import {ICommandParameters} from '../../src/commands/models';
import {MergeSkeleton} from '../../src/commands/repos/MergeSkeleton';
import {multiBranchTestSetupData, testWith} from '../helpers/remoteRepositories';
import {withLockedCwd} from '../helpers/processLock';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

describe('MergeSkeleton', () => {
    test('should detect and merge skeleton branch automatically', async () => {
        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/5.20')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const mainPath = path.join(rootDir, '..', 'main');

                    // Create build.gradle with version info for CplaceVersion check in main repo
                    fs.writeFileSync(path.join(mainPath, 'build.gradle'), 'version = "5.20.0"');
                    child_process.execSync('git add build.gradle && git commit -m "Add build.gradle"', {cwd: mainPath});

                    // Create skeleton branch in remote
                    child_process.execSync('git checkout -b skeleton/5.20', {cwd: mainPath});
                    fs.writeFileSync(path.join(mainPath, 'skeleton.txt'), 'skeleton content');
                    child_process.execSync('git add . && git commit -m "skeleton"', {cwd: mainPath});
                    child_process.execSync('git push origin skeleton/5.20', {cwd: mainPath});
                    child_process.execSync('git checkout release/5.20', {cwd: mainPath});

                    const params: ICommandParameters = {};

                    // MergeSkeleton operates on the current repo, so run from main
                    await withLockedCwd(mainPath, async () => {
                        const cmd = new MergeSkeleton();
                        cmd.prepareAndMayExecute(params);
                        await cmd.execute();
                    });

                    return mainPath;
                },
                async (mainPath: string) => {
                    // Assert: Skeleton branch merged
                    const log = child_process.execSync('git log --oneline -5', {
                        cwd: mainPath,
                        encoding: 'utf8'
                    });
                    expect(log).toContain('skeleton');
                }
            );
    });

    test('should handle merge conflicts with --ours strategy', async () => {
        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/5.20')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const mainPath = path.join(rootDir, '..', 'main');

                    // Create build.gradle with version info for CplaceVersion check in main repo
                    fs.writeFileSync(path.join(mainPath, 'build.gradle'), 'version = "5.20.0"');
                    child_process.execSync('git add build.gradle && git commit -m "Add build.gradle"', {cwd: mainPath});

                    // Create conflicting changes

                    // Create skeleton branch with conflict
                    child_process.execSync('git checkout -b skeleton/5.20', {cwd: mainPath});
                    fs.writeFileSync(path.join(mainPath, 'conflict.txt'), 'skeleton version');
                    child_process.execSync('git add . && git commit -m "skeleton"', {cwd: mainPath});
                    child_process.execSync('git push origin skeleton/5.20', {cwd: mainPath});

                    // Create conflicting change on release branch
                    child_process.execSync('git checkout release/5.20', {cwd: mainPath});
                    fs.writeFileSync(path.join(mainPath, 'conflict.txt'), 'release version');
                    child_process.execSync('git add . && git commit -m "release"', {cwd: mainPath});

                    const params: ICommandParameters = {
                        ours: true
                    };

                    // MergeSkeleton operates on the current repo, so run from main
                    await withLockedCwd(mainPath, async () => {
                        const cmd = new MergeSkeleton();
                        cmd.prepareAndMayExecute(params);
                        await cmd.execute();
                    });

                    return mainPath;
                },
                async (mainPath: string) => {
                    // Assert: Merge completed with ours strategy
                    const content = fs.readFileSync(path.join(mainPath, 'conflict.txt'), 'utf8');
                    expect(content).toBe('release version');
                }
            );
    });

    test('should handle case when no skeleton branch exists', async () => {
        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/5.20')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const mainPath = path.join(rootDir, '..', 'main');

                    // Create build.gradle with version info for CplaceVersion check in main repo
                    fs.writeFileSync(path.join(mainPath, 'build.gradle'), 'version = "5.20.0"');
                    child_process.execSync('git add build.gradle && git commit -m "Add build.gradle"', {cwd: mainPath});

                    const params: ICommandParameters = {};

                    // MergeSkeleton operates on the current repo, so run from main
                    await withLockedCwd(mainPath, async () => {
                        const cmd = new MergeSkeleton();
                        cmd.prepareAndMayExecute(params);

                        // Should handle gracefully when no skeleton branch exists
                        try {
                            await cmd.execute();
                        } catch (e) {
                            // Expected to fail or skip when no skeleton branch
                            expect(e).toBeDefined();
                        }
                    });

                    return mainPath;
                },
                async (mainPath: string) => {
                    // Assert: Repo is still in valid state
                    const currentBranch = child_process.execSync('git branch --show-current', {
                        cwd: mainPath,
                        encoding: 'utf8'
                    }).trim();
                    expect(currentBranch).toBe('release/5.20');
                }
            );
    });
});
