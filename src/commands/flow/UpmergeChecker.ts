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

type BranchPair = {
    source: IBranchDetails;
    target: IBranchDetails;
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
    public static readonly ERROR_MESSAGE = 'Pending upmerges found';

    constructor(private readonly repo: Repository) {
    }

    /**
     * Checks for pending upmerges between branches, handling both release and customer branches.
     * For release branches, checks sequential merges.
     * For customer branches, checks both previous customer version and release branch merges.
     *
     *
     * @param branches - Array of branch details sorted by version
     * @throws Error if any pending upmerges are found
     */
    public async checkUpmerges(branches: IBranchDetails[]): Promise<void> {
        const pairs = this.generateBranchPairs(branches);
        let hasPendingUpmerges = false;
        for (const pair of pairs) {
            const result = await this.checkMerge(pair.source, pair.target);
            this.printResult(result);
            if (!hasPendingUpmerges) {
                hasPendingUpmerges = result?.commits?.length > 0;
            }
        }
        if (!hasPendingUpmerges) {
            console.log('\n✓ All branches are up to date');
        } else {
            throw new Error(UpmergeChecker.ERROR_MESSAGE);
        }
    }

    /**
     * Generates pairs of branches to check for upmerges. For release branches, pairs are
     * sequential. For customer branches, pairs are created for both previous customer
     *
     * @param branches - Array of branch details sorted by version
     */
    private generateBranchPairs(branches: IBranchDetails[]): BranchPair[] {
        const pairs: BranchPair[] = [];
        const releaseBranches = branches.filter(b => !b.customer);
        const customerBranches = branches.filter(b => b.customer)
            .sort((a, b) => a.version.compareTo(b.version));

        // First add release branch pairs
        for (let i = 0; i < releaseBranches.length - 1; i++) {
            pairs.push({
                source: releaseBranches[i],
                target: releaseBranches[i + 1]
            });
        }

        // Then add customer branch pairs
        for (let i = 0; i < customerBranches.length; i++) {
            const currentBranch = customerBranches[i];

            // For subsequent branches:
            // 1. Merge from previous customer version beginning with the second branch
            if (i > 0) {
                const previousCustomerBranch = customerBranches[i - 1];
                pairs.push({source: previousCustomerBranch, target: currentBranch});
            }

            // 2. Merge from corresponding release branch
            const matchingRelease = this.findMatchingReleaseBranch(currentBranch, releaseBranches);
            if (matchingRelease) {
                pairs.push({source: matchingRelease, target: currentBranch});
            }
        }
        return pairs;
    }

    /**
     * Finds the matching release branch for a customer branch.
     * The matching release branch has the same version number as the customer branch.
     * If no matching release branch is found, returns undefined.
     *
     * @param customerBranch - Customer branch to find a matching release branch for
     * @param releaseBranches - Array of release branches to search for a match
     *
     */
    private findMatchingReleaseBranch(customerBranch: IBranchDetails, releaseBranches: IBranchDetails[]): IBranchDetails | undefined {
        return releaseBranches
            .filter(b => !b.customer)
            .find(b => b.version.compareTo(customerBranch.version) == 0);
    }

    /**
     * Checks for pending upmerges between two branches, returning detailed information
     *
     * @param sourceBranch
     * @param targetBranch
     */
    private async checkMerge(sourceBranch: IBranchDetails, targetBranch: IBranchDetails): Promise<UpmergeCheckResult> {
        try {
            const logCmd = ['log', '--format={"hash": "%H", "author_name": "%aN", "author_email": "%aE", "date": "%ad", "message": "%s"}', '--date=short',
                `${targetBranch.name}..${sourceBranch.name}`];
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
        if (!log) return [];

        return log.trim()
            .split('\n')
            .filter(line => line.trim())
            .reduce((acc, line) => {
                if (!line.trim()) return acc;
                try {
                    acc.push(JSON.parse(line));
                } catch (err) {
                    console.error('Failed to parse commit:', err.message);
                    throw err;
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
        const sourceBranch = result.sourceBranch.replaceAll('origin/', '');
        const targetBranch = result.targetBranch.replaceAll('origin/', '');
        console.log(`\nChecking merge from ${sourceBranch} into ${targetBranch}:`);
        if (!result.commits.length) {
            console.log('✓ Branches are up to date');
            return;
        }
        console.error(`Pending upmerges found: branch ${sourceBranch} into ${targetBranch}`);
        if (result.commits.length <= UpmergeChecker.COMMIT_THRESHOLD) {
            // Show detailed commit information
            console.error('Commits to be merged:');
            result.commits.forEach(commit => {
                console.error(`  ${commit.hash?.substring(0, 7)} (${commit.author_name} <${commit.author_email}>, ${commit.date}) ${commit.message}`);
            });
        } else {
            // Show aggregated author information
            console.error(`${result.commits.length} commits to be merged from ${result.authors.length} authors:`);
            result.authors.forEach(author => {
                console.error(`  ${author.name} <${author.email}> (${author.commitCount} commits)`);
            });
        }
    }
}
