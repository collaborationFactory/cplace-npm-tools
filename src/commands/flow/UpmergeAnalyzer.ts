import {Repository} from '../../git';

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
 * The UpmergeAnalyzer analyzes branches to identify commits that need to be merged
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
export class UpmergeAnalyzer {
    private static readonly COMMIT_THRESHOLD = 10;

    constructor(private readonly repo: Repository) {
    }

    /**
     * Checks for pending upmerges between two branches, returning detailed information
     *
     * @param sourceBranch
     * @param targetBranch
     */
    public async analyzeRequiredMerge(sourceBranch: string, targetBranch: string): Promise<UpmergeCheckResult> {
        try {
            const logCmd = ['log', '--format={"hash": "%H", "author_name": "%aN", "author_email": "%aE", "date": "%ad", "message": "%s"}', '--date=short',
                `${targetBranch}..${sourceBranch}`];
            const log = await this.repo.rawWrapper(logCmd);

            const commits = this.parseJsonCommits(log);
            const authors = this.aggregateAuthors(commits);

            this.printResult({sourceBranch: sourceBranch, targetBranch: targetBranch, commits, authors});
            return {
                sourceBranch: sourceBranch,
                targetBranch: targetBranch,
                commits,
                authors
            };
        } catch (error) {
            console.error(`Failed to check merge from ${sourceBranch} into ${targetBranch}: ${error.message}`);
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
        if (result.commits.length === 0) {
            return;
        }
        if (result.commits.length <= UpmergeAnalyzer.COMMIT_THRESHOLD) {
            // Show detailed commit information
            console.log(`Commits (${result.commits.length}):`);
            result.commits.forEach(commit => {
                console.log(`  ${commit.hash?.substring(0, 7)} (${commit.author_name} <${commit.author_email}>, ${commit.date}) ${commit.message}`);
            });
        } else {
            // Show aggregated author information
            console.log(`Authors (${result.commits.length} commits total):`);
            result.authors.forEach(author => {
                console.log(`  ${author.name} <${author.email}> (${author.commitCount} commits)`);
            });
        }
    }
}
