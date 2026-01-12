import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import {assertDirectoryExists, assertGitTag} from '../helpers/assertions';
import {ICliResult} from '../helpers/cliRunner';
import * as path from 'path';
import * as fs from 'fs';

describe('repos --clone E2E', () => {
    test('should clone parent repositories with basic setup', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteRepos(
            async (rootDir, cliRunner) => {
                // Execute: cplace-cli repos --clone
                const result = await cliRunner.execute(['repos', '--clone'], {
                    cwd: rootDir
                });
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Parent repos were cloned
                assertDirectoryExists(path.join(rootDir, '..', 'main'));
                assertDirectoryExists(path.join(rootDir, '..', 'test_1'));
                assertDirectoryExists(path.join(rootDir, '..', 'test_2'));

                // Assert: Output contains success messages
                expect(result.stdout).toContain('main');
                expect(result.stdout).toContain('test_1');
                expect(result.stdout).toContain('test_2');
            }
        );
    });

    test('should clone to specific tags when configured', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteRepos(
            async (rootDir, cliRunner) => {
                // Modify parent-repos.json to specify tags
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));

                Object.keys(parentRepos).forEach(repo => {
                    parentRepos[repo].tag = 'version/22.2.0';
                });

                fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));

                // Execute: cplace-cli repos --clone
                const result = await cliRunner.execute(['repos', '--clone'], {
                    cwd: rootDir
                });

                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Repos checked out to specified tags
                assertGitTag(path.join(rootDir, '..', 'main'), 'version/22.2.0');
                assertGitTag(path.join(rootDir, '..', 'test_1'), 'version/22.2.0');
                assertGitTag(path.join(rootDir, '..', 'test_2'), 'version/22.2.0');
            }
        );
    });

    test('should fail gracefully when tag does not exist', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteRepos(
            async (rootDir, cliRunner) => {
                // Modify parent-repos.json with non-existent tag
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));

                parentRepos.main.tag = 'version/99.99.99'; // Non-existent tag

                fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));

                // Execute: cplace-cli repos --clone
                const result = await cliRunner.execute(['repos', '--clone'], {
                    cwd: rootDir
                });

                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command failed
                expect(result.exitCode).not.toBe(0);

                // Assert: Error message mentions the tag
                const output = result.stdout + result.stderr;
                expect(output).toContain('version/99.99.99');
            }
        );
    });
});
