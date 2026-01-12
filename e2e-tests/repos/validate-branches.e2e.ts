import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData, multiBranchTestSetupData} from '../../test/helpers/remoteRepositories';
import {ICliResult} from '../helpers/cliRunner';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

describe('repos --validate-branches E2E', () => {
    test('should validate all parent repos have correct branches', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Execute: cplace-cli repos --validate-branches
                const result = await cliRunner.execute(['repos', '--validate-branches'], {
                    cwd: rootDir
                });
                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command succeeded (all branches valid)
                expect(result.exitCode).toBe(0);
                expect(result.stdout).toContain('valid');
            }
        );
    });

    test('should detect when repo is on wrong branch', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Switch one repo to wrong branch
                const mainPath = path.join(rootDir, '..', 'main');
                child_process.execSync('git checkout master', {cwd: mainPath});

                // Execute: cplace-cli repos --validate-branches
                const result = await cliRunner.execute(['repos', '--validate-branches'], {
                    cwd: rootDir
                });
                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command failed (branch mismatch detected)
                expect(result.exitCode).not.toBe(0);

                // Assert: Error message identifies the problematic repo
                const output = result.stdout + result.stderr;
                expect(output).toContain('main');
                expect(output.toLowerCase()).toMatch(/branch|mismatch|wrong/);
            }
        );
    });

    test('should handle parent-repos.json with branch specifications', async () => {
        const runner = new E2ETestRunner(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                // Clone repos
                await cliRunner.execute(['repos', '--clone'], {cwd: rootDir});

                // Modify parent-repos.json to specify different branches
                const parentReposPath = path.join(rootDir, 'parent-repos.json');
                const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));

                // Set all repos to release/22.3
                Object.keys(parentRepos).forEach(repo => {
                    parentRepos[repo].branch = 'release/22.3';
                });
                fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));

                // Execute: cplace-cli repos --validate-branches
                const result = await cliRunner.execute(['repos', '--validate-branches'], {
                    cwd: rootDir
                });
                return result;
            },
            async (result: ICliResult) => {
                // Assert: Command succeeded
                expect(result.exitCode).toBe(0);
            }
        );
    });
});
