/**
 * Interactive workflow selection and addition from skeleton repository
 */
import * as path from 'path';
import * as fs from 'fs';
import { checkbox, confirm } from '@inquirer/prompts';
import { ICommand, ICommandParameters } from '../../models';
import { Global } from '../../../Global';
import { SkeletonManager } from '../../../helpers/SkeletonManager';
import { WorkflowScanner } from '../../../helpers/WorkflowScanner';
import { Repository } from '../../../git';
import { AbstractReposCommand } from '../AbstractReposCommand';

export class WorkflowsAddInteractive extends AbstractReposCommand implements ICommand {

    protected static readonly PARAMETER_SKELETON_BRANCH: string = 'skeletonBranch';

    protected skeletonBranch?: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        Global.isVerbose() && console.log('Preparing interactive workflows add command');

        // Parse skeleton branch override parameter
        const skeletonBranch = params[WorkflowsAddInteractive.PARAMETER_SKELETON_BRANCH];
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
            Global.isVerbose() && console.log(`Interactive workflow selection for repo ${repo.repoName}`);

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

            const localWorkflowsPath = path.join(repo.workingDir, '.github', 'workflows');
            const localGithubPath = path.join(repo.workingDir, '.github');

            // Ensure .github/workflows directory exists
            await fs.promises.mkdir(localWorkflowsPath, { recursive: true });

            for (const workflowFileName of selectedWorkflows) {
                try {
                    // Copy workflow file from skeleton
                    const skeletonWorkflowPath = `.github/workflows/${workflowFileName}`;
                    const localWorkflowPath = path.join(localWorkflowsPath, workflowFileName);

                    // Check if workflow file already exists locally
                    if (fs.existsSync(localWorkflowPath)) {
                        const overwrite = await confirm({
                            message: `Workflow ${workflowFileName} already exists. Overwrite?`,
                            default: false
                        });

                        if (!overwrite) {
                            console.log(`  Skipped: ${workflowFileName}`);
                            continue;
                        }
                    }

                    await SkeletonManager.copyFileFromRemote(repo, selectedSkeletonBranch, skeletonWorkflowPath, localWorkflowPath);
                    console.log(`✓ Copied workflow: ${workflowFileName}`);

                    // Check for associated environment file
                    const workflowBaseName = workflowFileName.replace(/\.(ya?ml)$/, '');
                    const envFileName = `.${workflowBaseName}-env`;
                    const skeletonEnvPath = `.github/${envFileName}`;
                    const localEnvPath = path.join(localGithubPath, envFileName);

                    // Check if environment file exists in skeleton before trying to copy
                    const envFileExists = await SkeletonManager.fileExistsInRemote(repo, selectedSkeletonBranch, skeletonEnvPath);
                    if (envFileExists) {
                        // Check if environment file already exists locally
                        if (fs.existsSync(localEnvPath)) {
                            const overwrite = await confirm({
                                message: `Environment file ${envFileName} already exists. Overwrite?`,
                                default: false
                            });

                            if (!overwrite) {
                                console.log(`  Skipped: ${envFileName}`);
                                continue;
                            }
                        }

                        try {
                            await SkeletonManager.copyFileFromRemote(repo, selectedSkeletonBranch, skeletonEnvPath, localEnvPath);
                            console.log(`  ✓ Copied environment file: ${envFileName}`);
                        } catch (envError) {
                            console.error(`  ✗ Failed to copy environment file ${envFileName}: ${envError instanceof Error ? envError.message : envError}`);
                        }
                    } else {
                        Global.isVerbose() && console.log(`  No environment file found for ${workflowFileName} (${envFileName})`);
                    }

                } catch (error) {
                    console.error(`✗ Failed to copy workflow ${workflowFileName}: ${error instanceof Error ? error.message : error}`);
                    if (Global.isVerbose()) {
                        console.error('Full error details:', error);
                    }
                }
            }

        } catch (error) {
            console.error(`Error in interactive workflow selection: ${error instanceof Error ? error.message : error}`);
            if (Global.isVerbose()) {
                console.error('Full error details:', error);
            }
            process.exit(1);
        }
    }
}
