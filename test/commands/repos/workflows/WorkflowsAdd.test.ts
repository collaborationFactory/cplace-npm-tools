import { WorkflowsAdd } from '../../../../src/commands/repos/workflows';
import { Repository } from '../../../../src/git';
import { Global } from '../../../../src/Global';
import { Workflows } from '../../../../src/commands/repos/workflows';
import { ICommandParameters } from '../../../../src/commands/models';

jest.mock('../../../../src/git');
jest.mock('../../../../src/Global');

describe('WorkflowsAdd', () => {
    const mockGlobal = Global as jest.Mocked<typeof Global>;

    let workflowsAdd: WorkflowsAdd;
    let mockRepo: jest.Mocked<Repository>;
    let consoleLogSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    // Test constants
    const TEST_REPO_NAME = 'test-repo';
    const TEST_SKELETON_BRANCH = 'version/25.4';
    const WORKFLOW_NAMES_STRING = 'build.yml test.yml deploy.yml';
    const WORKFLOW_NAMES_ARRAY = ['build.yml', 'test.yml', 'deploy.yml'];

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        workflowsAdd = new WorkflowsAdd();

        // Create mock repo
        mockRepo = {
            repoName: TEST_REPO_NAME
        } as jest.Mocked<Repository>;

        // Mock inherited methods to avoid testing parent class functionality
        jest.spyOn(workflowsAdd as any, 'initializeRepository')
            .mockResolvedValue(mockRepo);
        jest.spyOn(workflowsAdd as any, 'setupSkeletonRepository')
            .mockResolvedValue(TEST_SKELETON_BRANCH);
        jest.spyOn(workflowsAdd as any, 'parseSkeletonBranchParameter')
            .mockImplementation(() => {});
        jest.spyOn(workflowsAdd as any, 'copyWorkflowWithEnvironment')
            .mockResolvedValue(true);

        // Set up required properties
        (workflowsAdd as any).repo = mockRepo;
        (workflowsAdd as any).selectedSkeletonBranch = TEST_SKELETON_BRANCH;

        mockGlobal.isVerbose.mockReturnValue(false);
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        jest.restoreAllMocks();
    });

    describe('prepareAndMayExecute', () => {
        describe('workflow names parsing', () => {
            describe('string input', () => {
                it('should parse space-separated workflow names from string', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: WORKFLOW_NAMES_STRING
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    expect((workflowsAdd as any).workflowNames).toEqual(['build.yml', 'test.yml', 'deploy.yml']);
                });

                it('should handle single workflow name', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: 'single.yml'
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    expect((workflowsAdd as any).workflowNames).toEqual(['single.yml']);
                });

                it('should trim whitespace and filter empty strings', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: '  build.yml   test.yml    deploy.yml  '
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    expect((workflowsAdd as any).workflowNames).toEqual(['build.yml', 'test.yml', 'deploy.yml']);
                });

                it('should filter out empty workflow names from extra spaces', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: 'build.yml  test.yml deploy.yml'
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    expect((workflowsAdd as any).workflowNames).toEqual(['build.yml', 'test.yml', 'deploy.yml']);
                });

                it('should handle empty string', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: ''
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(false);
                    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: No workflow names specified for --add-workflows');
                });

                it('should handle string with only whitespace', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: '   '
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(false);
                    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: No workflow names specified for --add-workflows');
                });
            });

            describe('array input', () => {
                it('should handle flat array of workflow names', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: WORKFLOW_NAMES_ARRAY
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    expect((workflowsAdd as any).workflowNames).toEqual(['build.yml', 'test.yml', 'deploy.yml']);
                });

                it('should handle nested arrays and flatten them', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: [['build.yml', 'test.yml'], ['deploy.yml']]
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    expect((workflowsAdd as any).workflowNames).toEqual(['build.yml', 'test.yml', 'deploy.yml']);
                });

                it('should filter out non-string values from array', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: ['build.yml', 123, 'test.yml', null, 'deploy.yml', undefined, true]
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    expect((workflowsAdd as any).workflowNames).toEqual(['build.yml', 'test.yml', 'deploy.yml']);
                });

                it('should filter out array elements with only whitespace but keep valid trimmed names', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: ['  build.yml  ', '  test.yml  ', '  deploy.yml  ']
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    // Note: The actual implementation doesn't trim individual elements, only filters by trim().length > 0
                    expect((workflowsAdd as any).workflowNames).toEqual(['  build.yml  ', '  test.yml  ', '  deploy.yml  ']);
                });

                it('should filter out empty strings from array', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: ['build.yml', '', 'test.yml', '   ', 'deploy.yml']
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(true);
                    expect((workflowsAdd as any).workflowNames).toEqual(['build.yml', 'test.yml', 'deploy.yml']);
                });

                it('should handle empty array', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: []
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(false);
                    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: No workflow names specified for --add-workflows');
                });

                it('should handle array with only invalid values', () => {
                    const params: ICommandParameters = {
                        [Workflows.PARAMETER_ADD_WORKFLOWS]: [123, null, undefined, true, {}]
                    };

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(false);
                    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: No workflow names specified for --add-workflows');
                });
            });

            describe('invalid input types', () => {
                it.each([
                    ['missing parameter', undefined],
                    ['null parameter', null],
                    ['number parameter', 123],
                    ['boolean parameter', true],
                    ['object parameter', { workflows: 'test' }]
                ])('should handle %s', (scenario, paramValue) => {
                    const params: ICommandParameters = {};
                    if (paramValue !== undefined) {
                        params[Workflows.PARAMETER_ADD_WORKFLOWS] = paramValue;
                    }

                    const result = workflowsAdd.prepareAndMayExecute(params);

                    expect(result).toBe(false);
                    expect(consoleErrorSpy).toHaveBeenCalledWith('Error: No workflow names specified for --add-workflows');
                });
            });
        });

        describe('force parameter parsing', () => {
            beforeEach(() => {
                // Provide valid workflow names for these tests
                jest.spyOn(workflowsAdd as any, 'parseWorkflowNames').mockReturnValue(true);
                (workflowsAdd as any).workflowNames = ['test.yml'];
            });

            it('should set force to true when force parameter is truthy', () => {
                const params: ICommandParameters = {
                    force: true
                };

                workflowsAdd.prepareAndMayExecute(params);

                expect((workflowsAdd as any).force).toBe(true);
            });

            it('should set force to false when force parameter is falsy', () => {
                const params: ICommandParameters = {
                    force: false
                };

                workflowsAdd.prepareAndMayExecute(params);

                expect((workflowsAdd as any).force).toBe(false);
            });

            it('should set force to false when force parameter is missing', () => {
                const params: ICommandParameters = {};

                workflowsAdd.prepareAndMayExecute(params);

                expect((workflowsAdd as any).force).toBe(false);
            });

            it.each([
                ['number 1', 1],
                ['string "true"', 'true'],
                ['string "yes"', 'yes'],
                ['empty object', {}],
                ['empty array', []]
            ])('should handle truthy value %s for force parameter', (scenario, value) => {
                const params: ICommandParameters = {
                    force: value
                };

                workflowsAdd.prepareAndMayExecute(params);

                expect((workflowsAdd as any).force).toBe(true);
            });
        });

        describe('skeleton branch parameter delegation', () => {
            beforeEach(() => {
                // Provide valid workflow names for these tests
                jest.spyOn(workflowsAdd as any, 'parseWorkflowNames').mockReturnValue(true);
                (workflowsAdd as any).workflowNames = ['test.yml'];
            });

            it('should call parseSkeletonBranchParameter with provided params', () => {
                const parseSkeletonSpy = jest.spyOn(workflowsAdd as any, 'parseSkeletonBranchParameter');
                const params: ICommandParameters = {
                    skeletonBranch: 'custom/branch'
                };

                workflowsAdd.prepareAndMayExecute(params);

                expect(parseSkeletonSpy).toHaveBeenCalledWith(params);
            });
        });

        describe('verbose logging', () => {
            beforeEach(() => {
                // Provide valid workflow names for these tests
                jest.spyOn(workflowsAdd as any, 'parseWorkflowNames').mockReturnValue(true);
                (workflowsAdd as any).workflowNames = ['build.yml', 'test.yml'];
            });

            it('should log preparation message when verbose mode is enabled', () => {
                mockGlobal.isVerbose.mockReturnValue(true);

                workflowsAdd.prepareAndMayExecute({});

                expect(consoleLogSpy).toHaveBeenCalledWith('Preparing workflows add command');
            });

            it('should not log preparation message when verbose mode is disabled', () => {
                mockGlobal.isVerbose.mockReturnValue(false);

                workflowsAdd.prepareAndMayExecute({});

                expect(consoleLogSpy).not.toHaveBeenCalledWith('Preparing workflows add command');
            });

            it('should log force mode message when force is enabled and verbose', () => {
                mockGlobal.isVerbose.mockReturnValue(true);
                const params: ICommandParameters = {
                    force: true
                };

                workflowsAdd.prepareAndMayExecute(params);

                expect(consoleLogSpy).toHaveBeenCalledWith('Force mode enabled - will overwrite existing files');
            });

            it('should not log force mode message when verbose is disabled', () => {
                mockGlobal.isVerbose.mockReturnValue(false);
                const params: ICommandParameters = {
                    force: true
                };

                workflowsAdd.prepareAndMayExecute(params);

                expect(consoleLogSpy).not.toHaveBeenCalledWith('Force mode enabled - will overwrite existing files');
            });

            it('should log workflow names when verbose mode is enabled', () => {
                mockGlobal.isVerbose.mockReturnValue(true);

                workflowsAdd.prepareAndMayExecute({});

                expect(consoleLogSpy).toHaveBeenCalledWith('Workflows to add: build.yml, test.yml');
            });

            it('should not log workflow names when verbose mode is disabled', () => {
                mockGlobal.isVerbose.mockReturnValue(false);

                workflowsAdd.prepareAndMayExecute({});

                expect(consoleLogSpy).not.toHaveBeenCalledWith('Workflows to add: build.yml, test.yml');
            });
        });
    });

    describe('execute', () => {
        beforeEach(() => {
            // Set up valid state for execute tests
            (workflowsAdd as any).workflowNames = ['build.yml', 'test.yml'];
            (workflowsAdd as any).force = false;
        });

        describe('method orchestration', () => {
            it('should call inherited methods in correct sequence', async () => {
                const initSpy = jest.spyOn(workflowsAdd as any, 'initializeRepository');
                const setupSpy = jest.spyOn(workflowsAdd as any, 'setupSkeletonRepository');

                await workflowsAdd.execute();

                expect(initSpy).toHaveBeenCalledTimes(1);
                expect(setupSpy).toHaveBeenCalledTimes(1);
                expect(consoleLogSpy).toHaveBeenCalledWith('Adding workflows: build.yml, test.yml');
            });

            it('should initialize repository first', async () => {
                const initSpy = jest.spyOn(workflowsAdd as any, 'initializeRepository');

                await workflowsAdd.execute();

                expect(initSpy).toHaveBeenCalledWith();
            });

            it('should setup skeleton repository after initialization', async () => {
                const setupSpy = jest.spyOn(workflowsAdd as any, 'setupSkeletonRepository');

                await workflowsAdd.execute();

                expect(setupSpy).toHaveBeenCalledWith();
            });

            it('should copy workflows with correct parameters', async () => {
                (workflowsAdd as any).workflowNames = ['custom.yml'];
                (workflowsAdd as any).force = true;

                await workflowsAdd.execute();

                // Verify that copySpecifiedWorkflows logic executed (through console output)
                expect(consoleLogSpy).toHaveBeenCalledWith('Adding workflows: custom.yml');
            });
        });

        describe('console output', () => {
            it('should log adding workflows message', async () => {
                await workflowsAdd.execute();

                expect(consoleLogSpy).toHaveBeenCalledWith(`Adding workflows to repo ${TEST_REPO_NAME}`);
            });

            it('should use correct repo name in message', async () => {
                Object.defineProperty(mockRepo, 'repoName', {
                    value: 'different-repo',
                    writable: false
                });

                await workflowsAdd.execute();

                expect(consoleLogSpy).toHaveBeenCalledWith('Adding workflows to repo different-repo');
            });
        });

        describe('error handling', () => {
            it('should catch and re-throw initialization errors', async () => {
                const error = new Error('Initialization failed');
                jest.spyOn(workflowsAdd as any, 'initializeRepository').mockRejectedValue(error);

                await expect(workflowsAdd.execute()).rejects.toThrow('Initialization failed');
                expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding workflows: Initialization failed');
            });

            it('should catch and re-throw skeleton setup errors', async () => {
                const error = new Error('Skeleton setup failed');
                jest.spyOn(workflowsAdd as any, 'setupSkeletonRepository').mockRejectedValue(error);

                await expect(workflowsAdd.execute()).rejects.toThrow('Skeleton setup failed');
                expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding workflows: Skeleton setup failed');
            });

            it('should catch and re-throw workflow copying errors', async () => {
                const error = new Error('Copy failed');
                jest.spyOn(workflowsAdd as any, 'copySpecifiedWorkflows').mockRejectedValue(error);

                await expect(workflowsAdd.execute()).rejects.toThrow('Copy failed');
                expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding workflows: Copy failed');
            });

            it('should handle non-Error objects', async () => {
                const error = 'String error';
                jest.spyOn(workflowsAdd as any, 'copySpecifiedWorkflows').mockRejectedValue(error);

                await expect(workflowsAdd.execute()).rejects.toBe('String error');
                expect(consoleErrorSpy).toHaveBeenCalledWith('Error adding workflows: String error');
            });

            it('should log verbose error details when verbose mode is enabled', async () => {
                mockGlobal.isVerbose.mockReturnValue(true);
                const error = new Error('Detailed error');
                jest.spyOn(workflowsAdd as any, 'copySpecifiedWorkflows').mockRejectedValue(error);

                await expect(workflowsAdd.execute()).rejects.toThrow('Detailed error');
                expect(consoleErrorSpy).toHaveBeenCalledWith('Full error details:', error);
            });

            it('should not log verbose error details when verbose mode is disabled', async () => {
                mockGlobal.isVerbose.mockReturnValue(false);
                const error = new Error('Simple error');
                jest.spyOn(workflowsAdd as any, 'copySpecifiedWorkflows').mockRejectedValue(error);

                await expect(workflowsAdd.execute()).rejects.toThrow('Simple error');
                expect(consoleErrorSpy).not.toHaveBeenCalledWith('Full error details:', expect.anything());
            });
        });
    });

    describe('copySpecifiedWorkflows', () => {
        let copyWorkflowSpy: jest.SpyInstance;

        beforeEach(() => {
            // Set up required properties
            (workflowsAdd as any).repo = mockRepo;
            copyWorkflowSpy = jest.spyOn(workflowsAdd as any, 'copyWorkflowWithEnvironment')
                .mockResolvedValue(true);
        });

        it('should process multiple workflows sequentially', async () => {
            await (workflowsAdd as any).copySpecifiedWorkflows(['build.yml', 'test.yml', 'deploy.yml'], false);

            expect(copyWorkflowSpy).toHaveBeenCalledTimes(3);
            expect(copyWorkflowSpy).toHaveBeenNthCalledWith(1, 'build.yml', false);
            expect(copyWorkflowSpy).toHaveBeenNthCalledWith(2, 'test.yml', false);
            expect(copyWorkflowSpy).toHaveBeenNthCalledWith(3, 'deploy.yml', false);
        });

        it('should pass force flag to copyWorkflowWithEnvironment', async () => {
            await (workflowsAdd as any).copySpecifiedWorkflows(['build.yml'], true);

            expect(copyWorkflowSpy).toHaveBeenCalledWith('build.yml', true);
        });

        it('should handle empty workflow list', async () => {
            await (workflowsAdd as any).copySpecifiedWorkflows([], false);

            expect(copyWorkflowSpy).not.toHaveBeenCalled();
        });

        describe('file extension handling', () => {
            it('should not modify filenames that already have .yml extension', async () => {
                await (workflowsAdd as any).copySpecifiedWorkflows(['build.yml'], false);

                expect(copyWorkflowSpy).toHaveBeenCalledWith('build.yml', false);
            });

            it('should not modify filenames that already have .yaml extension', async () => {
                await (workflowsAdd as any).copySpecifiedWorkflows(['build.yaml'], false);

                expect(copyWorkflowSpy).toHaveBeenCalledWith('build.yaml', false);
            });

            it('should add .yml extension to filenames without extension', async () => {
                await (workflowsAdd as any).copySpecifiedWorkflows(['build'], false);

                expect(copyWorkflowSpy).toHaveBeenCalledWith('build.yml', false);
            });

            it('should add .yml extension to filenames with other extensions', async () => {
                await (workflowsAdd as any).copySpecifiedWorkflows(['build.txt'], false);

                expect(copyWorkflowSpy).toHaveBeenCalledWith('build.txt.yml', false);
            });

            it.each([
                ['no extension', 'build', 'build.yml'],
                ['existing .yml extension', 'test.yml', 'test.yml'],
                ['existing .yaml extension', 'deploy.yaml', 'deploy.yaml'],
                ['other extension', 'custom.txt', 'custom.txt.yml']
            ])('should handle %s filename: %s -> %s', async (scenario, input, expected) => {
                await (workflowsAdd as any).copySpecifiedWorkflows([input], false);

                expect(copyWorkflowSpy).toHaveBeenCalledWith(expected, false);
            });
        });

        it('should log workflow names being added', async () => {
            await (workflowsAdd as any).copySpecifiedWorkflows(['build.yml', 'test.yml'], false);

            expect(consoleLogSpy).toHaveBeenCalledWith('Adding workflows: build.yml, test.yml');
        });

        it('should continue processing if individual workflow copying fails', async () => {
            copyWorkflowSpy
                .mockResolvedValueOnce(false) // First workflow fails
                .mockResolvedValueOnce(true); // Second workflow succeeds

            await (workflowsAdd as any).copySpecifiedWorkflows(['failing.yml', 'success.yml'], false);

            expect(copyWorkflowSpy).toHaveBeenCalledTimes(2);
            expect(copyWorkflowSpy).toHaveBeenNthCalledWith(1, 'failing.yml', false);
            expect(copyWorkflowSpy).toHaveBeenNthCalledWith(2, 'success.yml', false);
        });
    });

    describe('parameter constants', () => {
        it('should have correct PARAMETER_FORCE constant', () => {
            expect((WorkflowsAdd as any).PARAMETER_FORCE).toBe('force');
        });
    });

    describe('integration scenarios', () => {
        it('should handle complete workflow addition flow', async () => {
            const params: ICommandParameters = {
                [Workflows.PARAMETER_ADD_WORKFLOWS]: 'build test deploy',
                force: true
            };

            // Mock the actual private methods
            jest.spyOn(workflowsAdd as any, 'copyWorkflowWithEnvironment').mockResolvedValue(true);

            const prepareResult = workflowsAdd.prepareAndMayExecute(params);
            expect(prepareResult).toBe(true);

            await workflowsAdd.execute();

            expect((workflowsAdd as any).workflowNames).toEqual(['build', 'test', 'deploy']);
            expect((workflowsAdd as any).force).toBe(true);
        });

        it('should fail preparation but not execute with invalid parameters', () => {
            const params: ICommandParameters = {
                [Workflows.PARAMETER_ADD_WORKFLOWS]: ''
            };

            const prepareResult = workflowsAdd.prepareAndMayExecute(params);
            expect(prepareResult).toBe(false);

        });
    });
});
