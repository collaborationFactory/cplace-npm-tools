/**
 * Repository class providing helper methods
 */
import * as Promise from 'bluebird';
import * as path from 'path';
import * as simpleGit from 'simple-git';
import {Global} from '../Global';
import {IGitLogSummary, IGitRemoteBranchesAndCommits, IGitStatus} from './models';

export class Repository {

    public readonly repoName: string;
    private readonly git: simpleGit.Git;

    constructor(repoPath: string = './') {
        this.git = simpleGit(repoPath);
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

    private static includeBranch(branch: string, regex: string): boolean {
        const re = new RegExp(regex);
        const match = branch.match(re);
        return !(match !== null && branch === match[0]);
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
            this.git.log(['-n', size], (err, data: IGitLogSummary) => {
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
                    Global.isVerbose() && console.log('result of gitStatus', status);
                    resolve(status);
                }
            });
        });
    }

    public checkoutBranch(branch: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`checkout ${this.repoName}, in branch `, branch);
            this.git.checkout(branch, (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`repo ${this.repoName} is now in branch`, branch);
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

    public getRemoteBranchesAndCommits(branchRegex: string): Promise<IGitRemoteBranchesAndCommits[]> {
        return new Promise<IGitRemoteBranchesAndCommits[]>((resolve, reject) => {
            this.git.raw(['for-each-ref'], (err, result: string) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log('result of git for-each-ref', result);
                    const lines: string[] = result.match(/[^\r\n]+/g);
                    const branchesAndCommits: IGitRemoteBranchesAndCommits[] = [];

                    lines.forEach((l) => {
                        const trimmed = l.trim();
                        Global.isVerbose() && console.log('trimmed: ' + trimmed);
                        const matched = /([a-z0-9]+)\s*commit\s*refs\/remotes\/origin\/(\S*)/.exec(trimmed);
                        Global.isVerbose() && console.log('matched', matched);
                        if (matched && matched.length === 3) {
                            const branch = matched[2];
                            const commit = matched[1];

                            if (Repository.includeBranch(branch, branchRegex)) {
                                branchesAndCommits.push({branch, commit});
                            }
                        }
                    });

                    Global.isVerbose() && console.log('all branches and commits before filtering', branchesAndCommits);

                    // filter out branches that are on the same commit
                    const filteredBranchesAndCommits = branchesAndCommits.filter((branchAndCommit: IGitRemoteBranchesAndCommits) => {
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

    public getRemoteBranchesContainingCommit(commit: string, branchRegex: string): Promise<string[]> {
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
                            if (Repository.includeBranch(matched[1], branchRegex)) {
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
}
