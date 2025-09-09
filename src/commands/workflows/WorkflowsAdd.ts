/**
 * Add specific workflows from skeleton repository
 */
import * as path from 'path';
import {ICommand, ICommandParameters} from '../models';
import {Global} from '../../Global';
import {Workflows} from './Workflows';
import {SkeletonManager} from '../../helpers/SkeletonManager';
import {Repository} from '../../git';
import {AbstractReposCommand} from '../repos/AbstractReposCommand';

export class WorkflowsAdd extends AbstractReposCommand implements ICommand {
    
    protected static readonly PARAMETER_FORCE: string = 'force';
    protected static readonly PARAMETER_DRY_RUN: string = 'dryRun';
    protected static readonly PARAMETER_DRY_RUN_KEBAB: string = 'dry-run';
    protected static readonly PARAMETER_SKELETON_BRANCH: string = 'skeletonBranch';
    protected static readonly PARAMETER_SKELETON_BRANCH_KEBAB: string = 'skeleton-branch';

    protected workflowNames: string[] = [];
    protected force: boolean = false;
    protected dryRun: boolean = false;
    protected skeletonBranch: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing workflows add command');

        // Get workflow names from parameters
        const addWorkflows = params[Workflows.PARAMETER_ADD_WORKFLOWS] || params[Workflows.PARAMETER_ADD_WORKFLOWS_KEBAB];
        if (typeof addWorkflows === 'string') {
            this.workflowNames = addWorkflows.split(' ').filter(name => name.trim().length > 0);
        } else if (Array.isArray(addWorkflows)) {
            this.workflowNames = addWorkflows.flat().filter(name => typeof name === 'string' && name.trim().length > 0);
        }

        if (this.workflowNames.length === 0) {
            console.error('Error: No workflow names specified for --add-workflows');
            return false;
        }

        // Parse other parameters
        this.force = !!params[WorkflowsAdd.PARAMETER_FORCE];
        this.dryRun = !!params[WorkflowsAdd.PARAMETER_DRY_RUN] || !!params[WorkflowsAdd.PARAMETER_DRY_RUN_KEBAB];

        const skeletonBranch = params[WorkflowsAdd.PARAMETER_SKELETON_BRANCH] || params[WorkflowsAdd.PARAMETER_SKELETON_BRANCH_KEBAB];
        if (typeof skeletonBranch === 'string') {
            this.skeletonBranch = skeletonBranch;
            Global.isVerbose() && console.log(`Using skeleton branch: ${this.skeletonBranch}`);
        }

        if (this.force) {
            Global.isVerbose() && console.log('Force mode enabled - will overwrite existing files');
        }

        if (this.dryRun) {
            Global.isVerbose() && console.log('Dry run mode enabled - no changes will be made');
        }

        Global.isVerbose() && console.log(`Workflows to add: ${this.workflowNames.join(', ')}`);

        return true;
    }

    public async execute(): Promise<void> {
        try {
            const pathToRepo = path.join(process.cwd());
            const repo = new Repository(pathToRepo);

            await repo.checkIsRepo();
            console.log(`Adding workflows to repo ${repo.repoName}`);

            // Validate repository state unless force mode is enabled
            if (!this.force) {
                const status = await repo.status();
                this.checkRepoClean(repo, status);
            }

            // Validate cplace version compatibility
            SkeletonManager.validateCplaceVersion();

            // Setup skeleton repository access
            await SkeletonManager.ensureSkeletonRemote(repo);

            // Get appropriate skeleton branch
            const selectedSkeletonBranch = SkeletonManager.getSkeletonBranchForVersion(this.skeletonBranch);

            // Validate skeleton branch exists
            const branchExists = await SkeletonManager.validateSkeletonBranchExists(repo, selectedSkeletonBranch);
            if (!branchExists) {
                throw new Error(`Skeleton branch '${selectedSkeletonBranch}' does not exist`);
            }

            console.log(`Using skeleton branch: ${selectedSkeletonBranch}`);

            if (this.dryRun) {
                console.log('DRY RUN - No actual changes will be made');
            }

            console.log(`Workflows to add: ${this.workflowNames.join(', ')}`);
            console.log('Skeleton repository access configured successfully.');
            console.log('(Workflow validation and copying will be implemented in Phase 4)');

        } catch (error) {
            console.error(`Error adding workflows: ${error instanceof Error ? error.message : error}`);
            if (Global.isVerbose()) {
                console.error('Full error details:', error);
            }
            throw error;
        }
    }
}