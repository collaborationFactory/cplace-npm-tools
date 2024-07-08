/**
 * Repository class providing helper methods
 */
// import * as Promise from 'bluebird';
import * as path from 'path';
import * as simpleGit from 'simple-git';
import {Global} from '../Global';
import {IGitBranchAndCommit, IGitBranchDetails, IGitLogSummary} from './models';
import {execSync} from 'child_process';
import {IRepoStatus} from '../commands/repos/models';
import {SimpleGit} from 'simple-git/dist/typings/simple-git';
import {StatusResult} from 'simple-git';

export class Repository {
    private static readonly TRACKING_BRANCH_PATTERN: RegExp = new RegExp(/^\[(.+?)]/);
    private static readonly ADDITIONAL_INFO_PATTERN: RegExp = new RegExp(/^(.+?): (gone)?(ahead (\d+))?(, )?(behind (\d+))?$/);
    private static readonly REMOTE_BRANCH_PATTERN: RegExp = new RegExp(/^remotes\/(.+)$/);
    private static readonly TAG_FORMAT: RegExp = new RegExp(/^version\/(?<major>\d+).(?<minor>\d+).(?<patch>\d+)(-RC.(?<counter>\d+))?$/);
    private static readonly GIT_PROTOCOL: string = 'git@';
    private static readonly HTTPS_PROTOCOL: string = 'https:';

    public readonly repoName: string;
    private readonly git: SimpleGit;

    /**
     * The working directory of the repository. This is the absolute and normalized path to the repository as returned by path.resolve(...).
     */
    readonly workingDir: string;

    constructor(readonly repoPath: string = './') {
        this.workingDir = path.resolve(repoPath);
        try {
            this.git = simpleGit.simpleGit(repoPath);
        } catch (e) {
            console.log(`[${this.repoName}]:`, `Error at initialising a new Repository for ${repoPath}!`, e);
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

    public static clone(repoName: string, repoProperties: IRepoStatus, rootDir: string, toPath: string, depth: number): Promise<Repository> {
        return new Promise<Repository>((resolve, reject) => {
            const options = [];

            let refToCheckout: string;
            let refIsTag = false;

            if (repoProperties.useSnapshot) {
                refToCheckout = repoProperties.branch;
                console.log(`[${repoName}]: will clone the latest HEAD of remote branch ${refToCheckout}, depth ${depth}, because useSnapshot is true.`);
            } else if (repoProperties.commit) {
                refToCheckout = repoProperties.branch;
                console.log(`[${repoName}]: will clone the latest HEAD of remote branch ${refToCheckout} because a commit is specified.`);
            } else if (repoProperties.tag) {
                refToCheckout = repoProperties.tag;
                refIsTag = true;
                console.log(`[${repoName}]: will clone the tag ${refToCheckout} with depth ${depth} as configured.`);
            } else if (repoProperties.latestTagForRelease) {
                refToCheckout = repoProperties.latestTagForRelease;
                this.validateTagMarker(repoProperties, repoName);

                refIsTag = true;
                console.log(`[${repoName}]: will clone the latestTagForRelease ${refToCheckout}, depth ${depth}.`);
            } else if (repoProperties.branch) {
                refToCheckout = repoProperties.branch;
                console.log(`[${repoName}]: will clone the latest HEAD of remote branch ${refToCheckout}, depth ${depth}, because no latestTagForRelease was found and only a branch is configured.`);
            } else {
                console.log(`[${repoName}]: will clone the latest HEAD of the default branch with depth ${depth} because not even a branch is configured.`);
            }

            if (refToCheckout) {
                options.push('--branch', refToCheckout);
            }
            if (depth > 0 && !repoProperties.commit) {
                options.push('--depth', depth.toString(10));
            }

            Repository.getRemoteOriginUrl(repoName, repoProperties.url, rootDir).then((remoteOriginUrl) => {
                simpleGit.simpleGit().clone(remoteOriginUrl, toPath, options, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        const newRepo = new Repository(toPath);
                        if (refIsTag) {
                            newRepo.createBranchForTag(repoName, refToCheckout)
                                .then(() => {
                                    resolve(newRepo);
                                });
                        } else if (repoProperties.commit) {
                            console.log(`[${repoName}]:`, 'will update to the commit', repoProperties.commit);
                            newRepo.checkoutCommit(repoProperties.commit)
                                .then(() => {
                                    resolve(newRepo);
                                });
                        } else {
                            resolve(newRepo);
                        }
                    }
                });
            });
        });
    }

