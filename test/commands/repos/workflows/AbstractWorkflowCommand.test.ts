import { AbstractWorkflowCommand } from '../../../../src/commands/repos/workflows';
import { Repository } from '../../../../src/git';
import { SkeletonManager } from '../../../../src/helpers/SkeletonManager';
import { Global } from '../../../../src/Global';
import { ICommandParameters } from '../../../../src/commands/models';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('../../../../src/git');
jest.mock('../../../../src/helpers/SkeletonManager');
jest.mock('../../../../src/Global');
jest.mock('fs');
jest.mock('path');

// Concrete implementation for testing
class TestableAbstractWorkflowCommand extends AbstractWorkflowCommand {
    public async testInitializeRepository(): Promise<Repository> {
        return this.initializeRepository();
    }

    public async testSetupSkeletonRepository(): Promise<string> {
        return this.setupSkeletonRepository();
    }

    public async testCopyWorkflowWithEnvironment(workflowFileName: string, force?: boolean): Promise<boolean> {
        return this.copyWorkflowWithEnvironment(workflowFileName, force);
    }

    public testParseSkeletonBranchParameter(params: ICommandParameters): void {
        return this.parseSkeletonBranchParameter(params);
    }

    public async testCopyWorkflowsWithEnvironment(selectedWorkflows: string[], force: boolean): Promise<void> {
        return this.copyWorkflowsWithEnvironment(selectedWorkflows, force);
    }

    public async execute(): Promise<void> {
        // Implementation not needed for testing abstract methods
    }

    public prepareAndMayExecute(): boolean {
        return true;
    }
}

