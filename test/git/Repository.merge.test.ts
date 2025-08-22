import * as path from 'path';
import * as fs from 'fs';
import { Repository } from '../../src/git';
import * as simpleGit from 'simple-git';
import { execSync } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';
import { Global } from '../../src/Global';

const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);
const rmdir = promisify(fs.rmdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

async function removeDirectory(dir: string): Promise<void> {
    try {
        const files = await readdir(dir);
        for (const file of files) {
            const filePath = path.join(dir, file);
            const fileStat = await stat(filePath);
            if (fileStat.isDirectory()) {
                await removeDirectory(filePath);
            } else {
                await unlink(filePath);
            }
        }
        await rmdir(dir);
    } catch (err) {
        // Directory might not exist
    }
}

describe('Repository.merge() tests', () => {
    let testBaseDir: string;
    let remoteRepoDir: string;
    let localRepoDir: string;
    const testFile = 'test.txt';
    const conflictFile = 'conflict.txt';

    beforeEach(async () => {
        // Create a unique test directory for each test to avoid conflicts
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        testBaseDir = path.join(os.tmpdir(), `cplace-merge-test-${timestamp}-${random}`);
        remoteRepoDir = path.join(testBaseDir, 'remote-repo.git');
        localRepoDir = path.join(testBaseDir, 'local-repo');

        // Clean up any existing test directories
        await removeDirectory(testBaseDir);
        await mkdir(testBaseDir, { recursive: true });

        // Create a bare remote repository
        await mkdir(remoteRepoDir, { recursive: true });
        execSync('git init --bare', { cwd: remoteRepoDir });

        // Create and setup local repository
        await mkdir(localRepoDir, { recursive: true });
        const git = simpleGit.simpleGit(localRepoDir);
        await git.init();
        await git.addConfig('user.name', 'Test User');
        await git.addConfig('user.email', 'test@example.com');
        
        // Add remote
        await git.addRemote('origin', remoteRepoDir);

        // Create initial commit on master branch (default branch)
        await writeFile(path.join(localRepoDir, testFile), 'Initial content\n');
        await git.add(testFile);
        await git.commit('Initial commit');
        
        // Push to create master branch on remote
        await git.push(['-u', 'origin', 'master']);
        
        // Create and checkout main branch
        await git.checkoutBranch('main', 'master');
        await git.push(['-u', 'origin', 'main']);

        // Create feature branch
        await git.checkoutBranch('feature-branch', 'main');
        await writeFile(path.join(localRepoDir, testFile), 'Feature branch content\n');
        await git.add(testFile);
        await git.commit('Feature branch commit');
        await git.push('origin', 'feature-branch');

        // Create another feature branch for conflict testing
        await git.checkoutBranch('conflict-branch', 'main');
        await writeFile(path.join(localRepoDir, conflictFile), 'Conflict branch content\n');
        await git.add(conflictFile);
        await git.commit('Conflict branch commit');
        await git.push('origin', 'conflict-branch');

        // Go back to main and create a conflicting change
        await git.checkout('main');
        await writeFile(path.join(localRepoDir, testFile), 'Main branch updated content\n');
        await writeFile(path.join(localRepoDir, conflictFile), 'Main branch conflict content\n');
        await git.add([testFile, conflictFile]);
        await git.commit('Main branch update');
        await git.push('origin', 'main');
    }, 30000); // Increase timeout for setup

    afterEach(async () => {
        // Clean up test directories
        await removeDirectory(testBaseDir);
    });

    describe('successful merge scenarios', () => {
        test('should merge a local branch without conflicts', async () => {
            const repo = new Repository(localRepoDir);
            
            // Checkout main branch
            await repo.checkoutBranch('main');
            
            // Create a new local branch with non-conflicting changes
            const git = simpleGit.simpleGit(localRepoDir);
            await git.checkoutBranch('local-branch', 'main');
            await writeFile(path.join(localRepoDir, 'newfile.txt'), 'New file content\n');
            await git.add('newfile.txt');
            await git.commit('Add new file');
            
            // Go back to main and merge
            await repo.checkoutBranch('main');
            await repo.merge(null, 'local-branch');
            
            // Verify the merge was successful
            const status = await repo.status();
            expect(status.conflicted.length).toBe(0);
            
            // Verify the new file exists
            let fileExists = false;
            try {
                await access(path.join(localRepoDir, 'newfile.txt'), fs.constants.F_OK);
                fileExists = true;
            } catch (err) {
                fileExists = false;
            }
            expect(fileExists).toBe(true);
        });

        test('should merge a remote branch without conflicts', async () => {
            const repo = new Repository(localRepoDir);
            
            // Create a new branch on remote with non-conflicting changes
            const git = simpleGit.simpleGit(localRepoDir);
            await git.checkout('main');
            await git.checkoutBranch('remote-feature', 'main');
            await writeFile(path.join(localRepoDir, 'remote-file.txt'), 'Remote file content\n');
            await git.add('remote-file.txt');
            await git.commit('Add remote file');
            await git.push('origin', 'remote-feature');
            
            // Go back to main and fetch
            await repo.checkoutBranch('main');
            await repo.fetch({});
            
            // Merge the remote branch
            await repo.merge('origin', 'remote-feature');
            
            // Verify the merge was successful
            const status = await repo.status();
            expect(status.conflicted.length).toBe(0);
            
            // Verify the remote file exists
            let fileExists = false;
            try {
                await access(path.join(localRepoDir, 'remote-file.txt'), fs.constants.F_OK);
                fileExists = true;
            } catch (err) {
                fileExists = false;
            }
            expect(fileExists).toBe(true);
        });

        test('should merge with --no-ff option', async () => {
            const repo = new Repository(localRepoDir);
            
            // Create a simple branch
            const git = simpleGit.simpleGit(localRepoDir);
            await git.checkout('main');
            await git.checkoutBranch('no-ff-branch', 'main');
            await writeFile(path.join(localRepoDir, 'no-ff-file.txt'), 'No FF content\n');
            await git.add('no-ff-file.txt');
            await git.commit('No FF commit');
            
            // Go back to main and merge with no-ff
            await repo.checkoutBranch('main');
            const beforeMergeCommit = await repo.getCurrentCommitHash();
            
            await repo.merge(null, 'no-ff-branch', { noFF: true });
            
            // Verify a merge commit was created
            const afterMergeCommit = await repo.getCurrentCommitHash();
            expect(afterMergeCommit).not.toBe(beforeMergeCommit);
            
            // Check that it's a merge commit (has two parents)
            const log = await repo.logLast(1);
            expect(log.latest.message).toContain('Merge branch');
        });

        test('should list files when listFiles option is true', async () => {
            const repo = new Repository(localRepoDir);
            
            // Create a branch with multiple files
            const git = simpleGit.simpleGit(localRepoDir);
            await git.checkout('main');
            await git.checkoutBranch('list-files-branch', 'main');
            await writeFile(path.join(localRepoDir, 'file1.txt'), 'File 1\n');
            await writeFile(path.join(localRepoDir, 'file2.txt'), 'File 2\n');
            await git.add(['file1.txt', 'file2.txt']);
            await git.commit('Add multiple files');
            
            // Spy on console.log to capture output
            const consoleSpy = jest.spyOn(console, 'log');
            
            // Go back to main and merge with listFiles
            await repo.checkoutBranch('main');
            await repo.merge(null, 'list-files-branch', { listFiles: true });
            
            // Verify files were listed
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Merged files'));
            
            consoleSpy.mockRestore();
        });
    });

    describe('merge conflict scenarios', () => {
        test('should detect and report merge conflicts', async () => {
            const repo = new Repository(localRepoDir);
            
            // We already have conflicting changes set up in beforeEach
            // main has different content in conflict.txt than conflict-branch
            
            await repo.checkoutBranch('main');
            
            // Attempt to merge conflict-branch which will create conflicts
            // The merge will fail with "Merge failed" error
            await expect(repo.merge('origin', 'conflict-branch')).rejects.toThrow('Merge failed when merging conflict-branch');
            
            // After a failed merge, verify the repository is in a conflicted state
            const status = await repo.status();
            // The conflicted array should contain files with conflicts
            expect(status.conflicted.length).toBeGreaterThan(0);
            expect(status.conflicted).toContain(conflictFile);
        });

        test('should handle conflicts with --no-commit option', async () => {
            const repo = new Repository(localRepoDir);
            
            // Create a branch with conflicting changes
            const git = simpleGit.simpleGit(localRepoDir);
            await git.checkout('main');
            await git.checkoutBranch('no-commit-conflict', 'main');
            await writeFile(path.join(localRepoDir, testFile), 'Different content for conflict\n');
            await git.add(testFile);
            await git.commit('Conflicting change');
            
            await repo.checkoutBranch('main');
            
            // Merge with no-commit option - even without conflicts, it will stop before commit
            // This won't throw an error, it just won't create a commit
            await repo.merge(null, 'no-commit-conflict', { noCommit: true });
            
            // Verify no merge commit was created
            const log = await repo.logLast(1);
            expect(log.latest.message).not.toContain('Merge');
        });
    });

    describe('edge cases and error scenarios', () => {
        test('should throw error when merging non-existent branch', async () => {
            const repo = new Repository(localRepoDir);
            
            await repo.checkoutBranch('main');
            
            // Try to merge a branch that doesn't exist
            await expect(repo.merge(null, 'non-existent-branch'))
                .rejects.toThrow("Branch 'non-existent-branch' does not exist locally or on the remote");
        });

        test('should throw error when merging non-existent remote branch', async () => {
            const repo = new Repository(localRepoDir);
            
            await repo.checkoutBranch('main');
            
            // Try to merge a remote branch that doesn't exist
            await expect(repo.merge('origin', 'non-existent-remote-branch'))
                .rejects.toThrow("Branch 'non-existent-remote-branch' does not exist locally or on the remote");
        });

        test('should handle ff-only merge that cannot fast-forward', async () => {
            const repo = new Repository(localRepoDir);
            
            // Create divergent history
            const git = simpleGit.simpleGit(localRepoDir);
            await git.checkout('main');
            await git.checkoutBranch('divergent-branch', 'main');
            await writeFile(path.join(localRepoDir, 'divergent.txt'), 'Divergent content\n');
            await git.add('divergent.txt');
            await git.commit('Divergent commit');
            
            // Make a commit on main too
            await git.checkout('main');
            await writeFile(path.join(localRepoDir, 'main-only.txt'), 'Main only content\n');
            await git.add('main-only.txt');
            await git.commit('Main only commit');
            
            // Try ff-only merge which should fail
            await expect(repo.merge(null, 'divergent-branch', { ffOnly: true }))
                .rejects.toThrow('Merge failed when merging divergent-branch');
        });

        test('should handle unrelated histories with --allow-unrelated-histories', async () => {
            const repo = new Repository(localRepoDir);
            
            // Create an orphan branch (unrelated history)
            const git = simpleGit.simpleGit(localRepoDir);
            await git.raw(['checkout', '--orphan', 'unrelated-branch']);
            await git.raw(['rm', '-rf', '.']);
            await writeFile(path.join(localRepoDir, 'unrelated.txt'), 'Unrelated content\n');
            await git.add('unrelated.txt');
            await git.commit('Unrelated history commit');
            
            await repo.checkoutBranch('main');
            
            // This should work because merge() includes --allow-unrelated-histories by default
            await repo.merge(null, 'unrelated-branch');
            
            const status = await repo.status();
            expect(status.conflicted.length).toBe(0);
        });

        test('should correctly check if branch exists locally', async () => {
            const repo = new Repository(localRepoDir);
            
            // Test existing local branch
            const existsLocal = await repo.checkBranchExistsLocally('main');
            expect(existsLocal).toBe(true);
            
            // Test non-existing local branch
            const notExistsLocal = await repo.checkBranchExistsLocally('does-not-exist');
            expect(notExistsLocal).toBe(false);
        });

        test('should correctly check if branch exists on remote', async () => {
            const repo = new Repository(localRepoDir);
            
            // Fetch to ensure we have remote refs
            await repo.fetch({});
            
            // Test existing remote branch
            const existsRemote = repo.checkBranchExistsOnRemote('origin', 'main');
            expect(existsRemote).toBe(true);
            
            // Test non-existing remote branch
            const notExistsRemote = repo.checkBranchExistsOnRemote('origin', 'does-not-exist');
            expect(notExistsRemote).toBe(false);
        });
    });

    describe('verbose mode behavior', () => {
        let originalIsVerbose: () => boolean;
        
        beforeEach(() => {
            // Mock Global.isVerbose to return true
            originalIsVerbose = Global.isVerbose;
            Global.isVerbose = jest.fn(() => true);
        });

        afterEach(() => {
            // Restore original
            Global.isVerbose = originalIsVerbose;
        });

        test('should log verbose messages when verbose mode is on', async () => {
            const consoleSpy = jest.spyOn(console, 'log');
            const repo = new Repository(localRepoDir);
            
            // Create a branch that can be merged without conflicts
            const git = simpleGit.simpleGit(localRepoDir);
            await git.checkout('main');
            await git.checkoutBranch('verbose-test-branch', 'main');
            await writeFile(path.join(localRepoDir, 'verbose-test.txt'), 'Verbose test content\n');
            await git.add('verbose-test.txt');
            await git.commit('Verbose test commit');
            
            await repo.checkoutBranch('main');
            await repo.merge(null, 'verbose-test-branch');
            
            // Check that verbose messages were logged
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining(': merge'),
                expect.any(String)
            );
            
            consoleSpy.mockRestore();
        });
    });
});
