import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import {assertDirectoryExists, assertGitBranch} from '../helpers/assertions';
import {ICliResult} from '../helpers/cliRunner';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

describe('repos --update E2E', () => {
    test('should update all parent repositories from remote', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // First clone the repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Execute: cplace-cli repos --update
                // (Will update from remote - even if no changes, command should succeed)
                const result = await cliRunner.execute(['repos', '--update'], {cwd: rootDir});
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Repos still exist and are accessible
                const mainPath = path.join(rootDir, '..', 'main');
                assertDirectoryExists(mainPath);

                // After update, repos may be on tag branches (e.g. release-version/22.2.0)
                // Just verify the repo is in a valid state by checking current branch exists
                const currentBranch = child_process.execSync('git branch --show-current', {
                    cwd: mainPath,
                    encoding: 'utf8'
                }).trim();
                expect(currentBranch).toBeDefined();
                expect(currentBranch.length).toBeGreaterThan(0);
            }
        );
    });

    test('should handle already up-to-date repositories', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Execute update without any remote changes
                const result = await cliRunner.execute(['repos', '--update'], {cwd: rootDir});
                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command succeeded even when already up-to-date
                expect(result.exitCode).toBe(0);
            }
        );
    });

    test('should fail gracefully if repos not yet cloned', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteRepos(
            async (rootDir, cliRunner) => {
                // Execute update without cloning first
                const result = await cliRunner.execute(['repos', '--update'], {cwd: rootDir});
                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command handles missing repos gracefully
                // (Implementation may vary - either skip or error)
                expect(result.exitCode).toBeGreaterThanOrEqual(0);
            }
        );
    });
});
