/**
 * General update-repos command
 */
import {AbstractReposCommand} from './AbstractReposCommand';
import {ICommandParameters} from '../models';
import {Repository} from '../../git';
import {Global} from '../../Global';
import * as path from 'path';
import {GradleBuild} from '../../helpers/GradleBuild';
import {promiseAllSettled} from '../../promiseAllSettled';
import {IRepoStatus} from './models';

export class UpdateRepos extends AbstractReposCommand {
    private static readonly PARAMETER_NO_FETCH: string = 'nofetch';
    private static readonly PARAMETER_RESET_TO_REMOTE: string = 'resetToRemote';

    protected noFetch: boolean;
    protected resetToRemote: boolean;

    public async execute(): Promise<void> {
        Global.isVerbose() && console.log('update repos - prepare');
        await promiseAllSettled(
            {
                keys: Object.keys(this.parentRepos),
                promiseFactory: (repoName) => (this.prepareRepo(repoName)),
                sequential: this.sequential
            });

        Global.isVerbose() && console.log('update repos - handle');
        await promiseAllSettled(
            {
                keys: Object.keys(this.parentRepos),
                promiseFactory: (repoName) => (this.handleRepo(repoName)),
                sequential: this.sequential
            });

        Global.isVerbose() && console.log('all repositories successfully updated');
    }

    protected doPrepareAndMayExecute(params: ICommandParameters): boolean {
        this.noFetch = params[UpdateRepos.PARAMETER_NO_FETCH] as boolean;
        if (this.noFetch) {
            Global.isVerbose() && console.log('running in nofetch mode');
        }
        this.resetToRemote = params[UpdateRepos.PARAMETER_RESET_TO_REMOTE] as boolean;
        if (this.resetToRemote) {
            Global.isVerbose() && console.log('ATTENTION: resetting to remote state!');
        }
        return true;
    }

    private removeNodeModules(repo: Repository): void {
        this.removeFolderInRepo(repo, AbstractReposCommand.NODE_MODULES);
    }

    private async prepareRepo(repoName: string): Promise<void> {
        Global.isVerbose() && console.log('prepare repo', repoName);

        const repoProperties = this.parentRepos[repoName];
        Global.isVerbose() && console.log('repoProperties', repoProperties);

        Global.isVerbose() && console.log('commit', repoProperties.commit);
        Global.isVerbose() && console.log('branch', repoProperties.branch);
        Global.isVerbose() && console.log('tag', repoProperties.tag);

        if (!repoProperties.branch && !repoProperties.tag) {
            return Promise.reject('No branch or tag given in parent-repos.json for repo: ' + repoName);
        }

        const latestTagOfRelease = await Repository.getLatestTagOfReleaseBranch(repoName, repoProperties);
        repoProperties.latestTagForRelease = latestTagOfRelease;

        const pathToRepo = path.join(process.cwd(), '..', repoName);

        const repo = new Repository(pathToRepo);
        if (!this.noFetch) {
            await repo.fetch({});
        }

        const status = await repo.status();
        await this.checkRepoClean(repo, status);

        Global.isVerbose() && console.log('prepare repo', repoName, 'OK');
    }

