import {ICommandParameters} from '../../src/commands/models';
import {BranchRepos} from '../../src/commands/repos/BranchRepos';
import {basicTestSetupData, testWith, catParentReposJson} from '../helpers/remoteRepositories';
import * as path from 'path';
import * as child_process from 'child_process';

describe('BranchRepos', () => {
    test('should create branch across all repos', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const params: ICommandParameters = {
                        branch: 'feature/new-feature'
                    };

                    const previousCwd = process.cwd();
                    try {
                        process.chdir(rootDir);
                        const cmd = new BranchRepos();
                        cmd.prepareAndMayExecute(params);
                        await cmd.execute();
                    } finally {
                        process.chdir(previousCwd);
                    }

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: Branch created in all repos
                    const repos = ['main', 'test_1', 'test_2'];
                    for (const repo of repos) {
                        const repoPath = path.join(rootDir, '..', repo);
                        const branches = child_process.execSync('git branch --list feature/new-feature', {
                            cwd: repoPath,
                            encoding: 'utf8'
                        });
                        expect(branches).toContain('feature/new-feature');
                    }
                }
            );
    });

    test('should update parent-repos.json with new branch', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const params: ICommandParameters = {
                        branch: 'feature/new-feature'
                    };

                    const previousCwd = process.cwd();
                    try {
                        process.chdir(rootDir);
                        const cmd = new BranchRepos();
                        cmd.prepareAndMayExecute(params);
                        await cmd.execute();
                    } finally {
                        process.chdir(previousCwd);
                    }

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: parent-repos.json updated
                    const parentRepos = catParentReposJson(rootDir);
                    Object.values(parentRepos).forEach(repo => {
                        expect(repo.branch).toBe('feature/new-feature');
                    });
                }
            );
    });

    test('should create branch from specific source branch', async () => {
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(
                async (rootDir: string) => {
                    const params: ICommandParameters = {
                        branch: 'feature/from-master',
                        from: 'master'
                    };

                    const previousCwd = process.cwd();
                    try {
                        process.chdir(rootDir);
                        const cmd = new BranchRepos();
                        cmd.prepareAndMayExecute(params);
                        await cmd.execute();
                    } finally {
                        process.chdir(previousCwd);
                    }

                    return rootDir;
                },
                async (rootDir: string) => {
                    // Assert: New branch exists and is based on source branch
                    const repoPath = path.join(rootDir, '..', 'main');
                    const mergeBase = child_process.execSync(
                        'git merge-base feature/from-master origin/master',
                        {cwd: repoPath, encoding: 'utf8'}
                    ).trim();

                    const sourceSha = child_process.execSync(
                        'git rev-parse origin/master',
                        {cwd: repoPath, encoding: 'utf8'}
                    ).trim();

                    expect(mergeBase).toBe(sourceSha);
                }
            );
    });

    test('should not execute without branch parameter', () => {
        const params: ICommandParameters = {};

        const previousCwd = process.cwd();
        try {
            process.chdir('/tmp');
            const cmd = new BranchRepos();
            const shouldExecute = cmd.prepareAndMayExecute(params);
            expect(shouldExecute).toBe(false);
        } finally {
            process.chdir(previousCwd);
        }
    });
});
