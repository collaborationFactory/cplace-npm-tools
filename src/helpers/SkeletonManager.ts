/**
 * Utility class for managing skeleton repository operations
 * Extracted from MergeSkeleton.ts to enable reuse across commands
 */
import { Repository } from '../git';
import { Global } from '../Global';
import { CplaceVersion } from './CplaceVersion';
import { execSync } from 'child_process';

export class SkeletonManager {

    public static readonly SKELETON_REMOTE_NAME: string = 'skeleton';
    public static readonly SKELETON_REMOTE: string = 'https://github.com/collaborationFactory/cplace-customer-repo-skeleton.git';

    public static readonly CPLACE_VERSION_TO_SKELETON_VERSION: Map<{major: number, minor: number, patch: number}, string> = new Map([
        [{major: 5, minor: 4, patch: 0}, 'version/2.0'],
        [{major: 5, minor: 9, patch: 0}, 'version/3.0'],
        [{major: 5, minor: 11, patch: 0}, 'version/4.0'],
        [{major: 5, minor: 13, patch: 0}, 'version/5.0'],
        [{major: 5, minor: 19, patch: 0}, 'version/6.0'],
        [{major: 22, minor: 3, patch: 0}, 'version/7.0'],
        [{major: 23, minor: 1, patch: 0}, 'version/8.0'],
        [{major: 23, minor: 2, patch: 0}, 'version/23.2'],
        [{major: 23, minor: 3, patch: 0}, 'version/23.3'],
        [{major: 24, minor: 1, patch: 0}, 'version/24.1'],
        [{major: 25, minor: 2, patch: 0}, 'version/25.2'],
        [{major: 25, minor: 3, patch: 0}, 'version/25.3'],
        [{major: 25, minor: 4, patch: 0}, 'version/25.4'],
    ]);

    /**
     * Ensure skeleton remote exists and is fetched
     * Reuses existing remote if present, adds new one if missing
     */
    public static async ensureSkeletonRemote(repo: Repository): Promise<void> {
        Global.isVerbose() && console.log('Setting up skeleton repository remote');

        await repo.addRemote(SkeletonManager.SKELETON_REMOTE_NAME, SkeletonManager.SKELETON_REMOTE)
            .catch((err) => {
                console.log(`Skeleton remote already exists.`);
                Global.isVerbose() && console.log(`Error: ${err}`);
            });

        Global.isVerbose() && console.log('Fetching skeleton repository data');
        await repo.fetch({});
    }

    /**
     * Get the appropriate skeleton branch for the current cplace version
     * Handles manual override and automatic detection based on cplace version
     * Fixed typo from original MergeSkeleton implementation (skeletonVerion -> skeletonVersion)
     */
    public static getSkeletonBranchForVersion(overrideBranch?: string): string {
        if (overrideBranch) {
            Global.isVerbose() && console.log(`Using skeleton branch override: ${overrideBranch}`);
            return overrideBranch;
        }

        // Handle CplaceVersion initialization gracefully
        try {
            CplaceVersion.initialize();
        } catch (error) {
            // Version may already be initialized - this is fine
            Global.isVerbose() && console.log('CplaceVersion already initialized');
        }

        let skeletonVersion: string = '';
        const entries = Array.from(SkeletonManager.CPLACE_VERSION_TO_SKELETON_VERSION.entries());
        for (let i = entries.length - 1; i >= 0; i--) {
            const [key, value] = entries[i];
            if (CplaceVersion.compareTo(key) >= 0) {
                skeletonVersion = value;
                break;
            }
        }

        if (!skeletonVersion) {
            // Fallback to latest supported version if no match found
            skeletonVersion = 'version/25.4';
            console.warn(`No skeleton version mapping found for current cplace version. Using fallback: ${skeletonVersion}`);
        }

        Global.isVerbose() && console.log(`Selected skeleton branch: ${skeletonVersion} for cplace version ${CplaceVersion.toString()}`);
        return skeletonVersion;
    }

    /**
     * Check if a skeleton branch exists on the remote
     */
    public static async validateSkeletonBranchExists(repo: Repository, branch: string): Promise<boolean> {
        try {
            const exists = repo.checkBranchExistsOnRemote(SkeletonManager.SKELETON_REMOTE_NAME, branch);
            if (!exists) {
                console.error(`Skeleton branch '${branch}' does not exist on remote '${SkeletonManager.SKELETON_REMOTE_NAME}'`);
            }
            return exists;
        } catch (error) {
            Global.isVerbose() && console.log(`Error checking skeleton branch existence: ${error}`);
            return false;
        }
    }

