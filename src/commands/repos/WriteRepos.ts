import * as Promise from 'bluebird';
import {IGitStatus, Repository} from '../../git';
import {Global} from '../../Global';
import {AbstractReposCommand} from './AbstractReposCommand';
import {IReposDescriptor, IRepoStatus} from './models';
import {ICommandParameters} from '../models';
import * as path from 'path';

/**
 * General write-repos-state command
 */
export class WriteRepos extends AbstractReposCommand {
    public static readonly PARAMETER_FREEZE: string = 'freeze';
    public static readonly PARAMETER_UN_FREEZE: string = 'unFreeze';
    public static readonly PARAMETER_USE_LATEST_TAG: string = 'latestTag';
    private static readonly RELEASE_VERSION_BRANCH_PATTERN: RegExp = new RegExp(/^release-version\/(\d+).(\d+)/);

    private freeze: boolean = false;
    private unFreeze: boolean = false;
    private useTags: boolean = false;

    public execute(): Promise<void> {
        return Promise
            .resolve(Object.keys(this.parentRepos))
            .map((repoName: string) => this.handleRepo(repoName), {concurrency: 1})
            .then((states) => {
                const newParentRepos: IReposDescriptor = {};
                states.forEach((s) => {
                    newParentRepos[s.repoName] = s.status;
                });

                Global.isVerbose() && console.log('status and revparse successfully completed');
                return this.writeNewParentRepos(newParentRepos);
            });
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        this.freeze = params[WriteRepos.PARAMETER_FREEZE] as boolean;
        this.unFreeze = params[WriteRepos.PARAMETER_UN_FREEZE] as boolean;
        this.useTags = params[WriteRepos.PARAMETER_USE_LATEST_TAG] as boolean;

        Global.isVerbose() && this.freeze && console.log(`Freezing repo states, using tags: ${this.useTags}.`);
        return true;
    }

    private handleRepo(repoName: string): Promise<{ repoName: string; status: IRepoStatus }> {
        Global.isVerbose() && console.log(`[${repoName}]: starting writing the parent-repos.json`);
        const repoProperties = this.parentRepos[repoName];
        Global.isVerbose() && console.log(`[${repoName}]:`, 'repoProperties', repoProperties);

        if (this.unFreeze) {
            return new Promise<IRepoStatus>((resolve) => {
                const current = this.parentRepos[repoName];
                let currentBranch = current.branch;
                if (currentBranch.startsWith('release-version/')) {
                    const match = WriteRepos.RELEASE_VERSION_BRANCH_PATTERN.exec(currentBranch);
                    if (match.length > 1) {
                        const major = match[1];
                        const minor = match[2];
                        currentBranch = `release/${major}.${minor}`;
                    }
                }
                const status = {
                    url: current.url,
                    branch: currentBranch,
                    description: current.description ? current.description : repoName
                };
                resolve({repoName, status});
            });
        } else if (this.useTags) {
            return Repository.getActiveTagOfReleaseBranch(repoName, this.parentRepos[repoName])
                .then((activeTag) => {
                    const current = this.parentRepos[repoName];
                    const status: IRepoStatus = {
                        url: current.url,
                        branch: current.branch,
                        description: current.description ? current.description : repoName
                    };
                    if (activeTag) {
                        status.tag = activeTag;
                        status.tagMarker = activeTag;
                        Global.isVerbose() && console.log(`[${repoName}]: using tag ${status.tag}`);
                    } else {
                        Global.isVerbose() && console.log(`[${repoName}]: no tag found for ${repoName}`);
                        if (current.commit) {
                            Global.isVerbose() && console.log(`[${repoName}]: preserving commit`);
                            status.commit = current.commit;
                        }
                    }
                    return ({repoName, status});
                });
        } else {
            const repo = new Repository(path.join(this.rootDir, '..', repoName));
            return repo.status()
                .then((status) => this.checkRepoClean(repo, status))
                .then((status) => this.mapCommitStatus(repo, status))
                .then((status) => ({repoName, status}));
        }
    }

    private mapCommitStatus(repo: Repository, status: IGitStatus): Promise<IRepoStatus> {
        return repo
            .getCurrentCommitHash()
            .then((commit) => {
                const current = this.parentRepos[repo.repoName];
                const result: IRepoStatus = {
                    url: current.url,
                    branch: status.current,
                    description: current.description ? current.description : repo.repoName
                };
                if (this.freeze || current.commit) {
                    result.commit = commit;
                    Global.isVerbose() && console.log(`[${repo.repoName}]: using HEAD commit ${result.commit}`);
                }
                return result;
            });
    }
}
