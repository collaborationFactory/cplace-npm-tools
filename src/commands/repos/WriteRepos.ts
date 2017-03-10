/**
 * General write-repos-state command
 */
import * as Promise from 'bluebird';
import * as simpleGit from 'simple-git';
import {fs} from '../../p/fs';
import {Git} from '../../git';
import {Global} from '../../Global';
import {AbstractReposCommand} from './AbstractReposCommand';
import {IReposDescriptor, IRepoStatus} from './models';
import {IGitStatus} from '../../git/models';

export class WriteRepos extends AbstractReposCommand {

    public execute(): Promise<void> {
        const promises = Object
            .keys(this.parentRepos)
            .map((repoName) => {
                Global.isVerbose() && console.log('repo', repoName);
                const repoProperties = this.parentRepos[repoName];
                Global.isVerbose() && console.log('repoProperties', repoProperties);

                const repoGit = Git.forRepo(`../${repoName}`);
                return Git
                    .status(repoGit)
                    .then((status) => this.checkRepoClean(repoName, status))
                    .then((status) => this.mapStatus(repoName, repoGit, status))
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
                const newParentReposContent = JSON.stringify(newParentRepos, null, 2).replace(/[\n\r]/g, '\n');
                Global.isVerbose() && console.log('new repo description', newParentReposContent);

                return fs
                    .writeFileAsync(AbstractReposCommand.PARENT_REPOS_FILE_NAME, newParentReposContent, 'utf8')
                    .then(() => {
                        this.parentRepos = newParentRepos;
                    });
            });
    }

    private mapStatus(repoName: string, repoGit: simpleGit.Git, status: IGitStatus): Promise<IRepoStatus> {
        return Git
            .currentCommit(repoGit)
            .then((commit) => {
                const current = this.parentRepos[repoName];
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
