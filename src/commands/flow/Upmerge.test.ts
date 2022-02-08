import * as simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import {execSync} from 'child_process';
import {Upmerge} from './Upmerge';
import {Global} from '../../Global';
import {Repository} from '../../git';

const mainRepoName = 'main';
const originRepoName = 'origin';
const basePath = path.join(process.cwd(), 'testsetup');
const mainRepoPath = path.join(basePath, mainRepoName);
const originRepoPath = path.join(basePath, originRepoName);
const release17 = 'release/5.17';
const release18 = 'release/5.18';
const release19 = 'release/5.19';
let simpleGitClient: simpleGit.Git = null;

function removeTestFolder(): void {
    if (fs.existsSync(path.join(basePath))) {
        console.log('removing path', path.join(basePath));
        rimraf.sync(path.join(basePath));
    }
}

function createFileAndCommit(fileName: string, content: string): void {
    fileName = fileName.replace('/', '-');
    fs.writeFileSync(fileName, content);
    console.log(execSync(`git add ${fileName} && git commit -m "this is a commit for ${fileName}"`).toString());
}

function createBranchCommitFilePush(release: string): void {
    console.log(execSync(`git checkout -b ${release}`).toString());
    createFileAndCommit(release + '.txt', 'this is a file in ' + release);
    console.log(execSync(`git push origin ${release}`).toString());
}

beforeEach(() => {
               jest.setTimeout(60000);
               try {
                   removeTestFolder();
                   // init origin repo
                   fs.mkdirSync(path.join(originRepoPath), {recursive: true});
                   process.chdir(originRepoPath);
                   console.log(execSync('git init --bare').toString());
                   // init main repo and fetch
                   fs.mkdirSync(path.join(mainRepoPath), {recursive: true});
                   process.chdir(mainRepoPath);
                   console.log(execSync('git init').toString());
                   console.log(execSync(`git remote add origin ${originRepoPath}`).toString());
                   console.log(execSync(`git fetch`).toString());
                   createFileAndCommit('initial-content.txt', 'initial-content');
                   createBranchCommitFilePush(release17);
                   createBranchCommitFilePush(release18);
                   createBranchCommitFilePush(release19);
                   simpleGitClient = simpleGit(process.cwd());
               } catch (e) {
                   console.log(e);
               }
           }
);

afterAll(() => {
    removeTestFolder();
});

test('a fix can be upmerged', async () => {
    jest.spyOn(Global, 'isVerbose').mockReturnValue(true);
    console.log(execSync(`git checkout ${release18}`).toString());
    console.log(execSync(`git checkout ${release19}`).toString());

    // Add a fix in 5.17
    console.log(execSync(`git checkout ${release17}`).toString());
    createFileAndCommit('fixInRelease5-17.txt', 'a fix in release 5.17');
    console.log(execSync(`git push origin ${release17}`).toString());

    // Upmerge
    const upmerge: Upmerge = new Upmerge();
    upmerge.prepareAndMayExecute(
        {
            push: true,
            release: '5.17',
            showFiles: true,
            remote: 'origin'
        });
    await upmerge.execute();

    console.log(execSync(`git checkout ${release17}`).toString());
    console.log(execSync(`git pull origin ${release17}`).toString());
    const log17 = execSync(`git log ${release17}`).toString();
    expect(log17.includes('this is a commit for fixInRelease5-17.txt')).toBe(true);

    const upmerge1718Pattern = new RegExp(`upmerge-[A-Za-z0-9]*\\/release\\/5.17' into upmerge-[A-Za-z0-9]*\\/release\\/5.18`, 'gmi');
    const upmerge1819Pattern = new RegExp(`upmerge-[A-Za-z0-9]*\\/release\\/5.18' into upmerge-[A-Za-z0-9]*\\/release\\/5.19`, 'gmi');

    console.log(execSync(`git checkout ${release18}`).toString());
    console.log(execSync(`git pull origin ${release18}`).toString());
    const log18 = execSync(`git log ${release18}`).toString();
    expect(log18.match(upmerge1718Pattern).length).toBe(1);
    expect(log18.match(upmerge1819Pattern)).toBe(null);

    console.log(execSync(`git checkout ${release19}`).toString());
    console.log(execSync(`git pull origin ${release19}`).toString());
    const log19 = execSync(`git log ${release19}`).toString();
    expect(log19.match(upmerge1718Pattern).length).toBe(1);
    expect(log19.match(upmerge1819Pattern).length).toBe(1);
});

test('in a nx workspace CHANGELOG.md conflicts can be resolved', async () => {
    jest.spyOn(Global, 'isVerbose').mockReturnValue(true);
    console.log(execSync(`git checkout ${release18}`).toString());
    console.log(execSync(`git checkout ${release19}`).toString());

    // Add a fix and updated changelog 5.17
    console.log(execSync(`git checkout ${release17}`).toString());
    createFileAndCommit('fixInRelease5-17.txt', 'a fix in release 5.17');
    const changelog17 = '# Changelog\n' +
        '\n' +
        'This file was generated using [@jscutlery/semver](https://github.com/jscutlery/semver).\n' +
        '\n' +
        '## [0.40.1](https://github.com/collaborationFactory/cplace-frontend-applications/compare/cf-project-planning-0.40.0...cf-project-planning-0.40.1) (2022-02-04)\n' +
        '\n' +
        '\n' +
        '\n' +
        '# [0.40.0](https://github.com/collaborationFactory/cplace-frontend-applications/compare/cf-project-planning-0.39.0...cf-project-planning-0.40.0) (2021-12-15)\n' +
        '\n' +
        '\n' +
        '\n' +
        '# [0.40.0](https://github.com/collaborationFactory/cplace-frontend-applications/compare/cf-project-planning-0.39.0...cf-project-planning-0.40.0) (2021-12-15)\n' +
        '\n';
    createFileAndCommit('changelog.md', changelog17);
    console.log(execSync(`git push origin ${release17}`).toString());

    // Add updated changelog 5.18




    // Upmerge
    const upmerge: Upmerge = new Upmerge();
    upmerge.prepareAndMayExecute(
        {
            push: true,
            release: '5.17',
            showFiles: true,
            remote: 'origin'
        });
    await upmerge.execute();

    console.log(execSync(`git checkout ${release17}`).toString());
    console.log(execSync(`git pull origin ${release17}`).toString());
    const log17 = execSync(`git log ${release17}`).toString();
    expect(log17.includes('this is a commit for fixInRelease5-17.txt')).toBe(true);

    const upmerge1718Pattern = new RegExp(`upmerge-[A-Za-z0-9]*\\/release\\/5.17' into upmerge-[A-Za-z0-9]*\\/release\\/5.18`, 'gmi');
    const upmerge1819Pattern = new RegExp(`upmerge-[A-Za-z0-9]*\\/release\\/5.18' into upmerge-[A-Za-z0-9]*\\/release\\/5.19`, 'gmi');

    console.log(execSync(`git checkout ${release18}`).toString());
    console.log(execSync(`git pull origin ${release18}`).toString());
    const log18 = execSync(`git log ${release18}`).toString();
    expect(log18.match(upmerge1718Pattern).length).toBe(1);
    expect(log18.match(upmerge1819Pattern)).toBe(null);

    console.log(execSync(`git checkout ${release19}`).toString());
    console.log(execSync(`git pull origin ${release19}`).toString());
    const log19 = execSync(`git log ${release19}`).toString();
    expect(log19.match(upmerge1718Pattern).length).toBe(1);
    expect(log19.match(upmerge1819Pattern).length).toBe(1);
});
