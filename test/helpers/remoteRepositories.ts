import * as fs from 'fs';
import * as path from 'path';
import {withTempDirectory} from './directories';
import * as child_process from 'child_process';
import {enforceNewline} from '../../src/util';
import {IReposDescriptor} from '../../src/commands/repos/models';

export function testWith(testSetupData: ITestSetupData): ITestRun {
    return new EvaluateWithRemoteRepos(testSetupData);
}

export function catParentReposJson(rootDir: string): IReposDescriptor {
    return JSON.parse(fs.readFileSync(path.join(rootDir, 'parent-repos.json')).toString());
}

export function writeParentReposJson(rootDir: string, parentRepos: IReposDescriptor): void {
    fs.writeFileSync(path.join(rootDir, 'parent-repos.json'), JSON.stringify(parentRepos, null, 2), 'utf8');
}

export function writeAndCommitParentRepos(checkoutParentRepos: IReposDescriptor, rootDir: string): void {
    writeParentReposJson(rootDir, checkoutParentRepos);
    try {
        child_process.execSync(
            'git commit -a -m "updates parent repos" && git push',
            {
                cwd: rootDir,
                shell: 'bash'
            }
        );
    } catch (e) {
        console.log(`Git commit or push failed in ${rootDir} due to:
        ${e.status}
        ${e.message}
        ${e.stderr?.toString()}
        ${e.stdout?.toString()}
         `);
        throw e;
    }
}

export function gitDescribe(repoFolder: string): string {
    let tagDescription: Buffer;
    try {
        tagDescription = child_process.execSync(
            'git describe --long',
            {
                cwd: repoFolder,
                shell: 'bash'
            }
        );
    } catch (e) {
        console.log(`Git describe failed in ${repoFolder} due to:
        ${e.status}
        ${e.message}
        ${e.stderr?.toString()}
        ${e.stdout?.toString()}
    `);
        throw e;
    }
    return tagDescription.toString();
}

export function assertThatTheParentReposAreCheckedOutToTheExpectedTags(tags: { main?: string; test_1?: string; test_2?: string }, rootDir: string): void {
    let failed = false;
    Object.keys(tags).forEach((repo) => {
        const repoFolder = path.resolve(rootDir, '..', repo);
        const tagDescription = gitDescribe(repoFolder);
        const regex = new RegExp(`${tags[repo]}-0-\\w+\\n$`);
        try {
            expect(regex.test(tagDescription)).toBeTruthy();
        } catch (e) {
            failed = true;
            console.log(`Failed for ${repo}: expected tag = ${tags[repo]}, got description ${tagDescription}`);
        }

        expect(failed).toBeFalsy();
    });
}

export function assertAllFoldersArePresent(testResult: string): void {
    const files = fs.readdirSync(path.resolve(testResult, '..'));
    expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);
}

export function assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder: string, branch: string): void {
    const gitUpdateCommand = `git remote update`;
    const gitDiffCommand = `git diff --exit-code origin/${branch}`;
    child_process.execSync(
        gitUpdateCommand,
        {
            cwd: repoFolder,
            shell: 'bash'
        }
    );
    try {
        child_process.execSync(
            gitDiffCommand,
            {
                cwd: repoFolder,
                shell: 'bash'
            }
        );
    } catch (e) {
        console.log(`Git diff failed due to:
        ${e.status}
        ${e.message}
        ${e.stderr?.toString()}
        ${e.stdout?.toString()}
    `);
        throw e;
    }
}

export const assertVoid = (testResult: boolean): Promise<void> => {
    if (!testResult === true) {
        throw new Error('This test is expected to fail and should not reach the assertion!');
    }
    return;
};

export interface ITestRun {
    withBranchUnderTest(branchUnderTest: string): ITestRun;

    withBranchesToCheckout(branchesToCheckout: string[]): ITestRun;

    withDebug(debug: boolean): ITestRun;

    evaluateWithFolders<T>(testCase: (rootDir: string) => Promise<T>, assertion: (testResult: T) => Promise<void>): Promise<void>;

    evaluateWithRemoteRepos<T>(testCase: (rootDir: string) => Promise<T>, assertion: (testResult: T) => Promise<void>): Promise<void>;

    evaluateWithRemoteAndLocalRepos<T>(testCase: (rootDir: string) => Promise<T>, assertion: (testResult: T) => Promise<void>): Promise<void>;
}

export interface ITestSetupData {
    rootRepo: IRepoReleaseTestSetupData;

    [repoName: string]: IRepoReleaseTestSetupData;
}

export interface IBranchReleaseTestSetupData {
    branchName: string;
    releases?: string[];
}

export interface IRepoReleaseTestSetupData {
    repoName: string;
    releaseBranches: IBranchReleaseTestSetupData[];
}