describe('AbstractWorkflowCommand', () => {
    const mockRepository = Repository as jest.MockedClass<typeof Repository>;
    const mockSkeletonManager = SkeletonManager as jest.Mocked<typeof SkeletonManager>;
    const mockGlobal = Global as jest.Mocked<typeof Global>;
    const mockFs = fs as jest.Mocked<typeof fs>;
    const mockPath = path as jest.Mocked<typeof path>;

    let command: TestableAbstractWorkflowCommand;
    let mockRepo: jest.Mocked<Repository>;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    // Helper functions for common mock setups
    const setupSuccessfulSkeletonMocks = () => {
        mockSkeletonManager.validateCplaceVersion.mockImplementation(() => {});
        mockSkeletonManager.ensureSkeletonRemote.mockResolvedValue();
        mockSkeletonManager.getSkeletonBranchForVersion.mockReturnValue('version/25.4');
        mockSkeletonManager.validateSkeletonBranchExists.mockResolvedValue(true);
    };

    const setupRepositoryWithWorkingDir = () => {
        (command as any).repo = mockRepo;
        (command as any).selectedSkeletonBranch = 'version/25.4';
        Object.defineProperty(mockRepo, 'workingDir', {
            value: '/test/repo',
            writable: false
        });
    };

    const setupSuccessfulFileOperations = () => {
        mockSkeletonManager.fileExistsInRemote.mockResolvedValue(true);
        mockSkeletonManager.copyFileFromRemote.mockResolvedValue();
    };

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(process, 'cwd').mockReturnValue('/test/working/dir');

        command = new TestableAbstractWorkflowCommand();
        mockRepo = new mockRepository('/test/repo') as jest.Mocked<Repository>;
        mockRepository.mockImplementation(() => mockRepo);

        mockGlobal.isVerbose.mockReturnValue(false);
        mockPath.join.mockImplementation((...args) => args.join('/'));
        mockPath.normalize.mockImplementation((p) => p);
        mockPath.isAbsolute.mockImplementation((p) => p.startsWith('/'));

        // Setup fs.promises mock
        const promisesMock = {
            mkdir: jest.fn().mockResolvedValue(undefined)
        };
        Object.defineProperty(mockFs, 'promises', {
            value: promisesMock,
            writable: true
        });
        mockFs.existsSync.mockReturnValue(false);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        jest.restoreAllMocks();
    });

    describe('initializeRepository', () => {
        it('should initialize and validate repository successfully', async () => {
            mockRepo.checkIsRepo.mockResolvedValue();
            Object.defineProperty(mockRepo, 'repoName', {
                value: 'test-repo',
                writable: false
            });

            const result = await command.testInitializeRepository();

            expect(mockRepo.checkIsRepo).toHaveBeenCalled();
            expect(result).toBe(mockRepo);
        });

        it('should handle repository validation failure', async () => {
            mockRepo.checkIsRepo.mockRejectedValue(new Error('Not a git repository'));

            await expect(command.testInitializeRepository()).rejects.toThrow('Not a git repository');
        });
    });

    describe('setupSkeletonRepository', () => {
        beforeEach(() => {
            (command as any).repo = mockRepo;
            setupSuccessfulSkeletonMocks();
        });

        it('should setup skeleton repository with default branch', async () => {

            const result = await command.testSetupSkeletonRepository();

            expect(mockSkeletonManager.validateCplaceVersion).toHaveBeenCalled();
            expect(mockSkeletonManager.ensureSkeletonRemote).toHaveBeenCalledWith(mockRepo);
            expect(mockSkeletonManager.getSkeletonBranchForVersion).toHaveBeenCalledWith(undefined);
            expect(mockSkeletonManager.validateSkeletonBranchExists).toHaveBeenCalledWith(mockRepo, 'version/25.4');
            expect(result).toBe('version/25.4');
        });

        it('should setup skeleton repository with custom branch', async () => {
            (command as any).skeletonBranch = 'custom/branch';
            mockSkeletonManager.getSkeletonBranchForVersion.mockReturnValue('custom/branch');

            const result = await command.testSetupSkeletonRepository();

            expect(mockSkeletonManager.getSkeletonBranchForVersion).toHaveBeenCalledWith('custom/branch');
            expect(result).toBe('custom/branch');
        });

        it.each([
            [
                'skeleton branch does not exist',
                () => mockSkeletonManager.validateSkeletonBranchExists.mockResolvedValue(false),
                "Skeleton branch 'version/25.4' does not exist"
            ],
            [
                'cplace version validation failure',
                () => mockSkeletonManager.validateCplaceVersion.mockImplementation(() => {
                    throw new Error('Unsupported cplace version');
                }),
                'Unsupported cplace version'
            ],
            [
                'skeleton remote setup failure',
                () => mockSkeletonManager.ensureSkeletonRemote.mockRejectedValue(new Error('Network error')),
                'Network error'
            ]
        ])('should handle %s', async (scenario, mockSetup, expectedError) => {
            mockSetup();

            await expect(command.testSetupSkeletonRepository()).rejects.toThrow(expectedError);
        });
    });

    describe('copyWorkflowWithEnvironment', () => {
        beforeEach(() => {
            setupRepositoryWithWorkingDir();
        });

        it('should copy workflow and environment file successfully', async () => {
            mockSkeletonManager.fileExistsInRemote.mockResolvedValue(true);
            mockSkeletonManager.copyFileFromRemote.mockResolvedValue();

            const result = await command.testCopyWorkflowWithEnvironment('test.yml');

            expect(mockFs.promises.mkdir).toHaveBeenCalledWith('/test/repo/.github/workflows', { recursive: true });
            expect(mockSkeletonManager.fileExistsInRemote).toHaveBeenCalledWith(
                mockRepo,
                'version/25.4',
                '.github/workflows/test.yml'
            );
            expect(result).toBe(true);
        });

        it('should handle workflow file not found', async () => {
            mockSkeletonManager.fileExistsInRemote.mockResolvedValue(false);

            const result = await command.testCopyWorkflowWithEnvironment('nonexistent.yml');

            expect(result).toBe(false);
        });

        it('should copy workflow with force flag', async () => {
            mockFs.existsSync.mockReturnValue(true);
            mockSkeletonManager.fileExistsInRemote.mockResolvedValue(true);
            mockSkeletonManager.copyFileFromRemote.mockResolvedValue();

            const result = await command.testCopyWorkflowWithEnvironment('test.yml', true);

            expect(mockSkeletonManager.copyFileFromRemote).toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('should handle invalid workflow path', async () => {
            mockPath.normalize.mockReturnValue('../../../malicious/path');

            await expect(command.testCopyWorkflowWithEnvironment('test.yml')).rejects.toThrow(
                'Invalid workflows directory path'
            );
        });

        it('should handle copy file errors', async () => {
            mockSkeletonManager.fileExistsInRemote.mockResolvedValue(true);
            mockSkeletonManager.copyFileFromRemote.mockRejectedValue(new Error('Copy failed'));

            const result = await command.testCopyWorkflowWithEnvironment('test.yml');

            expect(result).toBe(false);
        });
    });

    describe('parseSkeletonBranchParameter', () => {
        it('should parse valid skeleton branch parameter', () => {
            const params: ICommandParameters = {
                skeletonBranch: 'custom/branch'
            };

            command.testParseSkeletonBranchParameter(params);

            expect((command as any).skeletonBranch).toBe('custom/branch');
        });

        it.each([
            ['missing parameter', {}, undefined],
            ['non-string parameter (number)', { skeletonBranch: 123 }, undefined],
            ['non-string parameter (boolean)', { skeletonBranch: true }, undefined],
            ['non-string parameter (object)', { skeletonBranch: {} }, undefined],
            ['non-string parameter (array)', { skeletonBranch: [] }, undefined],
            ['null parameter', { skeletonBranch: null }, undefined],
            ['undefined parameter', { skeletonBranch: undefined }, undefined]
        ])('should handle %s', (scenario, params, expectedResult) => {
            command.testParseSkeletonBranchParameter(params as ICommandParameters);

            expect((command as any).skeletonBranch).toBe(expectedResult);
        });
    });

    describe('copyWorkflowsWithEnvironment', () => {
        beforeEach(() => {
            setupRepositoryWithWorkingDir();
        });

        it('should copy multiple workflows successfully', async () => {
            setupSuccessfulFileOperations();

            await command.testCopyWorkflowsWithEnvironment(['workflow1.yml', 'workflow2.yml'], false);

            expect(mockFs.promises.mkdir).toHaveBeenCalledTimes(2);
            expect(mockSkeletonManager.fileExistsInRemote).toHaveBeenCalledTimes(4); // 2 workflows + 2 env files check
        });

        it('should handle empty workflow list', async () => {
            await command.testCopyWorkflowsWithEnvironment([], false);

            expect(mockFs.promises.mkdir).not.toHaveBeenCalled();
            expect(mockSkeletonManager.fileExistsInRemote).not.toHaveBeenCalled();
        });

        it('should continue with remaining workflows if one fails', async () => {
            mockSkeletonManager.fileExistsInRemote
                .mockResolvedValueOnce(false) // First workflow doesn't exist
                .mockResolvedValueOnce(true)  // Second workflow exists
                .mockResolvedValueOnce(false); // Environment file for second workflow doesn't exist
            mockSkeletonManager.copyFileFromRemote.mockResolvedValue();

            await command.testCopyWorkflowsWithEnvironment(['missing.yml', 'existing.yml'], false);

            expect(mockSkeletonManager.fileExistsInRemote).toHaveBeenCalledTimes(3);
            expect(mockSkeletonManager.copyFileFromRemote).toHaveBeenCalledTimes(1); // Only for existing.yml
        });
    });

    describe('security validations', () => {
        beforeEach(() => {
            setupRepositoryWithWorkingDir();
        });

        it.each([
            [
                'path traversal attempts',
                '../../malicious.yml',
                () => mockPath.normalize.mockReturnValue('../../../etc/passwd'),
                'Invalid workflows directory path'
            ],
            [
                'relative paths in workflows directory',
                'test.yml',
                () => {
                    mockPath.join.mockReturnValueOnce('/test/repo/.github/workflows');
                    mockPath.normalize.mockReturnValueOnce('/test/repo/.github/workflows');
                    mockPath.isAbsolute.mockReturnValueOnce(false);
                },
                'Invalid workflows directory path'
            ]
        ])('should reject %s', async (scenario, workflowFile, mockSetup, expectedError) => {
            mockSetup();

            await expect(command.testCopyWorkflowWithEnvironment(workflowFile)).rejects.toThrow(expectedError);
        });

        it('should allow valid absolute paths', async () => {
            mockPath.normalize.mockReturnValue('/valid/absolute/path');
            mockPath.isAbsolute.mockReturnValue(true);
            setupSuccessfulFileOperations();

            const result = await command.testCopyWorkflowWithEnvironment('test.yml');

            expect(result).toBe(true);
        });
    });
});
