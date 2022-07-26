import {IReposDescriptor, IRepoStatus} from './models';
import * as fs from 'fs';
import * as path from 'path';
import {withTempDirectory} from '../../test/helpers/directories';
import * as child_process from 'child_process';
import {WriteRepos} from './WriteRepos';
import {enforceNewline} from '../../util';
import {ICommandParameters} from '../models';

describe('writing the parent repos json', () => {

    const assertRaw = async (parentRepos: string) => {
        const parentReposJson = JSON.parse(parentRepos);
        expect(Object.keys(parentReposJson)).toHaveLength(3);
        Object.values(parentReposJson).map((status: IRepoStatus) => {
            expect(status.url).toBeDefined();
            expect(status.branch).toEqual('release/22.2');
            expect(status.description).toBeDefined();
            expect(status.commit).toBeUndefined();
            expect(status.tag).toBeUndefined();
            expect(status.tagMarker).toBeUndefined();
        });
    };

    test('raw', async () => {
        const testUsingTags = async (rootDir: string) => {
            const params: ICommandParameters = {};
            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
        };

        new EvaluateWithRemoteRepos(basicTestSetupData).evaluate(testUsingTags, assertRaw);
    });

    test('using commits', async () => {
        const testUsingTags = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
        };

        const assertUsingCommits = async (parentRepos: string) => {
            const parentReposJson = JSON.parse(parentRepos);
            expect(Object.keys(parentReposJson)).toHaveLength(3);
            Object.values(parentReposJson).map((status: IRepoStatus) => {
                expect(status.url).toBeDefined();
                expect(status.branch).toEqual('release/22.2');
                expect(status.description).toBeDefined();
                expect(status.commit).toBeDefined();
                expect(status.tag).toBeUndefined();
                expect(status.tagMarker).toBeUndefined();
            });
        };

        new EvaluateWithRemoteRepos(basicTestSetupData).evaluate(testUsingTags, assertUsingCommits);
    });

    test('using tags', async () => {
        const testUsingTags = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;
            params[WriteRepos.PARAMETER_USE_TAGS] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
        };

        const assertUsingTags = async (parentRepos: string) => {
            const parentReposJson = JSON.parse(parentRepos);
            expect(Object.keys(parentReposJson)).toHaveLength(3);
            Object.values(parentReposJson).map((status: IRepoStatus) => {
                expect(status.url).toBeDefined();
                expect(status.branch).toEqual('release/22.2');
                expect(status.description).toBeDefined();
                expect(status.commit).toBeUndefined();
                expect(status.tag).toEqual('version/22.2.0');
                expect(status.tagMarker).toEqual('version/22.2.0');
            });
        };

        new EvaluateWithRemoteRepos(basicTestSetupData).evaluate(testUsingTags, assertUsingTags);
    });

    test('un-freeze', async () => {
        const testUsingTags = async (rootDir: string) => {
            const prepareParams: ICommandParameters = {};
            prepareParams[WriteRepos.PARAMETER_FREEZE] = true;
            prepareParams[WriteRepos.PARAMETER_USE_TAGS] = true;

            const prepareWr = new WriteRepos();
            prepareWr.prepareAndMayExecute(prepareParams, rootDir);
            await prepareWr.execute();

            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;
            params[WriteRepos.PARAMETER_UN_FREEZE] = true;
            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
        };

        new EvaluateWithRemoteRepos(basicTestSetupData, true).evaluate(testUsingTags, assertRaw);
    });
});

interface ILocalRepoData {
    name: string;
    url: string;
}

interface ITestSetupData {
    rootRepo: IRepoReleaseTestSetupData;

    [repoName: string]: IRepoReleaseTestSetupData;
}

interface IBranchReleaseTestSetupData {
    branchName: string;
    releases?: string[];
}

interface IRepoReleaseTestSetupData {
    repoName: string;
    releaseBranches: IBranchReleaseTestSetupData[];
}

const basicTestSetupData: ITestSetupData = {
    rootRepo: {
        repoName: 'root',
        releaseBranches: [{branchName: 'release/22.2', releases: ['version/22.2.0']}]
    },
    main: {
        repoName: 'main',
        releaseBranches: [{branchName: 'release/22.2', releases: ['version/22.2.0']}]
    },
    test_1: {
        repoName: 'test-1',
        releaseBranches: [{branchName: 'release/22.2', releases: ['version/22.2.0']}]
    },
    test_2: {
        repoName: 'test-2', releaseBranches: [{branchName: 'release/22.2', releases: ['version/22.2.0']}]
    }
};

