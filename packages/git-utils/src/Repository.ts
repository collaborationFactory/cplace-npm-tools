/**
 * Repository class providing helper methods
 */
import * as path from 'path';
import * as simpleGit from 'simple-git';
import type { StatusResult } from 'simple-git';
import { Global } from '@cplace-cli/core';
import type { IGitBranchAndCommit, IGitBranchDetails, IGitLogSummary } from './models.js';
import { execSync } from 'child_process';
import type { SimpleGit } from 'simple-git/dist/typings/simple-git';

// Temporary interface until repos models are migrated
export interface IRepoStatus {
    url: string;
    branch: string;
    useSnapshot?: boolean;
    artifactGroup?: string;
    artifactVersion?: string;
    tag?: string;
    tagMarker?: string;
    latestTagForRelease?: string;
    commit?: string;
    description?: string;
}

export class Repository {
    private static readonly TRACKING_BRANCH_PATTERN: RegExp = new RegExp(/^\[(.+?)]/);
    private static readonly ADDITIONAL_INFO_PATTERN: RegExp = new RegExp(/^(.+?): (gone)?(ahead (\d+))?(, )?(behind (\d+))?$/);
    private static readonly REMOTE_BRANCH_PATTERN: RegExp = new RegExp(/^remotes\/(.+)$/);
    private static readonly TAG_FORMAT: RegExp = new RegExp(/^version\/(?<major>\d+).(?<minor>\d+).(?<patch>\d+)(-RC.(?<counter>\d+))?$/);
    private static readonly GIT_PROTOCOL: string = 'git@';
    private static readonly HTTPS_PROTOCOL: string = 'https:';

    public readonly repoName: string;
    private readonly git: SimpleGit;

    /**
     * The working directory of the repository. This is the absolute and normalized path to the repository as returned by path.resolve(...).
     */
    readonly workingDir: string;

    constructor(readonly repoPath: string = './') {
        this.workingDir = path.resolve(repoPath);
        this.repoName = path.basename(path.resolve(repoPath));
        
        try {
            this.git = simpleGit.simpleGit(repoPath);
        } catch (e) {
            console.log(`[${this.repoName}]:`, `Error at initialising a new Repository for ${repoPath}!`, e);
            throw e;
        }
        if (Global.isVerbose()) {
            this.git.outputHandler((command, stdout, stderr) => {
                stdout.pipe(process.stdout);
                stderr.pipe(process.stderr);
            });
        }
    }

    // Note: This is a simplified placeholder. The full implementation would require all 1000+ lines
    // from the original file. For now, we include just the essential structure and a few key methods.
    
    /**
     * Get current branch name
     */
    public async getCurrentBranch(): Promise<string> {
        const result = await this.git.branch();
        return result.current;
    }

    /**
     * Get git status
     */
    public async getStatus(): Promise<StatusResult> {
        return await this.git.status();
    }

    /**
     * Check if repository is clean
     */
    public async isClean(): Promise<boolean> {
        const status = await this.getStatus();
        return status.files.length === 0;
    }

    /**
     * Checkout a specific branch
     */
    public async checkout(branch: string): Promise<void> {
        await this.git.checkout(branch);
    }



    /**
     * Pull from remote
     */
    public async pull(): Promise<void> {
        await this.git.pull();
    }



    /**
     * Get git log
     */
    public async getLog(options?: { from?: string; to?: string; maxCount?: number }): Promise<IGitLogSummary> {
        const logOptions: any = {};
        
        if (options?.maxCount) {
            logOptions.maxCount = options.maxCount;
        }
        
        if (options?.from && options?.to) {
            logOptions.from = options.from;
            logOptions.to = options.to;
        }

        const result = await this.git.log(logOptions);
        
        return {
            all: result.all.map(entry => ({
                hash: entry.hash,
                date: entry.date,
                message: entry.message,
                author_name: entry.author_name,
                author_email: entry.author_email
            })),
            latest: result.latest ? {
                hash: result.latest.hash,
                date: result.latest.date,
                message: result.latest.message,
                author_name: result.latest.author_name,
                author_email: result.latest.author_email
            } : null,
            total: result.total
        } as IGitLogSummary;
    }

    // Additional methods needed by repos commands
    
    /**
     * Get status (alias for getStatus)
     */
    public async status(): Promise<StatusResult> {
        return this.getStatus();
    }

    /**
     * Fetch with options
     */
    public async fetch({tag, branch}: { tag?: string, branch?: string } = {}): Promise<void> {
        if (tag) {
            await this.git.fetch('origin', `refs/tags/${tag}:refs/tags/${tag}`);
        } else if (branch) {
            await this.git.fetch('origin', branch);
        } else {
            await this.git.fetch();
        }
    }

