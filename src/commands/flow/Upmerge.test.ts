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
    createFileAndCommit('fix.txt', 'a fix in release 5.17');
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

    const upmerge1819Pattern = new RegExp(`upmerge-[A-Za-z0-9]*\\/release\\/5.18' into upmerge-[A-Za-z0-9]*\\/release\\/5.19`, 'gmi');
    const upmerge1718Pattern = new RegExp(`upmerge-[A-Za-z0-9]*\\/release\\/5.17' into upmerge-[A-Za-z0-9]*\\/release\\/5.18`, 'gmi');

    console.log(execSync(`git log origin/${release17}`).toString());
    const log = simpleGitClient.log((err) => {
        if (err) {
            console.log(err);
        } else {
            console.log(err);
        }
    });
//     Merge branch 'upmerge-yMQHvE/release/5.18' into upmerge-yMQHvE/release/5.19
//     Merge branch 'upmerge-yMQHvE/release/5.17' into upmerge-yMQHvE/release/5.18

    console.log(log);
});