export class EvaluateWithRemoteRepos {

    private readonly debug: boolean;
    private readonly testSetupData: ITestSetupData;

    constructor(testSetupData: ITestSetupData, debug: boolean = false) {
        this.debug = debug;
        this.testSetupData = testSetupData;
    }

    private static writeParentRepos(rootDir: string, newParentRepos: IReposDescriptor): void {
        const newParentReposContent = enforceNewline(JSON.stringify(newParentRepos, null, 2));
        const parentRepos = path.join(rootDir, 'parent-repos.json');
        fs.writeFileSync(parentRepos, newParentReposContent, 'utf8');
    }

    public evaluate(testCase: (rootDir: string) => Promise<void>, assertion: (parentRepos: string) => Promise<void>): void {
        withTempDirectory('freeze-parent-repos', this.createRemoteRepos, testCase, assertion).then(
            () => Promise.resolve(),
            (e) => Promise.reject(e));
    }

    private createRemoteRepos = async (dir: string, testCase: (rootDir: string) => Promise<void>, assertion: (parentRepos: string) => Promise<void>) => {
        const remotePath = path.join(dir, 'remote');
        fs.mkdirSync(remotePath);
        const remoteRepos = this.createRepositories(Object.keys(this.testSetupData), remotePath);

        if (!Array.isArray(remoteRepos)) {
            throw new Error('Failed to create test setup!');
        }

        const workingDir = path.join(dir, 'working');
        fs.mkdirSync(workingDir);

        // set up remotes
        for (const remote of remoteRepos) {
            this.testSetupData[remote.name].releaseBranches.forEach((releaseBranch) => {
                this.debugLog(`setting up remote repository ${remote.name}`);
                this.branchOff(remote, releaseBranch.branchName);
                releaseBranch.releases.forEach((release) => this.createRelease(remote, release));
            });
        }

        // set up working copy
        const rootDir = remoteRepos.find((repo) => repo.name === this.testSetupData.rootRepo.repoName).url;
        const repos = this.initParentRepos(rootDir, remoteRepos, 'release/22.2');
        for (const remote of remoteRepos) {
            this.cloneRepo(workingDir, repos[remote.name].url);
            this.checkoutBranch(path.join(workingDir, remote.name), 'release/22.2');
        }

        if (this.debug) {
            this.debugLog(`initial parent repos`, fs.readFileSync(path.join(rootDir, 'parent-repos.json')));
        }

        try {
            await testCase(rootDir);
        } catch (e) {
            this.debugLog('Unexpected error during test evaluation!', e);
            throw e;
        }

        const result = fs.readFileSync(path.join(rootDir, 'parent-repos.json'));
        await assertion(result.toString());
    }

    private createRelease(localRepoData: ILocalRepoData, tag: string): void {
        this.commitSomeChanges(localRepoData, 'test_1.txt');
        this.tagRepo(localRepoData.url, tag);
    }

    private initParentRepos(rootDir: string, repoData: ILocalRepoData[], branchName: string): IReposDescriptor {
        const repos: IReposDescriptor = {};
        repoData.forEach((localRepoData) => {
            repos[localRepoData.name] = {
                url: `file://${localRepoData.url}/.git`,
                branch: branchName
            };
        });
        EvaluateWithRemoteRepos.writeParentRepos(rootDir, repos);
        this.updateRepo(rootDir);
        return repos;
    }

    private branchOff(localRepoData: ILocalRepoData, releaseBranch: string = 'release/22.2'): void {
        this.commitSomeChanges(localRepoData);
        this.checkoutBranch(localRepoData.url, releaseBranch);
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
        this.debugLog(child_process.execSync(
            command,
            {
                cwd: pathToRepo,
                shell: 'bash'
            }
        ).toString());
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

    private checkoutBranch(pathToRepo: string, branch: string): void {
        const command = `git checkout -B "${branch}"`;
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

    private cloneRepo(pathToRepo: string, repoUrl: string): void {
        const command = `git clone ${repoUrl}`;
        this.debugLog(`cloning repo ${repoUrl} in ${pathToRepo}`);
        this.execSync(pathToRepo, command);
    }
}