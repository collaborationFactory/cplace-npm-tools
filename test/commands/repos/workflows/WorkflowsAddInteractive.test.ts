import { WorkflowsAddInteractive } from '../../../../src/commands/repos/workflows';
import { Repository } from '../../../../src/git';
import { Global } from '../../../../src/Global';
import { WorkflowScanner } from '../../../../src/helpers/WorkflowScanner';
import { ICommandParameters } from '../../../../src/commands/models';
import { IWorkflowInfo, IWorkflowStatus } from '../../../../src/commands/repos/workflows';
import { checkbox } from '@inquirer/prompts';

jest.mock('../../../../src/git');
jest.mock('../../../../src/Global');
jest.mock('../../../../src/helpers/WorkflowScanner');
jest.mock('@inquirer/prompts');

describe('WorkflowsAddInteractive', () => {
    const mockRepository = Repository as jest.MockedClass<typeof Repository>;
    const mockGlobal = Global as jest.Mocked<typeof Global>;
    const mockWorkflowScanner = WorkflowScanner as jest.Mocked<typeof WorkflowScanner>;
    const mockCheckbox = checkbox as jest.MockedFunction<typeof checkbox>;

    let command: WorkflowsAddInteractive;
    let mockRepo: jest.Mocked<Repository>;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    // Test constants
    const TEST_REPO_NAME = 'test-repo';
    const TEST_SKELETON_BRANCH = 'version/25.4';
    const MOCK_WORKFLOW_INFO: IWorkflowInfo[] = [
        { name: 'Build Workflow', fileName: 'build.yml', exists: false },
        { name: 'Test Workflow', fileName: 'test.yml', exists: false },
        { name: 'Deploy Workflow', fileName: 'deploy.yml', exists: true }
    ];
    const MOCK_WORKFLOW_STATUS: IWorkflowStatus = {
        available: MOCK_WORKFLOW_INFO,
        existing: []
    };

    // Helper functions for common mock setups
    const setupSuccessfulMocks = () => {
        mockRepo.checkIsRepo.mockResolvedValue();
        Object.defineProperty(mockRepo, 'repoName', {
            value: TEST_REPO_NAME,
            writable: false
        });
    };

    const setupInteractiveMocks = (selectedWorkflows: string[] = []) => {
        mockWorkflowScanner.scanWorkflows.mockResolvedValue(MOCK_WORKFLOW_STATUS);
        mockCheckbox.mockResolvedValue(selectedWorkflows);
    };

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        command = new WorkflowsAddInteractive();
        mockRepo = new mockRepository('/test/repo') as jest.Mocked<Repository>;
        mockRepository.mockImplementation(() => mockRepo);

        mockGlobal.isVerbose.mockReturnValue(false);

        // Mock inherited methods from AbstractWorkflowCommand
        jest.spyOn(command as any, 'initializeRepository').mockResolvedValue(mockRepo);
        jest.spyOn(command as any, 'setupSkeletonRepository').mockResolvedValue(TEST_SKELETON_BRANCH);
        jest.spyOn(command as any, 'parseSkeletonBranchParameter').mockImplementation(() => {});
        jest.spyOn(command as any, 'copyWorkflowsWithEnvironment').mockResolvedValue(undefined);

        // Set up required properties
        (command as any).repo = mockRepo;
        (command as any).selectedSkeletonBranch = TEST_SKELETON_BRANCH;

        setupSuccessfulMocks();
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        jest.restoreAllMocks();
    });

    describe('prepareAndMayExecute', () => {
        describe('force parameter parsing', () => {
            it('should set force to true when force parameter is truthy', () => {
                const params: ICommandParameters = {
                    force: true
                };

                const result = command.prepareAndMayExecute(params);

                expect(result).toBe(true);
                expect((command as any).force).toBe(true);
            });

            it('should set force to false when force parameter is falsy', () => {
                const params: ICommandParameters = {
                    force: false
                };

                const result = command.prepareAndMayExecute(params);

                expect(result).toBe(true);
                expect((command as any).force).toBe(false);
            });

            it('should set force to false when force parameter is missing', () => {
                const params: ICommandParameters = {};

                const result = command.prepareAndMayExecute(params);

                expect(result).toBe(true);
                expect((command as any).force).toBe(false);
            });

            it('should handle various truthy values for force parameter', () => {
                const truthyValues = [1, 'true', 'yes', {}, []];

                truthyValues.forEach(value => {
                    const params: ICommandParameters = {
                        force: value
                    };

                    command.prepareAndMayExecute(params);

                    expect((command as any).force).toBe(true);
                });
            });
        });

        describe('skeleton branch parameter delegation', () => {
            it('should call parseSkeletonBranchParameter with provided params', () => {
                const parseSkeletonSpy = jest.spyOn(command as any, 'parseSkeletonBranchParameter');
                const params: ICommandParameters = {
                    skeletonBranch: 'custom/branch'
                };

                command.prepareAndMayExecute(params);

                expect(parseSkeletonSpy).toHaveBeenCalledWith(params);
            });
        });

        describe('verbose logging', () => {
            it('should log preparation message when verbose mode is enabled', () => {
                mockGlobal.isVerbose.mockReturnValue(true);

                command.prepareAndMayExecute({});

                expect(consoleLogSpy).toHaveBeenCalledWith('Preparing interactive workflows add command');
            });

            it('should not log preparation message when verbose mode is disabled', () => {
                mockGlobal.isVerbose.mockReturnValue(false);

                command.prepareAndMayExecute({});

                expect(consoleLogSpy).not.toHaveBeenCalledWith('Preparing interactive workflows add command');
            });

            it('should log force mode message when force is enabled and verbose', () => {
                mockGlobal.isVerbose.mockReturnValue(true);
                const params: ICommandParameters = {
                    force: true
                };

                command.prepareAndMayExecute(params);

                expect(consoleLogSpy).toHaveBeenCalledWith('Force mode enabled - will overwrite existing files');
            });

            it('should not log force mode message when verbose is disabled', () => {
                mockGlobal.isVerbose.mockReturnValue(false);
                const params: ICommandParameters = {
                    force: true
                };

                command.prepareAndMayExecute(params);

                expect(consoleLogSpy).not.toHaveBeenCalledWith('Force mode enabled - will overwrite existing files');
            });
        });

        it('should always return true', () => {
            const result = command.prepareAndMayExecute({});

            expect(result).toBe(true);
        });
    });

    describe('execute', () => {
        beforeEach(() => {
            // Set up valid state for execute tests
            (command as any).force = false;
            setupInteractiveMocks(['build.yml']);
        });

        describe('method orchestration', () => {
            it('should call inherited methods in correct sequence', async () => {
                const initSpy = jest.spyOn(command as any, 'initializeRepository');
                const setupSpy = jest.spyOn(command as any, 'setupSkeletonRepository');
                const copySpy = jest.spyOn(command as any, 'copyWorkflowsWithEnvironment');

                await command.execute();

                expect(initSpy).toHaveBeenCalledTimes(1);
                expect(setupSpy).toHaveBeenCalledTimes(1);
                expect(copySpy).toHaveBeenCalledTimes(1);
            });

            it('should initialize repository first', async () => {
                const initSpy = jest.spyOn(command as any, 'initializeRepository');

                await command.execute();

                expect(initSpy).toHaveBeenCalledWith();
            });

            it('should setup skeleton repository after initialization', async () => {
                const setupSpy = jest.spyOn(command as any, 'setupSkeletonRepository');

                await command.execute();

                expect(setupSpy).toHaveBeenCalledWith();
            });

            it('should copy workflows with correct parameters', async () => {
                (command as any).force = true;
                const copySpy = jest.spyOn(command as any, 'copyWorkflowsWithEnvironment');

                await command.execute();

                expect(copySpy).toHaveBeenCalledWith(['build.yml'], true);
            });
        });

        describe('console output', () => {
            it('should log interactive workflow selection message', async () => {
                await command.execute();

                expect(consoleLogSpy).toHaveBeenCalledWith(`Interactive workflow selection for repo ${TEST_REPO_NAME}`);
            });

        });

        it('should resolve with void', async () => {
            const result = await command.execute();

            expect(result).toBeUndefined();
        });
    });

    describe('performInteractiveWorkflowSelection', () => {
        beforeEach(() => {
            (command as any).repo = mockRepo;
            (command as any).selectedSkeletonBranch = TEST_SKELETON_BRANCH;
        });

        it('should scan workflows and return selected workflows', async () => {
            setupInteractiveMocks(['build.yml', 'test.yml']);

            const result = await (command as any).performInteractiveWorkflowSelection();

            expect(mockWorkflowScanner.scanWorkflows).toHaveBeenCalledWith(mockRepo, TEST_SKELETON_BRANCH);
            expect(result).toEqual(['build.yml', 'test.yml']);
        });

        it('should filter out existing workflows', async () => {
            const workflowStatusWithExisting: IWorkflowStatus = {
                available: [
                    { name: 'Build Workflow', fileName: 'build.yml', exists: false },
                    { name: 'Test Workflow', fileName: 'test.yml', exists: true }, // exists = true
                    { name: 'Deploy Workflow', fileName: 'deploy.yml', exists: false }
                ],
                existing: []
            };
            mockWorkflowScanner.scanWorkflows.mockResolvedValue(workflowStatusWithExisting);
            mockCheckbox.mockResolvedValue(['build.yml']);

            await (command as any).performInteractiveWorkflowSelection();

            // Only missing workflows (exists: false) should be offered for selection
            expect(mockCheckbox).toHaveBeenCalledWith({
                message: 'Select workflows to add:',
                choices: [
                    { name: 'Build Workflow (build.yml)', value: 'build.yml', checked: false },
                    { name: 'Deploy Workflow (deploy.yml)', value: 'deploy.yml', checked: false }
                ],
                required: false
            });
        });

        it('should handle no missing workflows', async () => {
            const workflowStatusAllExist: IWorkflowStatus = {
                available: [
                    { name: 'Build Workflow', fileName: 'build.yml', exists: true },
                    { name: 'Test Workflow', fileName: 'test.yml', exists: true }
                ],
                existing: []
            };
            mockWorkflowScanner.scanWorkflows.mockResolvedValue(workflowStatusAllExist);
            mockCheckbox.mockResolvedValue([]);

            const result = await (command as any).performInteractiveWorkflowSelection();

            expect(consoleLogSpy).toHaveBeenCalledWith('No missing workflows found. All available workflows are already present in this repository.');
            expect(result).toEqual([]);
        });

        it('should log scanning message', async () => {
            setupInteractiveMocks([]);

            await (command as any).performInteractiveWorkflowSelection();

            expect(consoleLogSpy).toHaveBeenCalledWith('Scanning available workflows...');
        });
    });


    describe('parameter constants', () => {
        it('should have correct PARAMETER_FORCE constant', () => {
            expect((WorkflowsAddInteractive as any).PARAMETER_FORCE).toBe('force');
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            (command as any).force = false;
        });

        it('should handle repository initialization errors', async () => {
            const error = new Error('Repository not found');
            jest.spyOn(command as any, 'initializeRepository').mockRejectedValue(error);

            await expect(command.execute()).rejects.toThrow('Repository not found');
        });

        it('should handle skeleton setup errors', async () => {
            const error = new Error('Skeleton branch not found');
            jest.spyOn(command as any, 'setupSkeletonRepository').mockRejectedValue(error);

            await expect(command.execute()).rejects.toThrow('Skeleton branch not found');
        });

        it('should handle workflow scanning errors', async () => {
            const error = new Error('Scanning failed');
            mockWorkflowScanner.scanWorkflows.mockRejectedValue(error);

            await expect(command.execute()).rejects.toThrow('Scanning failed');
        });

        it('should handle user selection errors', async () => {
            const error = new Error('Selection cancelled');
            mockWorkflowScanner.scanWorkflows.mockResolvedValue(MOCK_WORKFLOW_STATUS);
            mockCheckbox.mockRejectedValue(error);

            await expect(command.execute()).rejects.toThrow('Selection cancelled');
        });

        it('should handle workflow copying errors', async () => {
            const error = new Error('Copy failed');
            setupInteractiveMocks(['build.yml']);
            jest.spyOn(command as any, 'copyWorkflowsWithEnvironment').mockRejectedValue(error);

            await expect(command.execute()).rejects.toThrow('Copy failed');
        });
    });

});
