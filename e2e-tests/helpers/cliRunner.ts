import * as execa from 'execa';
import * as path from 'path';
import * as fs from 'fs';

export interface ICliResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    command: string;
}

export class CliRunner {
    private readonly binaryPath: string;

    constructor() {
        // Resolve binary path from project root
        const projectRoot = path.resolve(__dirname, '../..');
        this.binaryPath = path.join(projectRoot, 'dist', 'cli.js');

        // Validate binary exists
        if (!fs.existsSync(this.binaryPath)) {
            throw new Error(
                `CLI binary not found at ${this.binaryPath}. ` +
                `Run 'npm run prepare' to build the CLI first.`
            );
        }
    }

    /**
     * Execute cplace-cli command with arguments
     * @param args - Command arguments (e.g., ['repos', '--clone'])
     * @param options - Execution options (cwd, env, etc.)
     */
    public async execute(
        args: string[],
        options: {
            cwd?: string;
            env?: NodeJS.ProcessEnv;
            timeout?: number;
        } = {}
    ): Promise<ICliResult> {
        const command = `node ${this.binaryPath} ${args.join(' ')}`;

        try {
            const result = await execa('node', [this.binaryPath, ...args], {
                cwd: options.cwd || process.cwd(),
                env: {...process.env, ...options.env},
                timeout: options.timeout || 120000, // 2 minutes default
                reject: false, // Don't throw on non-zero exit
                all: true // Combine stdout and stderr
            });

            return {
                stdout: result.stdout || '',
                stderr: result.stderr || '',
                exitCode: result.exitCode || 0,
                command
            };
        } catch (error: any) {
            // Should rarely happen with reject: false
            throw new Error(`Failed to execute CLI: ${error.message}`);
        }
    }

    /**
     * Assert command succeeded (exit code 0)
     */
    public assertSuccess(result: ICliResult): void {
        if (result.exitCode !== 0) {
            throw new Error(
                `Expected command to succeed but got exit code ${result.exitCode}\n` +
                `Command: ${result.command}\n` +
                `Stdout: ${result.stdout}\n` +
                `Stderr: ${result.stderr}`
            );
        }
    }

    /**
     * Assert command failed (non-zero exit code)
     */
    public assertFailure(result: ICliResult, expectedError?: string): void {
        if (result.exitCode === 0) {
            throw new Error(
                `Expected command to fail but got exit code 0\n` +
                `Command: ${result.command}\n` +
                `Stdout: ${result.stdout}`
            );
        }

        if (expectedError) {
            const output = result.stdout + result.stderr;
            if (!output.includes(expectedError)) {
                throw new Error(
                    `Expected error message containing "${expectedError}" but got:\n` +
                    `Stdout: ${result.stdout}\n` +
                    `Stderr: ${result.stderr}`
                );
            }
        }
    }

    /**
     * Assert output contains expected text
     */
    public assertOutputContains(result: ICliResult, expectedText: string): void {
        const output = result.stdout + result.stderr;
        if (!output.includes(expectedText)) {
            throw new Error(
                `Expected output to contain "${expectedText}" but got:\n` +
                `Stdout: ${result.stdout}\n` +
                `Stderr: ${result.stderr}`
            );
        }
    }
}