    /**
     * Validate cplace version compatibility with skeleton operations
     * Reuses the same validation logic from MergeSkeleton
     */
    public static validateCplaceVersion(): void {
        try {
            CplaceVersion.initialize();
        } catch (error) {
            // Version may already be initialized - this is fine
            Global.isVerbose() && console.log('CplaceVersion already initialized');
        }

        console.log(`cplace version detected: ${CplaceVersion.toString()}`);

        if (CplaceVersion.compareTo({major: 5, minor: 4, patch: 0}) < 0) {
            throw new Error('Skeleton operations work only for cplace versions 5.4 or higher');
        }
    }

    /**
     * List files in a specific directory on a remote branch
     * Uses git ls-tree to enumerate files without checking out the branch
     */
    public static async getFilesFromRemoteBranch(repo: Repository, branch: string, directoryPath: string): Promise<string[]> {
        try {
            Global.isVerbose() && console.log(`Listing files in ${directoryPath} on remote branch ${branch}`);

            const remoteBranchRef = `${SkeletonManager.SKELETON_REMOTE_NAME}/${branch}`;
            const command = `git ls-tree --name-only -r "${remoteBranchRef}" "${directoryPath}/"`;

            const result: Buffer = execSync(command, {
                cwd: repo.workingDir,
                encoding: 'buffer'
            });

            if (!result || result.length === 0) {
                Global.isVerbose() && console.log(`No files found in ${directoryPath} on branch ${branch}`);
                return [];
            }

            const files = result.toString('utf8')
                .split(/\r?\n/)
                .filter(line => line.trim().length > 0)
                .map(line => line.trim());

            Global.isVerbose() && console.log(`Found ${files.length} files in ${directoryPath}: ${files.join(', ')}`);
            return files;
        } catch (error) {
            Global.isVerbose() && console.log(`Error listing files in remote branch: ${error}`);
            throw new Error(`Failed to list files in ${directoryPath} on branch ${branch}: ${error instanceof Error ? error.message : error}`);
        }
    }

    /**
     * Get content of a specific file from a remote branch
     * Uses git show to read file content without checking out the branch
     */
    public static async getFileContentFromRemote(repo: Repository, branch: string, filePath: string): Promise<string> {
        try {
            Global.isVerbose() && console.log(`Reading content of ${filePath} from remote branch ${branch}`);

            const remoteBranchRef = `${SkeletonManager.SKELETON_REMOTE_NAME}/${branch}`;
            const command = `git show "${remoteBranchRef}:${filePath}"`;

            const result: Buffer = execSync(command, {
                cwd: repo.workingDir,
                encoding: 'buffer'
            });

            const content = result.toString('utf8');
            Global.isVerbose() && console.log(`Successfully read ${content.length} characters from ${filePath}`);
            return content;
        } catch (error) {
            Global.isVerbose() && console.log(`Error reading file from remote branch: ${error}`);
            throw new Error(`Failed to read ${filePath} from branch ${branch}: ${error instanceof Error ? error.message : error}`);
        }
    }

    /**
     * List all workflow files (.yml and .yaml) in the skeleton repository's .github/workflows directory
     */
    public static async listWorkflowsInBranch(repo: Repository, branch: string): Promise<string[]> {
        try {
            const workflowsPath = '.github/workflows';
            const allFiles = await SkeletonManager.getFilesFromRemoteBranch(repo, branch, workflowsPath);

            // Filter for workflow files (.yml and .yaml)
            const workflowFiles = allFiles.filter(filePath => {
                const fileName = filePath.split('/').pop() || '';
                return fileName.endsWith('.yml') || fileName.endsWith('.yaml');
            });

            Global.isVerbose() && console.log(`Found ${workflowFiles.length} workflow files: ${workflowFiles.join(', ')}`);
            return workflowFiles;
        } catch (error) {
            if (error instanceof Error && error.message.includes('does not exist')) {
                Global.isVerbose() && console.log('No .github/workflows directory found in skeleton repository');
                return [];
            }
            throw error;
        }
    }
}