export interface ILocalRepoData {
    name: string;
    url: string;
}

export const ROOT_REPO = 'rootRepo';

export const basicTestSetupData: ITestSetupData = {
    rootRepo: {
        repoName: ROOT_REPO,
        releaseBranches: [{branchName: 'release/22.2', releases: ['version/22.2.0']}]
    },
    main: {
        repoName: 'main',
        releaseBranches: [{branchName: 'release/22.2', releases: ['version/22.2.0']}]
    },
    test_1: {
        repoName: 'test_1',
        releaseBranches: [{branchName: 'release/22.2', releases: ['version/22.2.0']}]
    },
    test_2: {
        repoName: 'test_2',
        releaseBranches: [{branchName: 'release/22.2', releases: ['version/22.2.0']}]
    }
};

export const multiBranchTestSetupData: ITestSetupData = {
    rootRepo: {
        repoName: ROOT_REPO,
        releaseBranches: [
            {branchName: 'release/5.20', releases: []},
            {branchName: 'release/22.2', releases: ['version/22.2.0', 'version/22.2.1', 'version/22.2.2', 'version/22.2.3']},
            {branchName: 'release/22.3', releases: ['version/22.3.0', 'version/22.3.1', 'version/22.3.2', 'version/22.3.3', 'version/22.3.4']},
            {branchName: 'release/22.4', releases: ['version/22.4.0']}
        ]
    },
    main: {
        repoName: 'main',
        releaseBranches: [
            {branchName: 'release/5.20', releases: []},
            {branchName: 'release/22.2', releases: ['version/22.2.0', 'version/22.2.1']},
            {branchName: 'release/22.3', releases: ['version/22.3.0', 'version/22.3.1', 'version/22.3.2']},
            {branchName: 'release/22.4', releases: ['version/22.4.0']}
        ]
    },
    test_1: {
        repoName: 'test_1',
        releaseBranches: [
            {branchName: 'release/5.20', releases: []},
            {branchName: 'release/22.2', releases: ['version/22.2.0', 'version/22.2.1', 'version/22.2.2', 'version/22.2.3']},
            {branchName: 'release/22.3', releases: ['version/22.3.0', 'version/22.3.1', 'version/22.3.2', 'version/22.3.3', 'version/22.3.4']},
            {branchName: 'release/22.4', releases: ['version/22.4.0', 'version/22.4.1']}
        ]
    },
    test_2: {
        repoName: 'test_2',
        releaseBranches: [
            {branchName: 'release/5.20', releases: []},
            {branchName: 'release/22.2', releases: []},
            {branchName: 'release/22.3', releases: ['version/22.3.0', 'version/22.3.1', 'version/22.3.2']},
            {branchName: 'release/22.4', releases: ['version/22.4.0']},
            {branchName: 'customer/22.4-A-2', releases: ['custom/22.4.0-A-2']}
        ]
    }
};

class EvaluateWithRemoteRepos implements ITestRun {

    private debug: boolean = false;
    private readonly testSetupData: ITestSetupData;
    private branchUnderTest: string;
    private readonly branchesToCheckout: string[] = [];
    private readonly defaultBranch: string = 'master';

    constructor(testSetupData: ITestSetupData) {
        this.testSetupData = testSetupData;
    }

    private static writeParentRepos(rootDir: string, newParentRepos: IReposDescriptor): void {
        const filtered: IReposDescriptor = {};
        Object.keys(newParentRepos).forEach((name) => {
            if (name !== ROOT_REPO) {
                filtered[name] = newParentRepos[name];
            }
        });
        const newParentReposContent = enforceNewline(JSON.stringify(filtered, null, 2));
        const parentRepos = path.join(rootDir, 'parent-repos.json');
        fs.writeFileSync(parentRepos, newParentReposContent, 'utf8');
    }

    public withBranchUnderTest(branchUnderTest: string): ITestRun {
        this.branchUnderTest = branchUnderTest;
        return this;
    }

    public withBranchesToCheckout(branchesToCheckout: string[]): ITestRun {
        this.branchesToCheckout.push(...branchesToCheckout);
        return this;
    }

    public withDebug(debug: boolean): ITestRun {
        this.debug = debug;
        return this;
    }

