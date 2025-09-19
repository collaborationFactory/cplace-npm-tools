/**
 * Adds specific workflows from skeleton repository to the current repository.
 * Extends AbstractWorkflowCommand to leverage repository setup, skeleton management, and workflow operations.
 * Works in conjunction with Workflows command for parameter parsing and SkeletonManager for file operations.
 * Supports force mode to overwrite existing workflows without confirmation.
 */
import {ICommand, ICommandParameters} from '../../models';
import {Global} from '../../../Global';
import {Workflows} from './Workflows';
import {AbstractWorkflowCommand} from './AbstractWorkflowCommand';

export class WorkflowsAdd extends AbstractWorkflowCommand implements ICommand {

    protected static readonly PARAMETER_FORCE: string = 'force';

    protected workflowNames: string[] = [];
    protected force: boolean = false;

    /**
     * Prepares and validates the command for execution.
     * Parses workflow names and force parameter from command parameters.
     *
     * @param params The command parameters containing workflow names and options
     * @return true if preparation successful and command can execute, false if validation failed
     */
    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing workflows add command');

        // Parse workflow names
        if (!this.parseWorkflowNames(params)) {
            return false;
        }

        // Parse other parameters
        this.force = !!params[WorkflowsAdd.PARAMETER_FORCE];
        this.parseSkeletonBranchParameter(params);

        if (this.force) {
            Global.isVerbose() && console.log('Force mode enabled - will overwrite existing files');
        }

        Global.isVerbose() && console.log(`Workflows to add: ${this.workflowNames.join(', ')}`);
        return true;
    }

    /**
     * Parses workflow names from command parameters.
     * Accepts workflow names as space-separated string or array format.
     * Filters out empty/invalid names and validates at least one workflow is specified.
     *
     * @param params The command parameters containing workflow names under 'add-workflows' key
     * @return true if workflow names parsed successfully, false if no valid workflow names found
     */
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

    /**
     * Executes the workflow addition process.
     * Initializes repository, sets up skeleton repository access, and copies specified workflows.
     * Handles errors gracefully with detailed logging in verbose mode.
     *
     * @return Promise that resolves when all workflows are processed
     * @throws Error If repository initialization, skeleton setup, or workflow copying fails
     */
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


    /**
     * Copies specified workflows from skeleton repository to current repository.
     * Automatically adds .yml extension to workflow names if not present.
     * Copies both workflow files and associated environment files if they exist.
     *
     * @param workflowNames Array of workflow names to copy (with or without .yml/.yaml extension)
     * @param force Whether to overwrite existing files without confirmation
     * @return Promise that resolves when all specified workflows are processed
     * @throws Error If workflow copying fails for any of the specified workflows
     */
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
