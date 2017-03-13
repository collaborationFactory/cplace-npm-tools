/**
 * Repository class providing helper methods
 */
import * as Promise from 'bluebird';
import * as path from 'path';
import * as simpleGit from 'simple-git';
import {Global} from '../Global';
import {IGitLogSummary, IGitStatus} from './models';

export class Repository {

    public readonly repoName: string;
    private readonly git: simpleGit.Git;

    constructor(repoPath: string = './') {
        this.git = simpleGit(repoPath);
        this.repoName = path.basename(path.resolve(repoPath));
    }

    public static clone(toPath: string, remoteUrl: string, branch: string): Promise<Repository> {
        return new Promise<Repository>((resolve, reject) => {
            Global.isVerbose() && console.log('cloning branch', branch, 'from', remoteUrl, 'to', top);
            simpleGit().clone(remoteUrl, toPath, ['--single-branch', '--branch', branch], (err) => {
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
                    to: toHash
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

    public resetHard(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.git.reset('hard', (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`repo ${this.repoName} has been resetted`);
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

}