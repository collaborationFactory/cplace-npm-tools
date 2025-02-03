import {UpmergeChecker} from '../../src/commands/flow/UpmergeChecker';
import {Repository} from '../../src/git';
import {IBranchDetails} from '../../src/commands/flow/models';
import {ReleaseNumber} from '../../src/commands/flow/ReleaseNumber';

// Mock Repository class
jest.mock('../../src/git/Repository');

describe('UpmergeChecker', () => {
    let upmergeChecker: UpmergeChecker;
    let mockRepo: jest.Mocked<Repository>;
    let consoleLogSpy: jest.SpyInstance;

    // Sample test data
    const sampleBranches: IBranchDetails[] = [
        {
            name: 'origin/release/23.1',
            commit: 'commit1',
            current: false,
            isRemote: true,
            version: ReleaseNumber.parse('23.1'),
            customer: null
        },
        {
            name: 'origin/release/23.2',
            commit: 'commit2',
            current: false,
            isRemote: true,
            version: ReleaseNumber.parse('23.2'),
            customer: null
        },
        {
            name: 'origin/master',
            commit: 'commit3',
            current: false,
            isRemote: true,
            version: ReleaseNumber.parse('master'),
            customer: null
        }
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
        upmergeChecker = new UpmergeChecker(mockRepo);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    describe('checkUpmerges', () => {
        it('should return false when all branches are up to date', async () => {
            // Mock git commands to return empty commit list
            mockRepo.rawWrapper
                .mockResolvedValueOnce('mergebase123') // merge-base
                .mockResolvedValueOnce(''); // log (no commits)

            await upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]]);

            expect(mockRepo.rawWrapper).toHaveBeenCalledTimes(2); // merge-base and log
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Branches are up to date'));
        });

        it('should throw an error if there are pending upmerges', async () => {
            const commitJson = sampleCommits.map(commit => JSON.stringify(commit)).join('\n');

            mockRepo.rawWrapper
                .mockResolvedValueOnce('mergebase123') // merge-base
                .mockResolvedValueOnce(commitJson); // log with commits

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]]))
                .rejects
                .toThrow("Pending upmerges found: branch origin/release/23.1 into origin/release/23.2");

            expect(mockRepo.rawWrapper).toHaveBeenCalledTimes(2); // merge-base and log
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Commits to be merged:'));
        });

        it('should handle git command errors gracefully', async () => {
            mockRepo.rawWrapper.mockRejectedValue(new Error('Git command failed'));

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]]))
                .rejects
                .toThrow('Git command failed');
        });

        it('should throw error when merge base cannot be found', async () => {
            mockRepo.rawWrapper.mockResolvedValueOnce(''); // Empty merge-base result

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]]))
                .rejects
                .toThrow('No merge base found');
        });
    });

    describe('logging behavior', () => {
        it('should show detailed commit info when commits are under threshold', async () => {
            const commitJson = sampleCommits.map(commit => JSON.stringify(commit)).join('\n');

            mockRepo.rawWrapper
                .mockResolvedValueOnce('mergebase123')
                .mockResolvedValueOnce(commitJson);

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]])).rejects.toThrow("Pending upmerges found: branch origin/release/23.1 into origin/release/23.2");

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
                .mockResolvedValueOnce('mergebase123')
                .mockResolvedValueOnce(commitJson);

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]])).rejects.toThrow("Pending upmerges found: branch origin/release/23.1 into origin/release/23.2");

            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('12 commits to be merged'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('John Doe <john@example.com> (12 commits)'));
        });
    });

    describe('multiple branch chain checking', () => {
        it('should check all sequential branch pairs', async () => {
            mockRepo.rawWrapper
                // First pair
                .mockResolvedValueOnce('mergebase1') // merge-base
                .mockResolvedValueOnce(JSON.stringify(sampleCommits[0])) // log

            await expect(upmergeChecker.checkUpmerges(sampleBranches)).rejects.toThrow("Pending upmerges found: branch origin/release/23.1 into origin/release/23.2");

            expect(mockRepo.rawWrapper).toHaveBeenCalledTimes(2);
            expect(mockRepo.rawWrapper).toHaveBeenCalledWith(
                expect.arrayContaining(['merge-base', 'origin/release/23.1', 'origin/release/23.2'])
            );
        });

        it('should handle empty branch array', async () => {
            await upmergeChecker.checkUpmerges([]);

            expect(mockRepo.rawWrapper).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });

        it('should handle single branch array', async () => {
            await upmergeChecker.checkUpmerges([sampleBranches[0]]);

            expect(mockRepo.rawWrapper).not.toHaveBeenCalled();
            expect(consoleLogSpy).not.toHaveBeenCalled();
        });
    });
});
