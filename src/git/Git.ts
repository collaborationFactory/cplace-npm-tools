/**
 * Git functions
 */
import * as simpleGit from 'simple-git';
import {HandlerFunction} from 'simple-git';

declare module 'simple-git' {
    /* tslint:disable */
    interface Git {
        revparse(args: string[], handlerFn: HandlerFunction): Git;
    }
    /* tslint:enable */
}

const git = simpleGit();

export function log(fromHash?: string, toHash?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        git.log(
            {
                from: fromHash,
                to: toHash
            },
            (err, data: string) => {
                err ? reject(err) : resolve(data);
            }
        );
    });
}

export function commitExists(hash: string): Promise<null> {
    return new Promise((resolve, reject) => {
        git.revparse(['-q', '--verify', `${hash}^{commit}`], (err, data) => {
            err || !data ? reject(err) : resolve();
        });
    });
}
