import {IReposDescriptor} from '../../commands/repos/models';
import {withTempDirectory} from './directories';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

export function withRepositories(repos: IReposDescriptor,
                                 func: (rootDir: string) => Promise<void>): Promise<void> {
    return withTempDirectory(
        'repos',
        async (dir) => {
            await createRepositories(repos, dir);
            await func(dir);
        }
    );
}

function createRepositories(repos: IReposDescriptor, rootDir: string): Promise<void[]> {
    // tslint:disable-next-line:prefer-array-literal
    const promises: Array<Promise<void>> = Object.keys(repos).map((repoName) => {
        const pathToRepo = path.join(rootDir, repoName);
        const descriptor = repos[repoName];

        fs.mkdirSync(pathToRepo);

        let command = `git init && git remote add origin "${descriptor.url}" && git commit --allow-empty -m "empty" `;
        if (descriptor.branch !== 'master') {
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
    return Promise.all(promises);
}
