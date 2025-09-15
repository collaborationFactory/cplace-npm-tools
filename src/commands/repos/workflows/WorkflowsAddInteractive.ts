/**
 * Interactive workflow selection and addition from skeleton repository
 */
import * as path from 'path';
import { checkbox } from '@inquirer/prompts';
import { ICommand, ICommandParameters } from '../../models';
import { Global } from '../../../Global';
import { SkeletonManager } from '../../../helpers/SkeletonManager';
import { WorkflowScanner } from '../../../helpers/WorkflowScanner';
import { Repository } from '../../../git';
import { AbstractReposCommand } from '../AbstractReposCommand';

export class WorkflowsAddInteractive extends AbstractReposCommand implements ICommand {

    protected static readonly PARAMETER_SKELETON_BRANCH: string = 'skeletonBranch';
    protected static readonly PARAMETER_SKELETON_BRANCH_KEBAB: string = 'skeleton-branch';
    protected static readonly PARAMETER_FORCE: string = 'force';

    protected skeletonBranch?: string;
    protected force: boolean = false;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing interactive workflows add command');

        // Parse skeleton branch override parameter
        const skeletonBranch = params[WorkflowsAddInteractive.PARAMETER_SKELETON_BRANCH] || params[WorkflowsAddInteractive.PARAMETER_SKELETON_BRANCH_KEBAB];
        if (typeof skeletonBranch === 'string') {
            this.skeletonBranch = skeletonBranch;
            Global.isVerbose() && console.log(`Using skeleton branch override: ${this.skeletonBranch}`);
        }

        // Parse force parameter
        this.force = !!params[WorkflowsAddInteractive.PARAMETER_FORCE];
        if (this.force) {
            Global.isVerbose() && console.log('Force mode enabled - will overwrite existing files');
        }

        return true;
    }

    public async execute(): Promise<void> {
        try {
            const pathToRepo = path.join(process.cwd());
            const repo = new Repository(pathToRepo);

            await repo.checkIsRepo();
            Global.isVerbose() && console.log(`Interactive workflow selection for repo ${repo.repoName}`);

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

            Global.isVerbose() && console.log(`Using skeleton branch: ${selectedSkeletonBranch}`);

            // Scan workflows from skeleton and compare with local
            console.log('Scanning available workflows...');
            const workflowStatus = await WorkflowScanner.scanWorkflows(repo, selectedSkeletonBranch);

            // Filter to show only missing workflows (ones we can add)
            const missingWorkflows = workflowStatus.available.filter(w => !w.exists);

            if (missingWorkflows.length === 0) {
                console.log('No missing workflows found. All available workflows are already present in this repository.');
                return;
            }

            // Create choices for interactive selection
            const choices = missingWorkflows.map(workflow => ({
                name: `${workflow.name} (${workflow.fileName})`,
                value: workflow.fileName,
                checked: false
            }));

            // Interactive selection
            console.log(`Found ${missingWorkflows.length} missing workflow(s). Use space to select, enter to confirm:`);
            const selectedWorkflows = await checkbox({
                message: 'Select workflows to add:',
                choices: choices,
                required: false
            });

            if (selectedWorkflows.length === 0) {
                console.log('No workflows selected. Nothing to do.');
                return;
            }

            console.log(`Selected ${selectedWorkflows.length} workflow(s): ${selectedWorkflows.join(', ')}`);
            console.log('Copying selected workflows...');

            // TODO: Implement actual workflow copying logic
            // For now, show what would be copied
            for (const workflowFileName of selectedWorkflows) {
                console.log(`✓ Would copy workflow: ${workflowFileName}`);
                // TODO: Copy workflow file from skeleton
                // TODO: Copy associated environment files
            }

            console.log(`Successfully processed ${selectedWorkflows.length} workflow(s).`);
            console.log('(Note: Actual file copying will be implemented in the next phase)');

        } catch (error) {
            console.error(`Error in interactive workflow selection: ${error instanceof Error ? error.message : error}`);
            if (Global.isVerbose()) {
                console.error('Full error details:', error);
            }
            process.exit(1);
        }
    }
}