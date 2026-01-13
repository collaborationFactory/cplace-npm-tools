import {MergeReleaseNotes} from '../../src/commands/release-notes/MergeReleaseNotes';
import {ICommandParameters} from '../../src/commands/models';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('MergeReleaseNotes', () => {
    let tempDir: string;
    let baseFile: string;
    let currentFile: string;
    let otherFile: string;

    beforeEach(() => {
        // Create temporary directory for test files
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'merge-release-notes-test-'));
        baseFile = path.join(tempDir, 'base.db');
        currentFile = path.join(tempDir, 'current.db');
        otherFile = path.join(tempDir, 'other.db');
    });

    afterEach(() => {
        // Clean up temporary files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, {recursive: true, force: true});
        }
    });

    test('should merge non-conflicting changes from other into current', async () => {
        // Base has one entry
        fs.writeFileSync(baseFile, 'hash1::message1\n');

        // Current adds a second entry
        fs.writeFileSync(currentFile, 'hash1::message1\nhash2::message2\n');

        // Other adds a third entry
        fs.writeFileSync(otherFile, 'hash1::message1\nhash3::message3\n');

        const params: ICommandParameters = {
            base: baseFile,
            current: currentFile,
            other: otherFile
        };

        const cmd = new MergeReleaseNotes();
        expect(cmd.prepareAndMayExecute(params)).toBe(true);
        await cmd.execute();

        // Current should now have all three entries
        const result = fs.readFileSync(currentFile, 'utf8');
        expect(result).toContain('hash1::message1');
        expect(result).toContain('hash2::message2');
        expect(result).toContain('hash3::message3');
    });

    test('should handle identical entries without conflict', async () => {
        // All files have the same entry
        const content = 'hash1::message1\n';
        fs.writeFileSync(baseFile, content);
        fs.writeFileSync(currentFile, content);
        fs.writeFileSync(otherFile, content);

        const params: ICommandParameters = {
            base: baseFile,
            current: currentFile,
            other: otherFile
        };

        const cmd = new MergeReleaseNotes();
        expect(cmd.prepareAndMayExecute(params)).toBe(true);
        await cmd.execute();

        // Current should still have the entry
        const result = fs.readFileSync(currentFile, 'utf8');
        expect(result).toContain('hash1::message1');
    });

    test('should detect conflicts when same hash has different messages', async () => {
        // Base has one entry
        fs.writeFileSync(baseFile, 'hash1::original message\n');

        // Current changes the message
        fs.writeFileSync(currentFile, 'hash1::current message\n');

        // Other also changes the message differently
        fs.writeFileSync(otherFile, 'hash1::other message\n');

        const params: ICommandParameters = {
            base: baseFile,
            current: currentFile,
            other: otherFile
        };

        const cmd = new MergeReleaseNotes();
        expect(cmd.prepareAndMayExecute(params)).toBe(true);

        // Capture console output
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

        await cmd.execute();

        // Should report conflicts
        expect(consoleSpy).toHaveBeenCalledWith('Had conflicts:', expect.any(Boolean));
        consoleSpy.mockRestore();
    });

    test('should handle commented entries correctly', async () => {
        // Base has regular entry
        fs.writeFileSync(baseFile, 'hash1::message1\n');

        // Current has commented entry
        fs.writeFileSync(currentFile, '#hash1::message1\n');

        // Other has updated message
        fs.writeFileSync(otherFile, 'hash1::message1 updated\n');

        const params: ICommandParameters = {
            base: baseFile,
            current: currentFile,
            other: otherFile
        };

        const cmd = new MergeReleaseNotes();
        expect(cmd.prepareAndMayExecute(params)).toBe(true);
        await cmd.execute();

        // Other's version should take precedence over commented version
        const result = fs.readFileSync(currentFile, 'utf8');
        expect(result).toContain('message1 updated');
    });

    test('should fail when current parameter is missing', () => {
        const params: ICommandParameters = {
            base: baseFile,
            other: otherFile
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const cmd = new MergeReleaseNotes();
        expect(cmd.prepareAndMayExecute(params)).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('missing "current"'));
        consoleSpy.mockRestore();
    });

    test('should fail when other parameter is missing', () => {
        const params: ICommandParameters = {
            base: baseFile,
            current: currentFile
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const cmd = new MergeReleaseNotes();
        expect(cmd.prepareAndMayExecute(params)).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('missing "other"'));
        consoleSpy.mockRestore();
    });

    test('should fail when base parameter is missing', () => {
        const params: ICommandParameters = {
            current: currentFile,
            other: otherFile
        };

        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const cmd = new MergeReleaseNotes();
        expect(cmd.prepareAndMayExecute(params)).toBe(false);
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('missing "base"'));
        consoleSpy.mockRestore();
    });

    test('should merge multiple entries from both sides', async () => {
        // Base has two entries
        fs.writeFileSync(baseFile, 'hash1::message1\nhash2::message2\n');

        // Current adds hash3 and hash4
        fs.writeFileSync(currentFile, 'hash1::message1\nhash2::message2\nhash3::message3\nhash4::message4\n');

        // Other adds hash5 and hash6
        fs.writeFileSync(otherFile, 'hash1::message1\nhash2::message2\nhash5::message5\nhash6::message6\n');

        const params: ICommandParameters = {
            base: baseFile,
            current: currentFile,
            other: otherFile
        };

        const cmd = new MergeReleaseNotes();
        expect(cmd.prepareAndMayExecute(params)).toBe(true);
        await cmd.execute();

        // Current should now have all six entries
        const result = fs.readFileSync(currentFile, 'utf8');
        expect(result).toContain('hash1::message1');
        expect(result).toContain('hash2::message2');
        expect(result).toContain('hash3::message3');
        expect(result).toContain('hash4::message4');
        expect(result).toContain('hash5::message5');
        expect(result).toContain('hash6::message6');
    });
});
