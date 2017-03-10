/**
 * General update-repos command
 */
import * as Promise from 'bluebird';
import {AbstractReposCommand} from './AbstractReposCommand';
import {ICommandParameters} from '../models';
import {Global} from '../../Global';
import {Git} from '../../git';

export class UpdateRepos extends AbstractReposCommand {
    private static readonly PARAMETER_NO_FETCH: string = 'nofetch';

    protected noFetch: boolean;

    public execute(): Promise<void> {
        const promises = Object
            .keys(this.parentRepos)
            .map((repoName) => {
                Global.isVerbose() && console.log('repo', repoName);

                const repoProperties = this.parentRepos[repoName];
                Global.isVerbose() && console.log('repoProperties', repoProperties);

                const commit = repoProperties.commit;
                Global.isVerbose() && console.log('commit', commit);

                const branch = repoProperties.branch;
                Global.isVerbose() && console.log('branch', branch);

                const repoGit = Git.forRepo(`../${repoName}`);
                const p = this.noFetch ? Promise.resolve() : Git.fetch(repoGit, repoName);
                return p
                    .then(() => Git.status(repoGit))
                    .then((status) => this.checkRepoClean(repoName, status))
                    .then(() => Git.checkoutBranch(repoGit, repoName, branch))
                    .then(() => Git.checkoutCommit(repoGit, repoName, commit))
                    .then(() => Git.resetHard(repoGit, repoName))
                    .then(() => {
                        Global.isVerbose() && console.log('successfully updated', repoName);
                    });
            });

        return Promise
            .all(promises)
            .then(
                () => {
                    // pass
                },
                (err) => Promise.reject('failed to update repos: ' + err)
            );
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        this.noFetch = params[UpdateRepos.PARAMETER_NO_FETCH] as boolean;
        if (this.noFetch) {
            Global.isVerbose() && console.log('running in nofetch mode');
        }
        return true;
    }
}
