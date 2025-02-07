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
    let consoleErrorSpy: jest.SpyInstance;

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
        upmergeChecker = new UpmergeChecker(mockRepo);
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
    });

    describe('checkUpmerges', () => {
        it('should return false when all branches are up to date', async () => {
            // Mock git commands to return empty commit list
            mockRepo.rawWrapper
                .mockResolvedValueOnce(''); // log (no commits)

            await upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]]);

            expect(mockRepo.rawWrapper).toHaveBeenCalledTimes(1); // merge-base and log
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Branches are up to date'));
        });

        it('should throw an error if there are pending upmerges', async () => {
            const commitJson = sampleCommits.map(commit => JSON.stringify(commit)).join('\n');

            mockRepo.rawWrapper
                .mockResolvedValueOnce(commitJson); // log with commits

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]]))
                .rejects
                .toThrow(UpmergeChecker.ERROR_MESSAGE);

            expect(mockRepo.rawWrapper).toHaveBeenCalledTimes(1); // merge-base and log
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Commits to be merged:'));
        });

        it('should handle git command errors gracefully', async () => {
            mockRepo.rawWrapper.mockRejectedValue(new Error('Git command failed'));

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]]))
                .rejects
                .toThrow('Git command failed');
        });

    });

    describe('logging behavior', () => {
        it('should show detailed commit info when commits are under threshold', async () => {
            const commitJson = sampleCommits.map(commit => JSON.stringify(commit)).join('\n');

            mockRepo.rawWrapper
                .mockResolvedValueOnce(commitJson);

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]])).rejects.toThrow(UpmergeChecker.ERROR_MESSAGE);

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('abc123'));
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('def456'));
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

            await expect(upmergeChecker.checkUpmerges([sampleBranches[0], sampleBranches[1]])).rejects.toThrow(UpmergeChecker.ERROR_MESSAGE);

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('12 commits to be merged'));
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('John Doe <john@example.com> (12 commits)'));
        });
    });

    describe('multiple branch chain checking', () => {
        it('should check all sequential branch pairs', async () => {
            mockRepo.rawWrapper
                .mockResolvedValueOnce(JSON.stringify(sampleCommits[0])) // log

            await expect(upmergeChecker.checkUpmerges(sampleBranches)).rejects.toThrow("Git command failed");

            expect(mockRepo.rawWrapper).toHaveBeenCalledTimes(2);
            expect(mockRepo.rawWrapper).toHaveBeenCalledWith(
                expect.arrayContaining(['origin/release/23.2..origin/release/23.1'])
            );
        });

        it('should handle empty branch array', async () => {
            await upmergeChecker.checkUpmerges([]);

            expect(mockRepo.rawWrapper).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should handle single branch array', async () => {
            await upmergeChecker.checkUpmerges([sampleBranches[0]]);

            expect(mockRepo.rawWrapper).not.toHaveBeenCalled();
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });
    });
    describe('generateBranchPairs', () => {
        it('should generate correct branch pairs for release and customer branches', () => {
            // Arrange
            const branches: IBranchDetails[] = [
                createBranchDetails('release/23.1', 'commit1', '23.1'),
                createBranchDetails('release/23.2', 'commit2', '23.2'),
                createBranchDetails('release/23.3', 'commit3', '23.3'),
                createBranchDetails('main', 'commit0', 'master'),
                createBranchDetails('customer/acme/23.1', 'commit4', '23.1', 'acme'),
                createBranchDetails('customer/acme/23.2', 'commit5', '23.2', 'acme'),
                createBranchDetails('customer/acme/23.3', 'commit6', '23.3', 'acme')
            ];

            // Act
            const pairs = upmergeChecker['generateBranchPairs'](branches);

            // expect(simplifiedActual).toEqual(expectedPairs);
            expect(pairs.length).toBe(8); // Total number of merge pairs

            // Verify order of merges
            expect(pairs[0].source.name).toBe('origin/release/23.1');
            expect(pairs[0].target.name).toBe('origin/release/23.2');

            expect(pairs[1].source.name).toBe('origin/release/23.2');
            expect(pairs[1].target.name).toBe('origin/release/23.3');

            expect(pairs[2].source.name).toBe('origin/release/23.3');
            expect(pairs[2].target.name).toBe('origin/main');

            //First customer branch, only merge with release branch
            expect(pairs[3].source.name).toBe('origin/release/23.1');
            expect(pairs[3].target.name).toBe('origin/customer/acme/23.1');

            //Second customer branch, merge with previous customer branch and release
            expect(pairs[4].source.name).toBe('origin/customer/acme/23.1');
            expect(pairs[4].target.name).toBe('origin/customer/acme/23.2');

            expect(pairs[5].source.name).toBe('origin/release/23.2');
            expect(pairs[5].target.name).toBe('origin/customer/acme/23.2');

            //Third customer branch, merge with previous customer branch and release
            expect(pairs[6].source.name).toBe('origin/customer/acme/23.2');
            expect(pairs[6].target.name).toBe('origin/customer/acme/23.3');

            expect(pairs[7].source.name).toBe('origin/release/23.3');
            expect(pairs[7].target.name).toBe('origin/customer/acme/23.3');

        });

        it('should handle single release branch', () => {
            const branches: IBranchDetails[] = [
                createBranchDetails('release/23.1', 'commit1', '23.1')
            ];

            const pairs = upmergeChecker['generateBranchPairs'](branches);
            expect(pairs).toEqual([]);
        });

        it('should handle single customer branch', () => {
            const branches: IBranchDetails[] = [
                createBranchDetails('release/23.1', 'commit1', '23.1'),
                createBranchDetails('master', 'commit1', 'master'),
                createBranchDetails('customer/acme/23.1', 'commit2', '23.1', 'acme')
            ];

            const pairs = upmergeChecker['generateBranchPairs'](branches);
            expect(pairs.length).toBe(2);
            expect(pairs[0].source.name).toBe('origin/release/23.1');
            expect(pairs[0].target.name).toBe('origin/master');
            expect(pairs[1].source.name).toBe('origin/release/23.1');
            expect(pairs[1].target.name).toBe('origin/customer/acme/23.1');
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
