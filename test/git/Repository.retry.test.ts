import { Repository } from '../../src/git';
import * as simpleGit from 'simple-git';

jest.mock('simple-git');

const mockedSimpleGit = simpleGit as jest.Mocked<typeof simpleGit>;

describe('Repository retry logic', () => {

    describe('isRetryableGitError', () => {
        const isRetryableGitError = (error: any): boolean => {
            return Repository.isRetryableGitError(error);
        };

        // Parameterized tests for retryable errors
        const retryableErrors: [string, string][] = [
            // HTTP 404 errors
            ['HTTP 404 error', 'error: 404 Not Found'],
            ['plain 404 in message', 'HTTP 404'],
            // Git repository not found errors
            ['repository not found', 'repository not found'],
            ['remote: repository not found', 'remote: repository not found'],
            ['remote: not found', 'remote: not found'],
            // Network timeout and connection errors
            ['ETIMEDOUT', 'connect ETIMEDOUT'],
            ['ECONNREFUSED', 'connect ECONNREFUSED 127.0.0.1:443'],
            ['ECONNRESET', 'read ECONNRESET'],
            ['generic timeout', 'Connection timeout after 30000ms'],
            // Case insensitivity
            ['uppercase REPOSITORY NOT FOUND', 'REPOSITORY NOT FOUND'],
            ['mixed case Remote: Repository Not Found', 'Remote: Repository Not Found'],
            ['uppercase ETIMEDOUT', 'ETIMEDOUT'],
        ];

        test.each(retryableErrors)(
            'should return true for %s',
            (_description, errorMessage) => {
                expect(isRetryableGitError({ message: errorMessage })).toBe(true);
            }
        );

        // Parameterized tests for non-retryable errors
        const nonRetryableErrors: [string, string][] = [
            ['permission denied', 'Permission denied (publickey)'],
            ['authentication failed', 'Authentication failed'],
            ['invalid repository', 'fatal: not a git repository'],
            ['merge conflicts', 'CONFLICT (content): Merge conflict in file.txt'],
            ['empty message', ''],
        ];

        test.each(nonRetryableErrors)(
            'should return false for %s',
            (_description, errorMessage) => {
                expect(isRetryableGitError({ message: errorMessage })).toBe(false);
            }
        );

        // Edge cases that need special handling
        describe('edge cases', () => {
            test.each([
                ['null', null],
                ['undefined', undefined],
            ])('should return false for %s error', (_description, errorValue) => {
                expect(isRetryableGitError(errorValue)).toBe(false);
            });

            test('should handle error without message property via toString', () => {
                expect(isRetryableGitError({ toString: () => 'ETIMEDOUT' })).toBe(true);
            });

            test('should handle retryable error via toString fallback', () => {
                expect(isRetryableGitError({ toString: () => 'repository not found' })).toBe(true);
            });
        });
    });

    describe('clone operation with retry', () => {
        let mockClone: jest.Mock;
        let consoleWarnSpy: jest.SpyInstance;
        let consoleLogSpy: jest.SpyInstance;
        let consoleErrorSpy: jest.SpyInstance;

        const performCloneWithRetry = (
            repoName: string,
            remoteUrl: string,
            toPath: string,
            options: string[],
            maxRetries: number
        ): Promise<void> => {
            const cloneOperation = (): Promise<void> => {
                return new Promise<void>((resolve, reject) => {
                    simpleGit.simpleGit().clone(remoteUrl, toPath, options, (err) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve();
                        }
                    });
                });
            };
            return Repository.withRetry(cloneOperation, 'Clone', repoName, maxRetries);
        };

        beforeEach(() => {
            jest.clearAllMocks();
            jest.useFakeTimers();

            mockClone = jest.fn();
            mockedSimpleGit.simpleGit.mockReturnValue({
                clone: mockClone
            } as any);

            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        });

        afterEach(() => {
            jest.useRealTimers();
            consoleWarnSpy.mockRestore();
            consoleLogSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        test('should succeed on first attempt without retries', async () => {
            mockClone.mockImplementation((_url, _path, _opts, callback) => {
                callback(null);
            });

            await performCloneWithRetry('test-repo', 'https://example.com/repo.git', '/tmp/repo', [], 3);

            expect(mockClone).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        test('should retry on retryable error and succeed', async () => {
            let attempts = 0;
            mockClone.mockImplementation((_url, _path, _opts, callback) => {
                attempts++;
                if (attempts === 1) {
                    callback(new Error('ETIMEDOUT'));
                } else {
                    callback(null);
                }
            });

            const clonePromise = performCloneWithRetry('test-repo', 'https://example.com/repo.git', '/tmp/repo', [], 3);

            // First attempt fails, wait for retry delay (2^1 * 1000 = 2000ms)
            await jest.advanceTimersByTimeAsync(2000);

            await clonePromise;

            expect(mockClone).toHaveBeenCalledTimes(2);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[test-repo]:',
                expect.stringContaining('Clone failed with transient error (attempt 1/3)')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '[test-repo]:',
                expect.stringContaining('Clone succeeded on attempt 2')
            );
        });

        test('should throw after exhausting all retries on retryable error', async () => {
            mockClone.mockImplementation((_url, _path, _opts, callback) => {
                callback(new Error('ETIMEDOUT'));
            });

            const clonePromise = performCloneWithRetry('test-repo', 'https://example.com/repo.git', '/tmp/repo', [], 3);

            // Attach rejection handler immediately to prevent unhandled rejection
            let caughtError: Error | null = null;
            clonePromise.catch((err: Error) => {
                caughtError = err;
            });

            // Advance through all retry delays
            await jest.runAllTimersAsync();

            // Wait for the promise to settle
            await expect(clonePromise).rejects.toThrow('ETIMEDOUT');

            expect(mockClone).toHaveBeenCalledTimes(3);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[test-repo]:',
                'Clone failed after 3 attempts'
            );
            expect(caughtError).not.toBeNull();
        });

        test('should fail immediately on non-retryable error', async () => {
            mockClone.mockImplementation((_url, _path, _opts, callback) => {
                callback(new Error('Permission denied (publickey)'));
            });

            await expect(
                performCloneWithRetry('test-repo', 'https://example.com/repo.git', '/tmp/repo', [], 3)
            ).rejects.toThrow('Permission denied (publickey)');

            expect(mockClone).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        test('should use exponential backoff delays', async () => {
            let attempts = 0;
            mockClone.mockImplementation((_url, _path, _opts, callback) => {
                attempts++;
                if (attempts < 4) {
                    callback(new Error('ETIMEDOUT'));
                } else {
                    callback(null);
                }
            });

            const clonePromise = performCloneWithRetry('test-repo', 'https://example.com/repo.git', '/tmp/repo', [], 5);

            // Verify exponential backoff: 2^1=2s, 2^2=4s, 2^3=8s
            await jest.advanceTimersByTimeAsync(2000); // After attempt 1 (2^1 * 1000)
            expect(mockClone).toHaveBeenCalledTimes(2);

            await jest.advanceTimersByTimeAsync(4000); // After attempt 2 (2^2 * 1000)
            expect(mockClone).toHaveBeenCalledTimes(3);

            await jest.advanceTimersByTimeAsync(8000); // After attempt 3 (2^3 * 1000)
            expect(mockClone).toHaveBeenCalledTimes(4);

            await clonePromise;
        });

        // Parameterized tests for different retryable error types
        const retryableCloneErrors: [string, string][] = [
            ['HTTP 404', 'HTTP 404: Not Found'],
            ['repository not found', 'remote: repository not found'],
            ['ECONNRESET', 'read ECONNRESET'],
        ];

        test.each(retryableCloneErrors)(
            'should retry on %s error and succeed',
            async (_description, errorMessage) => {
                let attempts = 0;
                mockClone.mockImplementation((_url, _path, _opts, callback) => {
                    attempts++;
                    if (attempts === 1) {
                        callback(new Error(errorMessage));
                    } else {
                        callback(null);
                    }
                });

                const clonePromise = performCloneWithRetry('test-repo', 'https://example.com/repo.git', '/tmp/repo', [], 3);

                await jest.advanceTimersByTimeAsync(2000);
                await clonePromise;

                expect(mockClone).toHaveBeenCalledTimes(2);
            }
        );

        test('should work with maxRetries of 1 (no retries)', async () => {
            mockClone.mockImplementation((_url, _path, _opts, callback) => {
                callback(new Error('ETIMEDOUT'));
            });

            await expect(
                performCloneWithRetry('test-repo', 'https://example.com/repo.git', '/tmp/repo', [], 1)
            ).rejects.toThrow('ETIMEDOUT');

            expect(mockClone).toHaveBeenCalledTimes(1);
        });
    });

    describe('delay helper', () => {
        const delay = (ms: number): Promise<void> => {
            return Repository.delay(ms);
        };

        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        test('should resolve after specified delay', async () => {
            const delayPromise = delay(1000);

            jest.advanceTimersByTime(999);
            expect(jest.getTimerCount()).toBe(1);

            jest.advanceTimersByTime(1);
            await delayPromise;

            expect(jest.getTimerCount()).toBe(0);
        });
    });

    describe('withRetry', () => {
        let consoleWarnSpy: jest.SpyInstance;
        let consoleLogSpy: jest.SpyInstance;
        let consoleErrorSpy: jest.SpyInstance;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.useFakeTimers();
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        });

        afterEach(() => {
            jest.useRealTimers();
            consoleWarnSpy.mockRestore();
            consoleLogSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });

        test('should succeed on first attempt and return the result', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            const result = await Repository.withRetry(operation, 'TestOp', 'test-repo', 3);

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        test('should retry on retryable error and return the result on success', async () => {
            let attempts = 0;
            const operation = jest.fn().mockImplementation(() => {
                attempts++;
                if (attempts === 1) {
                    return Promise.reject(new Error('ETIMEDOUT'));
                }
                return Promise.resolve('success after retry');
            });

            const resultPromise = Repository.withRetry(operation, 'TestOp', 'test-repo', 3);

            // First attempt fails, wait for retry delay (2^1 * 1000 = 2000ms)
            await jest.advanceTimersByTimeAsync(2000);

            const result = await resultPromise;

            expect(result).toBe('success after retry');
            expect(operation).toHaveBeenCalledTimes(2);
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[test-repo]:',
                expect.stringContaining('TestOp failed with transient error (attempt 1/3)')
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                '[test-repo]:',
                expect.stringContaining('TestOp succeeded on attempt 2')
            );
        });

        test('should throw after exhausting all retries on retryable error', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

            const resultPromise = Repository.withRetry(operation, 'TestOp', 'test-repo', 3);

            // Attach rejection handler immediately to prevent unhandled rejection
            let caughtError: Error | null = null;
            resultPromise.catch((err: Error) => {
                caughtError = err;
            });

            // Advance through all retry delays
            await jest.runAllTimersAsync();

            await expect(resultPromise).rejects.toThrow('ETIMEDOUT');

            expect(operation).toHaveBeenCalledTimes(3);
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[test-repo]:',
                'TestOp failed after 3 attempts'
            );
            expect(caughtError).not.toBeNull();
        });

        test('should fail immediately on non-retryable error', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('Permission denied'));

            await expect(
                Repository.withRetry(operation, 'TestOp', 'test-repo', 3)
            ).rejects.toThrow('Permission denied');

            expect(operation).toHaveBeenCalledTimes(1);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        test('should use exponential backoff delays', async () => {
            let attempts = 0;
            const operation = jest.fn().mockImplementation(() => {
                attempts++;
                if (attempts < 4) {
                    return Promise.reject(new Error('ETIMEDOUT'));
                }
                return Promise.resolve('success');
            });

            const resultPromise = Repository.withRetry(operation, 'TestOp', 'test-repo', 5);

            // Verify exponential backoff: 2^1=2s, 2^2=4s, 2^3=8s
            await jest.advanceTimersByTimeAsync(2000); // After attempt 1 (2^1 * 1000)
            expect(operation).toHaveBeenCalledTimes(2);

            await jest.advanceTimersByTimeAsync(4000); // After attempt 2 (2^2 * 1000)
            expect(operation).toHaveBeenCalledTimes(3);

            await jest.advanceTimersByTimeAsync(8000); // After attempt 3 (2^3 * 1000)
            expect(operation).toHaveBeenCalledTimes(4);

            await resultPromise;
        });

        test('should work with maxAttempts of 1 (no retries)', async () => {
            const operation = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

            await expect(
                Repository.withRetry(operation, 'TestOp', 'test-repo', 1)
            ).rejects.toThrow('ETIMEDOUT');

            expect(operation).toHaveBeenCalledTimes(1);
        });

        test('should throw for maxAttempts of 0 (edge case - loop never executes)', async () => {
            const operation = jest.fn().mockResolvedValue('success');

            await expect(
                Repository.withRetry(operation, 'TestOp', 'test-repo', 0)
            ).rejects.toThrow('failed unexpectedly');

            expect(operation).not.toHaveBeenCalled();
        });

        test('should preserve type for different return types', async () => {
            // Test with number return type
            const numberOp = jest.fn().mockResolvedValue(42);
            const numResult = await Repository.withRetry(numberOp, 'NumberOp', 'test-repo', 1);
            expect(numResult).toBe(42);
            expect(typeof numResult).toBe('number');

            // Test with object return type
            const objectOp = jest.fn().mockResolvedValue({ foo: 'bar' });
            const objResult = await Repository.withRetry(objectOp, 'ObjectOp', 'test-repo', 1);
            expect(objResult).toEqual({ foo: 'bar' });

            // Test with array return type
            const arrayOp = jest.fn().mockResolvedValue([1, 2, 3]);
            const arrResult = await Repository.withRetry(arrayOp, 'ArrayOp', 'test-repo', 1);
            expect(arrResult).toEqual([1, 2, 3]);
        });
    });

    describe('getLatestTagOfPattern with retry', () => {
        let mockListRemote: jest.Mock;
        let mockRemote: jest.Mock;
        let consoleLogSpy: jest.SpyInstance;
        let consoleWarnSpy: jest.SpyInstance;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.useFakeTimers();

            mockListRemote = jest.fn();
            mockRemote = jest.fn();
            mockedSimpleGit.simpleGit.mockReturnValue({
                listRemote: mockListRemote,
                remote: mockRemote
            } as any);

            // Mock getLocalOriginUrl to return a URL
            mockRemote.mockImplementation((_args, callback) => {
                callback(null, 'https://github.com/test/repo.git');
            });

            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        });

        afterEach(() => {
            jest.useRealTimers();
            consoleLogSpy.mockRestore();
            consoleWarnSpy.mockRestore();
        });

        test('should succeed on first attempt', async () => {
            mockListRemote.mockImplementation((_args, callback) => {
                callback(null, 'abc123\trefs/tags/version/1.0.0\n');
            });

            const result = await Repository.getLatestTagOfPattern(
                'test-repo',
                'https://github.com/test/repo.git',
                'version/1.0.*',
                '/tmp/root',
                1
            );

            expect(result).toBe('version/1.0.0');
            expect(mockListRemote).toHaveBeenCalledTimes(1);
        });

        test('should retry on retryable error and succeed', async () => {
            let attempts = 0;
            mockListRemote.mockImplementation((_args, callback) => {
                attempts++;
                if (attempts === 1) {
                    callback(new Error('ETIMEDOUT'));
                } else {
                    callback(null, 'abc123\trefs/tags/version/1.0.0\n');
                }
            });

            const resultPromise = Repository.getLatestTagOfPattern(
                'test-repo',
                'https://github.com/test/repo.git',
                'version/1.0.*',
                '/tmp/root',
                3
            );

            // First attempt fails, wait for retry delay
            await jest.advanceTimersByTimeAsync(2000);

            const result = await resultPromise;

            expect(result).toBe('version/1.0.0');
            expect(mockListRemote).toHaveBeenCalledTimes(2);
        });
    });

    describe('fetch with retry', () => {
        let mockFetch: jest.Mock;
        let consoleLogSpy: jest.SpyInstance;
        let consoleWarnSpy: jest.SpyInstance;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.useFakeTimers();

            mockFetch = jest.fn();
            mockedSimpleGit.simpleGit.mockReturnValue({
                fetch: mockFetch,
                outputHandler: jest.fn()
            } as any);

            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        });

        afterEach(() => {
            jest.useRealTimers();
            consoleLogSpy.mockRestore();
            consoleWarnSpy.mockRestore();
        });

        test('should succeed on first attempt', async () => {
            mockFetch.mockImplementation((_args, callback) => {
                callback(null);
            });

            const repo = new Repository('/tmp/test-repo');
            await repo.fetch({}, 1);

            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        test('should retry on retryable error and succeed', async () => {
            let attempts = 0;
            mockFetch.mockImplementation((_args, callback) => {
                attempts++;
                if (attempts === 1) {
                    callback(new Error('ETIMEDOUT'));
                } else {
                    callback(null);
                }
            });

            const repo = new Repository('/tmp/test-repo');
            const fetchPromise = repo.fetch({}, 3);

            // First attempt fails, wait for retry delay
            await jest.advanceTimersByTimeAsync(2000);

            await fetchPromise;

            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    describe('push with retry', () => {
        let mockPush: jest.Mock;
        let consoleLogSpy: jest.SpyInstance;
        let consoleWarnSpy: jest.SpyInstance;

        beforeEach(() => {
            jest.clearAllMocks();
            jest.useFakeTimers();

            mockPush = jest.fn();
            mockedSimpleGit.simpleGit.mockReturnValue({
                push: mockPush,
                outputHandler: jest.fn()
            } as any);

            consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
            consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        });

        afterEach(() => {
            jest.useRealTimers();
            consoleLogSpy.mockRestore();
            consoleWarnSpy.mockRestore();
        });

        test('should succeed on first attempt', async () => {
            mockPush.mockImplementation((_remote, _branch, _opts, callback) => {
                callback(null);
            });

            const repo = new Repository('/tmp/test-repo');
            await repo.push('origin', 'main', 1);

            expect(mockPush).toHaveBeenCalledTimes(1);
        });

        test('should retry on retryable error and succeed', async () => {
            let attempts = 0;
            mockPush.mockImplementation((_remote, _branch, _opts, callback) => {
                attempts++;
                if (attempts === 1) {
                    callback(new Error('ETIMEDOUT'));
                } else {
                    callback(null);
                }
            });

            const repo = new Repository('/tmp/test-repo');
            const pushPromise = repo.push('origin', 'main', 3);

            // First attempt fails, wait for retry delay
            await jest.advanceTimersByTimeAsync(2000);

            await pushPromise;

            expect(mockPush).toHaveBeenCalledTimes(2);
        });
    });
});
