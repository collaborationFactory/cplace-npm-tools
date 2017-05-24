/**
 * General branches command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {Global} from '../../Global';
import * as simpleGit from 'simple-git';
import {Repository} from '../../git/Repository';
import {IGitRemoteBranchesAndCommits, IGitStatus} from '../../git/models';
import * as os from 'os';
import {fs} from '../../p/fs';

export class BranchesCommand implements ICommand {

    private static readonly FILE_NAME_BRANCHES_DOT: string = 'branches.dot';

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        return true;
    }

    public execute(): Promise<void> {
        Global.isVerbose() && console.log('running branches command in verbose mode');

        const repo = new Repository();
        const eol = os.EOL;

        let dotString = 'digraph G {' + eol;

        return repo.getRemoteBranchesAndCommits().then((result: IGitRemoteBranchesAndCommits[]) => {
            return Promise.all(result.map((branchAndCommit: IGitRemoteBranchesAndCommits) => {
                return repo.getRemoteBranchesContainingCommit(branchAndCommit.commit).then((branches: string[]) => {
                    const index = branches.indexOf(branchAndCommit.branch);
                    if (index > -1) {
                        branches.splice(index, 1);
                    }
                    if (branches.length > 0) {
                        Global.isVerbose() && console.log('branch ' + branchAndCommit.branch + ' is contained in these branches: ' + branches);
                        Global.isVerbose() && console.log('');
                        branches.forEach((b: string) => {
                            dotString += '    "' + branchAndCommit.branch + '" -> "' + b + '";' + eol;
                        });
                    }
                });
            })).then(() => {
                dotString += '}';
                console.log('dotString: ' + dotString);
            }).then(() => {
                return fs
                    .writeFileAsync(BranchesCommand.FILE_NAME_BRANCHES_DOT, dotString, 'utf8')
                    .then(() => {
                        console.log(`>> dot file has successfully been graphgenerated in ${BranchesCommand.FILE_NAME_BRANCHES_DOT}`);
                    });
            });
        });
    }
}
