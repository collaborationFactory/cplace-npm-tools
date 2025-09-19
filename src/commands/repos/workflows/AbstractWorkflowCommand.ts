/**
 * Abstract base class for workflow-related commands
 * Contains shared functionality for repository setup, skeleton management, and workflow operations
 */
import * as path from 'path';
import * as fs from 'fs';
import {confirm} from '@inquirer/prompts';
import {ICommandParameters} from '../../models';
import {Global} from '../../../Global';
import {SkeletonManager} from '../../../helpers/SkeletonManager';
import {Repository} from '../../../git';
import {AbstractReposCommand} from '../AbstractReposCommand';

export abstract class AbstractWorkflowCommand extends AbstractReposCommand {

    protected static readonly PARAMETER_SKELETON_BRANCH: string = 'skeletonBranch';

    protected skeletonBranch?: string;
    protected repo: Repository;
    protected selectedSkeletonBranch: string;

    /**
     * Initialize repository and validate its state
     */
    protected async initializeRepository(): Promise<Repository> {
        const pathToRepo = path.join(process.cwd());
        this.repo = new Repository(pathToRepo);

        await this.repo.checkIsRepo();
        Global.isVerbose() && console.log(`Working with repo ${this.repo.repoName}`);
        return this.repo;
    }

    /**
     * Setup and validate skeleton repository access
     */
    protected async setupSkeletonRepository(): Promise<string> {
        // Validate cplace version compatibility
        SkeletonManager.validateCplaceVersion();

        // Setup skeleton repository access
        await SkeletonManager.ensureSkeletonRemote(this.repo);

        // Get appropriate skeleton branch
        this.selectedSkeletonBranch = SkeletonManager.getSkeletonBranchForVersion(this.skeletonBranch);

        // Validate skeleton branch exists
        const branchExists = await SkeletonManager.validateSkeletonBranchExists(this.repo, this.selectedSkeletonBranch);
        if (!branchExists) {
            throw new Error(`Skeleton branch '${this.selectedSkeletonBranch}' does not exist`);
        }

        Global.isVerbose() && console.log(`Using skeleton branch: ${this.selectedSkeletonBranch}`);
        return this.selectedSkeletonBranch;
    }

    /**
     * Copy a workflow and its optional environment file from skeleton
     */
    protected async copyWorkflowWithEnvironment(
        workflowFileName: string,
        force: boolean = false
    ): Promise<boolean> {
        const localWorkflowsPath = path.join(this.repo.workingDir, '.github', 'workflows');

        // Validate the workflows directory path
        if (!this.validatePath(localWorkflowsPath)) {
            throw new Error(`Invalid workflows directory path: ${localWorkflowsPath}`);
        }

        // Ensure .github/workflows directory exists
        await fs.promises.mkdir(localWorkflowsPath, {recursive: true});

        try {
            // Copy workflow file
            const success = await this.copyWorkflowFile(workflowFileName, force);
            if (!success) {
                return false;
            }

            // Copy associated environment file if it exists
            await this.copyEnvironmentFile(workflowFileName, force);

            return true;

        } catch (error) {
            console.error(`✗ Failed to copy workflow ${workflowFileName}: ${error instanceof Error ? error.message : error}`);
            if (Global.isVerbose()) {
                console.error('Full error details:', error);
            }
            return false;
        }
    }

    /**
     * Copy a file from skeleton repository with standard confirmation handling
     */
    private async copyFileFromSkeleton(
        skeletonPath: string,
        localPath: string,
        fileName: string,
        overwriteExisting: boolean
    ): Promise<boolean> {
        // Validate the local path for security
        if (!this.validatePath(localPath)) {
            throw new Error(`Invalid path: ${localPath}`);
        }

        if (fs.existsSync(localPath)) {
            if (!overwriteExisting) {
                const overwrite = await confirm({
                    message: `File ${fileName} already exists. Overwrite?`,
                    default: false
                });
                if (!overwrite) {
                    console.log(`Skipped: ${fileName}`);
                    return false;
                }
            }
        }

        await SkeletonManager.copyFileFromRemote(
            this.repo,
            this.selectedSkeletonBranch,
            skeletonPath,
            localPath
        );
        console.log(`✓ Copied: ${fileName}`);
        return true;
    }

