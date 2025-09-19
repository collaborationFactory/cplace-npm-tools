/**
 * List available workflows from skeleton repository
 */
import {ICommand, ICommandParameters} from '../../models';
import {Global} from '../../../Global';
import {WorkflowScanner} from '../../../helpers/WorkflowScanner';
import {AbstractWorkflowCommand} from './AbstractWorkflowCommand';

export class WorkflowsList extends AbstractWorkflowCommand implements ICommand {

    protected static readonly PARAMETER_SKELETON_BRANCH_KEBAB: string = 'skeleton-branch';

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing workflows list command');

        // Parse skeleton branch parameter (including kebab-case variant)
        this.parseSkeletonBranchParameter(params);

        // Also check kebab-case variant for backward compatibility
        if (!this.skeletonBranch) {
            const kebabBranch = params[WorkflowsList.PARAMETER_SKELETON_BRANCH_KEBAB];
            if (typeof kebabBranch === 'string') {
                this.skeletonBranch = kebabBranch;
                Global.isVerbose() && console.log(`Using skeleton branch override: ${this.skeletonBranch}`);
            }
        }

        return true;
    }

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