    private async handleRepo(repoName: string): Promise<void> {
        Global.isVerbose() && console.log('update repo', repoName);

        const repoProperties = this.parentRepos[repoName];

        if (!repoProperties.branch && !repoProperties.tag) {
            throw new Error(`Internal error: handleRepo was called for ${repoName} despite rejection in prepareRepo!`);
        }

        const pathToRepo = path.join(process.cwd(), '..', repoName);
        const wasGradleBuild = new GradleBuild(pathToRepo).containsGradleBuild();

        const repo = new Repository(pathToRepo);
        const targetBranch = await this.getTargetBranch(repo, repoProperties);

        const startingBranchHasCheckedInNodeModules = await repo.checkRepoHasPathInBranch({branch: 'HEAD', pathname: AbstractReposCommand.NODE_MODULES});
        Global.isVerbose() && console.log(repoName, 'current branch has ', AbstractReposCommand.NODE_MODULES, 'checked in:', startingBranchHasCheckedInNodeModules);
        const targetBranchHasCheckedInNodeModules = await repo.checkRepoHasPathInBranch({branch: targetBranch, pathname: AbstractReposCommand.NODE_MODULES});
        Global.isVerbose() && console.log(repoName, 'target branch ', targetBranch, ' has ', AbstractReposCommand.NODE_MODULES, 'checked in:', targetBranchHasCheckedInNodeModules);

        if (!startingBranchHasCheckedInNodeModules && targetBranchHasCheckedInNodeModules) {
            console.log(`[${repoName}]: Removing untracked ${AbstractReposCommand.NODE_MODULES} folder because it is checked in in the target branch.\n` +
                            `  This may interfere with a running cplace-asc process!`);
            await this.removeNodeModules(repo);
        } else if (startingBranchHasCheckedInNodeModules && targetBranchHasCheckedInNodeModules) {
            console.log(`[${repoName}]: Folder ${AbstractReposCommand.NODE_MODULES} is checked in in the current and the target branch.\n` +
                            `  Switching branches may interfere with a running cplace-asc process!`);
        }

        await this.checkout(repo, repoName, repoProperties);

        const isGradleBuild = new GradleBuild(pathToRepo).containsGradleBuild();
        if (isGradleBuild !== wasGradleBuild) {
            const toFrom = wasGradleBuild ? 'away from' : 'back to';
            console.warn(`WARNING: Repository ${repoName} has changed ${toFrom} a Gradle build!`);
            console.warn(`         This might cause issues in IntelliJ - be aware.`);
        }

        Global.isVerbose() && console.log('successfully updated', repoName);
    }

    private async checkout(repo: Repository, repoName: string, repoProperties: IRepoStatus): Promise<void> {
        if (repoProperties.commit) {
            Global.isVerbose() && console.log(repoName, 'checking out commit', repoProperties.commit);
            await repo.fetch({branch: repoProperties.branch});
            await repo.checkoutCommit(repoProperties.commit);
        } else if (repoProperties.tag || repoProperties.latestTagForRelease) {
            const tagToCheckout = repoProperties.tag || repoProperties.latestTagForRelease;
            await repo.resetHard();
            await repo.fetch({tag: tagToCheckout});
            await repo.checkoutTag(tagToCheckout);
            await repo.createBranchForTag(tagToCheckout);
        } else {
            // checkout branch
            await repo.resetHard();
            await repo.checkoutBranch(repoProperties.branch);
            if (this.resetToRemote) {
                await repo.resetHard(repoProperties.branch);
            } else if (this.noFetch) {
                // don't update to the remote branch, but stay at the current local branch
            } else {
                await repo.pullOnlyFastForward(repoProperties.branch);
            }
        }
    }

    private async getTargetBranch(repo: Repository, repoProperties: IRepoStatus): Promise<string> {
        let targetBranch: string;

        if (repoProperties.commit) {
            targetBranch = repoProperties.commit;
        } else if (repoProperties.tag) {
            targetBranch = repoProperties.tag;
        } else if (repoProperties.latestTagForRelease) {
            targetBranch = repoProperties.latestTagForRelease;
        } else if (repoProperties.branch) {
            if (this.resetToRemote) {
                targetBranch = `origin/${repoProperties.branch}`;
            } else if (this.noFetch) {
                let branchExists: boolean;
                try {
                    await repo.commitExists(repoProperties.branch);
                    branchExists = true;
                } catch (e) {
                    branchExists = false;
                }
                targetBranch = branchExists ? repoProperties.branch : `origin/${repoProperties.branch}`;
            } else {
                // we did fetch, so the current remote branch is very likely the same as the one we may pull later
                targetBranch = `origin/${repoProperties.branch}`;
            }
        }
        return targetBranch;
    }
}
