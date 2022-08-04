/**
 * Repository class providing helper methods
 */
import * as Promise from 'bluebird';
import * as path from 'path';
import * as simpleGit from 'simple-git';
import {Global} from '../Global';
import {IGitBranchAndCommit, IGitBranchDetails, IGitLogSummary, IGitStatus} from './models';
import {exec} from 'child_process';
import * as util from 'util';
import {IRepoStatus} from '../commands/repos/models';

export class Repository {

    get baseDir(): string {
        return this.git._baseDir;
    }

    private static readonly TRACKING_BRANCH_PATTERN: RegExp = new RegExp(/^\[(.+?)]/);
    private static readonly ADDITIONAL_INFO_PATTERN: RegExp = new RegExp(/^(.+?): (gone)?(ahead (\d+))?(, )?(behind (\d+))?$/);
    private static readonly REMOTE_BRANCH_PATTERN: RegExp = new RegExp(/^remotes\/(.+)$/);

    public readonly repoName: string;
    private readonly git: simpleGit.Git;

    constructor(repoPath: string = './') {
        try {
            this.git = simpleGit(repoPath);
        } catch (e) {
            console.log(`Error at initialising a new Repository for ${repoPath}!`, e);
            throw e;
        }
        if (Global.isVerbose()) {
            this.git.outputHandler((command, stdout, stderr) => {
                stdout.pipe(process.stdout);
                stderr.pipe(process.stderr);
            });
        }
        this.repoName = path.basename(path.resolve(repoPath));
    }

    public static clone(toPath: string, repoProperties: IRepoStatus, depth: number): Promise<Repository> {
        return new Promise<Repository>((resolve, reject) => {
            const options = [];

            let refToCheckout = repoProperties.branch;
            let refIsTag = false;
            if (!repoProperties.commit && (repoProperties.tag || repoProperties.latestTagForRelease)) {
                refToCheckout = repoProperties.tag || repoProperties.latestTagForRelease;
                refIsTag = true;
            }
            if (refToCheckout) {
                Global.isVerbose() && console.log('cloning tag or branch', refToCheckout, 'from', repoProperties.url, 'to', toPath);
                options.push('--branch', refToCheckout);
            } else {
                Global.isVerbose() && console.log('cloning default branch from', repoProperties.url, 'to', toPath);
            }
            if (depth > 0 && !repoProperties.commit) {
                options.push('--depth', depth.toString(10));
            }
            simpleGit().clone(repoProperties.url, toPath, options, (err) => {

                if (err) {
                    reject(err);
                } else {
                    const newRepo = new Repository(toPath);
                    if (refIsTag) {
                        newRepo.createBranchForTag(refToCheckout)
                            .then(() => {
                                resolve(newRepo);
                            });
                    } else {
                        resolve(newRepo);
                    }
                }
            });
        });
    }

