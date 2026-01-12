import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import {assertGitBranch, assertFileContains} from '../helpers/assertions';
import {ICliResult} from '../helpers/cliRunner';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

describe('repos --branch E2E', () => {
    test('should create new branch across all repos', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos first
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Execute: cplace-cli repos --branch feature/test-branch
                const result = await cliRunner.execute(['repos', '--branch', 'feature/test-branch'], {
                    cwd: rootDir
                });
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: New branch created in all repos
                assertGitBranch(path.join(rootDir, '..', 'main'), 'feature/test-branch');
                assertGitBranch(path.join(rootDir, '..', 'test_1'), 'feature/test-branch');
                assertGitBranch(path.join(rootDir, '..', 'test_2'), 'feature/test-branch');

                // Assert: parent-repos.json updated with new branch
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                assertFileContains(parentReposPath, 'feature/test-branch');
            }
        );
    });

    test('should create branch from specific source branch', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Execute: cplace-cli repos --branch feature/from-master --from master
                const result = await cliRunner.execute([
                    'repos',
                    '--branch', 'feature/from-master',
                    '--from', 'master'
                ], {cwd: rootDir});
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Branch created from master
                const mainPath = path.join(rootDir, '..', 'main');
                assertGitBranch(mainPath, 'feature/from-master');

                // Verify it's based on master
                const mergeBase = child_process.execSync(
                    'git merge-base feature/from-master master',
                    {cwd: mainPath, encoding: 'utf8'}
                ).trim();
                const masterSha = child_process.execSync(
                    'git rev-parse master',
                    {cwd: mainPath, encoding: 'utf8'}
                ).trim();
                expect(mergeBase).toBe(masterSha);
            }
        );
    });

    test('should fail if branch already exists', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Create branch first time (should succeed)
                await cliRunner.execute(['repos', '--branch', 'feature/duplicate'], {cwd: rootDir});

                // Try to create same branch again (should fail)
                const result = await cliRunner.execute(['repos', '--branch', 'feature/duplicate'], {
                    cwd: rootDir
                });
                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command failed
                expect(result.exitCode).not.toBe(0);

                // Assert: Error message mentions branch already exists
                const output = result.stdout + result.stderr;
                expect(output.toLowerCase()).toMatch(/already|exists|duplicate/);
            }
        );
    });
});
