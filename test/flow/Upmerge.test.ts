import {Upmerge} from '../../src/commands/flow/Upmerge';
import {Repository} from '../../src/git';
import {IGitBranchDetails} from '../../src/git/models';
import {ICommandParameters} from '../../src/commands/models';
import {StatusResult} from 'simple-git';

// Mock Repository class
jest.mock('../../src/git/Repository');

describe('Upmerge', () => {
    let upmerge: Upmerge;
    let mockRepo: jest.Mocked<Repository>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockRepo = new Repository() as jest.Mocked<Repository>;
        (Repository as jest.MockedClass<typeof Repository>).mockImplementation(() => mockRepo);
        upmerge = new Upmerge();
        (upmerge as any).repo = mockRepo;
    });

    describe('prepareAndMayExecute', () => {
        it('should initialize with default values', () => {
            const params: ICommandParameters = {};
            const result = upmerge.prepareAndMayExecute(params);

            expect(result).toBeTruthy();
            expect(Repository).toHaveBeenCalled();
        });

        it('should accept custom remote', () => {
            const params: ICommandParameters = {
                remote: 'custom-remote'
            };
            const result = upmerge.prepareAndMayExecute(params);

            expect(result).toBeTruthy();
        });
    });

    describe('execute', () => {
        const mockBranches: IGitBranchDetails[] = [
            {
                name: 'origin/release/23.4',
                commit: 'commit1',
                current: false,
                isRemote: true,
                tracking: null
            },
            {
                name: 'origin/release/24.1',
                commit: 'commit2',
                current: false,
                isRemote: true,
                tracking: null
            },
            {
                name: 'origin/release/24.2',
                commit: 'commit3',
                current: false,
                isRemote: true,
                tracking: null
            },
            {
                name: 'origin/master',
                commit: 'commit4',
                current: false,
                isRemote: true,
                tracking: null
            }
        ];


        beforeEach(() => {
            mockRepo.fetch.mockResolvedValue();
            mockRepo.status.mockResolvedValue(createStatusResult());
            mockRepo.listBranches.mockResolvedValue(mockBranches);
            mockRepo.checkoutBranch.mockResolvedValue();
            mockRepo.merge.mockResolvedValue();
            mockRepo.push.mockResolvedValue();
            mockRepo.deleteBranch.mockResolvedValue();
            mockRepo.rawWrapper = jest.fn().mockResolvedValue('');
            mockRepo.setUpstreamBranch = jest.fn().mockResolvedValue(undefined);
        });

        it('should fail if working directory is not clean', async () => {
            mockRepo.status.mockResolvedValue(createStatusResult({
                not_added: ['file1'],
                isClean: () => false
            }));

            await expect(upmerge.execute()).rejects.toMatch('You have uncommitted changes');
        });

        it('should fail if current branch is behind remote', async () => {
            mockRepo.status.mockResolvedValue(createStatusResult({
                behind: 2
            }));

            await expect(upmerge.execute()).rejects.toMatch('current branch is 2 commits behind');
        });

        it('should perform upmerge sequence successfully', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: true
            };
            expect(upmerge.prepareAndMayExecute(params)).toBeTruthy();

            await upmerge.execute();

            // Should create temp branches for merging
            expect(mockRepo.checkoutBranch).toHaveBeenCalledTimes(5); // Each branch + return to original

            // Should perform merges in sequence
            expect(mockRepo.merge).toHaveBeenCalledTimes(3); // 23.4->24.1, 24.1->24.2, 24.2->master

            // Should push changes to target branches (not temporary branches)
            expect(mockRepo.push).toHaveBeenCalledTimes(3);

            // Should set upstream for each temporary branch
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledTimes(4); // One for each branch

            // Should configure push.default to upstream
            expect(mockRepo.rawWrapper).toHaveBeenCalledWith(['config', '--local', 'push.default', 'upstream']);

            // Should clean up leftover upmerge branches
            expect(mockRepo.deleteBranch).toHaveBeenCalled();
        });

        it('should not push changes when push is false', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: false
            };
            upmerge.prepareAndMayExecute(params);

            await upmerge.execute();

            // Should not push to target branches when push is false
            expect(mockRepo.push).not.toHaveBeenCalled();

            // Should still set upstream for each temporary branch
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledTimes(4);

            // Should still configure push.default
            expect(mockRepo.rawWrapper).toHaveBeenCalledWith(['config', '--local', 'push.default', 'upstream']);
        });

        it('should handle customer branches when specified', async () => {
            const customerBranches: IGitBranchDetails[] = [
                ...mockBranches,
                {
                    name: 'origin/customer/acme/23.4',
                    commit: 'commit5',
                    current: false,
                    isRemote: true,
                    tracking: null
                },
                {
                    name: 'origin/customer/acme/24.1',
                    commit: 'commit6',
                    current: false,
                    isRemote: true,
                    tracking: null
                }
            ];

            mockRepo.listBranches.mockResolvedValue(customerBranches);

            const params: ICommandParameters = {
                release: '23.4',
                customer: 'acme',
                push: true
            };
            upmerge.prepareAndMayExecute(params);

            await upmerge.execute();

            // Should handle additional merges for customer branches
            expect(mockRepo.merge).toHaveBeenCalledTimes(6); // Regular merges + customer branch merges
        });

        it('should set upstream to target release branch for each temporary branch', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: true
            };
            upmerge.prepareAndMayExecute(params);

            await upmerge.execute();

            // Should set upstream for all 4 branches
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledTimes(4);
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledWith('origin/release/23.4');
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledWith('origin/release/24.1');
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledWith('origin/release/24.2');
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledWith('origin/master');
        });

        it('should configure push.default to upstream at start', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: true
            };
            upmerge.prepareAndMayExecute(params);

            await upmerge.execute();

            // Should set push.default to upstream
            expect(mockRepo.rawWrapper).toHaveBeenCalledWith(['config', '--local', 'push.default', 'upstream']);
        });

        it('should clean up leftover upmerge branches after successful completion', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: true
            };
            upmerge.prepareAndMayExecute(params);

            await upmerge.execute();

            // Should delete temporary branches created during upmerge
            const allDeleteCalls = (mockRepo.deleteBranch as jest.Mock).mock.calls.map(call => call[0]);

            // Verify that branches matching upmerge pattern are deleted
            const deletedUpmergeBranches = allDeleteCalls.filter(name => name.match(/^upmerge-[A-Za-z0-9]+\/.+$/));
            expect(deletedUpmergeBranches.length).toBeGreaterThan(0);

            // Verify the cleanup runs after successful completion
            // (this is implicitly tested by the fact that execute() completes without throwing)
        });

        it('should not clean up upmerge branches if upmerge fails', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: true
            };
            upmerge.prepareAndMayExecute(params);

            // Make merge fail to simulate conflict
            mockRepo.merge.mockRejectedValueOnce(new Error('Merge conflict'));

            await expect(upmerge.execute()).rejects.toThrow('Merge conflict');

            // Cleanup should not be called because upmerge failed
            // Only the cleanup.add() branches should be attempted in the finally block of doMerges
            // but cleanupUpmergeBranches() should not be called
            const allDeleteCalls = (mockRepo.deleteBranch as jest.Mock).mock.calls;
            const cleanupCalls = allDeleteCalls.filter(call => call[0].startsWith('upmerge-'));

            // Should only delete branches from the current run's cleanup set, not from cleanupUpmergeBranches
            expect(cleanupCalls.length).toBeLessThanOrEqual(4); // At most the 4 branches from current run
        });

        it('should set upstream even when push is disabled', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: false
            };
            upmerge.prepareAndMayExecute(params);

            await upmerge.execute();

            // Should still set upstream branches for conflict resolution
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledTimes(4);
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledWith('origin/release/23.4');
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledWith('origin/release/24.1');
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledWith('origin/release/24.2');
            expect(mockRepo.setUpstreamBranch).toHaveBeenCalledWith('origin/master');
        });
    });
});

// Helper function to create status results
function createStatusResult(overrides: Partial<StatusResult> = {}): StatusResult {
    return {
        not_added: [],
        conflicted: [],
        created: [],
        deleted: [],
        modified: [],
        renamed: [],
        files: [],
        staged: [],
        ahead: 0,
        behind: 0,
        current: 'release/23.4',
        tracking: 'origin/release/23.4',
        isClean: () => true,
        detached: false,
        ...overrides
    };
}
