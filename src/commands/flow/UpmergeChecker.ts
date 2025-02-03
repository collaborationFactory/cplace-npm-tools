import {Repository} from '../../git';
import {IBranchDetails} from './models';

/**
 * Information about an author's contributions
 */
type AuthorInfo = {
    name: string;
    email: string;
    commitCount: number;
}

/**
 * Information about a single commit
 */
interface CommitInfo {
    readonly hash: string;
    readonly author_name: string;
    readonly author_email: string;
    readonly date: string;
    readonly message: string;
}

/**
 * Result of an upmerge check
 */
type UpmergeCheckResult = {
    sourceBranch: string;
    targetBranch: string;
    commits?: CommitInfo[];
    authors?: AuthorInfo[];
}

/**
 * The UpmergeChecker analyzes branches to identify commits that need to be merged
 * upward into higher version branches (upmerges). It provides detailed reporting
 * about pending upmerges, including:
 *
 * - Which commits need to be merged
 * - Who authored the pending commits
 * - When the commits were made
 *
 * For smaller numbers of commits (<= 10), it shows detailed commit information.
 * For larger sets of commits, it provides an aggregated view by author.
 */
export class UpmergeChecker {
    private static readonly COMMIT_THRESHOLD = 10;

    constructor(private readonly repo: Repository) {
    }

    /**
     * Checks for pending upmerges between the given branches. For each pair of branches,
     * it checks what commits need to be merged from the source branch into the target branch.
     * If any commits are found, it throws an error with details about the pending upmerges.
     * If all branches are up to date, it prints a success message.
     * @param branches - Array of branch details to check for upmerges
     * @throws Error if any pending upmerges are found
     */
    public async checkUpmerges(branches: IBranchDetails[]): Promise<void> {
        for (let i = 0; i < branches.length - 1; i++) {
            const sourceBranch = branches[i];
            const targetBranch = branches[i + 1];

            const result = await this.checkMerge(sourceBranch, targetBranch);

            this.printResult(result);

            if (result?.commits?.length > 0) {
                throw new Error(`Pending upmerges found: branch ${sourceBranch.name} into ${targetBranch.name}`);
            }
        }
    }

    /**
     * Checks what commits need to be merged from source branch to target branch.
     * Uses git merge-base to find the common ancestor and then gets all commits
     * that are in source but not in target branch.
     *
     * @param sourceBranch - Branch to merge from
     * @param targetBranch - Branch to merge into
     * @returns Promise resolving to object containing merge check details
     * @throws Error if merge base cannot be found or git commands fail
     */
    private async checkMerge(sourceBranch: IBranchDetails, targetBranch: IBranchDetails): Promise<UpmergeCheckResult> {
        try {
            const mergeBaseCmd = ['merge-base', sourceBranch.name, targetBranch.name];
            const mergeBase = await this.repo.rawWrapper(mergeBaseCmd);
            if (!mergeBase.trim()) {
                throw new Error(`No merge base found between ${sourceBranch.name} and ${targetBranch.name}`);
            }

            const logCmd = ['log', '--format={"hash": "%H", "author_name": "%aN", "author_email": "%aE", "date": "%ad", "message": "%s"}', '--date=short',
                `${mergeBase.trim()}..${sourceBranch.name}`];
            const log = await this.repo.rawWrapper(logCmd);

            const commits = this.parseJsonCommits(log);
            const authors = this.aggregateAuthors(commits);

            return {
                sourceBranch: sourceBranch.name,
                targetBranch: targetBranch.name,
                commits,
                authors
            };

        } catch (error) {
            console.log(`Failed to check merge from ${sourceBranch.name} into ${targetBranch.name}: ${error.message}`);
            throw error;

        }
    }

    /**
     * Parses a git log output string containing JSON-formatted commit entries into an array
     * of CommitInfo objects. Handles empty logs and invalid JSON entries gracefully.
     *
     * @param log - Git log output string containing JSON-formatted commit entries
     * @returns Array of parsed CommitInfo objects
     */
    private parseJsonCommits(log: string): CommitInfo[] {
        return log.trim()
            .split('\n')
            .filter(line => line.trim())
            .reduce((acc, line) => {
                if (!line.trim()) return acc;
                try {
                    acc.push(JSON.parse(line));
                } catch (err) {
                    console.warn('Failed to parse commit:', err.message);
                }
                return acc;
            }, [] as CommitInfo[]);
    }

    /**
     * Aggregates commit information by author, counting how many commits each author has made.
     * This is used for the summarized view when there are many commits to merge.
     *
     * @param commits - Array of commit information objects
     * @returns Array of author information with commit counts
     */
    private aggregateAuthors(commits: CommitInfo[]): AuthorInfo[] {
        const authorMap = commits.reduce((acc, commit) => {
            if (!acc.has(commit.author_email)) {
                acc.set(commit.author_email, {
                    name: commit.author_name,
                    email: commit.author_email,
                    commitCount: 1
                });
            } else {
                acc.get(commit.author_email).commitCount++;
            }
            return acc;
        }, new Map<string, AuthorInfo>());

        return Array.from(authorMap.values());
    }

    /**
     * Outputs the merge check results to console in a user-friendly format.
     * If there are 10 or fewer commits, shows detailed commit information.
     * For more than 10 commits, shows an aggregated view by author.
     *
     * @param result - Object containing merge check results including commits and authors
     */
    private printResult(result: UpmergeCheckResult): void {
        console.log(`\nChecking merge from ${result.sourceBranch} into ${result.targetBranch}:`);
        if (!result.commits.length) {
            console.log('✓ Branches are up to date');
            return;
        }

        if (result.commits.length <= UpmergeChecker.COMMIT_THRESHOLD) {
            // Show detailed commit information
            console.log('📝 Commits to be merged:');
            result.commits.forEach(commit => {
                console.log(`  ${commit.hash?.substring(0, 7)} (${commit.author_name} <${commit.author_email}>, ${commit.date}) ${commit.message}`);
            });
        } else {
            // Show aggregated author information
            console.log(`📝 ${result.commits.length} commits to be merged from ${result.authors.length} authors:`);
            result.authors.forEach(author => {
                console.log(`  ${author.name} <${author.email}> (${author.commitCount} commits)`);
            });
        }
    }
}
