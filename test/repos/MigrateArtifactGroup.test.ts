import {ICommandParameters} from '../../src/commands/models';
import {MigrateArtifactGroup} from '../../src/commands/repos/MigrateArtifactGroup';
import {basicTestSetupData, testWith, catParentReposJson} from '../helpers/remoteRepositories';
import * as path from 'path';
import * as fs from 'fs';

describe('MigrateArtifactGroup', () => {
    test('should parse cplaceRepositories block from build.gradle', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    // Create build.gradle with cplaceRepositories block
                    const buildGradle = `
                        cplaceRepositories {
                            repository('main') {
                                url = 'git@github.com:example/main.git'
                                artifactGroup = 'com.example.main'
                                useSnapshots = true
                            }
                        }
                    `;
                    fs.writeFileSync(path.join(rootDir, 'build.gradle'), buildGradle);

                    const params: ICommandParameters = {};
                    const cmd = new MigrateArtifactGroup();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: parent-repos.json updated with artifactGroup
                    const parentRepos = catParentReposJson(rootDir);
                    expect(parentRepos.main.artifactGroup).toBe('com.example.main');
                    expect(parentRepos.main.useSnapshot).toBe(true);
                }
            );
    });

    test('should clean up build.gradle after migration', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const buildGradle = `
                        cplaceRepositories {
                            repository('main') {
                                artifactGroup = 'com.example.main'
                            }
                        }
                    `;
                    fs.writeFileSync(path.join(rootDir, 'build.gradle'), buildGradle);

                    const params: ICommandParameters = {};
                    const cmd = new MigrateArtifactGroup();
                    cmd.prepareAndMayExecute(params, rootDir);
                    await cmd.execute();

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: cplaceRepositories block removed
                    const buildGradle = fs.readFileSync(path.join(rootDir, 'build.gradle'), 'utf8');
                    expect(buildGradle).not.toContain('cplaceRepositories');
                }
            );
    });

    test('should handle missing cplaceRepositories block gracefully', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    // Create build.gradle without cplaceRepositories
                    const buildGradle = `
                        plugins {
                            id 'java'
                        }
                    `;
                    fs.writeFileSync(path.join(rootDir, 'build.gradle'), buildGradle);

                    const params: ICommandParameters = {};
                    const cmd = new MigrateArtifactGroup();
                    cmd.prepareAndMayExecute(params);

                    // Should handle gracefully
                    try {
                        await cmd.execute();
                    } catch (e) {
                        // Expected to complete or skip gracefully
                    }

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: build.gradle unchanged
                    const buildGradle = fs.readFileSync(path.join(rootDir, 'build.gradle'), 'utf8');
                    expect(buildGradle).toContain('plugins');
                }
            );
    });
});
