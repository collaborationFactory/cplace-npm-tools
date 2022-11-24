/**
 * General update-repos command
 */
import * as Promise from 'bluebird';
import * as path from 'path';
import {fs} from '../../p/fs';
import {AbstractReposCommand} from './AbstractReposCommand';
import {Repository} from '../../git';
import {Global} from '../../Global';
import {promiseAllSettledParallel} from '../../promiseAllSettled';
import {IRepoStatus} from './models';

export class CloneRepos extends AbstractReposCommand {

    public execute(): Promise<void> {
        const promises = Object
            .keys(this.parentRepos)
            .filter((repoName) => this.checkRepoMissing(this.rootDir, repoName))
            .map((repoName) => {
                Global.isVerbose() && console.log('cloning repository', repoName);
                const repoProperties = this.parentRepos[repoName];
                const toPath = path.resolve(this.rootDir, '..', repoName);
                return this.handleRepo(toPath, repoName, repoProperties, this.depth);
            });

        return promiseAllSettledParallel(promises)
            .then(
                () => {
                    // pass
                },
                (err) => Promise.reject('failed to clone repos: ' + err)
            );
    }

    private handleRepo(toPath: string, repoName: string, repoProperties: IRepoStatus, depth: number): Promise<void> {
        return Repository.getLatestTagOfReleaseBranch(repoName, repoProperties)
            .then((latestTag) => {
                repoProperties.latestTagForRelease = latestTag;
                return Repository.clone(toPath, repoProperties, depth);
            })
            .catch((err) => Promise.reject('failed to clone repos: ' + err));
    }

    private checkRepoMissing(rootDir: string, repoName: string): boolean {
        const pathToRepo = path.resolve(rootDir, '..', repoName);
        const exists = fs.existsSync(pathToRepo);
        Global.isVerbose() && console.log('repository', repoName, 'already exists:', exists);
        return !exists;
    }
}
