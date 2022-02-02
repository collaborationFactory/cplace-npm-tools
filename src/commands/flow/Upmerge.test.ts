import * as simpleGit from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import {execSync} from 'child_process';
import {Upmerge} from './Upmerge';
import {Global} from '../../Global';
import {Repository} from '../../git';

const mainRepoName = 'main';
const basePath = path.join(process.cwd(), 'testsetup');
const mainRepoPath = path.join(basePath, mainRepoName);
let simpleGitClient: simpleGit.Git = null;
const release17 = 'release/5.17';
const release18 = 'release/5.18';
const release19 = 'release/5.19';

// tslint:disable-next-line:typedef
function removeTestFolder() {
    if (fs.existsSync(path.join(basePath))) {
        console.log('removing path', path.join(basePath));
        rimraf.sync(path.join(basePath));
    }
}

// tslint:disable-next-line:typedef
function commitFile(fileName) {
    const fileNameRelease = fileName.replace('/', '-') + '.txt';
    fs.writeFileSync(fileNameRelease, 'this is a file in ' + fileName);
    console.log(execSync(`git add ${fileNameRelease} && git commit -m "this is ${fileName}"`).toString());
}

// tslint:disable-next-line:typedef
function createBranchAndCommitFile(release) {
    console.log(execSync(`git checkout -b ${release}`).toString());
    commitFile(release);
};

beforeEach(() => {
               jest.setTimeout(60000);
               removeTestFolder();
               fs.mkdirSync(path.join(basePath, mainRepoName), {recursive: true});
               process.chdir(mainRepoPath);
               console.log(execSync('git init').toString());
               simpleGitClient = simpleGit(process.cwd());
               commitFile('master-initial-content');
               createBranchAndCommitFile(release17);
               createBranchAndCommitFile(release18);
               createBranchAndCommitFile(release19);
           }
);

afterAll(() => {
    removeTestFolder();
});

test('a fix can be upmerged', async () => {
    jest.spyOn(Global, 'isVerbose').mockReturnValue(true);
    jest.spyOn(Repository.prototype, 'extractTrackingInfoFromLabel').mockImplementation(() => {
        return {tracking: 'tracking', ahead: 0, behind: 0, gone: false};
    });
    jest.spyOn(Repository.prototype, 'getBranchNameIfRemote')
        .mockImplementationOnce(() => 'origin/release/5.17')
        .mockImplementationOnce(() => 'origin/release/5.18')
        .mockImplementationOnce(() => 'origin/release/5.19');

    console.log(execSync(`git checkout ${release17}`).toString());
    const upmerge: Upmerge = new Upmerge();
    upmerge.prepareAndMayExecute(
        {
            push: false,
            release: '5.17',
            showFiles: true,
            remote: ''
        });
    await upmerge.execute();
});
