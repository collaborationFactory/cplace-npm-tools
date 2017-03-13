/**
 * General update-repos command
 */
import * as Promise from 'bluebird';
import * as path from 'path';
import {fs} from '../../p/fs';
import {AbstractReposCommand} from './AbstractReposCommand';
import {Repository} from '../../git';
import {Global} from '../../Global';

export class CloneRepos extends AbstractReposCommand {

    public execute(): Promise<void> {
        const promises = Object
            .keys(this.parentRepos)
            .filter(this.checkRepoMissing)
            .map((repoName) => {
                Global.isVerbose() && console.log('cloning repository', repoName);
                const repoProperties = this.parentRepos[repoName];
                const toPath = path.resolve('..', repoName);
                return Repository.clone(toPath, repoProperties.url, repoProperties.branch);
            });

        return Promise
            .all(promises)
            .then(
                () => {
                    // pass
                },
                (err) => Promise.reject('failed to clone repos: ' + err)
            );
    }

    private checkRepoMissing(repoName: string): boolean {
        const pathToRepo = path.resolve('..', repoName);
        const exists = fs.existsSync(pathToRepo);
        Global.isVerbose() && console.log('repository', repoName, 'already exists:', exists);
        return !exists;
    }
}
