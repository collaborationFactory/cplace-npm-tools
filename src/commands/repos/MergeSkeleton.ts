/**
 * Merge skeleton repo to current repo
 */
import * as path from 'path';
import {AbstractReposCommand} from './AbstractReposCommand';
import {Repository} from '../../git';
import {Global} from '../../Global';
import { ICommandParameters } from '../models';
import { CplaceVersion } from '../../helpers/CplaceVersion';
import { execSync } from 'child_process';
import {StatusResult} from 'simple-git';

export class MergeSkeleton extends AbstractReposCommand {

    protected static readonly PARAMETER_BASE_BRANCH: string = 'baseBranch';
    protected static readonly PARAMETER_TARGET_BRANCH: string = 'targetBranch';
    protected static readonly PARAMETER_SKELETON_BRANCH: string = 'skeletonBranch';
    protected static readonly PARAMETER_PULL_REQUEST: string = 'pullRequest';
    protected static readonly PARAMETER_PUSH: string = 'push';
    protected static readonly PARAMETER_OURS: string = 'ours';

    protected static readonly SKELETON_REMOTE_NAME: string = 'skeleton';
    protected static readonly SKELETON_REMOTE: string = 'https://github.com/collaborationFactory/cplace-customer-repo-skeleton.git';
    protected static readonly DEFAULT_OURS: string[] = ['README.md'];
    protected static readonly CPLACE_VERSION_TO_SKELETON_VERSION: Map<{major: number, minor: number, patch: number}, string> = new Map(
        [
            [{major: 5, minor: 4, patch: 0}, 'version/2.0'],
            [{major: 5, minor: 9, patch: 0}, 'version/3.0'],
            [{major: 5, minor: 11, patch: 0}, 'version/4.0'],
            [{major: 5, minor: 13, patch: 0}, 'version/5.0'],
            [{major: 5, minor: 19, patch: 0}, 'version/6.0'],
            [{major: 22, minor: 3, patch: 0}, 'version/7.0'],
            [{major: 23, minor: 1, patch: 0}, 'version/8.0'],
            [{major: 23, minor: 2, patch: 0}, 'version/9.0'],
            [{major: 23, minor: 3, patch: 0}, 'version/10.0']
        ]
    );

    protected static readonly GH_CLI_COMMAND: string = 'gh';

    protected targetBranch: string;
    protected skeletonBranch: string;
    protected ours: Set<string> = new Set<string>();
    protected pullRequest: boolean;
    protected push: boolean;

    protected selectedSkeletonBranch: string;
    protected targetBranchIsTracked: boolean = false;
    protected baseBranch: string;
    protected status: StatusResult;
    protected mergeSuccess: boolean = true;

    public async execute(): Promise<void> {
        const pathToRepo = path.join(process.cwd());
        const repo = new Repository(pathToRepo);

        await repo.checkIsRepo();

        console.log(`Merging skeleton in repo ${repo.repoName}`);
        await this.addSkeletonAsRemote(repo);

        // checkout branch if repo is not in merging state
        this.status = await repo.status();
        const isRepoMerging = await repo.isRepoMerging();
        await this.prepareBranch(repo, isRepoMerging);
        this.status = await repo.status();
        this.targetBranchIsTracked = this.status.tracking != null;

        // validate cplace version after checking out the target branch
        this.validateCplaceVersion();
        this.selectedSkeletonBranch = this.getSkeletonBranchToMerge();

        if (!isRepoMerging) {
            if (this.targetBranchIsTracked) {
                await repo.pullOnlyFastForward(this.status.current)
                    .catch((err) => console.log(`Error when pulling target branch ${err}`));
            }
            await this.mergeSkeletonBranch(repo, `${MergeSkeleton.SKELETON_REMOTE_NAME}/${this.selectedSkeletonBranch}`)
                .catch((err) => {
                    console.log(`Cannot merge skeleton branch: ${err}`);
                });
        }

        await this.acceptOursAndContinueMerge(repo)
            .catch((err) => {
                this.mergeSuccess = false;
                return Promise.reject(`Cannot merge skeleton because of merge conflicts. Fix conflicts manually and rerun the same command.\nError: ${err}`);
            });

        if (this.mergeSuccess) {
            if (this.pullRequest) {
                await this.createPullRequest(repo, this.selectedSkeletonBranch, this.baseBranch, this.status.current);
            }
            if (this.push) {
                await this.pushBranch(repo, this.status.current);
            }

            console.log('Merging skeleton done');
        }
        return Promise.resolve();
    }

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        const baseBranch = params[MergeSkeleton.PARAMETER_BASE_BRANCH];
        if (typeof baseBranch === 'string') {
            Global.isVerbose() && console.log(`Using base branch ${baseBranch}`);
            this.baseBranch = baseBranch;
        }
        if (!baseBranch) {
            console.error('--base-branch is mandatory parameter');
            return false;
        }

        const targetBranch = params[MergeSkeleton.PARAMETER_TARGET_BRANCH];
        if (typeof targetBranch === 'string') {
            Global.isVerbose() && console.log(`Using target branch ${targetBranch}`);
            this.targetBranch = targetBranch;
        }

        const skeletonBranch = params[MergeSkeleton.PARAMETER_SKELETON_BRANCH];
        if (typeof skeletonBranch === 'string') {
            Global.isVerbose() && console.log(`Using skeleton branch ${skeletonBranch}`);
            this.skeletonBranch = skeletonBranch;
        }

