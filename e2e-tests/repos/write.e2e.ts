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

    test('should update existing parent-repos.json', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Manually modify parent-repos.json
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                parentRepos.main.custom = 'test-value';
                fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));

                // Execute: cplace-cli repos --write (should preserve manual changes)
                const result = await cliRunner.execute(['repos', '--write'], {cwd: rootDir});
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Custom field preserved
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const content = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                expect(content.main.custom).toBe('test-value');
            }
        );
    });

    test('should create parent-repos.json if it does not exist', async () => {
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
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: parent-repos.json was created
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                expect(fs.existsSync(parentReposPath)).toBe(true);
                assertFileContains(parentReposPath, 'main');
            }
        );
    });
});
