/**
 * Repository class providing helper methods
 */
import * as Promise from 'bluebird';
import * as path from 'path';
import * as simpleGit from 'simple-git';
import {Global} from '../Global';
import {IGitBranchDetails, IGitLogSummary, IGitStatus} from './models';

export class Repository {
    private static readonly TRACKING_BRANCH_PATTERN: RegExp = new RegExp(/^\[(.+?)]/);
    private static readonly ADDITIONAL_INFO_PATTERN: RegExp = new RegExp(/^(.+?): (gone)?(ahead (\d+))?(, )?(behind (\d+))?$/);
    private static readonly REMOTE_BRANCH_PATTERN: RegExp = new RegExp(/^remotes\/(.+)$/);

    public readonly repoName: string;
    private readonly git: simpleGit.Git;

    constructor(repoPath: string = './') {
        this.git = simpleGit(repoPath);
        if (Global.isVerbose()) {
            this.git.outputHandler((command, stdout, stderr) => {
                stdout.pipe(process.stdout);
                stderr.pipe(process.stderr);
            });
        }
        this.repoName = path.basename(path.resolve(repoPath));
    }

    public static clone(toPath: string, remoteUrl: string, branch: string): Promise<Repository> {
        return new Promise<Repository>((resolve, reject) => {
            Global.isVerbose() && console.log('cloning branch', branch, 'from', remoteUrl, 'to', toPath);
            simpleGit().clone(remoteUrl, toPath, ['--branch', branch], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(new Repository(toPath));
                }
            });
        });
    }

    public log(fromHash?: string, toHash?: string): Promise<IGitLogSummary> {
        return new Promise<IGitLogSummary>((resolve, reject) => {
            this.git.log(
                {
                    from: fromHash,
                    to: toHash,
                    splitter: '__fieldSplitter_1234eirhgnsergfse324__',
                    format: {
                        hash: '%H',
                        date: '%ai',
                        message: '%B',
                        author_name: '%aN',
                        author_email: '%ae'
                    }
                },
                (err, data: IGitLogSummary) => {
                    err ? reject(err) : resolve(data);
                }
            );
        });
    }

    public logLast(size: number): Promise<IGitLogSummary> {
        return new Promise<IGitLogSummary>((resolve, reject) => {
            this.git.log(['-n', size + ''], (err, data: IGitLogSummary) => {
                err ? reject(err) : resolve(data);
            });
        });
    }

    public commitExists(hash: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            Global.isVerbose() && console.log('Checking commit existence for', hash);
            this.git.revparse(['-q', '--verify', `${hash}^{commit}`], (err, data) => {
                err || !data ? reject(err) : resolve(data.trim());
            });
        });
    }

    public fetch(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.git.fetch((err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`repo ${this.repoName} successfully fetched`);
                    resolve();
                }
            });
        });
    }

    public status(): Promise<IGitStatus> {
        return new Promise<IGitStatus>((resolve, reject) => {
            this.git.status((err, status: IGitStatus) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`result of gitStatus in ${this.repoName}`, status);
                    resolve(status);
                }
            });
        });
    }

    public checkoutBranch(branch: string | string[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`checkout ${this.repoName}, in branch ${branch}`);
            this.git.checkout(branch, (err) => {
                if (err) {
                    Global.isVerbose() && console.error(`failed to checkout ${this.repoName}/${branch}`, err);
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`repo ${this.repoName} is now in branch ${branch}`);
                    resolve();
                }
            });
        });
    }

    public deleteBranch(branch: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`deleting branch`, branch);
            this.git.branch(['-D', branch], (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`deleted branch`, branch);
                    resolve();
                }
            });
        });
    }

    public merge(otherBranch: string, noFF?: boolean, listFiles?: boolean): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`merge ${this.repoName}, otherBranch `, otherBranch);
            const options = [otherBranch];
            noFF && options.push('--no-ff');
            this.git.merge(options, (err, data) => {
                if (err) {
                    reject(err);
                } else if (data.conflicts.length > 0) {
                    // abort if merge failed
                    this.git.mergeFromTo('--abort', undefined, (err2) => {
                        reject(data);
                    });
                } else {
                    Global.isVerbose() && console.log(`merged ${otherBranch} into ${this.repoName}`);
                    if (listFiles) {
                        if (data.files.length > 0) {
                            console.log('The following files have been merged: ');
                            data.files.forEach((file) => console.log(file));
                        } else {
                            console.log('Nothing to merge.');
                        }
                    }
                    resolve();
                }
            });
        });
    }

    public push(remote: string, remoteBranchName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`pushing to ${remote}/${remoteBranchName}`);
            this.git.push(remote, 'HEAD:' + remoteBranchName, (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`pushed to ${remote}/${remoteBranchName}`);
                    resolve();
                }
            });
        });

    }

    public checkoutCommit(commit: string): Promise<void> {
        if (commit) {
            return new Promise<void>((resolve, reject) => {
                this.git.checkout(commit, (err) => {
                    if (err) {
                        Global.isVerbose() && console.error(`failed to checkout commit ${commit} in ${this.repoName}`, err);
                        reject(err);
                    } else {
                        Global.isVerbose() && console.log(`repo ${this.repoName} is now in commit`, commit);
                        resolve();
                    }
                });
            });
        } else {
            Global.isVerbose() && console.log('no commit given');
            return Promise.resolve();
        }
    }

    public pullOnlyFastForward(): Promise<void> {
        return this.status()
            .then(({tracking}) => {
                Global.isVerbose() && console.log(`doing a pull --ff-only in ${this.repoName} which is tracking ${tracking}`);
                const i = tracking.indexOf('/');
                if (i < 0) {
                    return Promise.reject(`cannot determine remote and branch for ${tracking}`);
                }

                const remote = tracking.substring(0, i);
                const branch = tracking.substr(i + 1);

                Global.isVerbose() && console.log(`pulling branch ${branch} from remote ${remote}`);
                return new Promise((resolve, reject) => {
                    this.git.pull(remote, branch, {'--ff-only': true}, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            });
    }

    public resetHard(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.git.reset('hard', (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`repo ${this.repoName} has been reset`);
                    resolve();
                }
            });
        });
    }

    public getCurrentCommitHash(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.git.revparse(['HEAD'], (err, commit: string) => {
                if (err) {
                    reject(err);
                } else {
                    commit = commit.trim();
                    Global.isVerbose() && console.log('current HEAD commit', commit);
                    resolve(commit);
                }
            });
        });
    }

    public listBranches(): Promise<IGitBranchDetails[]> {
        return new Promise<IGitBranchDetails[]>((resolve, reject) => {
            this.git.branch(['-a', '-vv'], (err, summary: simpleGit.BranchSummary) => {
                if (err) {
                    reject(err);
                } else {
                    const branches = summary.all.map((b) => {
                        const {current, name, commit, label} = summary.branches[b];
                        const tracking = this.extractTrackingInfoFromLabel(label);
                        const nameIfRemote = this.getBranchNameIfRemote(name);
                        const isRemote = nameIfRemote != null;
                        return {
                            current,
                            name: isRemote ? nameIfRemote : name,
                            commit,
                            isRemote,
                            ...tracking
                        };
                    });
                    resolve(branches);
                }
            });
        });
    }

    private extractTrackingInfoFromLabel(label: string): { tracking: string; gone?: boolean; ahead?: number; behind?: number; } {
        const match = Repository.TRACKING_BRANCH_PATTERN.exec(label);
        if (!match || match.length < 2 || !match[1]) {
            return {
                tracking: null
            };
        }

        const tracking = match[1];
        const info = Repository.ADDITIONAL_INFO_PATTERN.exec(tracking);
        if (!info) {
            return {
                tracking,
                gone: false,
                ahead: 0,
                behind: 0
            };
        }

        const gone = !!info[2];
        const ahead = Number(info[4]) || 0;
        const behind = Number(info[7]) || 0;
        return {
            tracking: info[1],
            gone,
            ahead,
            behind
        };
    }

    private getBranchNameIfRemote(name: string): string | null {
        const match = Repository.REMOTE_BRANCH_PATTERN.exec(name);
        if (!match || match.length < 2) {
            return null;
        }
        const branchName = match[1];
        return branchName ? branchName : null;
    }
}
