import { WorkflowsList } from '../../../../src/commands/repos/workflows';
import { Repository } from '../../../../src/git';
import { WorkflowScanner } from '../../../../src/helpers/WorkflowScanner';
import { Global } from '../../../../src/Global';
import { ICommandParameters } from '../../../../src/commands/models';
import { IWorkflowStatus, IWorkflowInfo } from '../../../../src/commands/repos/workflows';

jest.mock('../../../../src/git');
jest.mock('../../../../src/helpers/WorkflowScanner');
jest.mock('../../../../src/Global');

describe('WorkflowsList', () => {
    const mockWorkflowScanner = WorkflowScanner as jest.Mocked<typeof WorkflowScanner>;
    const mockGlobal = Global as jest.Mocked<typeof Global>;

    let workflowsList: WorkflowsList;
    let mockRepo: jest.Mocked<Repository>;
    let consoleLogSpy: jest.SpyInstance;

    // Test data
    const TEST_REPO_NAME = 'test-repo';
    const TEST_SKELETON_BRANCH = 'version/25.4';

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

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

        workflowsList = new WorkflowsList();

        // Create mock repo with basic properties
        mockRepo = {
            repoName: TEST_REPO_NAME
        } as jest.Mocked<Repository>;

        // Mock inherited methods directly
        jest.spyOn(workflowsList as any, 'initializeRepository')
            .mockResolvedValue(mockRepo);
        jest.spyOn(workflowsList as any, 'setupSkeletonRepository')
            .mockResolvedValue(TEST_SKELETON_BRANCH);
        jest.spyOn(workflowsList as any, 'parseSkeletonBranchParameter')
            .mockImplementation(() => {});

        // Set up repo and selectedSkeletonBranch properties
        (workflowsList as any).repo = mockRepo;
        (workflowsList as any).selectedSkeletonBranch = TEST_SKELETON_BRANCH;

        mockGlobal.isVerbose.mockReturnValue(false);
        mockWorkflowScanner.scanWorkflows.mockResolvedValue(createMockWorkflowStatus());
        mockWorkflowScanner.formatWorkflowStatus.mockReturnValue('Formatted workflow status');
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        jest.restoreAllMocks();
    });

    describe('prepareAndMayExecute', () => {
        describe('inherited method integration', () => {
            it('should call parseSkeletonBranchParameter with provided params', () => {
                const parseSkeletonSpy = jest.spyOn(workflowsList as any, 'parseSkeletonBranchParameter');
                const params: ICommandParameters = { someParam: 'value' };

                const result = workflowsList.prepareAndMayExecute(params);

                expect(result).toBe(true);
                expect(parseSkeletonSpy).toHaveBeenCalledWith(params);
            });
        });


        describe('verbose logging', () => {
            it('should log preparation message when verbose mode is enabled', () => {
                mockGlobal.isVerbose.mockReturnValue(true);

                workflowsList.prepareAndMayExecute({});

                expect(consoleLogSpy).toHaveBeenCalledWith('Preparing workflows list command');
            });

            it('should not log preparation message when verbose mode is disabled', () => {
                mockGlobal.isVerbose.mockReturnValue(false);

                workflowsList.prepareAndMayExecute({});

                expect(consoleLogSpy).not.toHaveBeenCalledWith('Preparing workflows list command');
            });

        });
    });

    describe('execute', () => {
        describe('method orchestration', () => {
            it('should call inherited methods in correct sequence', async () => {
                const initSpy = jest.spyOn(workflowsList as any, 'initializeRepository');
                const setupSpy = jest.spyOn(workflowsList as any, 'setupSkeletonRepository');

                await workflowsList.execute();

                // Verify methods were called - sequence verification through individual calls
                expect(initSpy).toHaveBeenCalledTimes(1);
                expect(setupSpy).toHaveBeenCalledTimes(1);
                expect(mockWorkflowScanner.scanWorkflows).toHaveBeenCalledTimes(1);
            });

            it('should initialize repository first', async () => {
                const initSpy = jest.spyOn(workflowsList as any, 'initializeRepository');

                await workflowsList.execute();

                expect(initSpy).toHaveBeenCalledWith();
            });

            it('should setup skeleton repository after initialization', async () => {
                const setupSpy = jest.spyOn(workflowsList as any, 'setupSkeletonRepository');

                await workflowsList.execute();

                expect(setupSpy).toHaveBeenCalledWith();
            });
        });

        describe('WorkflowScanner integration', () => {
            it('should scan workflows with correct parameters', async () => {
                await workflowsList.execute();

                expect(mockWorkflowScanner.scanWorkflows).toHaveBeenCalledWith(mockRepo, TEST_SKELETON_BRANCH);
            });

            it('should format and display workflow status', async () => {
                const workflowStatus = createMockWorkflowStatus({
                    available: [
                        createMockWorkflow({ name: 'Build', fileName: 'build.yml' }),
                        createMockWorkflow({ name: 'Test', fileName: 'test.yml' })
                    ]
                });
                mockWorkflowScanner.scanWorkflows.mockResolvedValue(workflowStatus);
                mockWorkflowScanner.formatWorkflowStatus.mockReturnValue('Custom formatted output');

                await workflowsList.execute();

                expect(mockWorkflowScanner.formatWorkflowStatus).toHaveBeenCalledWith(workflowStatus);
                expect(consoleLogSpy).toHaveBeenCalledWith('Custom formatted output');
            });

            it('should handle empty workflow status', async () => {
                const emptyStatus = createMockWorkflowStatus({ available: [], existing: [] });
                mockWorkflowScanner.scanWorkflows.mockResolvedValue(emptyStatus);

                await workflowsList.execute();

                expect(mockWorkflowScanner.formatWorkflowStatus).toHaveBeenCalledWith(emptyStatus);
            });

            it('should handle mixed workflow status', async () => {
                const mixedStatus = createMockWorkflowStatus({
                    available: [createMockWorkflow()],
                    existing: [createMockWorkflow({ exists: true })]
                });
                mockWorkflowScanner.scanWorkflows.mockResolvedValue(mixedStatus);

                await workflowsList.execute();

                expect(mockWorkflowScanner.formatWorkflowStatus).toHaveBeenCalledWith(mixedStatus);
            });
        });

        describe('verbose logging', () => {
            it('should log verbose message about listing workflows when enabled', async () => {
                mockGlobal.isVerbose.mockReturnValue(true);

                await workflowsList.execute();

                expect(consoleLogSpy).toHaveBeenCalledWith(`Listing available workflows in repo ${TEST_REPO_NAME}`);
            });

            it('should not log verbose messages when disabled', async () => {
                mockGlobal.isVerbose.mockReturnValue(false);

                await workflowsList.execute();

                expect(consoleLogSpy).not.toHaveBeenCalledWith(`Listing available workflows in repo ${TEST_REPO_NAME}`);
            });
        });

        describe('output display', () => {
            it('should always display formatted workflow status', async () => {
                mockWorkflowScanner.formatWorkflowStatus.mockReturnValue('Test output');

                await workflowsList.execute();

                expect(consoleLogSpy).toHaveBeenCalledWith('Test output');
            });

            it('should display output even when no workflows are found', async () => {
                const emptyStatus = createMockWorkflowStatus({ available: [], existing: [] });
                mockWorkflowScanner.scanWorkflows.mockResolvedValue(emptyStatus);
                mockWorkflowScanner.formatWorkflowStatus.mockReturnValue('No workflows found');

                await workflowsList.execute();

                expect(consoleLogSpy).toHaveBeenCalledWith('No workflows found');
            });
        });

        describe('error propagation', () => {
            it('should propagate errors from inherited methods', async () => {
                const error = new Error('Initialization failed');
                jest.spyOn(workflowsList as any, 'initializeRepository').mockRejectedValue(error);

                await expect(workflowsList.execute()).rejects.toThrow('Initialization failed');
            });

            it('should propagate errors from WorkflowScanner', async () => {
                const error = new Error('Scan failed');
                mockWorkflowScanner.scanWorkflows.mockRejectedValue(error);

                await expect(workflowsList.execute()).rejects.toThrow('Scan failed');
            });
        });
    });
});
