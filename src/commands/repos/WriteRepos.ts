/**
 * General write-repos-state command
 */
import * as Promise from 'bluebird';
import {fs} from '../../p/fs';
import {IGitStatus, Repository} from '../../git';
import {Global} from '../../Global';
import {enforceNewline} from '../../util';
import {AbstractReposCommand} from './AbstractReposCommand';
import {IReposDescriptor, IRepoStatus} from './models';

export class WriteRepos extends AbstractReposCommand {

    public execute(): Promise<void> {
        const promises = Object
            .keys(this.parentRepos)
            .map((repoName) => {
                Global.isVerbose() && console.log('repo', repoName);
                const repoProperties = this.parentRepos[repoName];
                Global.isVerbose() && console.log('repoProperties', repoProperties);

                const repo = new Repository(`../${repoName}`);
                return repo
                    .status()
                    .then((status) => this.checkRepoClean(repo, status))
                    .then((status) => this.mapStatus(repo, status))
                    .then((status) => ({repoName, status}));
            });

        return Promise
            .all(promises)
            .then((states) => {
                const newParentRepos: IReposDescriptor = {};
                states.forEach((s) => {
                    if (!this.parentRepos[s.repoName].commit) {
                        delete s.status.commit;
                    }
                    newParentRepos[s.repoName] = s.status;
                });

                Global.isVerbose() && console.log('status and revparse successfully completed');
                const newParentReposContent = enforceNewline(JSON.stringify(newParentRepos, null, 2));
                Global.isVerbose() && console.log('new repo description', newParentReposContent);

                return fs
                    .writeFileAsync(AbstractReposCommand.PARENT_REPOS_FILE_NAME, newParentReposContent, 'utf8')
                    .then(() => {
                        this.parentRepos = newParentRepos;
                    });
            });
    }

    private mapStatus(repo: Repository, status: IGitStatus): Promise<IRepoStatus> {
        return repo
            .getCurrentCommitHash()
            .then((commit) => {
                const current = this.parentRepos[repo.repoName];
                const result: IRepoStatus = {
                    url: current.url,
                    branch: status.current
                };
                if (current.commit) {
                    result.commit = commit;
                }
                return result;
            });
    }
}
