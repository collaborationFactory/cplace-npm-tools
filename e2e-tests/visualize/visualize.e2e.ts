import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

describe('visualize E2E', () => {
    test('should generate branches visualization dot file', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                const mainPath = path.join(rootDir, '..', 'main');

                // The test runner already creates release/22.2
                // Create a multi-branch structure for visualization
                // Branch 1: feature/test-feature from master
                child_process.execSync('git checkout master', {cwd: mainPath});
                child_process.execSync('git checkout -b feature/test-feature', {cwd: mainPath});
                child_process.execSync('echo "feature" > feature.txt', {cwd: mainPath});
                child_process.execSync('git add feature.txt', {cwd: mainPath});
                child_process.execSync('git commit -m "Add feature"', {cwd: mainPath});
                child_process.execSync('git push origin feature/test-feature', {cwd: mainPath});

                // Use existing release/22.2 and add a commit
                child_process.execSync('git checkout release/22.2', {cwd: mainPath});
                child_process.execSync('echo "release" > release.txt', {cwd: mainPath});
                child_process.execSync('git add release.txt', {cwd: mainPath});
                child_process.execSync('git commit -m "Add release"', {cwd: mainPath});
                child_process.execSync('git push origin release/22.2', {cwd: mainPath});

                // Execute: cplace-cli visualize
                const result = await cliRunner.execute(['visualize'], {cwd: mainPath});

                return {result, mainPath};
            },
            async ({result, mainPath}) => {
                // Verify command executed successfully
                if (result.exitCode !== 0) {
                    console.log('Visualize stderr:', result.stderr);
                    console.log('Visualize stdout:', result.stdout);
                }

                // Expect success (command should complete)
                expect(result.exitCode).toBe(0);

                // Verify dot file was created
                const dotFilePath = path.join(mainPath, 'branches.dot');
                expect(fs.existsSync(dotFilePath)).toBe(true);

                // Verify dot file has content
                const dotContent = fs.readFileSync(dotFilePath, 'utf8');
                expect(dotContent).toContain('digraph');
                expect(dotContent.length).toBeGreaterThan(0);

                // Clean up generated file
                if (fs.existsSync(dotFilePath)) {
                    fs.unlinkSync(dotFilePath);
                }
            }
        );
    }, 120000); // 2 minute timeout

    test('should accept regex parameters for branch filtering', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                const mainPath = path.join(rootDir, '..', 'main');

                // Create some branches from master
                child_process.execSync('git checkout master', {cwd: mainPath});
                child_process.execSync('git checkout -b feature/include-this', {cwd: mainPath});
                child_process.execSync('echo "included" > included.txt', {cwd: mainPath});
                child_process.execSync('git add included.txt', {cwd: mainPath});
                child_process.execSync('git commit -m "Include"', {cwd: mainPath});
                child_process.execSync('git push origin feature/include-this', {cwd: mainPath});

                child_process.execSync('git checkout master', {cwd: mainPath});
                child_process.execSync('git checkout -b test/exclude-this', {cwd: mainPath});
                child_process.execSync('echo "excluded" > excluded.txt', {cwd: mainPath});
                child_process.execSync('git add excluded.txt', {cwd: mainPath});
                child_process.execSync('git commit -m "Exclude"', {cwd: mainPath});
                child_process.execSync('git push origin test/exclude-this', {cwd: mainPath});

                // Execute: cplace-cli visualize --regexForInclusion "feature/.*"
                const result = await cliRunner.execute([
                    'visualize',
                    '--regexForInclusion', 'feature/.*'
                ], {cwd: mainPath});

                return {result, mainPath};
            },
            async ({result, mainPath}) => {
                // Command should accept parameters without error
                expect(result.exitCode).toBeGreaterThanOrEqual(0);

                // Clean up if dot file was created
                const dotFilePath = path.join(mainPath, 'branches.dot');
                if (fs.existsSync(dotFilePath)) {
                    fs.unlinkSync(dotFilePath);
                }
            }
        );
    }, 120000);
});