    /**
     * Copy the workflow file from skeleton repository
     */
    private async copyWorkflowFile(
        workflowFileName: string,
        overwriteExisting: boolean,
    ): Promise<boolean> {
        const localWorkflowsPath = path.join(this.repo.workingDir, '.github', 'workflows');
        const skeletonWorkflowPath = `.github/workflows/${workflowFileName}`;
        const localWorkflowPath = path.join(localWorkflowsPath, workflowFileName);

        // Validate the local workflow path
        if (!this.validatePath(localWorkflowPath)) {
            throw new Error(`Invalid workflow path: ${localWorkflowPath}`);
        }

        // Check if workflow file exists in skeleton repository
        const fileExists = await SkeletonManager.fileExistsInRemote(
            this.repo,
            this.selectedSkeletonBranch,
            skeletonWorkflowPath
        );

        if (!fileExists) {
            console.log(`✗ Workflow not found: ${workflowFileName}`);
            return false;
        }

        return await this.copyFileFromSkeleton(
            skeletonWorkflowPath,
            localWorkflowPath,
            workflowFileName,
            overwriteExisting
        );
    }

    /**
     * Copy environment file associated with a workflow
     */
    private async copyEnvironmentFile(
        workflowFileName: string,
        overwriteExisting: boolean = false
    ): Promise<void> {
        const localGithubPath = path.join(this.repo.workingDir, '.github');
        const workflowBaseName = workflowFileName.replace(/\.(ya?ml)$/, '');
        const envFileName = `.${workflowBaseName}-env`;
        const skeletonEnvPath = `.github/${envFileName}`;
        const localEnvPath = path.join(localGithubPath, envFileName);

        // Validate the local environment file path
        if (!this.validatePath(localEnvPath)) {
            throw new Error(`Invalid environment file path: ${localEnvPath}`);
        }

        // Check if environment file exists in skeleton
        const envFileExists = await SkeletonManager.fileExistsInRemote(
            this.repo,
            this.selectedSkeletonBranch,
            skeletonEnvPath
        );

        if (!envFileExists) {
            Global.isVerbose() && console.log(`  No environment file found for ${workflowFileName} (${envFileName})`);
            return;
        }

        try {
            await this.copyFileFromSkeleton(
                skeletonEnvPath,
                localEnvPath,
                envFileName,
                overwriteExisting
            );
        } catch (envError) {
            console.error(`  ✗ Failed to copy environment file ${envFileName}: ${envError instanceof Error ? envError.message : envError}`);
        }
    }

    /**
     * Validate a file path for security
     * @param filePath Path to validate
     * @returns true if the path is valid, false otherwise
     */
    private validatePath(filePath: string): boolean {
        const normalized = path.normalize(filePath);
        return !normalized.includes('..') && path.isAbsolute(normalized);
    }

    /**
     * Parse skeleton branch parameter
     */
    protected parseSkeletonBranchParameter(params: ICommandParameters): void {
        const skeletonBranch = params[AbstractWorkflowCommand.PARAMETER_SKELETON_BRANCH];
        if (typeof skeletonBranch === 'string') {
            this.skeletonBranch = skeletonBranch;
            Global.isVerbose() && console.log(`Using skeleton branch override: ${this.skeletonBranch}`);
        }
    }

    protected async copyWorkflowsWithEnvironment(selectedWorkflows: string[], force: boolean) {
        for (const workflow of selectedWorkflows) {
            await this.copyWorkflowWithEnvironment(workflow, force);
        }
    }
}
