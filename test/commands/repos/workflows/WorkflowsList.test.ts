import { WorkflowsList } from '../../../../src/commands/repos/workflows/WorkflowsList';
import { Repository } from '../../../../src/git';
import { SkeletonManager } from '../../../../src/helpers/SkeletonManager';
import { WorkflowScanner } from '../../../../src/helpers/WorkflowScanner';
import { Global } from '../../../../src/Global';
import { ICommandParameters } from '../../../../src/commands/models';
import { IWorkflowStatus, IWorkflowInfo } from '../../../../src/commands/repos/workflows/models';

jest.mock('../../../../src/git');
jest.mock('../../../../src/helpers/SkeletonManager');
jest.mock('../../../../src/helpers/WorkflowScanner');
jest.mock('../../../../src/Global');

describe('WorkflowsList', () => {
    const mockRepository = Repository as jest.MockedClass<typeof Repository>;
    const mockSkeletonManager = SkeletonManager as jest.Mocked<typeof SkeletonManager>;
    const mockWorkflowScanner = WorkflowScanner as jest.Mocked<typeof WorkflowScanner>;
    const mockGlobal = Global as jest.Mocked<typeof Global>;

    let workflowsList: WorkflowsList;
    let mockRepo: jest.Mocked<Repository>;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;
    let processExitSpy: jest.SpyInstance;

    // Test data objects
    const TEST_REPO_NAME = 'test-repo';
    const TEST_SKELETON_BRANCH = 'version/25.4';
    const CUSTOM_SKELETON_BRANCH = 'custom/branch';

    const createMockWorkflow = (overrides: Partial<IWorkflowInfo> = {}): IWorkflowInfo => ({
        name: 'CI Pipeline',
        fileName: 'ci.yml',
        exists: false,
        ...overrides
    });

    const createMockWorkflowStatus = (overrides: Partial<IWorkflowStatus> = {}): IWorkflowStatus => ({
        available: [createMockWorkflow()],
        existing: [],
        ...overrides
    });

    // Helper functions for mock setup
    const setupBasicMocks = () => {
        mockGlobal.isVerbose.mockReturnValue(false);
        mockRepo.checkIsRepo.mockResolvedValue();
        Object.defineProperty(mockRepo, 'repoName', {
            value: TEST_REPO_NAME,
            writable: false
        });
    };

    const setupSkeletonMocks = (branch: string = TEST_SKELETON_BRANCH) => {
        mockSkeletonManager.validateCplaceVersion.mockImplementation(() => {});
        mockSkeletonManager.ensureSkeletonRemote.mockResolvedValue();
        mockSkeletonManager.getSkeletonBranchForVersion.mockReturnValue(branch);
        mockSkeletonManager.validateSkeletonBranchExists.mockResolvedValue(true);
    };

    const setupWorkflowScannerMocks = (workflowStatus: IWorkflowStatus = createMockWorkflowStatus()) => {
        mockWorkflowScanner.scanWorkflows.mockResolvedValue(workflowStatus);
        mockWorkflowScanner.formatWorkflowStatus.mockReturnValue('Formatted workflow status');
    };

    const setupAllMocks = (workflowStatus?: IWorkflowStatus, skeletonBranch?: string) => {
        setupBasicMocks();
        setupSkeletonMocks(skeletonBranch);
        setupWorkflowScannerMocks(workflowStatus);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        workflowsList = new WorkflowsList();
        mockRepo = new mockRepository('/test/repo') as jest.Mocked<Repository>;
        mockRepository.mockImplementation(() => mockRepo);

        setupBasicMocks();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        processExitSpy.mockRestore();
        jest.restoreAllMocks();
    });

    describe('prepareAndMayExecute', () => {
        describe('parameter parsing', () => {
            it.each([
                [
                    'camelCase skeleton branch parameter',
                    { skeletonBranch: CUSTOM_SKELETON_BRANCH },
                    CUSTOM_SKELETON_BRANCH
                ],
                [
                    'kebab-case skeleton branch parameter',
                    { 'skeleton-branch': 'another/branch' },
                    'another/branch'
                ],
                [
                    'missing skeleton branch parameter',
                    {},
                    undefined
                ]
            ])('should handle %s', (scenario, params, expectedBranch) => {
                const result = workflowsList.prepareAndMayExecute(params);

                expect(result).toBe(true);
                expect((workflowsList as any).skeletonBranch).toBe(expectedBranch);
            });
        });

        describe('verbose logging', () => {
            it('should log verbose message when verbose mode is enabled', () => {
                mockGlobal.isVerbose.mockReturnValue(true);

                const params: ICommandParameters = {};
                workflowsList.prepareAndMayExecute(params);

                expect(consoleLogSpy).toHaveBeenCalledWith('Preparing workflows list command');
            });

            it('should not log when verbose mode is disabled', () => {
                mockGlobal.isVerbose.mockReturnValue(false);

                const params: ICommandParameters = {};
                workflowsList.prepareAndMayExecute(params);

                expect(consoleLogSpy).not.toHaveBeenCalledWith('Preparing workflows list command');
            });
        });
    });

    describe('execute', () => {
        describe('successful execution', () => {
            beforeEach(() => {
                setupAllMocks();
            });

            it('should execute successfully and display workflows', async () => {
                await workflowsList.execute();

                expect(mockRepo.checkIsRepo).toHaveBeenCalled();
                expect(mockSkeletonManager.validateCplaceVersion).toHaveBeenCalled();
                expect(mockSkeletonManager.ensureSkeletonRemote).toHaveBeenCalledWith(mockRepo);
                expect(mockSkeletonManager.getSkeletonBranchForVersion).toHaveBeenCalledWith(undefined);
                expect(mockSkeletonManager.validateSkeletonBranchExists).toHaveBeenCalledWith(mockRepo, TEST_SKELETON_BRANCH);
                expect(mockWorkflowScanner.scanWorkflows).toHaveBeenCalledWith(mockRepo, TEST_SKELETON_BRANCH);
                expect(mockWorkflowScanner.formatWorkflowStatus).toHaveBeenCalledWith(createMockWorkflowStatus());
                expect(consoleLogSpy).toHaveBeenCalledWith('Formatted workflow status');
            });

            it('should use custom skeleton branch when provided', async () => {
                (workflowsList as any).skeletonBranch = CUSTOM_SKELETON_BRANCH;
                setupAllMocks(createMockWorkflowStatus({ available: [], existing: [] }));

                await workflowsList.execute();

                expect(mockSkeletonManager.getSkeletonBranchForVersion).toHaveBeenCalledWith(CUSTOM_SKELETON_BRANCH);
                expect(mockSkeletonManager.validateSkeletonBranchExists).toHaveBeenCalledWith(mockRepo, TEST_SKELETON_BRANCH);
            });
        });

        describe('workflow status variations', () => {
            beforeEach(() => {
                setupBasicMocks();
                setupSkeletonMocks();
            });

            it.each([
                [
                    'empty workflow status',
                    createMockWorkflowStatus({ available: [], existing: [] }),
                    'should handle empty workflow lists'
                ],
                [
                    'multiple available workflows',
                    createMockWorkflowStatus({
                        available: [
                            createMockWorkflow({ name: 'Build', fileName: 'build.yml' }),
                            createMockWorkflow({ name: 'Test', fileName: 'test.yml' })
                        ],
                        existing: []
                    }),
                    'should handle multiple available workflows'
                ],
                [
                    'workflows with existing files',
                    createMockWorkflowStatus({
                        available: [createMockWorkflow({ exists: true })],
                        existing: [createMockWorkflow({ name: 'Existing', fileName: 'existing.yml', exists: true })]
                    }),
                    'should handle workflows with existing files'
                ]
            ])('should handle %s', async (scenario, workflowStatus) => {
                setupWorkflowScannerMocks(workflowStatus);

                await workflowsList.execute();

                expect(mockWorkflowScanner.scanWorkflows).toHaveBeenCalledWith(mockRepo, TEST_SKELETON_BRANCH);
                expect(mockWorkflowScanner.formatWorkflowStatus).toHaveBeenCalledWith(workflowStatus);
                expect(consoleLogSpy).toHaveBeenCalledWith('Formatted workflow status');
            });
        });

        describe('verbose logging', () => {
            beforeEach(() => {
                setupAllMocks();
            });

            it('should log verbose messages when verbose mode is enabled', async () => {
                mockGlobal.isVerbose.mockReturnValue(true);

                await workflowsList.execute();

                expect(consoleLogSpy).toHaveBeenCalledWith(`Listing available workflows in repo ${TEST_REPO_NAME}`);
                expect(consoleLogSpy).toHaveBeenCalledWith(`Using skeleton branch: ${TEST_SKELETON_BRANCH}`);
            });

            it('should not log verbose messages when verbose mode is disabled', async () => {
                mockGlobal.isVerbose.mockReturnValue(false);

                await workflowsList.execute();

                expect(consoleLogSpy).not.toHaveBeenCalledWith(`Listing available workflows in repo ${TEST_REPO_NAME}`);
                expect(consoleLogSpy).not.toHaveBeenCalledWith(`Using skeleton branch: ${TEST_SKELETON_BRANCH}`);
            });
        });

        describe('error handling', () => {
            beforeEach(() => {
                setupBasicMocks();
            });

            it.each([
                [
                    'repository check failure',
                    () => mockRepo.checkIsRepo.mockRejectedValue(new Error('Not a git repository')),
                    'Not a git repository'
                ],
                [
                    'cplace version validation failure',
                    () => {
                        setupSkeletonMocks();
                        mockSkeletonManager.validateCplaceVersion.mockImplementation(() => {
                            throw new Error('Unsupported cplace version');
                        });
                    },
                    'Unsupported cplace version'
                ],
                [
                    'skeleton remote setup failure',
                    () => {
                        setupSkeletonMocks();
                        mockSkeletonManager.ensureSkeletonRemote.mockRejectedValue(new Error('Network error'));
                    },
                    'Network error'
                ],
                [
                    'non-existent skeleton branch',
                    () => {
                        setupSkeletonMocks();
                        mockSkeletonManager.validateSkeletonBranchExists.mockResolvedValue(false);
                    },
                    `Skeleton branch '${TEST_SKELETON_BRANCH}' does not exist`
                ],
                [
                    'workflow scanning failure',
                    () => {
                        setupSkeletonMocks();
                        mockWorkflowScanner.scanWorkflows.mockRejectedValue(new Error('Failed to scan workflows'));
                    },
                    'Failed to scan workflows'
                ]
            ])('should propagate %s', async (scenario, setupError, expectedErrorMessage) => {
                setupError();

                await expect(workflowsList.execute()).rejects.toThrow(expectedErrorMessage);
            });

            it('should propagate detailed error objects for proper CLI handling', async () => {
                const error = new Error('Detailed error message');
                error.stack = 'Mock stack trace';
                setupSkeletonMocks();
                mockWorkflowScanner.scanWorkflows.mockRejectedValue(error);

                await expect(workflowsList.execute()).rejects.toThrow(error);
            });
        });
    });
});