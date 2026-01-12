import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import {ICliResult} from '../helpers/cliRunner';
import * as path from 'path';
import * as fs from 'fs';

describe('repos --migrate-artifact-groups E2E', () => {
    test('should migrate cplaceRepositories from build.gradle to parent-repos.json', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Create build.gradle with cplaceRepositories block
                const buildGradlePath = path.join(rootDir, 'build.gradle');
                const buildGradleContent = `
                    plugins {
                        id 'java'
                    }

                    cplaceRepositories {
                        repository('main') {
                            url = 'git@github.com:example/main.git'
                            artifactGroup = 'cf.example.main'
                            useSnapshots = true
                        }
                        repository('test_1') {
                            url = 'git@github.com:example/test1.git'
                            artifactGroup = 'cf.example.test1'
                        }
                    }
                `;
                fs.writeFileSync(buildGradlePath, buildGradleContent);

                // Execute: cplace-cli repos --migrate-artifact-groups
                const result = await cliRunner.execute(['repos', '--migrate-artifact-groups'], {
                    cwd: rootDir
                });
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: parent-repos.json updated with artifact groups
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));

                expect(parentRepos.main.artifactGroup).toBe('cf.example.main');
                expect(parentRepos.main.useSnapshots).toBe(true);
                expect(parentRepos.test_1.artifactGroup).toBe('cf.example.test1');

                // Assert: cplaceRepositories block removed from build.gradle
                const buildGradleContent = fs.readFileSync(
                    path.join(rootDir, 'build.gradle'),
                    'utf8'
                );
                expect(buildGradleContent).not.toContain('cplaceRepositories');
            }
        );
    });

    test('should handle missing cplaceRepositories block', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Create build.gradle without cplaceRepositories
                const buildGradlePath = path.join(rootDir, 'build.gradle');
                fs.writeFileSync(buildGradlePath, 'plugins { id "java" }');

                // Execute: cplace-cli repos --migrate-artifact-groups
                const result = await cliRunner.execute(['repos', '--migrate-artifact-groups'], {
                    cwd: rootDir
                });
                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command handles gracefully (nothing to migrate)
                expect(result.exitCode).toBe(0);
            }
        );
    });

    test('should preserve existing parent-repos.json properties', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Manually add custom property to parent-repos.json
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                parentRepos.main.customProperty = 'should-be-preserved';
                fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));

                // Create build.gradle with cplaceRepositories
                const buildGradleContent = `
                    cplaceRepositories {
                        repository('main') {
                            artifactGroup = 'cf.example.main'
                        }
                    }
                `;
                fs.writeFileSync(path.join(rootDir, 'build.gradle'), buildGradleContent);

                // Execute migration
                const result = await cliRunner.execute(['repos', '--migrate-artifact-groups'], {
                    cwd: rootDir
                });
                return {result, rootDir};
            },
            async ({result, rootDir}) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);

                // Assert: Custom property preserved
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                expect(parentRepos.main.customProperty).toBe('should-be-preserved');
                expect(parentRepos.main.artifactGroup).toBe('cf.example.main');
            }
        );
    });
});
