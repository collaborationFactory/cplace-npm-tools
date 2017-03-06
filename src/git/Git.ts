/**
 * Git functions
 */
import * as Promise from 'bluebird';
import * as simpleGit from 'simple-git';
import {HandlerFunction} from 'simple-git';
import {IGitLogSummary, IRepoProperties} from './models';

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

export function repoGit(repoName: string): simpleGit.Git {
    return simpleGit('../' + repoName);
}

export function fetch(repoGit: simpleGit.Git, repoName: string, noFetch: boolean, debug: boolean): Promise<void> {
    return new Promise<null>((resolve, reject) => {
        if (noFetch) {
            if (debug) {
                console.log('not fetching because in no-fetch mode');
            }
            resolve();
        } else {
            repoGit.fetch((err, result) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('repo ' + repoName + ' successfully fetched');
                    resolve();
                }
            });
        }
    });
}

export function status(repoGit: simpleGit.Git, repoName: string, repoProperties: IRepoProperties, force: boolean, debug: boolean): Promise<void> {
    // tslint:disable-next-line promise-must-complete
    return new Promise<null>((resolve, reject) => {
        repoGit.status((err, result) => {
            if (err) {
                reject(err);
            } else {
                if (debug) {
                    console.log('result of gitStatus', result);
                }
                const isRepoClean =
                    result.not_added.length === 0 &&
                    result.deleted.length === 0 &&
                    result.modified.length === 0 &&
                    result.created.length === 0 &&
                    result.conflicted.length === 0;
                if (isRepoClean || force) {
                    if (!isRepoClean) {
                        console.log('working copy of repo ' + repoName + ' is not clean; continue due to --force flag');
                    }
                    if (debug) {
                        console.log('setting commit to', result.current);
                    }
                    repoProperties.branch = result.current;
                    if (debug) {
                        console.log('repoProperties', repoProperties);
                    }
                    resolve(result);
                } else {
                    reject('working copy of repo ' + repoName + ' is not clean');
                }
            }
        });
    });
}

export function clone(repoGit: simpleGit.Git, repoName: string, branch: string, url: string): Promise<void> {
    return new Promise<null>((resolve, reject) => {
        repoGit.clone(url, repoName, '--single-branch', '--branch', branch, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function checkoutBranch(repoGit: simpleGit.Git, repoName: string, branch: string, debug: boolean): Promise<void> {
    return new Promise<null>((resolve, reject) => {
        if (debug) {
            console.log('checkout ', repoName, ', in branch ', branch);
        }
        repoGit.checkout(branch, (err, result) => {
            if (err) {
                reject(err);
            } else {
                console.log('repo ' + repoName + ' is now in branch', branch);
                resolve();
            }
        });
    });
}

export function checkoutCommit(repoGit: simpleGit.Git, repoName: string, commit: string): Promise<void> {
    return new Promise<null>((resolve, reject) => {
        repoGit.checkout(commit, (err, result) => {
            if (err) {
                reject(err);
            } else {
                console.log('repo ' + repoName + ' is now in commit', commit);
                resolve();
            }
        });
    });
}

export function resetHard(repoGit: simpleGit.Git, repoName: string): Promise<void> {
    return new Promise<null>((resolve, reject) => {
        repoGit.reset('hard', (err, result) => {
            if (err) {
                reject(err);
            } else {
                console.log('repo ' + repoName + ' has been resetted');
                resolve();
            }
        });
    });
}

export function revParseHead(repoGit: simpleGit.Git, repoName: string, repoProperties: IRepoProperties, debug: boolean): Promise<string> {
    return new Promise<null>((resolve, reject) => {
        repoGit.revparse(['HEAD'], (err, commit: string) => {
            if (err) {
                reject(err);
            } else {
                commit = commit.replace(/[\n\r]+/g, '');
                if (debug) {
                    console.log('repo ' + repoName + ' is in commit ' + commit);
                }
                repoProperties.commit = commit;
                resolve(commit);
            }
        });
    });
}
