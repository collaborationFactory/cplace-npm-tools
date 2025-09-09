/**
 * Utility class for managing skeleton repository operations
 * Extracted from MergeSkeleton.ts to enable reuse across commands
 */
import { Repository } from '../git';
import { Global } from '../Global';
import { CplaceVersion } from './CplaceVersion';

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
        SkeletonManager.CPLACE_VERSION_TO_SKELETON_VERSION.forEach((value: string, key: {major: number, minor: number, patch: number}) => {
            if (CplaceVersion.compareTo(key) >= 0) {
                skeletonVersion = value;
            }
        });

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
}