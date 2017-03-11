/**
 * Git functions
 */
import * as Promise from 'bluebird';
import * as simpleGit from 'simple-git';
import {HandlerFunction} from 'simple-git';
import {Global} from '../Global';
import {IGitLogSummary, IGitStatus} from './models';

declare module 'simple-git' {
    /* tslint:disable */
    // tslint disabled due to interface definition to fix simpleGit declaration
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

export function logLast(size: number): Promise<IGitLogSummary> {
    return new Promise<IGitLogSummary>((resolve, reject) => {
        git.log(['-n', size], (err, data: IGitLogSummary) => {
            err ? reject(err) : resolve(data);
        });
    });
}

export function commitExists(hash: string): Promise<void> {
    return new Promise<null>((resolve, reject) => {
        Global.isVerbose() && console.log('Checking commit existence for', hash);
        git.revparse(['-q', '--verify', `${hash}^{commit}`], (err, data) => {
            err || !data ? reject(err) : resolve();
        });
    });
}

export function forRepo(repoName: string): simpleGit.Git {
    return simpleGit(repoName);
}

export function fetch(repoGit: simpleGit.Git, repoName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        repoGit.fetch((err) => {
            if (err) {
                reject(err);
            } else {
                Global.isVerbose() && console.log(`repo ${repoName} successfully fetched`);
                resolve();
            }
        });
    });
}

export function status(repoGit: simpleGit.Git): Promise<IGitStatus> {
    return new Promise<IGitStatus>((resolve, reject) => {
        repoGit.status((err, status: IGitStatus) => {
            if (err) {
                reject(err);
            } else {
                Global.isVerbose() && console.log('result of gitStatus', status);
                resolve(status);
            }
        });
    });
}

export function clone(repoGit: simpleGit.Git, repoName: string, branch: string, url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        repoGit.clone(url, repoName, ['--single-branch', '--branch', branch], (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export function checkoutBranch(repoGit: simpleGit.Git, repoName: string, branch: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        Global.isVerbose() && console.log(`checkout ${repoName}, in branch `, branch);
        repoGit.checkout(branch, (err) => {
            if (err) {
                reject(err);
            } else {
                Global.isVerbose() && console.log(`repo ${repoName} is now in branch`, branch);
                resolve();
            }
        });
    });
}

export function checkoutCommit(repoGit: simpleGit.Git, repoName: string, commit: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        if (commit) {
            repoGit.checkout(commit, (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`repo ${repoName} is now in commit`, commit);
                    resolve();
                }
            });
        } else {
            Global.isVerbose() && console.log('no commit given');
            resolve();
        }
    });
}

export function resetHard(repoGit: simpleGit.Git, repoName: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        repoGit.reset('hard', (err) => {
            if (err) {
                reject(err);
            } else {
                Global.isVerbose() && console.log(`repo ${repoName} has been resetted`);
                resolve();
            }
        });
    });
}

export function currentCommit(repoGit: simpleGit.Git): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        repoGit.revparse(['HEAD'], (err, commit: string) => {
            if (err) {
                reject(err);
            } else {
                Global.isVerbose() && console.log('current HEAD commit', commit);
                commit = commit.replace(/[\n\r]+/g, '');
                resolve(commit);
            }
        });
    });
}
