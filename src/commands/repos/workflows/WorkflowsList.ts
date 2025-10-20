/**
 * Lists and displays available workflows from skeleton repository with local comparison.
 * Extends AbstractWorkflowCommand to leverage repository setup and skeleton management.
 * Uses WorkflowScanner to scan available workflows and format display output.
 * Performs read-only operations without modifying any files or repository state.
 * Compares skeleton workflows with local repository to show availability status.
 */
import {ICommand, ICommandParameters} from '../../models';
import {Global} from '../../../Global';
import {WorkflowScanner} from '../../../helpers/WorkflowScanner';
import {AbstractWorkflowCommand} from './AbstractWorkflowCommand';

export class WorkflowsList extends AbstractWorkflowCommand implements ICommand {

    /**
     * Prepares and validates the list command for execution.
     * Parses skeleton branch parameter for workflow scanning.
     * Requires minimal validation as listing is a read-only operation.
     *
     * @param params The command parameters containing optional skeleton branch specification
     * @return true always, as listing doesn't require complex validation or prerequisites
     */
    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing workflows list command');

        // Parse skeleton branch parameter from base class
        this.parseSkeletonBranchParameter(params);

        return true;
    }

    /**
     * Executes the workflow listing process.
     * Initializes repository, sets up skeleton access, scans available workflows,
     * and displays formatted comparison results showing local vs skeleton workflow status.
     * Performs read-only operations without modifying repository or file system.
     *
     * @return Promise that resolves when workflow listing and display is complete
     * @throws Error If repository initialization, skeleton setup, or workflow scanning fails
     */
    public async execute(): Promise<void> {
        // Initialize repository (skip repo clean check for list command)
        await this.initializeRepository();
        Global.isVerbose() && console.log(`Listing available workflows in repo ${this.repo.repoName}`);

        // Setup skeleton repository
        await this.setupSkeletonRepository();

        // Scan workflows from skeleton and compare with local
        const workflowStatus = await WorkflowScanner.scanWorkflows(this.repo, this.selectedSkeletonBranch);

        // Display formatted results
        console.log(WorkflowScanner.formatWorkflowStatus(workflowStatus));

        return Promise.resolve();
    }
}