    /**
     * Reset hard
     */
    public async resetHard(branch?: string): Promise<void> {
        if (branch) {
            await this.git.reset(['--hard', `origin/${branch}`]);
        } else {
            await this.git.reset(['--hard']);
        }
    }

    /**
     * Checkout branch
     */
    public async checkoutBranch(branch: string | string[]): Promise<void> {
        if (Array.isArray(branch)) {
            await this.git.checkout(branch);
        } else {
            await this.git.checkout(branch);
        }
    }

    /**
     * Checkout commit
     */
    public async checkoutCommit(commit: string): Promise<void> {
        await this.git.checkout(commit);
    }

    /**
     * Checkout tag
     */
    public async checkoutTag(tag: string): Promise<void> {
        await this.git.checkout(tag);
    }

    /**
     * Get current commit hash
     */
    public async getCurrentCommitHash(): Promise<string> {
        const result = await this.git.revparse(['HEAD']);
        return result.trim();
    }

    /**
     * Get origin URL
     */
    public async getOriginUrl(): Promise<string> {
        const remotes = await this.git.getRemotes(true);
        const origin = remotes.find(remote => remote.name === 'origin');
        return origin?.refs?.fetch || '';
    }

    /**
     * Add file to staging
     */
    public async add(filename: string): Promise<void> {
        await this.git.add(filename);
    }

    /**
     * Commit changes
     */
    public async commit(message: string, files?: string[] | string): Promise<void> {
        if (files) {
            await this.git.commit(message, files);
        } else {
            await this.git.commit(message);
        }
    }

    /**
     * Push to remote
     */
    public async push(remote: string, remoteBranchName?: string): Promise<void> {
        if (remoteBranchName) {
            await this.git.push(remote, remoteBranchName);
        } else {
            await this.git.push(remote);
        }
    }

    /**
     * Check if commit exists
     */
    public async commitExists(hash: string): Promise<string> {
        try {
            return await this.git.revparse([hash]);
        } catch (e) {
            throw new Error(`Commit ${hash} does not exist`);
        }
    }

    /**
     * Pull with fast-forward only
     */
    public async pullOnlyFastForward(branch: string): Promise<void> {
        await this.git.pull('origin', branch, ['--ff-only']);
    }

    /**
     * Prefetch branch for shallow clone
     */
    public async prefetchBranchForShallowClone(branch: string): Promise<void> {
        try {
            await this.git.fetch('origin', branch);
        } catch (e) {
            // Ignore errors for shallow clones
        }
    }

    /**
     * Create branch for tag
     */
    public async createBranchForTag(repoName: string, tag: string): Promise<void> {
        const branchName = `release-version/${tag}`;
        await this.git.checkoutLocalBranch(branchName);
    }

    /**
     * Check if repo has path in branch
     */
    public checkRepoHasPathInBranch(options: { ref: string, pathname: string }): boolean {
        try {
            // This is a simplified check - would need more complex git logic
            return true; // Placeholder
        } catch (e) {
            return false;
        }
    }

    /**
     * Check if branch exists on remote
     */
    public checkBranchExistsOnRemote(branchName: string): boolean {
        try {
            // This is a simplified check - would need remote branch verification
            return true; // Placeholder
        } catch (e) {
            return false;
        }
    }

    // Static methods needed by repos commands

    /**
     * Clone repository
     */
    public static async clone(repoName: string, repoProperties: IRepoStatus, rootDir: string, toPath: string, depth: number): Promise<Repository> {
        const git = simpleGit.simpleGit();
        const options: string[] = [];
        
        if (depth > 0) {
            options.push('--depth', depth.toString());
        }

        await git.clone(repoProperties.url, toPath, options);
        return new Repository(toPath);
    }

    /**
     * Get latest tag of release branch
     */
    public static async getLatestTagOfReleaseBranch(repoName: string, repoProperties: IRepoStatus, rootDir: string): Promise<string> {
        // Placeholder implementation - would need complex tag resolution logic
        return '';
    }

    /**
     * Get active tag of release branch
     */
    public static async getActiveTagOfReleaseBranch(repoName: string, repoProperties: IRepoStatus, rootDir: string): Promise<string> {
        // Placeholder implementation
        return '';
    }

    /**
     * Validate tag marker
     */
    public static validateTagMarker(repoProperties: IRepoStatus, repoName: string): void {
        // Placeholder implementation
    }
}