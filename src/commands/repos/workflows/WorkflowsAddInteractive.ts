/**
 * Interactive workflow selection and addition from skeleton repository
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
