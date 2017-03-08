/**
 * General update-repos command
 */
import * as Promise from 'bluebird';
import {Git} from '../../git';
import {AbstractReposCommand} from '../AbstractReposCommand';
import {ICommandParameters} from '../models';

const FLAG_NO_FETCH = 'nofetch';

export class UpdateRepos extends AbstractReposCommand {

    public noFetch: boolean;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        super.prepareAndMayExecute(params);
        this.noFetch = params[FLAG_NO_FETCH] as boolean;
        if (this.debug && this.noFetch) {
            console.log('running in nofetch mode');
        }
        return true;
    }

    public execute(): Promise<void> {
        return new Promise<null>((resolve, reject) => {
            Object.keys(this.obj).forEach(async (repoName) => {
                if (this.debug) {
                    console.log('repo', repoName);
                }
                const repoProperties = this.obj[repoName];
                if (this.debug) {
                    console.log('repoProperties', repoProperties);
                }
                const commit = repoProperties.commit;
                if (this.debug) {
                    console.log('commit', commit);
                }
                const branch = repoProperties.branch;
                if (this.debug) {
                    console.log('branch', branch);
                }

                const repoGit = Git.repoGit(repoName);

                try {
                    await Git.fetch(repoGit, repoName, this.noFetch, this.debug);
                    await Git.status(repoGit, repoName, repoProperties, this.force, this.debug);
                    await Git.checkoutBranch(repoGit, repoName, branch, this.debug);
                    await Git.checkoutCommit(repoGit, repoName, commit, this.debug);
                    await Git.resetHard(repoGit, repoName);
                } catch (e) {
                    throw new Error('an error occured: ' + e);
                }
            });

            resolve();
        });
    }
}
