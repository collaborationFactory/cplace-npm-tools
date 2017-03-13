/**
 * General update-repos command
 */
import * as Promise from 'bluebird';
import {AbstractReposCommand} from './AbstractReposCommand';
import {ICommandParameters} from '../models';
import {Repository} from '../../git';
import {Global} from '../../Global';

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

                const repo = new Repository(`../${repoName}`);
                const p = this.noFetch ? Promise.resolve() : repo.fetch();
                return p
                    .then(() => repo.status())
                    .then((status) => this.checkRepoClean(repo, status))
                    .then(() => repo.checkoutBranch(branch))
                    .then(() => repo.checkoutCommit(commit))
                    .then(() => repo.resetHard())
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
