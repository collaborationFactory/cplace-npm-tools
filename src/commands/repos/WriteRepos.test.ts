import {IReposDescriptor, IRepoStatus} from './models';
import * as fs from 'fs';
import * as path from 'path';
import {withTempDirectory} from '../../test/helpers/directories';
import * as child_process from 'child_process';
import {WriteRepos} from './WriteRepos';
import {enforceNewline} from '../../util';
import {ICommandParameters} from '../models';

const REPO_NAMES = ['main', 'test-1', 'test-2'];
describe('writing the parent repos json', () => {

    const assertRaw = async (parentRepos: string) => {
        debugLog(parentRepos);
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

        await evaluate(testUsingTags, assertRaw);
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
            debugLog(parentRepos);
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

        await evaluate(testUsingTags, assertUsingCommits);
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
            debugLog(parentRepos);
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

        await evaluate(testUsingTags, assertUsingTags);
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

        await evaluate(testUsingTags, assertRaw);
    });
});

interface ILocalRepoData {
    name: string;
    url: string;
}

const debug = false;

// tslint:disable-next-line:no-any
function debugLog(message?: any, ...args: any[]): void {
    if (debug) {
        console.log(message, ...args);
    }
}

async function evaluate(testCase: (rootDir: string) => Promise<void>, assertion: (parentRepos: string) => Promise<void>): Promise<void> {
    return withTempDirectory('freeze-parent-repos', createRemoteRepos, testCase, assertion);
}

const createRemoteRepos = async (dir: string, testCase: (rootDir: string) => Promise<void>, assertion: (parentRepos: string) => Promise<void>) => {
    const remotePath = path.join(dir, 'remote');
    fs.mkdirSync(remotePath);
    const repoFolders = createRepositories(REPO_NAMES, remotePath);

    if (!Array.isArray(repoFolders)) {
        throw new Error('Failed to create test setup!');
    }

    const workingDir = path.join(dir, 'working');
    fs.mkdirSync(workingDir);

    const repos: IReposDescriptor = {};
    repoFolders.forEach((localRepoData) => {
        repos[localRepoData.name] = {
            url: `file://${localRepoData.url}/.git`,
            branch: 'master'
        };
    });

    const rootDir = path.join(workingDir, 'root');
    fs.mkdirSync(rootDir);
    initRepo(rootDir);
    writeParentRepos(rootDir, repos);
    updateRepo(rootDir);
    checkoutBranch(rootDir, 'release/22.2');
    repoFolders.forEach((localRepoData) => {
        repos[localRepoData.name] = {
            url: `file://${localRepoData.url}/.git`,
            branch: 'release/22.2'
        };
    });
    writeParentRepos(rootDir, repos);
    updateRepo(rootDir);

    for (const localRepoData of repoFolders) {
        fs.writeFileSync(`${localRepoData.url}/test.txt`, 'test', 'utf8');
        updateRepo(localRepoData.url);
        checkoutBranch(localRepoData.url, 'release/22.2');

        fs.writeFileSync(`${localRepoData.url}/test_1.txt`, 'test', 'utf8');
        updateRepo(localRepoData.url);
        tagRepo(localRepoData.url, 'version/22.2.0');

        const repoDir = path.join(workingDir, localRepoData.name);
        fs.mkdirSync(repoDir);
        cloneRepo(workingDir, repos[localRepoData.name].url);
        checkoutBranch(path.join(workingDir, localRepoData.name), 'release/22.2');
    }

    const initialParentRepos = fs.readFileSync(path.join(rootDir, 'parent-repos.json'));
    debugLog(`initial\n${initialParentRepos.toString()}`);

    try {
        await testCase(rootDir);
    } catch (e) {
        debugLog('Unexpected error during test evaluation!', e);
        throw e;
    }

    const result = fs.readFileSync(path.join(rootDir, 'parent-repos.json'));
    await assertion(result.toString());
};

function writeParentRepos(rootDir: string, newParentRepos: IReposDescriptor): void {
    const newParentReposContent = enforceNewline(JSON.stringify(newParentRepos, null, 2));
    const parentRepos = path.join(rootDir, 'parent-repos.json');
    fs.writeFileSync(parentRepos, newParentReposContent, 'utf8');
}

function execSync(pathToRepo: string, command: string): void {
    debugLog(child_process.execSync(
        command,
        {
            cwd: pathToRepo,
            shell: 'bash'
        }
    ).toString());
}

function createRepositories(repos: string[], rootDir: string): ILocalRepoData[] {
    const command = `git init && git commit --no-gpg-sign --allow-empty -m "empty" `;
    const data: ILocalRepoData[] = [];
    for (const repo of repos) {
        const pathToRepo = path.join(rootDir, repo);
        fs.mkdirSync(pathToRepo);
        debugLog(`init repo ${repo} in ${pathToRepo}`);
        execSync(pathToRepo, command);
        data.push({
                      name: repo,
                      url: pathToRepo
                  });
    }
    return data;
}

function initRepo(pathToRepo: string): void {
    const command = `git init && git commit --no-gpg-sign --allow-empty -m "empty" `;
    debugLog(`init repo in ${pathToRepo}`);
    execSync(pathToRepo, command);
}

function checkoutBranch(pathToRepo: string, branch: string): void {
    const command = `git checkout -B "${branch}"`;
    debugLog(`checkout branch in ${pathToRepo}: ${command}`);
    execSync(pathToRepo, command);
}

function updateRepo(pathToRepo: string): void {
    const command = `git status && git add '.' && git commit --no-gpg-sign --allow-empty -m "empty"`;
    debugLog(`update repo in ${pathToRepo}`);
    execSync(pathToRepo, command);
}

function tagRepo(pathToRepo: string, version: string): void {
    const command = `git tag -a "${version}" -m "empty"`;
    debugLog(`tag repo in ${pathToRepo} to ${version}`);
    execSync(pathToRepo, command);
}

function cloneRepo(pathToRepo: string, repoUrl: string): void {
    const command = `git clone ${repoUrl}`;
    debugLog(`cloning repo ${repoUrl} in ${pathToRepo}`);
    execSync(pathToRepo, command);
}