        const ours = params[MergeSkeleton.PARAMETER_OURS];
        if (typeof ours === 'string' || Array.isArray(ours)) {
            const oursArray: string[] = [].concat(ours);
            oursArray.forEach((element) => this.ours.add(element));
        }
        MergeSkeleton.DEFAULT_OURS.forEach((element) => this.ours.add(element));

        const pullRequest = !!params[MergeSkeleton.PARAMETER_PULL_REQUEST];
        if (pullRequest) {
            // check if target branch is specified
            if (!this.targetBranch) {
                console.log('SKIPPING PR: Pull reuest can be created only if target branch is specified');
            } else {
                // check if gh is available
                try {
                    execSync(`${MergeSkeleton.GH_CLI_COMMAND} --version`);
                    this.pullRequest = true;
                    Global.isVerbose() && console.log('Will create pull request after successful merge');
                } catch (err) {
                    console.log('SKIPPING PR: You need to have github cli (gh) set to create a pull request.');
                }
            }
        }

        this.push = !!params[MergeSkeleton.PARAMETER_PUSH];
        if (this.push) {
            Global.isVerbose() && console.log('Will push branch after successful merge');
        }

        return true;
    }

    private async prepareBranch(repo: Repository, isRepoMerging: boolean): Promise<void> {
        if (!isRepoMerging) {
            await this.validateRepoClean(repo);

            await this.checkoutBaseBranch(repo);
            await this.checkoutTargetBranch(repo);
        }

        Promise.resolve();
    }

    private async addSkeletonAsRemote(repo: Repository): Promise<void> {
        console.log('Add skeleton repo as remote');
        await repo.addRemote(MergeSkeleton.SKELETON_REMOTE_NAME, MergeSkeleton.SKELETON_REMOTE)
            .catch((err) => console.log(`Skeleton remote already exists.\nError: ${err}`));
        await repo.fetch({});
    }

    private validateRepoClean(repo: Repository): Promise<Repository> {
        return repo.status()
            .then((status) => this.checkRepoClean(repo, status))
            .then(() => repo);
    }

    private validateCplaceVersion(): void {
        console.log('Initialize cplace version');
        CplaceVersion.initialize();
        console.log(`cplace version detected: ${CplaceVersion.toString()}`);

        if (CplaceVersion.compareTo({major: 5, minor: 4, patch: 0}) < 0) {
            throw new Error('Merge skeleton works only for cplace versions 5.4 or higher');
        }
    }

    private async checkoutBaseBranch(repo: Repository): Promise<void> {
        console.log(`Checking out base branch ${this.baseBranch}`);
        try {
            await repo.checkoutBranch(this.baseBranch);
        } catch (err) {
            console.log('Base branch cannot be checked out');
            Promise.reject();
        }

        Promise.resolve();
    }

    private async checkoutTargetBranch(repo: Repository): Promise<void> {
        if (this.targetBranch) {
            console.log(`Checking out target branch ${this.targetBranch}`);
            try {
                await repo.checkoutBranch(['-b', this.targetBranch]);
                console.log('Target branch checked out as new branch');
            } catch (err) {
                await repo.checkoutBranch(this.targetBranch);
                console.log('Target branch checked out');
            }
        }
        Promise.resolve();
    }

    private getSkeletonBranchToMerge(): string {
        if (this.skeletonBranch) {
            return `${this.skeletonBranch}`;
        }

        let skeletonVerion: string = '';
        MergeSkeleton.CPLACE_VERSION_TO_SKELETON_VERSION.forEach((value: string, key: {major: number, minor: number, patch: number}) => {
            if (CplaceVersion.compareTo(key) >= 0) {
                skeletonVerion = value;
            }
        });
        return `${skeletonVerion}`;
    }

    private mergeSkeletonBranch(repo: Repository, skeletonBranch: string): Promise<void> {
        console.log(`Merging skeleton branch ${skeletonBranch}`);
        return repo.merge(skeletonBranch, {noEdit: true});
    }

    private async acceptOursAndContinueMerge(repo: Repository): Promise<void> {
        console.log('Accept any files specified with ours');
        for (const our of this.ours) {
            console.log(`Accepting our ${our}`);
            await repo.rawWrapper(['checkout', '--ours', our]);
            await repo.rawWrapper(['add', '--ignore-errors', '-A', '-f', '--', our]);
        }

        console.log('Try to continue merge');
        await repo.rawWrapper(['-c', 'core.editor=true', 'merge', '--continue'])
            .catch((err) => {
                throw new Error(`Cannot merge because of merge conflicts.\nError: ${err}`);
            });
    }

    private async pushBranch(repo: Repository, currentBranch: string): Promise<void> {
        console.log('Pushing changes to remote');
        await repo.rawWrapper(['push', '--set-upstream', 'origin', currentBranch]);
        return Promise.resolve();
    }

    private async createPullRequest(repo: Repository, skeletonBranch: string, baseBranch: string, currentBranch: string): Promise<void> {
        if (this.targetBranchIsTracked) {
            console.log('SKIPPING PR: Pull request can be created only if the target branch is not already pushed.');
        } else {
            await this.pushBranch(repo, currentBranch);

            console.log('Creating pull request');
            const title: string = `Merge skeleton ${skeletonBranch} to ${baseBranch}`;
            const body: string = `Merge skeleton repo ${skeletonBranch} to ${baseBranch}`;
            execSync(`gh pr create --repo "collaborationFactory/${repo.repoName}" --title "${title}" --body "${body}" --base "${baseBranch}" --assignee @me`);
        }
        return Promise.resolve();
    }
}
