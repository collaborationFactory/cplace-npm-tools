/**
 * Merge skeleton repo to current repo
 */
import * as path from 'path';
import {AbstractReposCommand} from './AbstractReposCommand';
import {IGitStatus, Repository} from '../../git';
import {Global} from '../../Global';
import { ICommandParameters } from '../models';
import { CplaceVersion } from '../../helpers/CplaceVersion';

export class MergeSkeleton extends AbstractReposCommand {

    protected static readonly PARAMETER_TARGET_BRANCH: string = 'targetBranch';
    protected static readonly PARAMETER_SKELETON_BRANCH: string = 'skeletonBranch';
    protected static readonly PARAMETER_PUSH: string = 'push';
    protected static readonly PARAMETER_OURS: string = 'ours';

    protected static readonly SKELETON_REMOTE_NAME: string = 'skeleton';
    protected static readonly SKELETON_REMOTE: string = 'https://github.com/collaborationFactory/cplace-customer-repo-skeleton.git';

    protected static readonly CPLACE_VERSION_TO_SKELETON_VERSION: Map<{major: number, minor: number, patch: number}, string> = new Map(
        [
            [{major: 5, minor: 4, patch: 0}, 'version/2.0'],
            [{major: 5, minor: 9, patch: 0}, 'version/3.0'],
            [{major: 5, minor: 11, patch: 0}, 'version/4.0'],
            [{major: 5, minor: 13, patch: 0}, 'version/5.0'],
            [{major: 5, minor: 19, patch: 0}, 'version/6.0'],
            [{major: 22, minor: 3, patch: 0}, 'version/7.0']
        ]
    );

    protected targetBranch: string;
    protected skeletonBranch: string;
    protected ours: string[] = [];
    protected pullRequest: boolean;
    protected push: boolean;

    public async execute(): Promise<void> {
        const pathToRepo = path.join(process.cwd());
        const repo = new Repository(pathToRepo);

        await repo.checkIsRepo();

        console.log(`Merging skeleton in repo ${repo.repoName}`);
        await this.addSkeletonAsRemote(repo)
            .catch((err) => console.log('Skeleton remote already exists'));

        const isRepoMerging = await repo.isRepoMerging();
        if (!isRepoMerging) {
            await this.validateRepoClean(repo);
            await this.checkoutTargetBranch(repo);

            const status: IGitStatus = await repo.status();
            await repo.pullOnlyFastForward(status.current)
                .catch((err) => console.log('Skip pulling branch as it\'s not tracked'));
            await this.mergeSkeletonBranch(repo)
                .catch((err) => this.acceptOursAndContinue(repo));
        } else {
            console.log('Repository already in merge state');
            await this.acceptOursAndContinue(repo);
        }

        console.log('Merging skeleton done');
        return Promise.resolve();
    }

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        console.log('Initialize cplace version');
        CplaceVersion.initialize();
        console.log(`cplace version detected: ${CplaceVersion.toString()}`);

        if (CplaceVersion.compareTo({major: 5, minor: 4, patch: 0}) < 0) {
            console.log('Merge skeleton works only for cplace version higher than 5.4');
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
            this.ours = this.ours.concat(ours);
        }

        this.push = !!params[MergeSkeleton.PARAMETER_PUSH];
        if (this.push) {
            Global.isVerbose() && console.log('Will push branch after successful merge');
        }

        return true;
    }

    private async addSkeletonAsRemote(repo: Repository): Promise<void> {
        console.log('Add skeleton repo as remote');
        await repo.addRemote(MergeSkeleton.SKELETON_REMOTE_NAME, MergeSkeleton.SKELETON_REMOTE);
        await repo.fetch({});
    }

    private async acceptOursAndContinue(repo: Repository): Promise<void> {
        console.log('Accept any files specified with ours');
        for (const our of this.ours) {
            console.log(`Accepting our ${our}`);
            await repo.rawWrapper(['checkout', '--ours', our]);
            await repo.rawWrapper(['add', '--ignore-errors', '-A', '-f', '--', our]);
        }

        console.log('Try to continue merge');
        await repo.rawWrapper(['-c', 'core.editor=true', 'merge', '--continue'])
            .catch((err) => console.log('Cannot merge because of merge conflicts'));
    }

    private validateRepoClean(repo: Repository): Promise<Repository> {
        return repo.status()
            .then((status) => this.checkRepoClean(repo, status))
            .then(() => repo);
    }

    private checkoutTargetBranch(repo: Repository): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.targetBranch) {
                console.log(`Checking out branch ${this.targetBranch}`);
                repo.checkoutBranch(this.targetBranch)
                    .then(() => resolve())
                    .catch((err) => {
                        console.log(`Try to checkout branch ${this.targetBranch} as new branch`);
                        repo.checkoutBranch(['-b', this.targetBranch]).then(() => resolve());
                    });
            }
            resolve();
        });
    }

    private mergeSkeletonBranch(repo: Repository): Promise<Repository> {
        const skeletonBranch = this.getSkeletonBranchToMerge(repo);
        console.log(`Merging skeleton branch ${skeletonBranch}`);
        return repo.merge(skeletonBranch, {noEdit: true});
    }

    private getSkeletonBranchToMerge(repo: Repository): string {
        if (this.skeletonBranch) {
            return `${MergeSkeleton.SKELETON_REMOTE_NAME}/${this.skeletonBranch}`;
        }

        let skeletonVerion: string = '';
        MergeSkeleton.CPLACE_VERSION_TO_SKELETON_VERSION.forEach((value: string, key: {major: number, minor: number, patch: number}) => {
            if (CplaceVersion.compareTo(key) >= 0) {
                skeletonVerion = value;
            }
        });
        return `${MergeSkeleton.SKELETON_REMOTE_NAME}/${skeletonVerion}`;
    }
}
