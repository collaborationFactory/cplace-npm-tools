/**
 * Provides interactive workflow selection and addition from skeleton repository.
 * Extends AbstractWorkflowCommand to leverage repository setup and workflow operations.
 * Uses WorkflowScanner to detect available workflows and @inquirer/prompts for user interaction.
 * Presents checkbox interface for selecting multiple workflows to add simultaneously.
 * Automatically filters out existing workflows to show only missing ones for selection.
 */
import {checkbox} from '@inquirer/prompts';
import {ICommand, ICommandParameters} from '../../models';
import {Global} from '../../../Global';
import {WorkflowScanner} from '../../../helpers/WorkflowScanner';
import {IWorkflowInfo} from './models';
import {AbstractWorkflowCommand} from './AbstractWorkflowCommand';

export class WorkflowsAddInteractive extends AbstractWorkflowCommand implements ICommand {

    protected static readonly PARAMETER_FORCE: string = 'force';

    protected force: boolean = false;

    /**
     * Prepares and validates the interactive command for execution.
     * Parses force parameter and skeleton branch options from command parameters.
     * No workflow name validation required as selection happens interactively.
     *
     * @param params The command parameters containing force flag and skeleton branch options
     * @return true always, as interactive selection handles validation during execution
     */
    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing interactive workflows add command');

        // Parse force parameter
        this.force = !!params[WorkflowsAddInteractive.PARAMETER_FORCE];

        this.parseSkeletonBranchParameter(params);

        if (this.force) {
            Global.isVerbose() && console.log('Force mode enabled - will overwrite existing files');
        }

        return true;
    }

    /**
     * Executes the interactive workflow addition process.
     * Initializes repository, sets up skeleton access, scans for available workflows,
     * presents interactive selection interface, and copies selected workflows.
     * Gracefully handles cases where no missing workflows are found.
     *
     * @return Promise that resolves when interactive selection and copying is complete
     * @throws Error If repository initialization, skeleton setup, or workflow operations fail
     */
    public async execute(): Promise<void> {
        // Initialize repository with force flag consideration
        await this.initializeRepository();
        console.log(`Interactive workflow selection for repo ${this.repo.repoName}`);

        // Setup skeleton repository
        await this.setupSkeletonRepository();

        // Perform interactive workflow selection
        const selectedWorkflows = await this.performInteractiveWorkflowSelection();

        await this.copyWorkflowsWithEnvironment(selectedWorkflows, this.force);

        return Promise.resolve();
    }

    /**
     * Performs interactive workflow selection by scanning available workflows and filtering missing ones.
     * Uses WorkflowScanner to detect all available workflows from skeleton repository.
     * Filters results to show only workflows not already present in current repository.
     * Delegates to user selection interface if missing workflows are found.
     *
     * @return Promise resolving to array of selected workflow file names, empty if no missing workflows or none selected
     * @throws Error If workflow scanning fails or skeleton repository is inaccessible
     */
    private async performInteractiveWorkflowSelection(): Promise<string[]> {
        // Scan workflows
        console.log('Scanning available workflows...');
        const workflowStatus = await WorkflowScanner.scanWorkflows(this.repo, this.selectedSkeletonBranch);

        // Filter missing workflows
        const missingWorkflows = workflowStatus.available.filter(w => !w.exists);

        if (missingWorkflows.length === 0) {
            console.log('No missing workflows found. All available workflows are already present in this repository.');
        }

        return await this.getUserWorkflowSelection(missingWorkflows);

    }

    /**
     * Presents interactive checkbox interface for workflow selection.
     * Creates choices with workflow display names and file names for user selection.
     * Uses @inquirer/prompts checkbox for multi-select workflow interface.
     * Selection is optional - user can proceed with empty selection.
     *
     * @param missingWorkflows Array of workflow info objects for workflows not present in current repository
     * @return Promise resolving to array of selected workflow file names, empty array if none selected
     * @throws Error If interactive prompt fails or is cancelled by user
     */
    private async getUserWorkflowSelection(missingWorkflows: IWorkflowInfo[]): Promise<string[]> {
        const choices = missingWorkflows.map(workflow => ({
            name: `${workflow.name} (${workflow.fileName})`,
            value: workflow.fileName,
            checked: false
        }));

        console.log(`Found ${missingWorkflows.length} missing workflow(s). Use space to select, enter to confirm:`);

        return checkbox({
            message: 'Select workflows to add:',
            choices: choices,
            required: false
        });
    }


}
