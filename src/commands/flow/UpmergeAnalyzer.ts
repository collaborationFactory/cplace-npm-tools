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
            // Use null-byte delimiter to avoid JSON parsing issues with quotes in commit messages
            const logCmd = ['log', '--format=%H%x00%aN%x00%aE%x00%ad%x00%s%x00', '--date=short',
                `${targetBranch}..${sourceBranch}`];
            const log = await this.repo.rawWrapper(logCmd);

            const commits = this.parseDelimiterCommits(log);
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
     * Parses a git log output string using null-byte delimiters into an array
     * of CommitInfo objects. This approach is safer than JSON parsing as it
     * avoids issues with quotes, backslashes, and other special characters
     * in commit messages.
     *
     * @param log - Git log output string with null-byte delimited fields
     * @returns Array of parsed CommitInfo objects
     */
    private parseDelimiterCommits(log: string): CommitInfo[] {
        if (!log) return [];

        return log.trim()
            .split('\n')
            .filter(line => line.trim())
            .map(line => this.parseGitLogLine(line));
    }

    /**
     * Parses a single line of git log output using null-byte delimiters
     *
     * @param line - Single line with null-byte delimited fields
     * @returns Parsed CommitInfo object
     */
    private parseGitLogLine(line: string): CommitInfo {
        const parts = line.split('\0');
        
        // Remove trailing empty element (caused by trailing %x00)
        if (parts.length > 0 && parts[parts.length - 1] === '') {
            parts.pop();
        }

        const [hash, author_name, author_email, date, message = ''] = parts;

        return {
            hash: hash?.trim() || '',
            author_name: author_name?.trim() || '',
            author_email: author_email?.trim() || '',
            date: date?.trim() || '',
            message: message?.trim() || ''
        };
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
