import {SplitRepository} from '../../src/commands/flow/SplitRepository';
import {ICommandParameters} from '../../src/commands/models';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as child_process from 'child_process';

describe('SplitRepository', () => {
    describe('prepareAndMayExecute', () => {
        test('should require pathToTargetRepo parameter', () => {
            const splitRepo = new SplitRepository();
            const params: ICommandParameters = {};

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const result = splitRepo.prepareAndMayExecute(params);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('missing path to target repo');
            consoleSpy.mockRestore();
        });

        test('should reject empty pathToTargetRepo', () => {
            const splitRepo = new SplitRepository();
            const params: ICommandParameters = {
                pathToTargetRepo: ''
            };

            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            const result = splitRepo.prepareAndMayExecute(params);

            expect(result).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('missing path to target repo');
            consoleSpy.mockRestore();
        });

        test('should accept valid pathToTargetRepo', () => {
            const splitRepo = new SplitRepository();
            // Use a temp directory that actually exists
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));

            try {
                const params: ICommandParameters = {
                    pathToTargetRepo: tempDir
                };

                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                const result = splitRepo.prepareAndMayExecute(params);
                consoleSpy.mockRestore();

                expect(result).toBe(true);
            } finally {
                fs.rmSync(tempDir, {recursive: true, force: true});
            }
        });

        test('should use default directories when not specified', () => {
            const splitRepo = new SplitRepository();
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));

            try {
                const params: ICommandParameters = {
                    pathToTargetRepo: tempDir
                };

                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                splitRepo.prepareAndMayExecute(params);
                consoleSpy.mockRestore();

                // Should use PROJECT_PLANNING_DIRECTORIES_TO_MIGRATE by default
                const directoriesUsed = (splitRepo as any).sourceDirectoriesToMigrate;
                expect(directoriesUsed).toContain('cf.cplace.projektplanung');
            } finally {
                fs.rmSync(tempDir, {recursive: true, force: true});
            }
        });

        test('should accept custom directories parameter', () => {
            const splitRepo = new SplitRepository();
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));

            try {
                const params: ICommandParameters = {
                    pathToTargetRepo: tempDir,
                    directories: 'my.custom.directory'
                };

                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                splitRepo.prepareAndMayExecute(params);
                consoleSpy.mockRestore();

                // Should use custom directories
                const directoriesUsed = (splitRepo as any).sourceDirectoriesToMigrate;
                expect(directoriesUsed).toBe('-- my.custom.directory');
            } finally {
                fs.rmSync(tempDir, {recursive: true, force: true});
            }
        });

        test('should reject empty directories parameter', () => {
            const splitRepo = new SplitRepository();
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));

            try {
                const params: ICommandParameters = {
                    pathToTargetRepo: tempDir,
                    directories: ''
                };

                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                splitRepo.prepareAndMayExecute(params);
                consoleSpy.mockRestore();

                // Empty directories should fall back to default
                const directoriesUsed = (splitRepo as any).sourceDirectoriesToMigrate;
                expect(directoriesUsed).toContain('cf.cplace.projektplanung');
            } finally {
                fs.rmSync(tempDir, {recursive: true, force: true});
            }
        });

        test('should handle multiple directory paths', () => {
            const splitRepo = new SplitRepository();
            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-test-'));

            try {
                const params: ICommandParameters = {
                    pathToTargetRepo: tempDir,
                    directories: 'dir1 dir2 dir3'
                };

                const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
                splitRepo.prepareAndMayExecute(params);
                consoleSpy.mockRestore();

                const directoriesUsed = (splitRepo as any).sourceDirectoriesToMigrate;
                expect(directoriesUsed).toBe('-- dir1 dir2 dir3');
            } finally {
                fs.rmSync(tempDir, {recursive: true, force: true});
            }
        });
    });

    describe('execute - validation only', () => {
        let tempSourceDir: string;
        let tempTargetDir: string;

        beforeEach(() => {
            tempSourceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-source-'));
            tempTargetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-target-'));
        });

        afterEach(() => {
            if (fs.existsSync(tempSourceDir)) {
                fs.rmSync(tempSourceDir, {recursive: true, force: true});
            }
            if (fs.existsSync(tempTargetDir)) {
                fs.rmSync(tempTargetDir, {recursive: true, force: true});
            }
        });

        test('should reject execution when source is not a git repo', async () => {
            const splitRepo = new SplitRepository();
            const params: ICommandParameters = {
                pathToTargetRepo: tempTargetDir
            };

            const previousCwd = process.cwd();
            try {
                process.chdir(tempSourceDir);
                splitRepo.prepareAndMayExecute(params);

                await expect(splitRepo.execute()).rejects.toThrow();
            } finally {
                process.chdir(previousCwd);
            }
        });

        test('should reject execution when target is not a git repo', async () => {
            // Initialize source as git repo
            child_process.execSync('git init', {cwd: tempSourceDir});
            child_process.execSync('git config user.email "test@test.com"', {cwd: tempSourceDir});
            child_process.execSync('git config user.name "Test"', {cwd: tempSourceDir});
            child_process.execSync('echo "test" > test.txt', {cwd: tempSourceDir});
            child_process.execSync('git add test.txt', {cwd: tempSourceDir});
            child_process.execSync('git commit -m "Initial"', {cwd: tempSourceDir});

            const splitRepo = new SplitRepository();
            const params: ICommandParameters = {
                pathToTargetRepo: tempTargetDir
            };

            const previousCwd = process.cwd();
            try {
                process.chdir(tempSourceDir);
                splitRepo.prepareAndMayExecute(params);

                await expect(splitRepo.execute()).rejects.toThrow();
            } finally {
                process.chdir(previousCwd);
            }
        });
    });
});