    public static getLatestTagOfReleaseBranch(repoName: string, repoProperties: IRepoStatus): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (repoProperties.branch.startsWith('release/')) {
                const currentReleaseVersion: string = repoProperties.branch.substring('release/'.length);
                Global.isVerbose() && console.log(repoName, `release version: ${currentReleaseVersion}`);

                this.getLatestTagOfPattern(repoProperties.url, `version/${currentReleaseVersion}.*`)
                    .then((latestTag) => {
                        Global.isVerbose() && console.log(repoName, `latest tag for release ${currentReleaseVersion}: ${latestTag}`);
                        resolve(latestTag);
                    })
                    .catch((error) => reject(error));
            } else {
                resolve(null);
            }
        });
    }

    public static getActiveTagOfReleaseBranch(repoName: string, repoProperties: IRepoStatus): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (repoProperties.tag) {
                Global.isVerbose() && console.log(repoName, `release version from predefined tag: ${repoProperties.tag}`);
                resolve(repoProperties.tag);
            } else if (repoProperties.branch.startsWith('release-version/')) {
                const currentReleaseVersion: string = repoProperties.branch.substring('release-'.length);
                Global.isVerbose() && console.log(repoName, `release version from local tag branch name: ${currentReleaseVersion}`);
                resolve(currentReleaseVersion);
            } else {
                Repository.getLatestTagOfReleaseBranch(repoName, repoProperties)
                    .then((latestTag) => {
                        if (latestTag) {
                            Global.isVerbose() && console.log(repoName, `release version from latest tag: ${latestTag}`);
                        }
                        resolve(latestTag);
                    })
                    .catch((error) => reject(error));
            }
        });
    }

    public static getLatestTagOfPattern(repoUrl: string, tagPattern: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            Global.isVerbose() && console.log(`Getting the last tag with pattern ${tagPattern}:\n`);
            simpleGit().listRemote(['--tags', '--refs', '--sort=version:refname', repoUrl, tagPattern], (err, result: string) => {
                if (err) {
                    Global.isVerbose() && console.log(repoUrl, ': ls-remote failed!\n', err);
                    reject(err);
                } else {
                    Global.isVerbose() && console.log('result of git ls-remote:\n', result);
                    const lines: string[] = result.match(/[^\r\n]+/g);
                    if (lines) {
                        const lastLine = lines.slice(-1)[0];
                        const tagMatch: RegExpMatchArray = lastLine.match(tagPattern);
                        resolve(tagMatch ? tagMatch[0] : null);
                    } else {
                        resolve(null);
                    }
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

    public checkRepoHasPathInBranch(options: { branch: string, pathname: string }): Promise<boolean> {
        const pathname = options.pathname;
        const branch = options.branch;
        Global.isVerbose() && console.log(`check whether repo ${this.repoName} has path ${pathname} in branch/commit/tag ${branch}`);
        return util.promisify(exec)(
            `git ls-tree --name-only "${branch}" "${pathname}"`, {
                cwd: path.join(this.baseDir)
            }
        ).then(({stdout}) => {
            return stdout.split(/\r?\n/).indexOf(pathname) >= 0;
        });
    }

    public log(fromHash: string, toHash: string = 'HEAD'): Promise<IGitLogSummary> {
        return new Promise<IGitLogSummary>((resolve, reject) => {
            // This is a hack - simpleGit will just append
            // the keys of the `options` object to the command
            // if the value is not of type string (or equal to some special keys)
            const options = {
                splitter: '__fieldSplitter_1234eirhgnsergfse324__',
                format: {
                    hash: '%H',
                    date: '%ai',
                    message: '%B',
                    author_name: '%aN',
                    author_email: '%ae'
                }
            };
            // We therefore just construct the path-spec as a special key
            const pathSpec = `${fromHash}..${toHash}`;
            options[pathSpec] = null;
            this.git.log(options, (err, data: IGitLogSummary) => {
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

    public fetch({tag, branch}: { tag?: string, branch?: string }): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const options = [];
            if (branch || tag) {
                options.push('--no-tags', '--force', 'origin');
                tag ? options.push('tag', tag) : options.push(branch);
            }

            Global.isVerbose() && console.log(`fetching repo ${this.repoName} with options ${options}`);
            this.git.fetch(options, (err) => {
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
        // tslint:disable-next-line:promise-must-complete
        return new Promise<IGitStatus>((resolve, reject) => {
            let numTries = 1;
            const gitStatus = () => this.git.status((err, status: IGitStatus) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`result of gitStatus in ${this.repoName}`, status);

                    if (!status.current) {
                        if (numTries >= 5) {
                            reject(`tried gitStatus 5 times for ${this.repoName} - still failing, aborting...`);
                        } else {
                            numTries = numTries + 1;
                            console.warn(`failed to correctly get gitStatus of ${this.repoName}, trying again... (try #${numTries})`);
                            gitStatus();
                        }
                    } else {
                        resolve(status);
                    }
                }
            });
            gitStatus();
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

    // Note after checking out a Tag, git is in Detached Head state
    // therefore it might be beneficial to create a branch for the specified git Tag
    // ->  git checkout tags/<tag_name> -b <branch_name>
    // Unfortunately this is not possible in simpleGit, so instead we call git.checkoutLocalBranch in createBranchForTag
    public checkoutTag(tag: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`checkout ${this.repoName}, in tag ${tag}`);
            this.git.checkout('tags/' + tag, (err) => {
                if (err) {
                    Global.isVerbose() && console.error(`failed to checkout ${this.repoName}/${tag}`, err);
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`repo ${this.repoName} is now at tag ${tag}`);
                    resolve();
                }
            });
        });
    }

    public createBranchForTag(tag: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const branchName = tag.startsWith('version/') ? `release-${tag}` : tag;

            Global.isVerbose() && console.log(`Creating branch ${branchName} for tag ${tag}`);
            this.git.checkout(['-B', branchName], (err) => {
                if (err) {
                    Global.isVerbose() && console.error(`failed to create branch ${branchName} for tag ${tag}`, err);
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`Created branch ${branchName} for tag ${tag}`);
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

    public merge(otherBranch: string, opts?: { noFF?: boolean, ffOnly?: boolean, listFiles?: boolean }): Promise<void> {
        opts = opts || {};
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`merge ${this.repoName}, otherBranch `, otherBranch);
            const options = [otherBranch];
            opts.noFF && options.push('--no-ff');
            opts.ffOnly && options.push('--ff-only');
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
                    if (opts.listFiles) {
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

    public pullOnlyFastForward(branch: string): Promise<void> {
        return this.getUpstreamBranchOrOriginBranch()
            .then((tracking) => {
                if (tracking != null) {
                    Global.isVerbose() && console.log(`doing a pull --ff-only in ${this.repoName} from ${tracking}`);
                    const i = tracking.indexOf('/');
                    if (i < 0) {
                        throw new Error(`cannot determine remote and branch for ${tracking}`);
                    }

                    const remote = tracking.substring(0, i);
                    const trackingBranch = tracking.substr(i + 1);

                    Global.isVerbose() && console.log(`pulling branch ${branch} from remote ${trackingBranch}`);
                    return new Promise((resolve, reject) => {
                        this.git.pull(remote, trackingBranch, {'--ff-only': true}, (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                } else {
                    const errorMessage: string = `Not possible because cannot find tracking branch for branch ${branch} in repository ${this.repoName}`;
                    Global.isVerbose() && console.error(errorMessage);
                    throw new Error(errorMessage);
                }
            });
    }

    /**
     * Returns the upstream branch of the current branch if it is tracking a branch.
     * Otherwise, returns the branch from the origin remote with the same name as the current branch, if it exists.
     * Otherwise, returns null.
     */
    public getUpstreamBranchOrOriginBranch(): Promise<string> {
        return this.status()
            .then(({current, tracking}) => {
                if (tracking != null) {
                    return Promise.resolve(tracking);
                }
                const originBranch = 'origin/' + current;
                return this.commitExists(originBranch)
                    .then(
                        () => {
                            return Promise.resolve(originBranch);
                        },
                        () => {
                            return Promise.resolve(null);
                        });
            });
    }

    public resetHard(branch?: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const args = !branch
                ? ['--hard']
                : ['--hard', `origin/${branch}`];
            this.git.reset(args, (err) => {
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

    public getOriginUrl(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            Global.isVerbose() && console.log(`Retrieving origin remote URL...`);
            this.git.raw(['remote', 'get-url', 'origin'], (err, result) => {
                if (err || !result) {
                    reject(err);
                } else {
                    resolve(result.trim());
                }
            });
        });
    }

    public checkIsRepo(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.git.checkIsRepo((err) => {
                if (err) {
                    Global.isVerbose() && console.log(`repo ${this.repoName} not a git repo`);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public addRemote(remoteName: string, remoteUrl: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.git.addRemote(remoteName, remoteUrl, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public removeRemote(remoteName: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.git.removeRemote(remoteName, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public rawWrapper(rawCommand: string[]): Promise<void> {
        return new Promise<string[]>((resolve, reject) => {
            this.git.raw(rawCommand, (err, result: string) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
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