    public evaluateWithFolders<T>(testCase: (rootDir: string) => Promise<T>, assertion: (testResult: T) => Promise<void>): Promise<void> {
        return withTempDirectory('freeze-parent-repos', this.testWithFolders, testCase, assertion).then(
            () => Promise.resolve(),
            (e) => {
                console.log('Failed assertion or error while evaluating a test!', e);
                // fail in case of an exception
                expect(e).toBeUndefined();
                Promise.reject(e);
            });
    }
    public evaluateWithRemoteRepos<T>(testCase: (rootDir: string, remoteRepos?: ILocalRepoData[]) => Promise<T>, assertion: (testResult: T) => Promise<void>): Promise<void> {
        return withTempDirectory('freeze-parent-repos', this.testWithRemoteRepos, testCase, assertion).then(
            () => Promise.resolve(),
            (e) => {
                console.log('Failed assertion or error while evaluating a test!', e);
                // fail in case of an exception
                expect(e).toBeUndefined();
                Promise.reject(e);
            });
    }

    public evaluateWithRemoteAndLocalRepos<T>(testCase: (rootDir: string) => Promise<T>, assertion: (testResult: T) => Promise<void>): Promise<void> {
        return withTempDirectory('freeze-parent-repos', this.testWithRemoteAndLocalRepos, testCase, assertion).then(
            () => Promise.resolve(),
            (e) => {
                console.log('Failed assertion or error while evaluating a test!', e);
                // fail in case of an exception
                expect(e).toBeUndefined();
                Promise.reject(e);
            });
    }

    private testWithFolders = async <T>(dir: string, testCase: (workingDir: string) => Promise<T>, assertion: (result: T) => Promise<void>): Promise<void> => {
        const rootDir = this.createWorkingCopyFolderStructureOnly(dir);
        try {
            const testResult = await testCase(rootDir);
            await assertion(testResult);
        } catch (e) {
            this.debugLog('Unexpected error during test evaluation!', e);
            throw e;
        }
    }

    private testWithRemoteRepos = async <T>(dir: string, testCase: (workingDir: string, remoteRepos?: ILocalRepoData[]) => Promise<T>, assertion: (result: T) => Promise<void>) => {
        const remoteRepos = this.createRemoteRepos(dir);
        const rootDir = this.createLocalRepos(dir, remoteRepos, false);
        try {
            const testResult = await testCase(rootDir, remoteRepos);
            await assertion(testResult);
        } catch (e) {
            this.debugLog('Unexpected error during test evaluation!', e);
            throw e;
        }
    }

    private testWithRemoteAndLocalRepos = async <T>(dir: string, testCase: (rootDir: string) => Promise<T>, assertion: (testResult: T) => Promise<void>) => {
        const remoteRepos = this.createRemoteRepos(dir);
        const rootDir = this.createLocalRepos(dir, remoteRepos, true);

        try {
            const testResult = await testCase(rootDir);
            await assertion(testResult);
        } catch (e) {
            this.debugLog('Unexpected error during test evaluation!', e);
            throw e;
        }
    }

    private createWorkingCopyFolderStructureOnly(dir: string): string {
        const workingDir = path.join(dir, 'working');
        fs.mkdirSync(workingDir);
        Object.keys(this.testSetupData).forEach((repoName) => {
            fs.mkdirSync(path.join(workingDir, repoName));
        });
        const repos: IReposDescriptor = {};
        Object.keys(this.testSetupData).forEach((repoName) => {
            repos[repoName] = {
                url: `git@cplace.test.de:${repoName}.git`,
                branch: this.branchUnderTest
            };
        });
        const rootDir = path.join(workingDir, ROOT_REPO);
        EvaluateWithRemoteRepos.writeParentRepos(rootDir, repos);
        return rootDir;
    }

    private createRemoteRepos(dir: string): ILocalRepoData[] {
        const remotePath = path.join(dir, 'remote');
        fs.mkdirSync(remotePath);
        const remoteRepos = this.createRepositories(Object.keys(this.testSetupData), remotePath);

        if (!Array.isArray(remoteRepos)) {
            throw new Error('Failed to create test setup!');
        }

        // set up remotes
        for (const remote of remoteRepos) {
            this.testSetupData[remote.name].releaseBranches.forEach((releaseBranch) => {
                this.debugLog(`setting up remote repository ${remote.name}`);
                this.branchOff(remote, releaseBranch.branchName);
                releaseBranch.releases.forEach((release) => this.createRelease(remote, release));
                this.commitSomeChanges(remote, 'latest_change.txt');
            });
            this.branchOff(remote, this.defaultBranch);
            this.commitSomeChanges(remote, 'latest_change.txt');
            this.cloneRepo(remotePath, remote.url, true);
            remote.url += '.git';
        }
        return remoteRepos;
    }