    public static validateTagMarker(repoProperties: IRepoStatus, repoName: string): void {
        if (repoProperties.tagMarker && repoProperties.tagMarker !== repoProperties.latestTagForRelease) {

            const tagMatches = Repository.TAG_FORMAT.exec(repoProperties.latestTagForRelease);
            const tagMarkerMatches = Repository.TAG_FORMAT.exec(repoProperties.tagMarker);
            if (!tagMatches) {
                // tslint:disable-next-line:max-line-length
                throw new Error(`[${repoName}]: Resolved latestTagForRelease ${repoProperties.latestTagForRelease} does not match the expected pattern 'version/{major}.{minor}.{patch}(-RC.{counter})?'!`);
            }
            if (!tagMarkerMatches) {
                throw new Error(`[${repoName}]: Configured tagMarker ${repoProperties.tagMarker} does not match the expected pattern 'version/{major}.{minor}.{patch}(-RC.{counter})?'!`);
            }

            if (tagMatches.groups.major !== tagMarkerMatches.groups.major) {
                throw new Error(`[${repoName}]: Configured tagMarker ${repoProperties.tagMarker} does not match the major version of the latest available tag ${repoProperties.latestTagForRelease}
                for the release branch ${repoProperties.branch}! For consistency the tagMarker must have the same major and minor version as the release branch and the tag.`);
            } else if (tagMatches.groups.minor !== tagMarkerMatches.groups.minor) {
                throw new Error(`[${repoName}]: Configured tagMarker ${repoProperties.tagMarker} does not match the minor version of the latest available tag ${repoProperties.latestTagForRelease}
                 for the release branch ${repoProperties.branch}! For consistency the tagMarker must have the same major and minor version as the release branch and the tag.`);
            } else if (parseInt(tagMatches.groups.patch, 10) < parseInt(tagMarkerMatches.groups.patch, 10)) {
                throw new Error(`[${repoName}]: Configured tagMarker ${repoProperties.tagMarker} has a higher patch version then the latest available tag ${repoProperties.latestTagForRelease}!`);
            }
        }
    }

