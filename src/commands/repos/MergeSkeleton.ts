/**
 * Merge skeleton repo to current repo
 */
import * as path from 'path';
import { AbstractReposCommand } from './AbstractReposCommand';
import { Repository } from '../../git';
import { Global } from '../../Global';
import { ICommandParameters } from '../models';
import { CplaceVersion } from '../../helpers/CplaceVersion';
import { execSync } from 'child_process';
import { StatusResult } from 'simple-git';
import { fs } from '../../p/fs';
import { expand } from '@inquirer/prompts';

export class MergeSkeleton extends AbstractReposCommand {

    protected static readonly PARAMETER_BASE_BRANCH: string = 'baseBranch';
    protected static readonly PARAMETER_TARGET_BRANCH: string = 'targetBranch';
    protected static readonly PARAMETER_SKELETON_BRANCH: string = 'skeletonBranch';
    protected static readonly PARAMETER_PULL_REQUEST: string = 'pullRequest';
    protected static readonly PARAMETER_PUSH: string = 'push';
    protected static readonly PARAMETER_OURS: string = 'ours';
    protected static readonly PARAMETER_INTERACTIVE: string = 'interactive';

    protected static readonly SKELETON_REMOTE_NAME: string = 'skeleton';
    protected static readonly SKELETON_REMOTE: string = 'https://github.com/collaborationFactory/cplace-customer-repo-skeleton.git';
    protected static readonly CPLACE_VERSION_TO_SKELETON_VERSION: Map<{major: number, minor: number, patch: number}, string> = new Map([
        [{major: 5, minor: 4, patch: 0}, 'version/2.0'],
        [{major: 5, minor: 9, patch: 0}, 'version/3.0'],
        [{major: 5, minor: 11, patch: 0}, 'version/4.0'],
        [{major: 5, minor: 13, patch: 0}, 'version/5.0'],
        [{major: 5, minor: 19, patch: 0}, 'version/6.0'],
        [{major: 22, minor: 3, patch: 0}, 'version/7.0'],
        [{major: 23, minor: 1, patch: 0}, 'version/8.0'],
        [{major: 23, minor: 2, patch: 0}, 'version/23.2'],
        [{major: 23, minor: 3, patch: 0}, 'version/23.3'],
        [{major: 24, minor: 1, patch: 0}, 'version/24.1'],
        [{major: 25, minor: 2, patch: 0}, 'version/25.2'],
        [{major: 25, minor: 3, patch: 0}, 'version/25.3'],
    ]);