    private createLocalRepos(dir: string, remoteRepos: ILocalRepoData[], setupParentRepos: boolean): string {
        const remoteRootRepo = remoteRepos.find((repo) => repo.name === this.testSetupData.rootRepo.repoName);
        if (!remoteRootRepo) {
            // tslint:disable-next-line:max-line-length
            throw new Error(`Remote repo name in test setup data [${this.testSetupData.rootRepo.repoName}] does not match any name of created repo names [${Object.values(remoteRepos).map((r) => r.name).join(', ')}]!`);
        }

        // set up rootRepo
        const workingDir = path.join(dir, 'working');
        fs.mkdirSync(workingDir);

        const rootDir = path.join(workingDir, ROOT_REPO);
        this.cloneRepo(workingDir, remoteRootRepo.url);
        for (const branch of this.branchesToCheckout) {
            this.checkoutBranch(path.join(workingDir, ROOT_REPO), branch);
        }
        this.checkoutBranch(path.join(workingDir, ROOT_REPO), this.branchUnderTest);
        const repos = this.initParentRepos(rootDir, remoteRepos, this.branchUnderTest);

        if (setupParentRepos) {
            for (const remote of remoteRepos) {
                if (remote.name !== ROOT_REPO) {
                    this.cloneRepo(workingDir, repos[remote.name].url);
                    this.checkoutBranch(path.join(workingDir, remote.name), this.branchUnderTest);
                }
            }
        }

        if (this.debug) {
            this.debugLog(`initial parent repos`, fs.readFileSync(path.join(rootDir, 'parent-repos.json')).toString());
        }
        return rootDir;
    }

    private createRelease(localRepoData: ILocalRepoData, tag: string): void {
        this.commitSomeChanges(localRepoData, 'test_1.txt');
        this.tagRepo(localRepoData.url, tag);
    }

    private initParentRepos(rootDir: string, repoData: ILocalRepoData[], branchName: string): IReposDescriptor {
        const repos: IReposDescriptor = {};
        repoData.forEach((localRepoData) => {
            repos[localRepoData.name] = {
                url: `file://${localRepoData.url}`,
                branch: branchName
            };
        });
        EvaluateWithRemoteRepos.writeParentRepos(rootDir, repos);
        this.updateRepo(rootDir);
        return repos;
    }

    private branchOff(localRepoData: ILocalRepoData, releaseBranch: string): void {
        this.commitSomeChanges(localRepoData);
        this.checkoutBranch(localRepoData.url, releaseBranch, true);
    }

    private commitSomeChanges(localRepoData: ILocalRepoData, fileName: string = 'test.txt'): void {
        fs.writeFileSync(`${localRepoData.url}/${fileName}`, 'test', 'utf8');
        this.updateRepo(localRepoData.url);
    }

    // tslint:disable-next-line:no-any
    private debugLog(message?: any, ...args: any[]): void {
        if (this.debug) {
            console.log(message, ...args);
        }
    }

    private execSync(pathToRepo: string, command: string): void {
        try {
            this.debugLog(child_process.execSync(
                command,
                {
                    cwd: pathToRepo,
                    shell: 'bash'
                }
            ).toString());
        } catch (e) {
            console.log(`error when executing command [${command}] in [${pathToRepo}]!`, e);
            throw e;
        }
    }

    private createRepositories(repos: string[], rootDir: string): ILocalRepoData[] {
        const command = `git init && git commit --no-gpg-sign --allow-empty -m "empty" `;
        const data: ILocalRepoData[] = [];
        for (const repo of repos) {
            const pathToRepo = path.join(rootDir, repo);
            fs.mkdirSync(pathToRepo);
            this.debugLog(`init repo ${repo} in ${pathToRepo}`);
            this.execSync(pathToRepo, command);
            data.push({
                          name: repo,
                          url: pathToRepo
                      });
        }
        return data;
    }

    private checkoutBranch(pathToRepo: string, branch: string, createNew?: boolean): void {
        const command = `git checkout ${createNew ? '-B ' : ''}"${branch}"`;
        // const command = `git checkout -B "${branch}"`;
        this.debugLog(`checkout branch in ${pathToRepo}: ${command}`);
        this.execSync(pathToRepo, command);
    }

    private updateRepo(pathToRepo: string): void {
        const command = `git status && git add '.' && git commit --no-gpg-sign --allow-empty -m "empty"`;
        this.debugLog(`update repo in ${pathToRepo}`);
        this.execSync(pathToRepo, command);
    }

    private tagRepo(pathToRepo: string, version: string): void {
        const command = `git tag -a "${version}" -m "empty"`;
        this.debugLog(`tag repo in ${pathToRepo} to ${version}`);
        this.execSync(pathToRepo, command);
    }

    private cloneRepo(pathToRepo: string, repoUrl: string, bare?: boolean): void {
        const command = `git clone ${bare ? '--bare ' : ''}${repoUrl}`;
        this.debugLog(`cloning repo ${repoUrl} in ${pathToRepo}`);
        this.execSync(pathToRepo, command);
    }
}
