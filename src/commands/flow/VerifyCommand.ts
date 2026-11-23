/*
 * Copyright 2026, collaboration Factory GmbH. All rights reserved.
 */

/**
 * Runs the command given to `flow --upmerge --verify`. The command is opaque to cplace-cli: it is run through the
 * shell, so the CLI needs no knowledge of the build tool behind it.
 */
import {spawn} from 'child_process';

export interface IVerifyCommandResult {
    /** Exit code of the command, null if it was terminated by a signal */
    exitCode: number | null;
    /** Signal that terminated the command, null if it exited on its own */
    signal: string | null;
}

/**
 * Runs the command through the shell in the given directory, with the output going straight to the console.
 * Resolves once the command has finished, whatever its exit code; rejects if the command could not be started.
 */
export function runVerifyCommand(command: string, cwd: string): Promise<IVerifyCommandResult> {
    return new Promise<IVerifyCommandResult>((resolve, reject) => {
        const child = spawn(command, {cwd, shell: true, stdio: 'inherit'});
        child.on('error', reject);
        child.on('close', (exitCode, signal) => resolve({exitCode, signal}));
    });
}
