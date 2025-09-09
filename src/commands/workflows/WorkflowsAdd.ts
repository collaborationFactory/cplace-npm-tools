/**
 * Add specific workflows from skeleton repository
 */
import {ICommand, ICommandParameters} from '../models';
import {Global} from '../../Global';
import {Workflows} from './Workflows';

export class WorkflowsAdd implements ICommand {
    
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
        console.log(`Adding workflows: ${this.workflowNames.join(', ')}`);
        if (this.dryRun) {
            console.log('DRY RUN - No actual changes will be made');
        }
        if (this.skeletonBranch) {
            console.log(`Using skeleton branch: ${this.skeletonBranch}`);
        }
        console.log('(This is a stub implementation - workflow copying will be implemented in Phase 4)');
    }
}