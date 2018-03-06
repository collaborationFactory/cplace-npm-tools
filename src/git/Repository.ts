/**
 * Repository class providing helper methods
 */
import * as Promise from 'bluebird';
import * as path from 'path';
import * as simpleGit from 'simple-git';
import {Global} from '../Global';
import {IGitBranchAndCommit, IGitBranchDetails, IGitLogSummary, IGitStatus} from './models';

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

    get baseDir(): string {
        return this.git._baseDir;
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

    private static includeBranch(branch: string, regexForExclusion: string, regexForInclusion: string): boolean {
        if (regexForInclusion.length > 0) {
            const re = new RegExp(regexForInclusion);
            const match = branch.match(re);
            return match !== null && branch === match[0];
        } else {
            const re = new RegExp(regexForExclusion);
            const match = branch.match(re);
            return !(match !== null && branch === match[0]);
        }
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

    public push(remote: string, remoteBranchName?: string): Promise<void> {
        const remoteBranch = remoteBranchName ? 'HEAD:' + remoteBranchName : undefined;
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`pushing to ${remote}/${remoteBranchName}`);
            this.git.push(remote, remoteBranch, (err) => {
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

    public getRemoteBranches(): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            this.git.raw(['branch', '-r'], (err, result: string) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log('result of git branch -r', result);
                    const lines: string[] = result.match(/[^\r\n]+/g);
                    const trimmedLines: string[] = [];
                    lines.forEach((l) => {
                        const trimmed = l.trim();
                        if (trimmed.indexOf('origin/HEAD') < 0) {
                            trimmedLines.push(trimmed.substring('origin/'.length));
                        }
                    });

                    Global.isVerbose() && console.log('remote branches', trimmedLines);
                    resolve(trimmedLines);
                }
            });
        });
    }

    public getRemoteBranchesAndCommits(branchRegexForExclusion: string, branchRegexForInclusion: string): Promise<IGitBranchAndCommit[]> {
        return new Promise<IGitBranchAndCommit[]>((resolve, reject) => {
            this.git.raw(['for-each-ref'], (err, result: string) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log('result of git for-each-ref', result);
                    const lines: string[] = result.match(/[^\r\n]+/g);
                    const branchesAndCommits: IGitBranchAndCommit[] = [];

                    lines.forEach((l) => {
                        const trimmed = l.trim();
                        Global.isVerbose() && console.log('trimmed: ' + trimmed);
                        const matched = /([a-z0-9]+)\s*commit\s*refs\/remotes\/origin\/(\S*)/.exec(trimmed);
                        Global.isVerbose() && console.log('matched', matched);
                        if (matched && matched.length === 3) {
                            const branch = matched[2];
                            const commit = matched[1];

                            if (Repository.includeBranch(branch, branchRegexForExclusion, branchRegexForInclusion)) {
                                branchesAndCommits.push({branch, commit});
                            }
                        }
                    });

                    Global.isVerbose() && console.log('all branches and commits before filtering', branchesAndCommits);

                    // filter out branches that are on the same commit
                    const filteredBranchesAndCommits = branchesAndCommits.filter((branchAndCommit: IGitBranchAndCommit) => {
                        const branches: string[] = [];
                        for (const bac of branchesAndCommits) {
                            if (bac.commit === branchAndCommit.commit) {
                                branches.push(bac.branch);
                            }
                        }
                        if (branches.length === 1) {
                            return true;
                        } else {
                            if (branches[0] === branchAndCommit.branch) {
                                console.log('WARNING: There are multiple branches at commit ' + branchAndCommit.commit + ': ' + branches +
                                    ', ignoring branch ' + branchAndCommit.branch);
                                return true;
                            } else {
                                return false;
                            }
                        }
                    });

                    Global.isVerbose() && console.log('all branches and commits after filtering', filteredBranchesAndCommits);

                    resolve(filteredBranchesAndCommits);
                }
            });
        });
    }

    public getRemoteBranchesContainingCommit(commit: string, branchRegexForExclusion: string, branchRegexForInclusion: string): Promise<string[]> {
        return new Promise<string[]>((resolve, reject) => {
            this.git.raw(['branch', '-a', '--contains', commit], (err, result: string) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log('result of git branch -a --contains ' + commit, result);
                    const lines: string[] = result.match(/[^\r\n]+/g);
                    const branches: string[] = [];

                    lines.forEach((l) => {
                        const trimmed = l.trim();
                        Global.isVerbose() && console.log('trimmed: ' + trimmed);
                        const matched = /remotes\/origin\/(\S*)/.exec(trimmed);
                        Global.isVerbose() && console.log('matched', matched);
                        if (matched && matched.length === 2) {
                            if (Repository.includeBranch(matched[1], branchRegexForExclusion, branchRegexForInclusion)) {
                                branches.push(matched[1]);
                            }
                        }
                    });

                    Global.isVerbose() && console.log('branches', branches);
                    resolve(branches);
                }
            });
        });
    }

    public add(filename: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`Adding file ${filename}`);
            this.git.add(filename, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public commit(message: string, files: string[] | string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`Committing branch ${this.baseDir} with message ${message}`);
            // Git.prototype.commit = function (message, files, options, then) {
            this.git.commit(message, files, {}, (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`Committed branch ${this.baseDir}`);
                    resolve();
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
