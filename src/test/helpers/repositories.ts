import {IReposDescriptor} from '../../commands/repos/models';
import {withTempDirectory} from './directories';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';
import {promiseAllSettledParallel} from '../../promiseAllSettled';

export function withRepositories(repos: IReposDescriptor,
                                 func: (rootDir: string) => Promise<void>): Promise<void> {
    return withTempDirectory(
        'repos-' + (Math.random() * 100).toFixed(0),
        async (dir) => {
            await createRepositories(repos, dir);
            await func(dir);
        }
    );
}

function createRepositories(repos: IReposDescriptor, rootDir: string): Promise<void[]> {
    const promises: Array<Promise<void>> = Object.keys(repos).map((repoName) => {
        const pathToRepo = path.join(rootDir, repoName);
        const descriptor = repos[repoName];

        fs.mkdirSync(pathToRepo);

        let command = `git init && git remote add origin "${descriptor.url}" && git commit --no-gpg-sign --allow-empty -m "empty" `;
        if (descriptor.branch !== 'master' && descriptor.branch !== 'main') {
            command = `${command} && git checkout -b "${descriptor.branch}"`;
        }

        return new Promise<void>((resolve, reject) => {
            child_process.exec(
                command,
                {
                    cwd: pathToRepo
                },
                (error, stdout) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
    });
    return promiseAllSettledParallel(promises);
}
