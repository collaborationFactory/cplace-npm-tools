/**
 * General update-repos command
 */
import * as Promise from 'bluebird';
import * as path from 'path';
import {fs} from '../../p/fs';
import {AbstractReposCommand} from './AbstractReposCommand';
import {Repository} from '../../git';
import {Global} from '../../Global';
import {promiseAllSettled} from '../../promiseAllSettled';
import {IRepoStatus} from './models';

export class CloneRepos extends AbstractReposCommand {

    public execute(): Promise<void> {
        const missingRepoNames = Object
            .keys(this.parentRepos)
            .filter((repoName) => this.checkRepoMissing(repoName, this.rootDir));

        return promiseAllSettled(
            {
                keys: missingRepoNames,
                promiseFactory: (repoName) => {
                    const repoProperties = this.parentRepos[repoName];
                    Global.isVerbose() && console.log(`[${repoName}]:`, 'starting to clone repository ', repoProperties.url);
                    const toPath = path.resolve(this.rootDir, '..', repoName);
                    return this.handleRepo(repoName, repoProperties, toPath, this.depth);
                },
                sequential: this.sequential
            })
            .catch((err) => Promise.reject(`[CloneRepos]: failed to clone repos: ${err}`));
    }

    private handleRepo(repoName: string, repoProperties: IRepoStatus, toPath: string, depth: number): Promise<void> {
        if (!repoProperties.tag && !repoProperties.useSnapshot) {
            return Repository.getLatestTagOfReleaseBranch(repoName, repoProperties, this.rootDir)
                .then((latestTag) => {
                    repoProperties.latestTagForRelease = latestTag;
                    return Repository.clone(repoName, repoProperties, this.rootDir, toPath, depth);
                })
                .catch((err) => Promise.reject(`[${repoName}]: failed to handle repo due to\n${err}`));
        } else {
            return Repository.clone(repoName, repoProperties, this.rootDir, toPath, depth);
        }
    }

    private checkRepoMissing(repoName: string, rootDir: string): boolean {
        const pathToRepo = path.resolve(rootDir, '..', repoName);
        const exists = fs.existsSync(pathToRepo);
        Global.isVerbose() && console.log(`[${repoName}]:`, 'repository already exists:', exists);
        return !exists;
    }
}