    protected static readonly FILE_MERGE_STATUS_MAP: Map<string, { description: string, defaultAction: string, defaultActionLong: string }> = new Map([
        [' M', { description: 'work tree changed since index', defaultAction: 't', defaultActionLong: 'theirs' }],
        ['M ', { description: 'modified', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['MM', { description: 'updated in index and work tree changed since index', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['T ', { description: 'type changed', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['TT', { description: 'type changed in index and in work tree', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['A ', { description: 'new file', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['AM', { description: 'added to index and work tree changed since index', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['D ', { description: 'deleted', defaultAction: 'o', defaultActionLong: 'ours' }],
        [' D', { description: 'deleted in work tree', defaultAction: 't', defaultActionLong: 'theirs' }],
        ['R ', { description: 'renamed', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['RM', { description: 'renamed in index and work tree changed since index', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['C ', { description: 'copied', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['CM', { description: 'copied in index and work tree changed since index', defaultAction: 'o', defaultActionLong: 'ours' }],

        // Merge conflicts
        ['DD', { description: 'both deleted', defaultAction: 't', defaultActionLong: 'theirs' }],
        ['AU', { description: 'added by us', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['UD', { description: 'deleted by them', defaultAction: 'r', defaultActionLong: 'resolve' }],
        ['UA', { description: 'added by them', defaultAction: 'r', defaultActionLong: 'resolve' }],
        ['DU', { description: 'deleted by us', defaultAction: 'o', defaultActionLong: 'ours' }],
        ['AA', { description: 'both added', defaultAction: 'r', defaultActionLong: 'resolve' }],
        ['UU', { description: 'both modified', defaultAction: 'r', defaultActionLong: 'resolve' }],

        // Untracked and ignored
        ['??', { description: 'untracked', defaultAction: 't', defaultActionLong: 'theirs' }],
        ['!!', { description: 'ignored', defaultAction: '', defaultActionLong: '' }]
    ]);

    protected static readonly GH_CLI_COMMAND: string = 'gh';

    protected baseBranch: string;
    protected targetBranch: string;
    protected skeletonBranch: string;
    protected pullRequest: boolean;
    protected push: boolean;
    protected interactive: boolean = false;

    protected ours: Set<string> = new Set<string>();
    protected theirs: Set<string> = new Set<string>();
    protected toMerge: Set<string> = new Set<string>();

    protected selectedSkeletonBranch: string;
    protected targetBranchIsTracked: boolean = false;
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
        let isRepoMerging = await repo.isRepoMerging();
        await this.prepareBranch(repo, isRepoMerging);
        this.status = await repo.status();
        this.targetBranchIsTracked = this.status.tracking != null;

        // validate cplace version after checking out the target branch
        this.validateCplaceVersion();
        this.selectedSkeletonBranch = this.getSkeletonBranchToMerge();

        // if not in merging state, merge skeleton
        if (!isRepoMerging) {
            if (this.targetBranchIsTracked) {
                await repo.pullOnlyFastForward(this.status.current)
                    .catch((err) => console.log(`Error when pulling target branch ${err}`));
            }
            await this.mergeSkeletonBranch(repo, MergeSkeleton.SKELETON_REMOTE_NAME, this.selectedSkeletonBranch, true)
                .catch((err) => {
                    console.error(`Cannot merge skeleton branch: ${err.message || err}`);
                    if (Global.isVerbose()) {
                        console.error('Full error details:', err);
                    }
                });
        }

        // check status again after merging
        this.status = await repo.status();
        isRepoMerging = await repo.isRepoMerging();

        // if it is in merging state (after a merge or after a rerun of the command)
        if (isRepoMerging) {
            // get a decision for any new files
            for (const file of this.status.created) {
                const fileDescriptor = this.status.files.find(f => f.path === file);
                if (fileDescriptor) {
                    await this.handleFile(fileDescriptor.path, fileDescriptor.index, fileDescriptor.working_dir, this.interactive, 'New file')
                }
            }

            // get a decision for any files with conflicts
            for (const file of this.status.conflicted) {
                const fileDescriptor = this.status.files.find(f => f.path === file);
                if (fileDescriptor) {
                    await this.handleFile(fileDescriptor.path, fileDescriptor.index, fileDescriptor.working_dir, this.interactive, 'Conflict on file')
                }
            }

            await this.acceptDecisionsAndContinueMerge(repo)
                .catch((err) => {
                    this.mergeSuccess = false;
                    console.error(err);
                    return Promise.reject('Fix conflicts manually and rerun the same command or use the --interactive option to resolve conflicts interactively.');
                });
        }

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

        const targetBranch = params[MergeSkeleton.PARAMETER_TARGET_BRANCH];
        if (typeof targetBranch === 'string') {
            Global.isVerbose() && console.log(`Using target branch ${targetBranch}`);
            this.targetBranch = targetBranch;
        }

        const skeletonBranch = params[MergeSkeleton.PARAMETER_SKELETON_BRANCH];
        if (typeof skeletonBranch === 'string') {
            Global.isVerbose() && console.log(`Using skeleton branch ${skeletonBranch}`);
            this.skeletonBranch = skeletonBranch;
        } else {
            console.log(`Skeleton branch not specified, will try to determine it automatically based on cplace version`);
        }

        const ours = params[MergeSkeleton.PARAMETER_OURS];
        if (typeof ours === 'string' || Array.isArray(ours)) {
            const oursArray: string[] = [].concat(ours);
            oursArray.forEach((element) => this.ours.add(element));
        }

        const pullRequest = !!params[MergeSkeleton.PARAMETER_PULL_REQUEST];
        if (pullRequest) {
            // check if target branch is specified
            if (!this.baseBranch || !this.targetBranch) {
                throw new Error('You need to specify both --base-branch and --target-branch to create a pull request.');
            } else {
                // check if gh is available
                try {
                    execSync(`${MergeSkeleton.GH_CLI_COMMAND} --version`);
                    this.pullRequest = true;
                    Global.isVerbose() && console.log('Will create pull request after successful merge');
                } catch (err) {
                    throw new Error('You need to have github cli (gh) installed to create a pull request.');
                }
            }
        }

        this.push = !!params[MergeSkeleton.PARAMETER_PUSH];
        if (this.push) {
            Global.isVerbose() && console.log('Will push branch after successful merge');
        }

        this.interactive = !!params[MergeSkeleton.PARAMETER_INTERACTIVE];

        return true;
    }

    private async handleFile(fileName: string, localStatus: string, remoteStatus: string, interactive: boolean, messagePrefix: string): Promise<void> {

        // get the corresponding merge status from the map
        const mergeStatus = MergeSkeleton.FILE_MERGE_STATUS_MAP.get(`${localStatus}${remoteStatus}`);
        
        let userResponse: string;
        if (interactive) {
            // ask user if he wants to keep the file
            userResponse = await this.userChoiceOursTheirsMerge(fileName, mergeStatus.defaultAction, mergeStatus.description, messagePrefix);
        } else {
            userResponse = mergeStatus.defaultActionLong;
        }
         
        if (userResponse === 'ours') {
            // accept our version
            this.ours.add(fileName);
        } else if (userResponse === 'theirs') {
            // accept their version
            this.theirs.add(fileName);
        } else if (userResponse === 'resolve') {
            // do nothing, resolve conflicts manually   
        }
    }

    private async userChoiceOursTheirsMerge(fileName: string, defaultChoice: any, description: string, messagePrefix: string): Promise<string> {
        return await expand({
            message: `${messagePrefix} '${fileName}' (${description}). Accept ([o]urs, [t]heirs, [r]esolve manually [default: ${defaultChoice}])?`,
            default: defaultChoice,
            choices: [
                {
                    key: 'o',
                    name: 'Accept our version',
                    value: 'ours',
                },
                {
                    key: 't',
                    name: 'Accept their version',
                    value: 'theirs',
                },
                {
                    key: 'r',
                    name: 'Resolve conflicts manually',
                    value: 'resolve',
                },
            ],
        });
    }

    private async unstageFile(repo: Repository, file: string): Promise<string> {
        return repo.rawWrapper(['restore', '--staged', file]);
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
            .catch((err) => {
                console.log(`Skeleton remote already exists.\n`);
                Global.isVerbose() && console.log(`Error: ${err}`);
            });
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
        if (this.baseBranch) {
            console.log(`Checking out base branch ${this.baseBranch}`);
            try {
                await repo.checkoutBranch(this.baseBranch);
            } catch (err) {
                console.log('Base branch cannot be checked out');
                Promise.reject();
            }
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

    private mergeSkeletonBranch(repo: Repository, remote: string, skeletonBranch: string, noCommit: boolean): Promise<void> {
        console.log(`Merging skeleton branch ${skeletonBranch}`);
        return repo.merge(remote, skeletonBranch, {noEdit: true, noCommit: noCommit});
    }

    private async acceptDecisionsAndContinueMerge(repo: Repository): Promise<void> {
        console.log('Accept any files specified with ours');
        for (const our of this.ours) {
            console.log(`Accepting our ${our}`);
            const fileDescriptor = this.status.files.find(f => f.path === our);
            if (this.status.created.includes(our)) {
                // if the file is new, unstage it and remove it
                await this.unstageFile(repo, our);
                fs.unlinkSync(path.join(repo.repoPath, our));
            } else if (fileDescriptor.index === 'D') {
                // if the file is deleted locally
                await repo.rawWrapper(['rm', '--sparse', '--', our]);
            } else {
                await repo.rawWrapper(['checkout', '--ours', our]);
                await repo.rawWrapper(['add', '--ignore-errors', '-A', '-f', '--', our]);
            }
        }

        console.log('Accept any files specified with theirs');
        for (const their of this.theirs) {
            console.log(`Accepting their ${their}`);
            await repo.rawWrapper(['checkout', '--theirs', '--', their]);
            await repo.rawWrapper(['add', '--ignore-errors', '-A', '-f', '--sparse', '--', their]);
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
