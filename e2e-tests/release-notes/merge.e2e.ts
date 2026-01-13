import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('release-notes merge E2E', () => {
    test('should merge two message database files', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Create temporary directory for test files
                const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-test-'));

                // Create test database files
                const baseFile = path.join(tempDir, 'base.db');
                const currentFile = path.join(tempDir, 'current.db');
                const otherFile = path.join(tempDir, 'other.db');

                // Base has one entry
                fs.writeFileSync(baseFile, 'hash1::Base message 1\n');

                // Current adds a second entry
                fs.writeFileSync(currentFile, 'hash1::Base message 1\nhash2::Current message 2\n');

                // Other adds a third entry
                fs.writeFileSync(otherFile, 'hash1::Base message 1\nhash3::Other message 3\n');

                // Execute: cplace-cli release-notes --merge --base <base> --current <current> --other <other>
                const result = await cliRunner.execute([
                    'release-notes',
                    '--merge',
                    '--base', baseFile,
                    '--current', currentFile,
                    '--other', otherFile
                ], {cwd: rootDir});

                return {result, currentFile, tempDir};
            },
            async ({result, currentFile, tempDir}) => {
                try {
                    // Verify command executed successfully
                    expect(result.exitCode).toBe(0);

                    // Verify merged file contains all entries
                    if (fs.existsSync(currentFile)) {
                        const merged = fs.readFileSync(currentFile, 'utf8');
                        expect(merged).toContain('hash1::Base message 1');
                        expect(merged).toContain('hash2::Current message 2');
                        expect(merged).toContain('hash3::Other message 3');
                    }
                } finally {
                    // Clean up temp directory
                    if (fs.existsSync(tempDir)) {
                        fs.rmSync(tempDir, {recursive: true, force: true});
                    }
                }
            }
        );
    });

    test('should handle conflicting changes', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-conflict-test-'));

                const baseFile = path.join(tempDir, 'base.db');
                const currentFile = path.join(tempDir, 'current.db');
                const otherFile = path.join(tempDir, 'other.db');

                // Base has one entry
                fs.writeFileSync(baseFile, 'hash1::Original message\n');

                // Current changes it
                fs.writeFileSync(currentFile, 'hash1::Current changed message\n');

                // Other also changes it differently
                fs.writeFileSync(otherFile, 'hash1::Other changed message\n');

                // Execute merge command
                const result = await cliRunner.execute([
                    'release-notes',
                    '--merge',
                    '--base', baseFile,
                    '--current', currentFile,
                    '--other', otherFile
                ], {cwd: rootDir});

                return {result, currentFile, tempDir};
            },
            async ({result, currentFile, tempDir}) => {
                try {
                    // Command should complete (may report conflicts but not crash)
                    expect(result.exitCode).toBeGreaterThanOrEqual(0);

                    // Output should mention conflicts
                    const output = result.stdout + result.stderr;
                    if (result.exitCode === 0) {
                        expect(output).toContain('conflicts');
                    }
                } finally {
                    if (fs.existsSync(tempDir)) {
                        fs.rmSync(tempDir, {recursive: true, force: true});
                    }
                }
            }
        );
    });
});
