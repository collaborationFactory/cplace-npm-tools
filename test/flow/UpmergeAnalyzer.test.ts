import {UpmergeAnalyzer} from '../../src/commands/flow/UpmergeAnalyzer';
import {Repository} from '../../src/git';
import {IBranchDetails} from '../../src/commands/flow/models';
import {ReleaseNumber} from '../../src/commands/flow/ReleaseNumber';

// Mock Repository class
jest.mock('../../src/git/Repository');

describe('UpmergeAnalyzer', () => {
    let upmergeChecker: UpmergeAnalyzer;
    let mockRepo: jest.Mocked<Repository>;
    let consoleLogSpy: jest.SpyInstance;

    // Sample test data
    const sampleBranches: IBranchDetails[] = [
        createBranchDetails('release/23.1', 'commit1', '23.1'),
        createBranchDetails('release/23.2', 'commit2', '23.2'),
        createBranchDetails('master', 'commit3', 'master')
    ];

    const sampleCommits = [
        {
            hash: 'abc123',
            author_name: 'John Doe',
            author_email: 'john@example.com',
            date: '2024-01-01',
            message: 'First commit'
        },
        {
            hash: 'def456',
            author_name: 'Jane Smith',
            author_email: 'jane@example.com',
            date: '2024-01-02',
            message: 'Second commit'
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        mockRepo = new Repository() as jest.Mocked<Repository>;
        (Repository as jest.MockedClass<typeof Repository>).mockImplementation(() => mockRepo);
        upmergeChecker = new UpmergeAnalyzer(mockRepo);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    describe('checkUpmerges', () => {
        it('should not log if branches are up to date', async () => {
            // Mock git commands to return empty commit list
            mockRepo.rawWrapper
                .mockResolvedValueOnce(''); // log (no commits)

            await upmergeChecker.analyzeRequiredMerge(sampleBranches[0].name, sampleBranches[1].name);

            expect(mockRepo.rawWrapper).toHaveBeenCalledTimes(1); // merge-base and log
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should print out a message if there are pending upmerges', async () => {
            const commitJson = sampleCommits.map(commit => JSON.stringify(commit)).join('\n');

            mockRepo.rawWrapper
                .mockResolvedValueOnce(commitJson); // log with commits

            await upmergeChecker.analyzeRequiredMerge(sampleBranches[0].name, sampleBranches[1].name)

            expect(mockRepo.rawWrapper).toHaveBeenCalledTimes(1); // merge-base and log
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Commits (2):'));
        });

        it('should handle git command errors gracefully', async () => {
            mockRepo.rawWrapper.mockRejectedValue(new Error('Git command failed'));

            await expect(upmergeChecker.analyzeRequiredMerge(sampleBranches[0].name, sampleBranches[1].name))
                .rejects
                .toThrow('Git command failed');
        });

    });

    describe('logging behavior', () => {
        it('should show detailed commit info when commits are under threshold', async () => {
            const commitJson = sampleCommits.map(commit => JSON.stringify(commit)).join('\n');

            mockRepo.rawWrapper
                .mockResolvedValueOnce(commitJson);

            await upmergeChecker.analyzeRequiredMerge(sampleBranches[0].name, sampleBranches[1].name);

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('abc123'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('def456'));
        });

        it('should show aggregated author info when commits exceed threshold', async () => {
            // Create more than 10 commits
            const manyCommits = Array(12).fill(null).map((_, i) => ({
                ...sampleCommits[0],
                hash: `hash${i}`,
                message: `Commit ${i}`
            }));
            const commitJson = manyCommits.map(commit => JSON.stringify(commit)).join('\n');

            mockRepo.rawWrapper
                .mockResolvedValueOnce(commitJson);

            await upmergeChecker.analyzeRequiredMerge(sampleBranches[0].name, sampleBranches[1].name)

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Authors (12 commits total):'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('John Doe <john@example.com> (12 commits)'));
        });
    });

});

function createBranchDetails(name: string, commit: string, version: string, customer: string | null = null): IBranchDetails {
    return {
        name: `origin/${name}`,
        commit,
        current: false,
        isRemote: true,
        version: ReleaseNumber.parse(version),
        customer
    };
}