    public static includeBranch(branch: string, regexForExclusion: string, regexForInclusion: string): boolean {
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

    public static getLatestTagOfReleaseBranch(repoName: string, repoProperties: IRepoStatus, rootDir: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (repoProperties.branch?.startsWith('release/')) {
                const currentReleaseVersion: string = repoProperties.branch.substring('release/'.length);
                Global.isVerbose() && console.log(`[${repoName}]:`, `release version: ${currentReleaseVersion}`);

                this.getLatestTagOfPattern(repoName, repoProperties.url, `version/${currentReleaseVersion}.*`, rootDir)
                    .then((latestTag) => {
                        Global.isVerbose() && console.log(`[${repoName}]:`, `latest tag for release ${currentReleaseVersion}: ${latestTag}`);
                        resolve(latestTag);
                    })
                    .catch((error) => reject(error));
            } else {
                resolve(null);
            }
        });
    }

    public static getActiveTagOfReleaseBranch(repoName: string, repoProperties: IRepoStatus, rootDir: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            if (repoProperties.tag) {
                Global.isVerbose() && console.log(`[${repoName}]:`, `release version from predefined tag: ${repoProperties.tag}`);
                resolve(repoProperties.tag);
            } else if (repoProperties.branch.startsWith('release-version/')) {
                const currentReleaseVersion: string = repoProperties.branch.substring('release-'.length);
                Global.isVerbose() && console.log(`[${repoName}]:`, `release version from local tag branch name: ${currentReleaseVersion}`);
                resolve(currentReleaseVersion);
            } else {
                Repository.getLatestTagOfReleaseBranch(repoName, repoProperties, rootDir)
                    .then((latestTag) => {
                        if (latestTag) {
                            Global.isVerbose() && console.log(`[${repoName}]:`, `release version from latest tag: ${latestTag}`);
                        }
                        resolve(latestTag);
                    })
                    .catch((error) => {
                               console.log(`[${repoName}]: failed to get latest tag:\n${error}`);
                               reject(error);
                           }
                    );
            }
        });
    }

    public static getLatestTagOfPattern(repoName: string, repoUrl: string, tagPattern: string, rootDir: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            Global.isVerbose() && console.log(`[${repoName}]: Getting the last tag with pattern ${tagPattern}:\n`);
            Repository.getRemoteOriginUrl(repoName, repoUrl, rootDir).then((remoteOriginUrl) => {
                simpleGit.simpleGit().listRemote(['--tags', '--refs', '--sort=version:refname', remoteOriginUrl, tagPattern], (err, result: string) => {
                    if (err) {
                        Global.isVerbose() && console.log(`[${repoName}]:`, remoteOriginUrl, ': ls-remote failed!\n', err);
                        reject(err);
                    } else {
                        const sortedTags: string[] = this.sortByTagName(repoName, result, tagPattern);
                        Global.isVerbose() && console.log(`[${repoName}]: found latest versions in remote git repository:\n${sortedTags ? sortedTags.join('\n') : 'no tags found'}`);
                        if (sortedTags) {
                            resolve(sortedTags.slice(-1)[0]);
                        } else {
                            resolve(null);
                        }
                    }
                });
            });
        });
    }

    public static sortByTagName(repoName: string, result: string, tagPattern: string): string[] {
        const lines: string[] = result.match(/[^\r\n]+/g);
        if (lines) {
            // 1. prepare all lines - remove hash and non-matching results
            const tags: string[] = lines.map((line: string) => {
                const tagMatch: RegExpMatchArray = line.match(tagPattern);
                return tagMatch ? tagMatch[0] : null;
            }).filter((tag) => tag);

            // 2. sort lines, respecting RC order
            return tags.sort((a: string, b: string): number => {
                if (a === b) {
                    return 0;
                }

                const aRcMatch: RegExpMatchArray = a.match(/^version\/\d+\.\d+\.(\d+)-RC.(\d+)$/);
                const bRcMatch: RegExpMatchArray = b.match(/^version\/\d+\.\d+\.(\d+)-RC.(\d+)$/);
                const aMatch: RegExpMatchArray = a.match(/^version\/\d+\.\d+\.(\d+)$/);
                const bMatch: RegExpMatchArray = b.match(/^version\/\d+\.\d+\.(\d+)$/);

                if (aRcMatch && bRcMatch) {
                    if (parseInt(aRcMatch[1], 10) > parseInt(bRcMatch[1], 10)) {
                        return 1;
                    }
                    if (parseInt(aRcMatch[1], 10) < parseInt(bRcMatch[1], 10)) {
                        return 1;
                    }
                    if (parseInt(aRcMatch[2], 10) === parseInt(bRcMatch[2], 10)) {
                        return 0;
                    }
                    if (parseInt(aRcMatch[2], 10) > parseInt(bRcMatch[2], 10)) {
                        return 1;
                    }
                    return -1;
                }
                if (aRcMatch && bMatch) {
                    if (parseInt(aRcMatch[1], 10) > parseInt(bMatch[1], 10)) {
                        return 1;
                    }
                    return -1;
                }
                if (aMatch && bRcMatch) {
                    if (parseInt(aMatch[1], 10) >= parseInt(bRcMatch[1], 10)) {
                        return 1;
                    }
                    return -1;
                }
                if (aMatch && bMatch) {
                    if (parseInt(aMatch[1], 10) > parseInt(bMatch[1], 10)) {
                        return 1;
                    }
                    return -1;
                }
                if (aMatch) {
                    console.log(`[${repoName}]: Unsupported version format [${b}].`);
                    return 1;
                }
                if (bMatch) {
                    console.log(`[${repoName}]: Unsupported version format [${a}].`);
                    return -1;
                }
                if (aRcMatch) {
                    console.log(`[${repoName}]: Unsupported version format [${b}].`);
                    return 1;
                }
                if (bRcMatch) {
                    console.log(`[${repoName}]: Unsupported version format [${a}].`);
                    return -1;
                }
                if (a > b) {
                    console.log(`[${repoName}]: Unsupported version format [${a}] and [${b}].`);
                    return 1;
                }
                return -1;
            });
        } else {
            return null;
        }
    }

    /**
     * Translates the repoUrl to the expected protocol defined by the local root repository to avoid authentication problems.
     *
     * | local root-repo | remote parent-repo | uses protocol |
     * |-----------|-------------|-------|
     * | https     | https       | https |
     * | https     | git         | https |
     * | git       | git         | git   |
     * | git       | https       | git   |
     *
     * @param repoName The name of the repository
     * @param repoUrl The URL of the remote repository
     * @param rootDir The directory of the local root repository
     */
    public static getRemoteOriginUrl(repoName: string, repoUrl: string, rootDir: string): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            Repository.getLocalOriginUrl(repoName, rootDir)
                .then((localOriginUrl) => {
                    let useRepoUrl = repoUrl;
                    if (!repoUrl) {
                        console.log(`[${repoName}]: repo url not configure in parent-repos.json. Please check the configuration of ${repoName}.`);
                        reject(`[${repoName}]: repo url not configure in parent-repos.json. Please check the configuration of ${repoName}.`);
                    } else if (repoUrl.startsWith(this.GIT_PROTOCOL) && localOriginUrl.startsWith(this.HTTPS_PROTOCOL)) {
                        const {groups: {host, orgPath}} = /^git@(?<host>.*):(?<orgPath>.*)$/.exec(repoUrl);
                        useRepoUrl = `${this.HTTPS_PROTOCOL}//${host}/${orgPath}`;
                        Global.isVerbose() && console.log(`[${repoName}]: changed repo url ${repoUrl} to ${useRepoUrl} as the root repository's origin is configured for https.`);
                    } else if (repoUrl.startsWith(this.HTTPS_PROTOCOL) && localOriginUrl.startsWith(this.GIT_PROTOCOL)) {
                        const {groups: {host, orgPath}} = /^https:\/\/(?<host>[^/]*)\/(?<orgPath>.*)$/.exec(repoUrl);
                        useRepoUrl = `${this.GIT_PROTOCOL}${host}:${orgPath}`;
                        Global.isVerbose() && console.log(`[${repoName}]: changed repo url ${repoUrl} to ${useRepoUrl} as the root repository's origin is configured for git via ssh.`);
                    }
                    resolve(useRepoUrl);
                });
        });
    }

    public static getLocalOriginUrl(repoName: string, rootDir: string): Promise<string> {
        return new Promise<string>((resolve) => {
            simpleGit.simpleGit(rootDir).remote(['get-url', 'origin'], (err, result: string) => {
                if (err) {
                    console.log(`[${repoName}]:`, 'git remote get-url failed! Has the root parent repository the remote added as "origin"?\n', err);
                    resolve('');
                } else {
                    resolve(result);
                }
            });
        });
    }

    public checkRepoHasPathInBranch(options: { ref: string, pathname: string }): boolean {
        const pathname = options.pathname;
        const ref = options.ref;
        Global.isVerbose() && console.log(`[${this.repoName}]: check whether repo ${this.repoName} has path ${pathname} in branch/commit/tag ${ref}`);
        try {
            const result: Buffer = execSync(`git ls-tree --name-only "${ref}" "${pathname}"`, {
                cwd: this.workingDir,
            });
            if(result) {
                return result.toString().split(/\r?\n/).indexOf(pathname) >= 0;
            } else {
                return false;
            }
        } catch (e) {
            console.error(`[${this.repoName}]:`, `Error at checking whether repo ${this.repoName} has path ${pathname} in branch/commit/tag ${ref}!`, e);
            throw e;
        }
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
            } else {
                options.push('--all');
                options.push('--tags');
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

    public status(): Promise<StatusResult> {
        // tslint:disable-next-line:promise-must-complete
        return new Promise<StatusResult>((resolve, reject) => {
            let numTries = 1;

            const gitStatus = () => this.git.status(null,(err, data): void => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`result of gitStatus in ${this.repoName}`, data);

                    if (!data.current) {
                        if (numTries >= 5) {
                            reject(`tried gitStatus 5 times for ${this.repoName} - still failing, aborting...`);
                        } else {
                            numTries = numTries + 1;
                            console.warn(`failed to correctly get gitStatus of ${this.repoName}, trying again... (try #${numTries})`);
                            gitStatus();
                        }
                    } else {
                        resolve(data);
                    }
                }
            });
            gitStatus();
        });
    }

    /**
     * If the repo is a shallow clone, the requested branch will be fetched from the remote to allow checking it out.
     * The fetch will be done with a depth of 1.
     * @param branch the branch to fetch from the remote
     */
    public prefetchBranchForShallowClone(branch: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.git.revparse(['--is-shallow-repository'], (err, data) => {
                if (err) {
                    reject(err);
                } else if (data?.trim() === 'true') {
                    Global.isVerbose() && console.log(`[${this.repoName}]: pre-fetching branch ${branch} for shallow cloned repo.`);
                    /*
                    set-branches
                    Changes the list of branches tracked by the named remote. This can be used to track a subset of the available remote branches after the initial setup for a remote.
                    The named branches will be interpreted as if specified with the -t option on the git remote add command line.
                    With --add, instead of replacing the list of currently tracked branches, adds to that list.
                     */
                    this.git.remote(['set-branches', '--add', 'origin', branch]);
                    this.git.fetch(['--depth', '1']);
                    resolve();
                } else {
                    resolve();
                }
            });
        });
    }

    public async checkoutBranch(branch: string | string[]): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`[${this.repoName}]: checkout ${this.repoName}, in branch ${branch}`);

            const callback = async (err) => {
                if (err) {
                    console.error(`[${this.repoName}]: failed to checkout branch ${branch}`, err);
                    await this.git.branch(['-a']).then((branches) => {
                        console.error(`[${this.repoName}]: available branches:`, branches);
                    });
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`[${this.repoName}]: repo ${this.repoName} is now in branch ${branch}`);
                    resolve();
                }
            };

            if(branch instanceof Array) {
                this.git.checkout(branch, callback);
            } else {
                this.git.checkout(branch as string, {}, callback);
            }
        });
    }

    // Note after checking out a Tag, git is in Detached Head state
    // therefore it might be beneficial to create a branch for the specified git Tag
    // ->  git checkout tags/<tag_name> -b <branch_name>
    // Unfortunately this is not possible in simpleGit, so instead we call git.checkoutLocalBranch in createBranchForTag
    public checkoutTag(tag: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`[${this.repoName}]: checkout ${this.repoName}, in tag ${tag}`);
            this.git.checkout('tags/' + tag, (err) => {
                if (err) {
                    console.error(`[${this.repoName}]: failed to checkout tag ${this.repoName}/${tag}`, err);
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`[${this.repoName}]: repo ${this.repoName} is now at tag ${tag}`);
                    resolve();
                }
            });
        });
    }

    public createBranchForTag(repoName: string, tag: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const branchName = tag.startsWith('version/') ? `release-${tag}` : tag;

            Global.isVerbose() && console.log(`[${repoName}]: Creating branch ${branchName} for tag ${tag}`);
            this.git.checkout(['-B', branchName], (err) => {
                if (err) {
                    console.error(`[${repoName}]:failed to create branch ${branchName} for tag ${tag}`, err);
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`[${repoName}]: Created branch ${branchName} for tag ${tag}`);
                    resolve();
                }
            });
        });
    }

    public deleteBranch(branch: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`[${this.repoName}]: deleting branch`, branch);
            this.git.branch(['-D', branch], (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`[${this.repoName}]: deleted branch`, branch);
                    resolve();
                }
            });
        });
    }

    public merge(otherBranch: string, opts?: { noFF?: boolean, ffOnly?: boolean, noEdit?: boolean, listFiles?: boolean }): Promise<void> {
        opts = opts || {};
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`[${this.repoName}]: merge ${this.repoName}, otherBranch `, otherBranch);
            const options = [otherBranch];
            opts.noFF && options.push('--no-ff');
            opts.ffOnly && options.push('--ff-only');
            opts.noEdit && options.push('--no-edit');
            this.git.merge(options, (err, data) => {
                if (err) {
                    reject(err);
                } else if (data.conflicts.length > 0) {
                    // abort if merge failed
                    this.git.mergeFromTo('--abort', undefined, (err2) => {
                        console.log('[${this.repoName}]: error during merge:', err2);
                        reject(data);
                    });
                } else {
                    Global.isVerbose() && console.log(`[${this.repoName}]: merged ${otherBranch} into ${this.repoName}`);
                    if (opts.listFiles) {
                        if (data.files.length > 0) {
                            console.log('[${this.repoName}]: The following files have been merged: ');
                            data.files.forEach((file) => console.log(file));
                        } else {
                            console.log('[${this.repoName}]:  Nothing to merge.');
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
            Global.isVerbose() && console.log(`[${this.repoName}]: pushing to ${remote}/${remoteBranchName}`);
            this.git.push(remote, remoteBranch,{}, (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`[${this.repoName}]: pushed to ${remote}/${remoteBranchName}`);
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
                        console.error(`failed to checkout commit ${commit} in ${this.repoName}`, err);
                        reject(err);
                    } else {
                        Global.isVerbose() && console.log(`[${this.repoName}]: repo ${this.repoName} is now in commit`, commit);
                        resolve();
                    }
                });
            });
        } else {
            Global.isVerbose() && console.log(`[${this.repoName}]: no commit given`);
            return Promise.resolve();
        }
    }

    public pullOnlyFastForward(branch: string): Promise<void> {
        return this.getUpstreamBranchOrOriginBranch()
            .then((tracking) => {
                if (tracking != null) {
                    Global.isVerbose() && console.log(`[${this.repoName}]: doing a pull --ff-only in ${this.repoName} from ${tracking}`);
                    const i = tracking.indexOf('/');
                    if (i < 0) {
                        throw new Error(`cannot determine remote and branch for ${tracking}`);
                    }

                    const remote = tracking.substring(0, i);
                    const trackingBranch = tracking.substr(i + 1);

                    Global.isVerbose() && console.log(`[${this.repoName}]: pulling branch ${branch} from remote ${trackingBranch}`);
                    return new Promise((resolve, reject) => {
                        this.git.pull(remote, trackingBranch, ['--ff-only'], (err) => {
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
                    Global.isVerbose() && console.log(`[${this.repoName}]: repo ${this.repoName} has been reset`);
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
                    Global.isVerbose() && console.log(`[${this.repoName}]: current HEAD commit`, commit);
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
                    Global.isVerbose() && console.log(`[${this.repoName}]: result of git branch -r`, result);
                    const lines: string[] = result.match(/[^\r\n]+/g);
                    const trimmedLines: string[] = [];
                    lines.forEach((l) => {
                        const trimmed = l.trim();
                        if (trimmed.indexOf('origin/HEAD') < 0) {
                            trimmedLines.push(trimmed.substring('origin/'.length));
                        }
                    });

                    Global.isVerbose() && console.log(`[${this.repoName}]: remote branches`, trimmedLines);
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
                    Global.isVerbose() && console.log(`[${this.repoName}]:`, 'result of git for-each-ref', result);
                    const lines: string[] = result.match(/[^\r\n]+/g);
                    const branchesAndCommits: IGitBranchAndCommit[] = [];

                    lines.forEach((l) => {
                        const trimmed = l.trim();
                        Global.isVerbose() && console.log(`[${this.repoName}]:`, 'trimmed: ' + trimmed);
                        const matched = /([a-z0-9]+)\s*commit\s*refs\/remotes\/origin\/(\S*)/.exec(trimmed);
                        Global.isVerbose() && console.log(`[${this.repoName}]:`, 'matched', matched);
                        if (matched && matched.length === 3) {
                            const branch = matched[2];
                            const commit = matched[1];

                            if (Repository.includeBranch(branch, branchRegexForExclusion, branchRegexForInclusion)) {
                                branchesAndCommits.push({branch, commit});
                            }
                        }
                    });

                    Global.isVerbose() && console.log(`[${this.repoName}]:`, 'all branches and commits before filtering', branchesAndCommits);

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
                                console.log(`[${this.repoName}]:`, 'WARNING: There are multiple branches at commit ' + branchAndCommit.commit + ': ' + branches +
                                    ', ignoring branch ' + branchAndCommit.branch);
                                return true;
                            } else {
                                return false;
                            }
                        }
                    });

                    Global.isVerbose() && console.log(`[${this.repoName}]:`, 'all branches and commits after filtering', filteredBranchesAndCommits);

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
                    Global.isVerbose() && console.log(`[${this.repoName}]:`, 'result of git branch -a --contains ' + commit, result);
                    const lines: string[] = result.match(/[^\r\n]+/g);
                    const branches: string[] = [];

                    lines.forEach((l) => {
                        const trimmed = l.trim();
                        Global.isVerbose() && console.log(`[${this.repoName}]:`, 'trimmed: ' + trimmed);
                        const matched = /remotes\/origin\/(\S*)/.exec(trimmed);
                        Global.isVerbose() && console.log(`[${this.repoName}]:`, 'matched', matched);
                        if (matched && matched.length === 2) {
                            if (Repository.includeBranch(matched[1], branchRegexForExclusion, branchRegexForInclusion)) {
                                branches.push(matched[1]);
                            }
                        }
                    });

                    Global.isVerbose() && console.log(`[${this.repoName}]:`, 'branches', branches);
                    resolve(branches);
                }
            });
        });
    }

    public add(filename: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            Global.isVerbose() && console.log(`[${this.repoName}]:`, `Adding file ${filename}`);
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
            Global.isVerbose() && console.log(`[${this.repoName}]:`, `Committing branch in repo ${this.workingDir} with message ${message}`);
            this.git.commit(message, files, {}, (err) => {
                if (err) {
                    reject(err);
                } else {
                    Global.isVerbose() && console.log(`[${this.repoName}]:`, `Committed branch in repo ${this.workingDir}`);
                    resolve();
                }
            });
        });
    }

    public getOriginUrl(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            Global.isVerbose() && console.log(`[${this.repoName}]:`, `Retrieving origin remote URL...`);
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
                    Global.isVerbose() && console.log(`[${this.repoName}]:`, `repo ${this.repoName} not a git repo`);
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

    public rawWrapper(rawCommand: string[]): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            this.git.raw(rawCommand, (err, result: string) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    public checkBranchExistsOnRemote(branchName: string): boolean {
        let result = '';
        try {
            result = execSync(`git rev-parse origin/${branchName}`, {
                cwd: this.workingDir,
                stdio : 'pipe'
            }).toString();
        } catch (e) {
            throw new Error(`Branch ${branchName} doesn't exist. ${e}`);
        }
        return result !== '';
    }

    public isRepoMerging(): Promise<boolean> {
        return new Promise<boolean>((resolve) => {
            const options = ['HEAD'];
            this.git.merge(options, (err) => {
                if (err) {
                    resolve(true);
                } else {
                    resolve(false);
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
