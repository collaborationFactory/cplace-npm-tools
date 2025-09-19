/**
 * Add specific workflows from skeleton repository
 */
import {ICommand, ICommandParameters} from '../../models';
import {Global} from '../../../Global';
import {Workflows} from './Workflows';
import {AbstractWorkflowCommand} from './AbstractWorkflowCommand';

export class WorkflowsAdd extends AbstractWorkflowCommand implements ICommand {

    protected static readonly PARAMETER_FORCE: string = 'force';
    protected static readonly PARAMETER_DRY_RUN: string = 'dryRun';

    protected workflowNames: string[] = [];
    protected force: boolean = false;
    protected dryRun: boolean = false;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing workflows add command');

        // Parse workflow names
        if (!this.parseWorkflowNames(params)) {
            return false;
        }

        // Parse other parameters
        this.force = !!params[WorkflowsAdd.PARAMETER_FORCE];
        this.dryRun = !!params[WorkflowsAdd.PARAMETER_DRY_RUN];
        this.parseSkeletonBranchParameter(params);

        if (this.force) {
            Global.isVerbose() && console.log('Force mode enabled - will overwrite existing files');
        }
        if (this.dryRun) {
            Global.isVerbose() && console.log('Dry run mode enabled - no changes will be made');
        }

        Global.isVerbose() && console.log(`Workflows to add: ${this.workflowNames.join(', ')}`);
        return true;
    }

    private parseWorkflowNames(params: ICommandParameters): boolean {
        const addWorkflows = params[Workflows.PARAMETER_ADD_WORKFLOWS];
        if (typeof addWorkflows === 'string') {
            this.workflowNames = addWorkflows.split(' ').filter(name => name.trim().length > 0);
        } else if (Array.isArray(addWorkflows)) {
            this.workflowNames = addWorkflows.flat().filter(name => typeof name === 'string' && name.trim().length > 0);
        }

        if (this.workflowNames.length === 0) {
            console.error('Error: No workflow names specified for --add-workflows');
            return false;
        }
        return true;
    }

    public async execute(): Promise<void> {
        try {
            // Initialize repository with force flag consideration
            await this.initializeRepository();
            console.log(`Adding workflows to repo ${this.repo.repoName}`);

            // Setup skeleton repository
            await this.setupSkeletonRepository();

            // Copy specified workflows
            await this.copySpecifiedWorkflows(this.workflowNames, this.force);

        } catch (error) {
            console.error(`Error adding workflows: ${error instanceof Error ? error.message : error}`);
            if (Global.isVerbose()) {
                console.error('Full error details:', error);
            }
            throw error;
        }
    }


    private async copySpecifiedWorkflows(workflowNames: string[], force: boolean): Promise<void> {
        console.log(`Adding workflows: ${workflowNames.join(', ')}`);

        for (const workflowName of workflowNames) {
            // Add .yml extension if not present
            const workflowFileName = workflowName.endsWith('.yml') || workflowName.endsWith('.yaml')
                ? workflowName
                : `${workflowName}.yml`;

             await this.copyWorkflowWithEnvironment(workflowFileName, force);

        }

    }
}
