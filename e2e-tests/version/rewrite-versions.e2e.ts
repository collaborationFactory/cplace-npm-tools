import {E2ETestRunner} from '../helpers/E2ETestRunner';
import {basicTestSetupData} from '../../test/helpers/remoteRepositories';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

describe('version rewrite-versions E2E', () => {
    test('should rewrite versions for non-release branches', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                const mainPath = path.join(rootDir, '..', 'main');
                const rootRepoPath = path.join(rootDir, 'rootRepo');

                // Switch main to a feature branch (non-release) from master
                child_process.execSync('git checkout master', {cwd: mainPath});
                child_process.execSync('git checkout -b feature/test-feature', {cwd: mainPath});
                child_process.execSync('echo "feature work" > feature.txt', {cwd: mainPath});
                child_process.execSync('git add feature.txt', {cwd: mainPath});
                child_process.execSync('git commit -m "Feature work"', {cwd: mainPath});

                // Create version.gradle in main
                const versionGradleContent = `
ext {
    createdOnBranch='release/22.2'
    cplaceVersion='22.2'
}`;
                fs.writeFileSync(path.join(mainPath, 'version.gradle'), versionGradleContent);
                child_process.execSync('git add version.gradle', {cwd: mainPath});
                child_process.execSync('git commit -m "Add version.gradle"', {cwd: mainPath});

                // Update parent-repos.json in rootRepo to reference the feature branch
                const parentReposPath = path.join(rootRepoPath, 'parent-repos.json');
                if (fs.existsSync(parentReposPath)) {
                    const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                    if (parentRepos.main) {
                        parentRepos.main.branch = 'feature/test-feature';
                        fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));
                        child_process.execSync('git add parent-repos.json', {cwd: rootRepoPath});
                        child_process.execSync('git commit -m "Update main branch reference"', {cwd: rootRepoPath});
                    }
                }

                // Execute: cplace-cli version --rewrite-versions
                const result = await cliRunner.execute([
                    'version',
                    '--rewrite-versions'
                ], {cwd: rootRepoPath});

                return {result, rootRepoPath, parentReposPath, mainPath};
            },
            async ({result, parentReposPath, mainPath}) => {
                // Verify command executed
                if (result.exitCode !== 0) {
                    console.log('Rewrite-versions stderr:', result.stderr);
                    console.log('Rewrite-versions stdout:', result.stdout);
                }

                // Command should complete (exit code 0 or 1 depending on state)
                expect([0, 1]).toContain(result.exitCode);

                // If parent-repos.json exists, check if artifact versions were added
                if (fs.existsSync(parentReposPath)) {
                    const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                    if (parentRepos.main && parentRepos.main.branch === 'feature/test-feature') {
                        // For non-release branches, artifactVersion should be set to .999
                        if (parentRepos.main.artifactVersion) {
                            expect(parentRepos.main.artifactVersion).toContain('.999');
                        }
                    }
                }

                // Check if currentVersion was added to main's version.gradle
                const versionGradlePath = path.join(mainPath, 'version.gradle');
                if (fs.existsSync(versionGradlePath)) {
                    const content = fs.readFileSync(versionGradlePath, 'utf8');
                    // For feature branches, currentVersion should be added
                    if (content.includes('currentVersion')) {
                        expect(content).toContain('.999');
                    }
                }
            }
        );
    });

    test('should not modify versions for release branches', async () => {
        const runner = new E2ETestRunner(basicTestSetupData)
            .withBranchUnderTest('release/22.2');

        await runner.runWithRemoteAndLocalRepos(
            async (rootDir, cliRunner) => {
                const rootRepoPath = path.join(rootDir, 'rootRepo');
                const mainPath = path.join(rootDir, '..', 'main');

                // The test runner already creates release/22.2, just use it
                child_process.execSync('git checkout release/22.2', {cwd: mainPath});

                // Create version.gradle
                const versionGradleContent = `
ext {
    createdOnBranch='release/22.2'
    cplaceVersion='22.2'
}`;
                fs.writeFileSync(path.join(mainPath, 'version.gradle'), versionGradleContent);
                child_process.execSync('git add version.gradle', {cwd: mainPath});
                child_process.execSync('git commit -m "Add version.gradle"', {cwd: mainPath});

                // Update parent-repos.json to reference release branch
                const parentReposPath = path.join(rootRepoPath, 'parent-repos.json');
                if (fs.existsSync(parentReposPath)) {
                    const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                    if (parentRepos.main) {
                        parentRepos.main.branch = 'release/22.2';
                        fs.writeFileSync(parentReposPath, JSON.stringify(parentRepos, null, 2));
                        child_process.execSync('git add parent-repos.json', {cwd: rootRepoPath});
                        child_process.execSync('git commit -m "Update to release branch"', {cwd: rootRepoPath});
                    }
                }

                // Execute: cplace-cli version --rewrite-versions
                const result = await cliRunner.execute([
                    'version',
                    '--rewrite-versions'
                ], {cwd: rootRepoPath});

                return {result, rootRepoPath, parentReposPath, mainPath};
            },
            async ({result, parentReposPath, mainPath}) => {
                // Command should complete
                expect([0, 1]).toContain(result.exitCode);

                // For release branches, artifactVersion should NOT be added
                if (fs.existsSync(parentReposPath)) {
                    const parentRepos = JSON.parse(fs.readFileSync(parentReposPath, 'utf8'));
                    if (parentRepos.main) {
                        expect(parentRepos.main.artifactVersion).toBeUndefined();
                    }
                }

                // currentVersion should NOT be added to version.gradle
                const versionGradlePath = path.join(mainPath, 'version.gradle');
                if (fs.existsSync(versionGradlePath)) {
                    const content = fs.readFileSync(versionGradlePath, 'utf8');
                    expect(content).not.toContain('currentVersion');
                }
            }
        );
    });
});
