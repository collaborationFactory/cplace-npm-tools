/**
 * Mutex lock for serializing process.chdir() calls across parallel tests.
 *
 * When Jest runs tests in parallel, multiple tests can call process.chdir()
 * simultaneously, causing them to interfere with each other. This lock ensures
 * that only one test at a time can change the working directory.
 */

let cwdLock: Promise<void> = Promise.resolve();

/**
 * Execute a function with the working directory temporarily changed to the specified path.
 * This function serializes all process.chdir() calls across parallel tests using a mutex lock.
 *
 * @param dir - The directory to change to
 * @param fn - The function to execute in that directory
 * @returns Promise that resolves with the function's return value
 */
export async function withLockedCwd<T>(dir: string, fn: () => Promise<T>): Promise<T> {
    // Wait for any previous chdir operations to complete
    const previousLock = cwdLock;

    // Create a new lock that will be released when this operation completes
    let releaseLock: (() => void) | undefined;
    cwdLock = new Promise<void>((resolve) => {
        releaseLock = resolve;
    });

    try {
        // Wait for the previous operation to complete
        await previousLock;

        // Now we have exclusive access to process.chdir()
        const originalCwd = process.cwd();
        try {
            process.chdir(dir);
            return await fn();
        } finally {
            // Always restore the original directory
            process.chdir(originalCwd);
        }
    } finally {
        // Release the lock so the next operation can proceed
        if (releaseLock) {
            releaseLock();
        }
    }
}
