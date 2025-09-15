import { WorkflowsList } from '../../../../src/commands/repos/workflows/WorkflowsList';
import { Repository } from '../../../../src/git';
import { SkeletonManager } from '../../../../src/helpers/SkeletonManager';
import { WorkflowScanner } from '../../../../src/helpers/WorkflowScanner';
import { Global } from '../../../../src/Global';
import { ICommandParameters } from '../../../../src/commands/models';
import { IWorkflowStatus } from '../../../../src/commands/repos/workflows/models';

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

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);

        workflowsList = new WorkflowsList();
        mockRepo = new mockRepository('/test/repo') as jest.Mocked<Repository>;
        mockRepository.mockImplementation(() => mockRepo);

        mockGlobal.isVerbose.mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('prepareAndMayExecute', () => {
        it('should parse skeleton branch parameter', () => {
            const params: ICommandParameters = {
                skeletonBranch: 'custom/branch'
            };

            const result = workflowsList.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((workflowsList as any).skeletonBranch).toBe('custom/branch');
        });

        it('should parse kebab-case skeleton branch parameter', () => {
            const params: ICommandParameters = {
                'skeleton-branch': 'another/branch'
            };

            const result = workflowsList.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((workflowsList as any).skeletonBranch).toBe('another/branch');
        });

        it('should handle missing skeleton branch parameter', () => {
            const params: ICommandParameters = {};

            const result = workflowsList.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((workflowsList as any).skeletonBranch).toBeUndefined();
        });

        it('should log verbose message when verbose mode is enabled', () => {
            mockGlobal.isVerbose.mockReturnValue(true);
            const consoleSpy = jest.spyOn(console, 'log');

            const params: ICommandParameters = {};
            workflowsList.prepareAndMayExecute(params);

            expect(consoleSpy).toHaveBeenCalledWith('Preparing workflows list command');
        });
    });

    describe('execute', () => {
        beforeEach(() => {
            mockRepo.checkIsRepo.mockResolvedValue();
            Object.defineProperty(mockRepo, 'repoName', {
                value: 'test-repo',
                writable: false
            });
            mockSkeletonManager.validateCplaceVersion.mockImplementation(() => {});
            mockSkeletonManager.ensureSkeletonRemote.mockResolvedValue();
            mockSkeletonManager.getSkeletonBranchForVersion.mockReturnValue('version/25.4');
            mockSkeletonManager.validateSkeletonBranchExists.mockResolvedValue(true);
        });

        it('should execute successfully and display workflows', async () => {
            const mockWorkflowStatus: IWorkflowStatus = {
                available: [
                    {
                        name: 'CI Pipeline',
                        fileName: 'ci.yml',
                        size: 1024,
                        exists: false,
                        description: 'Triggers on: push'
                    }
                ],
                existing: []
            };

            mockWorkflowScanner.scanWorkflows.mockResolvedValue(mockWorkflowStatus);
            mockWorkflowScanner.formatWorkflowStatus.mockReturnValue('Formatted workflow status');

            const consoleSpy = jest.spyOn(console, 'log');

            await workflowsList.execute();

            expect(mockRepo.checkIsRepo).toHaveBeenCalled();
            expect(mockSkeletonManager.validateCplaceVersion).toHaveBeenCalled();
            expect(mockSkeletonManager.ensureSkeletonRemote).toHaveBeenCalledWith(mockRepo);
            expect(mockSkeletonManager.getSkeletonBranchForVersion).toHaveBeenCalledWith(undefined);
            expect(mockSkeletonManager.validateSkeletonBranchExists).toHaveBeenCalledWith(mockRepo, 'version/25.4');
            expect(mockWorkflowScanner.scanWorkflows).toHaveBeenCalledWith(mockRepo, 'version/25.4');
            expect(mockWorkflowScanner.formatWorkflowStatus).toHaveBeenCalledWith(mockWorkflowStatus);
            expect(consoleSpy).toHaveBeenCalledWith('Formatted workflow status');
        });

        it('should use custom skeleton branch when provided', async () => {
            (workflowsList as any).skeletonBranch = 'custom/branch';

            const mockWorkflowStatus: IWorkflowStatus = { available: [], existing: [] };
            mockWorkflowScanner.scanWorkflows.mockResolvedValue(mockWorkflowStatus);
            mockWorkflowScanner.formatWorkflowStatus.mockReturnValue('Empty status');

            await workflowsList.execute();

            expect(mockSkeletonManager.getSkeletonBranchForVersion).toHaveBeenCalledWith('custom/branch');
            expect(mockSkeletonManager.validateSkeletonBranchExists).toHaveBeenCalledWith(mockRepo, 'version/25.4');
        });

        it('should log verbose messages when verbose mode is enabled', async () => {
            mockGlobal.isVerbose.mockReturnValue(true);
            const consoleSpy = jest.spyOn(console, 'log');

            const mockWorkflowStatus: IWorkflowStatus = { available: [], existing: [] };
            mockWorkflowScanner.scanWorkflows.mockResolvedValue(mockWorkflowStatus);
            mockWorkflowScanner.formatWorkflowStatus.mockReturnValue('Status');

            await workflowsList.execute();

            expect(consoleSpy).toHaveBeenCalledWith(`Listing available workflows in repo ${mockRepo.repoName}`);
            expect(consoleSpy).toHaveBeenCalledWith('Using skeleton branch: version/25.4');
        });

        it('should handle repository check failure', async () => {
            mockRepo.checkIsRepo.mockRejectedValue(new Error('Not a git repository'));

            const consoleErrorSpy = jest.spyOn(console, 'error');
            const processExitSpy = jest.spyOn(process, 'exit');

            await workflowsList.execute();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error listing workflows: Not a git repository');
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should handle cplace version validation failure', async () => {
            mockSkeletonManager.validateCplaceVersion.mockImplementation(() => {
                throw new Error('Unsupported cplace version');
            });

            const consoleErrorSpy = jest.spyOn(console, 'error');
            const processExitSpy = jest.spyOn(process, 'exit');

            await workflowsList.execute();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error listing workflows: Unsupported cplace version');
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should handle skeleton remote setup failure', async () => {
            mockSkeletonManager.ensureSkeletonRemote.mockRejectedValue(new Error('Network error'));

            const consoleErrorSpy = jest.spyOn(console, 'error');
            const processExitSpy = jest.spyOn(process, 'exit');

            await workflowsList.execute();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error listing workflows: Network error');
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should handle non-existent skeleton branch', async () => {
            mockSkeletonManager.validateSkeletonBranchExists.mockResolvedValue(false);

            const consoleErrorSpy = jest.spyOn(console, 'error');
            const processExitSpy = jest.spyOn(process, 'exit');

            await workflowsList.execute();

            expect(consoleErrorSpy).toHaveBeenCalledWith("Error listing workflows: Skeleton branch 'version/25.4' does not exist");
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should handle workflow scanning failure', async () => {
            mockWorkflowScanner.scanWorkflows.mockRejectedValue(new Error('Failed to scan workflows'));

            const consoleErrorSpy = jest.spyOn(console, 'error');
            const processExitSpy = jest.spyOn(process, 'exit');

            await workflowsList.execute();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error listing workflows: Failed to scan workflows');
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should display detailed error information in verbose mode', async () => {
            mockGlobal.isVerbose.mockReturnValue(true);
            const error = new Error('Detailed error');
            mockWorkflowScanner.scanWorkflows.mockRejectedValue(error);

            const consoleErrorSpy = jest.spyOn(console, 'error');
            const processExitSpy = jest.spyOn(process, 'exit');

            await workflowsList.execute();

            expect(consoleErrorSpy).toHaveBeenCalledWith('Error listing workflows: Detailed error');
            expect(consoleErrorSpy).toHaveBeenCalledWith('Full error details:', error);
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });
});