/**
 * General branches command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {Global} from '../../Global';
import * as simpleGit from 'simple-git';
import {Repository} from '../../git/Repository';
import {IGitRemoteBranchesAndCommits, IGitStatus} from '../../git/models';

export class BranchesCommand implements ICommand {

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        return true;
    }

    public execute(): Promise<void> {
        Global.isVerbose() && console.log('running branches command in verbose mode');

        return new Promise<void>((resolve, reject) => {
            const repo = new Repository();
            repo.getRemoteBranchesAndCommits().then((result: IGitRemoteBranchesAndCommits[]) => {
                console.log('result of getRemoteBranches: ', result);
                result.forEach((branchAndCommit: IGitRemoteBranchesAndCommits) => {
                    repo.getRemoteBranchesContainingCommit(branchAndCommit.commit).then((branches: string[]) => {
                        console.log('branch ' + branchAndCommit.branch + ' is contained in these branches: ' + branches);
                    });
                });
            });

            resolve();
        });

        // return new Promise<void>((resolve, reject) => {
        //
        //     // /* tslint:disable:no-any*/
        //     // git.branch([], (err, branches: any) => {
        //     //     if (err) {
        //     //         console.log('an error occured');
        //     //         reject(err);
        //     //     } else {
        //     //         Global.isVerbose() && console.log('branches', branches);
        //     //         Global.isVerbose() && console.log('branches.branches', branches.branches);
        //     //         resolve(branches);
        //     //     }
        //     // });
        //     //
        //     // resolve();
        // });
    }
}
