import {Upmerge} from '../../src/commands/flow/Upmerge';
import {Repository} from '../../src/git';
import {IGitBranchDetails} from '../../src/git/models';
import {ICommandParameters} from '../../src/commands/models';
import {StatusResult} from 'simple-git';
import {runVerifyCommand} from '../../src/commands/flow/VerifyCommand';

// Mock Repository class
jest.mock('../../src/git/Repository');
jest.mock('../../src/commands/flow/VerifyCommand');

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

        it('should refuse --verify without a command', () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            try {
                expect(upmerge.prepareAndMayExecute({verify: ''})).toBeFalsy();
                expect(upmerge.prepareAndMayExecute({verify: '  '})).toBeFalsy();
            } finally {
                errorSpy.mockRestore();
            }
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
            // Drop queued one-time values a failing test may have left behind
            mockRepo.status.mockReset();
            mockRepo.merge.mockReset();
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

        it('should not change the git configuration of the repository', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: true
            };
            upmerge.prepareAndMayExecute(params);

            await upmerge.execute();

            const configCalls = (mockRepo.rawWrapper as jest.Mock).mock.calls.filter(call => call[0][0] === 'config');
            expect(configCalls).toEqual([]);
        });

        it('should print the push command with an explicit refspec when the merge stops on a conflict', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: true
            };
            upmerge.prepareAndMayExecute(params);
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

            // First merge (23.4 -> 24.1) stops on a conflict
            mockRepo.merge.mockRejectedValueOnce(new Error('Merge conflict'));
            mockRepo.status
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult({conflicted: ['file1']}));

            try {
                await expect(upmerge.execute()).rejects.toThrow('Merge conflict');

                const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
                expect(output).toContain('git push origin HEAD:release/24.1');
                expect(output).toContain('cplace-cli flow --upmerge --release 23.4\n');
            } finally {
                logSpy.mockRestore();
            }
        });

        it('should repeat the original arguments in the rerun command when a customer branch merge stops on a conflict', async () => {
            mockRepo.listBranches.mockResolvedValue([
                ...mockBranches,
                {name: 'origin/customer/acme/23.4', commit: 'commit5', current: false, isRemote: true, tracking: null},
                {name: 'origin/customer/acme/24.1', commit: 'commit6', current: false, isRemote: true, tracking: null}
            ]);
            const params: ICommandParameters = {
                release: '23.4',
                customer: 'acme',
                push: true
            };
            upmerge.prepareAndMayExecute(params);
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

            // The three release merges succeed, the merge into customer/acme/23.4 stops on a conflict
            mockRepo.merge
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockRejectedValueOnce(new Error('Merge conflict'));
            mockRepo.status
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult({conflicted: ['file1']}));

            try {
                await expect(upmerge.execute()).rejects.toThrow('Merge conflict');

                const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
                expect(output).toContain('git push origin HEAD:customer/acme/23.4');
                expect(output).toContain('cplace-cli flow --upmerge --release 23.4 --customer acme\n');
            } finally {
                logSpy.mockRestore();
            }
        });

        it('should print the rerun command when the merge into the default branch stops on a conflict', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                allCustomers: true,
                showFiles: true,
                push: true
            };
            upmerge.prepareAndMayExecute(params);
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

            // 23.4 -> 24.1 and 24.1 -> 24.2 succeed, 24.2 -> master stops on a conflict
            mockRepo.merge
                .mockResolvedValueOnce()
                .mockResolvedValueOnce()
                .mockRejectedValueOnce(new Error('Merge conflict'));
            mockRepo.status
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult({conflicted: ['file1']}));

            try {
                await expect(upmerge.execute()).rejects.toThrow('Merge conflict');

                const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
                expect(output).toContain('git push origin HEAD:master');
                expect(output).toContain('cplace-cli flow --upmerge --release 23.4 --all-customers --show-files\n');
            } finally {
                logSpy.mockRestore();
            }
        });

        it('should use the release of the tracked branch in the rerun command when no release is given', async () => {
            upmerge.prepareAndMayExecute({push: true});
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

            mockRepo.merge.mockRejectedValueOnce(new Error('Merge conflict'));
            mockRepo.status
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult({conflicted: ['file1']}));

            try {
                await expect(upmerge.execute()).rejects.toThrow('Merge conflict');

                const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
                expect(output).toContain('cplace-cli flow --upmerge --release 23.4\n');
            } finally {
                logSpy.mockRestore();
            }
        });

        it('should not print the push command for a conflict when push is disabled', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: false
            };
            upmerge.prepareAndMayExecute(params);
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

            mockRepo.merge.mockRejectedValueOnce(new Error('Merge conflict'));
            mockRepo.status
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult())
                .mockResolvedValueOnce(createStatusResult({conflicted: ['file1']}));

            try {
                await expect(upmerge.execute()).rejects.toThrow('Merge conflict');

                const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
                expect(output).not.toContain('git push');
            } finally {
                logSpy.mockRestore();
            }
        });

        it('should not print the push command when the merge fails without a conflict', async () => {
            const params: ICommandParameters = {
                release: '23.4',
                push: true
            };
            upmerge.prepareAndMayExecute(params);
            const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

            mockRepo.merge.mockRejectedValueOnce(new Error('Merge failed'));

            try {
                await expect(upmerge.execute()).rejects.toThrow('Merge failed');

                const output = logSpy.mock.calls.map(call => call.join(' ')).join('\n');
                expect(output).not.toContain('git push');
            } finally {
                logSpy.mockRestore();
            }
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

        it('should not run a verify command without --verify', async () => {
            upmerge.prepareAndMayExecute({release: '23.4', push: true});

            await upmerge.execute();

            expect(runVerifyCommand).not.toHaveBeenCalled();
        });

        describe('with --verify', () => {
            const VERIFY_COMMAND = './gradlew compileJava';
            const mockRunVerifyCommand = runVerifyCommand as jest.MockedFunction<typeof runVerifyCommand>;
            let logSpy: jest.SpyInstance;
            let errorSpy: jest.SpyInstance;

            /** Target branches that received no new commits in the merge */
            let unchangedTargets: string[];

            beforeEach(() => {
                unchangedTargets = [];
                mockRunVerifyCommand.mockReset();
                mockRunVerifyCommand.mockResolvedValue({exitCode: 0, signal: null});
                mockRepo.rawWrapper = jest.fn().mockImplementation((args: string[]) => {
                    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
                        return Promise.resolve('/path/to/repo\n');
                    }
                    if (args[0] === 'rev-list') {
                        const target = args[2].split('..')[0].replace(/^origin\//, '');
                        return Promise.resolve(unchangedTargets.includes(target) ? '0\n' : '2\n');
                    }
                    return Promise.resolve('');
                });
                logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
                errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
            });

            afterEach(() => {
                logSpy.mockRestore();
                errorSpy.mockRestore();
            });

            function output(): string {
                return [...logSpy.mock.calls, ...errorSpy.mock.calls].map(call => call.join(' ')).join('\n');
            }

            /** The branch checked out right before each call of the given mock */
            function checkedOutBefore(mock: jest.MockInstance<unknown, any[]>): string[] {
                return mock.mock.invocationCallOrder.map((order) => {
                    const checkoutIndex = mockRepo.checkoutBranch.mock.invocationCallOrder
                        .filter((o) => o < order)
                        .length - 1;
                    return mockRepo.checkoutBranch.mock.calls[checkoutIndex][0] as string;
                });
            }

            it('should verify every merged branch in merge order before pushing any of them', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});

                await upmerge.execute();

                expect(mockRunVerifyCommand).toHaveBeenCalledTimes(3);
                expect(mockRunVerifyCommand).toHaveBeenCalledWith(VERIFY_COMMAND, '/path/to/repo');
                expect(checkedOutBefore(mockRunVerifyCommand)).toEqual([
                    expect.stringMatching(/^upmerge-[A-Za-z0-9]{6}\/release\/24\.1$/),
                    expect.stringMatching(/^upmerge-[A-Za-z0-9]{6}\/release\/24\.2$/),
                    expect.stringMatching(/^upmerge-[A-Za-z0-9]{6}\/master$/)
                ]);

                expect(mockRepo.push.mock.calls).toEqual([
                    ['origin', 'release/24.1'],
                    ['origin', 'release/24.2'],
                    ['origin', 'master']
                ]);
                const lastVerification = Math.max(...mockRunVerifyCommand.mock.invocationCallOrder);
                const firstPush = Math.min(...mockRepo.push.mock.invocationCallOrder);
                expect(lastVerification).toBeLessThan(firstPush);
            });

            it('should push each branch from its own temporary branch', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});

                await upmerge.execute();

                expect(checkedOutBefore(mockRepo.push)).toEqual([
                    expect.stringMatching(/^upmerge-[A-Za-z0-9]{6}\/release\/24\.1$/),
                    expect.stringMatching(/^upmerge-[A-Za-z0-9]{6}\/release\/24\.2$/),
                    expect.stringMatching(/^upmerge-[A-Za-z0-9]{6}\/master$/)
                ]);
            });

            it('should push nothing and name the failing branch when the verify command fails', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});
                mockRunVerifyCommand
                    .mockResolvedValueOnce({exitCode: 0, signal: null})
                    .mockResolvedValueOnce({exitCode: 1, signal: null});

                await expect(upmerge.execute()).rejects.toThrow('Verification failed for release/24.2 (exit code 1)');

                expect(mockRepo.push).not.toHaveBeenCalled();
                expect(mockRunVerifyCommand).toHaveBeenCalledTimes(2);
                expect(errorSpy).toHaveBeenCalledWith('Verification failed for release/24.2 (exit code 1)');
            });

            it('should keep the temporary branches and stay on the failing one when the verify command fails', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});
                mockRunVerifyCommand.mockResolvedValueOnce({exitCode: 1, signal: null});

                await expect(upmerge.execute()).rejects.toThrow('Verification failed for release/24.1');

                expect(mockRepo.deleteBranch).not.toHaveBeenCalled();
                const checkouts = mockRepo.checkoutBranch.mock.calls;
                expect(checkouts[checkouts.length - 1][0]).toMatch(/^upmerge-[A-Za-z0-9]{6}\/release\/24\.1$/);
            });

            it('should print how to push the fix together with the branches verified before it', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});
                mockRunVerifyCommand
                    .mockResolvedValueOnce({exitCode: 0, signal: null})
                    .mockResolvedValueOnce({exitCode: 1, signal: null});

                await expect(upmerge.execute()).rejects.toThrow('Verification failed');

                expect(output()).toMatch(
                    /git push --atomic origin upmerge-[A-Za-z0-9]{6}\/release\/24\.1:release\/24\.1 HEAD:release\/24\.2\n/);
                expect(output()).toContain(`cplace-cli flow --upmerge --release 23.4 --verify '${VERIFY_COMMAND}'\n`);
            });

            it('should report a command terminated by a signal as a failure', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});
                mockRunVerifyCommand.mockResolvedValueOnce({exitCode: null, signal: 'SIGTERM'});

                await expect(upmerge.execute()).rejects.toThrow('Verification failed for release/24.1 (terminated by signal SIGTERM)');

                expect(mockRepo.push).not.toHaveBeenCalled();
            });

            it('should report a command that cannot be started as a failure', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});
                mockRunVerifyCommand.mockRejectedValueOnce(new Error('spawn ENOENT'));

                await expect(upmerge.execute()).rejects.toThrow(
                    'Verification failed for release/24.1 (command could not be started: spawn ENOENT)');

                expect(mockRepo.push).not.toHaveBeenCalled();
            });

            it('should verify but not push with --no-push', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: false, verify: VERIFY_COMMAND});

                await upmerge.execute();

                expect(mockRunVerifyCommand).toHaveBeenCalledTimes(3);
                expect(mockRepo.push).not.toHaveBeenCalled();
            });

            it('should not print push instructions for a failure with --no-push', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: false, verify: VERIFY_COMMAND});
                mockRunVerifyCommand.mockResolvedValueOnce({exitCode: 2, signal: null});

                await expect(upmerge.execute()).rejects.toThrow('Verification failed for release/24.1 (exit code 2)');

                expect(output()).not.toContain('git push');
            });

            it('should skip the verification of a branch that received no new commits', async () => {
                unchangedTargets = ['release/24.2'];
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});

                await upmerge.execute();

                expect(checkedOutBefore(mockRunVerifyCommand)).toEqual([
                    expect.stringMatching(/\/release\/24\.1$/),
                    expect.stringMatching(/\/master$/)
                ]);
                expect(mockRepo.push).toHaveBeenCalledTimes(3);
            });

            it('should verify customer branches after the release branches and keep both merges into a customer branch', async () => {
                mockRepo.listBranches.mockResolvedValue([
                    ...mockBranches,
                    {name: 'origin/customer/acme/23.4', commit: 'commit5', current: false, isRemote: true, tracking: null},
                    {name: 'origin/customer/acme/24.1', commit: 'commit6', current: false, isRemote: true, tracking: null}
                ]);
                upmerge.prepareAndMayExecute({release: '23.4', customer: 'acme', push: true, verify: VERIFY_COMMAND});

                await upmerge.execute();

                expect(mockRepo.merge).toHaveBeenCalledTimes(6);
                // customer/acme/24.1 receives customer/acme/23.4 and then release/24.1: the second merge has to continue on
                // the temporary branch of the first one instead of resetting it to the unchanged remote branch
                const resets = mockRepo.checkoutBranch.mock.calls
                    .filter((call) => Array.isArray(call[0]) && call[0][0] === '-B')
                    .filter((call) => call[0][2] === 'origin/customer/acme/24.1');
                expect(resets).toEqual([]);
                expect(mockRepo.checkoutBranch).toHaveBeenCalledWith(expect.stringMatching(/^upmerge-[A-Za-z0-9]{6}\/customer\/acme\/24\.1$/));

                expect(checkedOutBefore(mockRunVerifyCommand)).toEqual([
                    expect.stringMatching(/\/release\/24\.1$/),
                    expect.stringMatching(/\/release\/24\.2$/),
                    expect.stringMatching(/\/master$/),
                    expect.stringMatching(/\/customer\/acme\/23\.4$/),
                    expect.stringMatching(/\/customer\/acme\/24\.1$/)
                ]);
                expect(mockRepo.push.mock.calls.map((call) => call[1])).toEqual([
                    'release/24.1', 'release/24.2', 'master', 'customer/acme/23.4', 'customer/acme/24.1'
                ]);
            });

            it('should print how to push a conflict resolution together with the unpushed merges below it', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: VERIFY_COMMAND});
                // 23.4 -> 24.1 succeeds, 24.1 -> 24.2 stops on a conflict
                mockRepo.merge
                    .mockResolvedValueOnce()
                    .mockRejectedValueOnce(new Error('Merge conflict'));
                mockRepo.status
                    .mockResolvedValueOnce(createStatusResult())
                    .mockResolvedValueOnce(createStatusResult())
                    .mockResolvedValueOnce(createStatusResult({conflicted: ['file1']}));

                await expect(upmerge.execute()).rejects.toThrow('Merge conflict');

                expect(mockRepo.push).not.toHaveBeenCalled();
                expect(mockRunVerifyCommand).not.toHaveBeenCalled();
                expect(output()).toMatch(/run the verify command on this branch, upmerge-[A-Za-z0-9]{6}\/release\/24\.1: /);
                expect(output()).toMatch(
                    /git push --atomic origin upmerge-[A-Za-z0-9]{6}\/release\/24\.1:release\/24\.1 HEAD:release\/24\.2\n/);
                expect(output()).toContain(`cplace-cli flow --upmerge --release 23.4 --verify '${VERIFY_COMMAND}'\n`);
            });

            it('should quote single quotes of the verify command in the rerun command', async () => {
                upmerge.prepareAndMayExecute({release: '23.4', push: true, verify: "./gradlew -Pmsg='a b'"});
                mockRunVerifyCommand.mockResolvedValueOnce({exitCode: 1, signal: null});

                await expect(upmerge.execute()).rejects.toThrow('Verification failed');

                expect(output()).toContain(String.raw`--verify './gradlew -Pmsg='\''a b'\'''` + '\n');
            });
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
