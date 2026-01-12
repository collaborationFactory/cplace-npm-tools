import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import {assertFileContains} from '../helpers/assertions';
import * as path from 'path';
import * as fs from 'fs';

describe('repos --write E2E', () => {
    test('should write parent-repos.json with current state', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos first
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Execute: cplace-cli repos --write
                const result = await cliRunner.execute(['repos', '--write'], {cwd: rootDir});
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: parent-repos.json exists and contains expected repos
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                assertFileContains(parentReposPath, 'main');
                assertFileContains(parentReposPath, 'test_1');
                assertFileContains(parentReposPath, 'test_2');

                // Assert: File contains branch information
                const content = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                expect(content.main).toBeDefined();
                expect(content.main.branch).toBe('release/22.2');
            }
        );
    });

    test('should update parent-repos.json from cloned repositories', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Manually modify branch in parent-repos.json
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                parentRepos.main.description = 'Custom Description';
                fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));

                // Execute: cplace-cli repos --write (should update from actual repos)
                const result = await cliRunner.execute(['repos', '--write'], {cwd: rootDir});
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Standard fields updated from repositories
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const content = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                expect(content.main.branch).toBe('release/22.2');
                expect(content.main.url).toBeDefined();
                // Description is preserved from existing parent-repos.json
                expect(content.main.description).toBe('Custom Description');
            }
        );
    });

    test('should fail gracefully when parent-repos.json does not exist', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Delete parent-repos.json
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                if (fs.existsSync(parentReposPath)) {
                    fs.unlinkSync(parentReposPath);
                }

                // Execute: cplace-cli repos --write
                const result = await cliRunner.execute(['repos', '--write'], {cwd: rootDir});
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command failed with non-zero exit code
                expect(result.exitCode).not.toBe(0);

                // Assert: Error message indicates missing parent-repos.json
                expect(result.stderr).toContain('Cannot find repo description');
                expect(result.stderr).toContain('parent-repos.json');
            }
        );
    });
});
