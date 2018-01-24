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
        const repoNames = Object.keys(this.parentRepos);
        return new Promise<void>((resolve, reject) => {
            const handleNext = (i: number) => {
                if (i === repoNames.length) {
                    resolve();
                    return;
                }
                const repoName = repoNames[i];
                this.handleRepo(repoName).then(
                    () => handleNext(i + 1),
                    (err) => {
                        Global.isVerbose() && console.error('failed to update repos:', err);
                        reject(err);
                    }
                );
            };
            handleNext(0);
        });
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        this.noFetch = params[UpdateRepos.PARAMETER_NO_FETCH] as boolean;
        if (this.noFetch) {
            Global.isVerbose() && console.log('running in nofetch mode');
        }
        return true;
    }

    private handleRepo(repoName: string): Promise<void> {
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
            .then(() => repo.resetHard())
            .then(() => {
                if (commit) {
                    return repo.checkoutCommit(commit);
                } else {
                    return repo.pullOnlyFastForward();
                }
            })
            .then(() => {
                Global.isVerbose() && console.log('successfully updated', repoName);
            });
    }
}
