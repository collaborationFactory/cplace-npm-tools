/**
 * List available workflows from skeleton repository
 */
import * as path from 'path';
import {ICommand, ICommandParameters} from '../../models';
import {Global} from '../../../Global';
import {SkeletonManager} from '../../../helpers/SkeletonManager';
import {WorkflowScanner} from '../../../helpers/WorkflowScanner';
import {Repository} from '../../../git';

export class WorkflowsList implements ICommand {

    protected static readonly PARAMETER_SKELETON_BRANCH: string = 'skeletonBranch';
    protected static readonly PARAMETER_SKELETON_BRANCH_KEBAB: string = 'skeleton-branch';

    protected skeletonBranch?: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing workflows list command');

        // Parse skeleton branch override parameter
        const skeletonBranch = params[WorkflowsList.PARAMETER_SKELETON_BRANCH] || params[WorkflowsList.PARAMETER_SKELETON_BRANCH_KEBAB];
        if (typeof skeletonBranch === 'string') {
            this.skeletonBranch = skeletonBranch;
            Global.isVerbose() && console.log(`Using skeleton branch override: ${this.skeletonBranch}`);
        }

        return true;
    }

    public async execute(): Promise<void> {
        try {
            const pathToRepo = path.join(process.cwd());
            const repo = new Repository(pathToRepo);

            await repo.checkIsRepo();
            Global.isVerbose() && console.log(`Listing available workflows in repo ${repo.repoName}`);

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

            Global.isVerbose() && console.log(`Using skeleton branch: ${selectedSkeletonBranch}`);

            // Scan workflows from skeleton and compare with local
            const workflowStatus = await WorkflowScanner.scanWorkflows(repo, selectedSkeletonBranch);

            // Display formatted results
            console.log(WorkflowScanner.formatWorkflowStatus(workflowStatus));

        } catch (error) {
            console.error(`Error listing workflows: ${error instanceof Error ? error.message : error}`);
            if (Global.isVerbose()) {
                console.error('Full error details:', error);
            }
            process.exit(1);
        }
    }
}
