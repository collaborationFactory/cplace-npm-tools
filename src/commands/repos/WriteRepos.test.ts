import {IReposDescriptor} from './models';
import * as fs from 'fs';
import * as path from 'path';
import {withTempDirectory} from '../../test/helpers/directories';
import * as child_process from 'child_process';
import {WriteRepos} from './WriteRepos';
import {enforceNewline} from '../../util';
import {ICommandParameters} from '../models';

const REPO_NAMES = ['main', 'test-1', 'test-2'];

test('Say hello world', async () => {
    console.log(`starting with all repos`);
    await createGitReposSetup().then(() => {
        console.log(`done with all repos`);
    });
});

interface ILocalRepoData {
    name: string;
    url: string;
}

async function createGitReposSetup(): Promise<void> {
    return withTempDirectory('freeze-parent-repos', createRemoteRepos);
}

const createRemoteRepos = async (dir: string) => {
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
    console.log(`initial\n${initialParentRepos.toString()}`);

    const wr = new WriteRepos();
    try {
        const params: ICommandParameters = {};
        const FREEZE = 'freeze';
        const USE_TAGS = 'useTags';
        params[FREEZE] = true;
        params[USE_TAGS] = true;

        wr.prepareAndMayExecute(params, rootDir);
        await wr.execute();
        const result = fs.readFileSync(path.join(rootDir, 'parent-repos.json'));
        console.log(result.toString());
    } catch (e) {
        console.log('Unexpected error!', e);
    }
};

function writeParentRepos(rootDir: string, newParentRepos: IReposDescriptor): void {
    const newParentReposContent = enforceNewline(JSON.stringify(newParentRepos, null, 2));
    const parentRepos = path.join(rootDir, 'parent-repos.json');
    fs.writeFileSync(parentRepos, newParentReposContent, 'utf8');
}

function execSync(pathToRepo: string, command: string): void {
    console.log(child_process.execSync(
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
        console.log(`init repo ${repo} in ${pathToRepo}`);
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
    console.log(`init repo in ${pathToRepo}`);
    execSync(pathToRepo, command);
}

function checkoutBranch(pathToRepo: string, branch: string): void {
    const command = `git checkout -B "${branch}"`;
    console.log(`checkout branch in ${pathToRepo}: ${command}`);
    execSync(pathToRepo, command);
}

function updateRepo(pathToRepo: string): void {
    const command = `git status && git add '.' && git commit --no-gpg-sign --allow-empty -m "empty"`;
    console.log(`update repo in ${pathToRepo}`);
    execSync(pathToRepo, command);
}

function tagRepo(pathToRepo: string, version: string): void {
    const command = `git tag -a "${version}" -m "empty"`;
    console.log(`tag repo in ${pathToRepo} to ${version}`);
    execSync(pathToRepo, command);
}

function cloneRepo(pathToRepo: string, repoUrl: string): void {
    const command = `git clone ${repoUrl}`;
    console.log(`cloning repo ${repoUrl} in ${pathToRepo}`);
    execSync(pathToRepo, command);
}
