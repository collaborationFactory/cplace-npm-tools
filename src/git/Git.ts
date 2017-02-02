/**
 * Git functions
 */
import * as Promise from 'bluebird';
import * as simpleGit from 'simple-git';
import {HandlerFunction} from 'simple-git';
import {IGitLogSummary} from './models';

declare module 'simple-git' {
    /* tslint:disable */
    interface Git {
        revparse(args: string[], handlerFn: HandlerFunction): Git;
    }
    /* tslint:enable */
}

const git = simpleGit();

export function log(fromHash?: string, toHash?: string): Promise<IGitLogSummary> {
    return new Promise<IGitLogSummary>((resolve, reject) => {
        git.log(
            {
                from: fromHash,
                to: toHash
            },
            (err, data: IGitLogSummary) => {
                err ? reject(err) : resolve(data);
            }
        );
    });
}

export function commitExists(hash: string): Promise<void> {
    return new Promise<null>((resolve, reject) => {
        git.revparse(['-q', '--verify', `${hash}^{commit}`], (err, data) => {
            err || !data ? reject(err) : resolve();
        });
    });
}
