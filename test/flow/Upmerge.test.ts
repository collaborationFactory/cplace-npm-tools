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
        });

        it('should fail if working directory is not clean', async () => {
            mockRepo.status.mockResolvedValue(createStatusResult({
                not_added: ['file1'],
                isClean: () => false
            }));

            await expect(upmerge.execute()).rejects.toMatch('Cannot proceed with upmerge: repository has uncommitted changes');
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

            // Should push changes
            expect(mockRepo.push).toHaveBeenCalledTimes(3);
        });

        it('should not push changes when push is false', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: false
            };
            upmerge.prepareAndMayExecute(params);

            await upmerge.execute();

            expect(mockRepo.push).not.toHaveBeenCalled();
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
