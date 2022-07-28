import * as Promise from 'bluebird';
import {IGitStatus, Repository} from '../../git';
import {Global} from '../../Global';
import {AbstractReposCommand} from './AbstractReposCommand';
import {IReposDescriptor, IRepoStatus} from './models';
import {ICommandParameters} from '../models';

/**
 * General write-repos-state command
 */
export class WriteRepos extends AbstractReposCommand {
    public static readonly PARAMETER_FREEZE: string = 'freeze';
    public static readonly PARAMETER_UN_FREEZE: string = 'unFreeze';
    public static readonly PARAMETER_USE_TAGS: string = 'useTags';
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
                states.forEach((s) => newParentRepos[s.repoName] = s.status);

                Global.isVerbose() && console.log('status and revparse successfully completed');
                return this.writeNewParentRepos(newParentRepos);
            });
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        this.freeze = params[WriteRepos.PARAMETER_FREEZE] as boolean;
        this.unFreeze = params[WriteRepos.PARAMETER_UN_FREEZE] as boolean;
        this.useTags = params[WriteRepos.PARAMETER_USE_TAGS] as boolean;

        Global.isVerbose() && this.freeze && console.log(`Freezing repo states, using tags: ${this.useTags}.`);
        return true;
    }

    private handleRepo(repoName: string): Promise<{ repoName: string; status: IRepoStatus }> {
        Global.isVerbose() && console.log('repo', repoName);
        const repoProperties = this.parentRepos[repoName];
        Global.isVerbose() && console.log('repoProperties', repoProperties);

        const repo = new Repository(`${this.rootDir}/../${repoName}`);
        return repo.status()
            .then((status) => this.checkRepoClean(repo, status))
            .then((status) => this.mapStatus(repo, status))
            .then((status) => ({repoName, status}));
    }

    private mapStatus(repo: Repository, status: IGitStatus): Promise<IRepoStatus> {
        if (this.unFreeze) {
            return new Promise<IRepoStatus>((resolve) => {
                const current = this.parentRepos[repo.repoName];
                let currentBranch = current.branch;
                if (currentBranch.startsWith('release-version/')) {
                    const match = WriteRepos.RELEASE_VERSION_BRANCH_PATTERN.exec(currentBranch);
                    if (match.length > 1) {
                        const major = match[1];
                        const minor = match[2];
                        currentBranch = `release/${major}.${minor}`;
                    }
                }
                resolve({
                            url: current.url,
                            branch: currentBranch,
                            description: current.description ? current.description : repo.repoName
                        });
            });
        } else if (this.freeze && this.useTags) {
            return Repository.getActiveTagOfReleaseBranch(repo.repoName, this.parentRepos[repo.repoName])
                .then((activeTag) => {
                    const current = this.parentRepos[repo.repoName];
                    const result: IRepoStatus = {
                        url: current.url,
                        branch: current.branch,
                        description: current.description ? current.description : repo.repoName
                    };
                    if (activeTag) {
                        result.tag = activeTag;
                        result.tagMarker = activeTag;
                        Global.isVerbose() && console.log(`using tag ${result.tag}`);
                    } else {
                        Global.isVerbose() && console.log(`no tag found for ${repo.repoName}`);
                        if (current.commit) {
                            Global.isVerbose() && console.log(`preserving commit ${repo.commit}`);
                            result.commit = current.commit;
                        }
                    }
                    return result;
                });
        } else {
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
                        Global.isVerbose() && console.log(`using HEAD commit ${result.commit}`);
                    }
                    return result;
                });
        }
    }
}
