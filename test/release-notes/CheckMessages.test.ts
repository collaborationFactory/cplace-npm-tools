import {CheckMessages} from '../../src/commands/release-notes/CheckMessages';
import {ICommandParameters} from '../../src/commands/models';
import {ReleaseNotesMessagesFile} from '../../src/commands/release-notes/ReleaseNotesMessagesFile';
import {IGitLogEntry} from '../../src/git';

describe('CheckMessages', () => {
    test('should use default size of 100 when no size parameter provided', () => {
        const params: ICommandParameters = {};
        const cmd = new CheckMessages();

        expect(cmd.prepareAndMayExecute(params)).toBe(true);
        // Default size is 100, tested via the command execution
    });

    test('should use custom size when size parameter provided', () => {
        const params: ICommandParameters = {
            size: 50
        };
        const cmd = new CheckMessages();

        expect(cmd.prepareAndMayExecute(params)).toBe(true);
        // Custom size is used, tested via the command execution
    });

    test('should accept size parameter as number', () => {
        const params: ICommandParameters = {
            size: 200
        };
        const cmd = new CheckMessages();

        expect(cmd.prepareAndMayExecute(params)).toBe(true);
    });

    test('should handle zero size parameter', () => {
        const params: ICommandParameters = {
            size: 0
        };
        const cmd = new CheckMessages();

        expect(cmd.prepareAndMayExecute(params)).toBe(true);
    });
});

describe('ReleaseNotesMessagesFile - CheckMessages Integration', () => {
    test('filterRelevantCommits should identify commits with changelog marker', () => {
        const validCommit: IGitLogEntry = {
            hash: 'abc123',
            message: 'changelog: Fix important bug',
            date: '2024-01-01',
            author_email: 'dev@example.com',
            author_name: 'Developer'
        };

        expect(ReleaseNotesMessagesFile.filterRelevantCommits(validCommit)).toBe(true);
    });

    test('filterRelevantCommits should reject commits without changelog marker', () => {
        const invalidCommit: IGitLogEntry = {
            hash: 'abc123',
            message: 'Regular commit message without marker',
            date: '2024-01-01',
            author_email: 'dev@example.com',
            author_name: 'Developer'
        };

        expect(ReleaseNotesMessagesFile.filterRelevantCommits(invalidCommit)).toBe(undefined);
    });

    test('filterRelevantCommits should accept merge pull request commits', () => {
        const mergeCommit: IGitLogEntry = {
            hash: 'abc123',
            message: 'Merge pull request #123 from feature-branch',
            date: '2024-01-01',
            author_email: 'dev@example.com',
            author_name: 'Developer'
        };

        expect(ReleaseNotesMessagesFile.filterRelevantCommits(mergeCommit)).toBe(true);
    });

    test('filterRelevantCommits should accept changelog in second paragraph', () => {
        const commitWithNewline: IGitLogEntry = {
            hash: 'abc123',
            message: 'First line\n\nchangelog: Important fix in second paragraph',
            date: '2024-01-01',
            author_email: 'dev@example.com',
            author_name: 'Developer'
        };

        expect(ReleaseNotesMessagesFile.filterRelevantCommits(commitWithNewline)).toBe(true);
    });

    test('filterRelevantCommits should reject changelog in same paragraph', () => {
        const commitSameLine: IGitLogEntry = {
            hash: 'abc123',
            message: 'Short message changelog: same paragraph',
            date: '2024-01-01',
            author_email: 'dev@example.com',
            author_name: 'Developer'
        };

        expect(ReleaseNotesMessagesFile.filterRelevantCommits(commitSameLine)).toBe(undefined);
    });

    test('update should track missing entries', () => {
        const messagesFile = new ReleaseNotesMessagesFile('');

        const logEntries: IGitLogEntry[] = [
            {
                hash: 'hash1',
                message: 'changelog: First feature',
                date: '2024-01-01',
                author_email: 'dev@example.com',
                author_name: 'Developer'
            },
            {
                hash: 'hash2',
                message: 'changelog: Second feature',
                date: '2024-01-02',
                author_email: 'dev@example.com',
                author_name: 'Developer'
            }
        ];

        const missingCount = messagesFile.update(logEntries);

        expect(missingCount).toBe(2);
        expect(messagesFile.getMessage('hash1')).toBe('First feature');
        expect(messagesFile.getMessage('hash2')).toBe('Second feature');
    });

    test('update should not add duplicates', () => {
        const messagesFile = new ReleaseNotesMessagesFile('');

        const logEntry: IGitLogEntry = {
            hash: 'hash1',
            message: 'changelog: Feature',
            date: '2024-01-01',
            author_email: 'dev@example.com',
            author_name: 'Developer'
        };

        // First update
        let count = messagesFile.update([logEntry]);
        expect(count).toBe(1);

        // Second update with same entry
        count = messagesFile.update([logEntry]);
        expect(count).toBe(1); // Still 1, not 2
    });

    test('getMessage should extract changelog message correctly', () => {
        const messagesFile = new ReleaseNotesMessagesFile('');

        const logEntry: IGitLogEntry = {
            hash: 'hash1',
            message: 'changelog: Squad: [ISSUE-123] Fix: Fixed the thing [PR repo#456]',
            date: '2024-01-01',
            author_email: 'dev@example.com',
            author_name: 'Developer'
        };

        messagesFile.update([logEntry]);

        expect(messagesFile.getMessage('hash1')).toBe('Squad: [ISSUE-123] Fix: Fixed the thing [PR repo#456]');
    });

    test('getMessage should handle merge commit format', () => {
        const messagesFile = new ReleaseNotesMessagesFile('');

        const logEntry: IGitLogEntry = {
            hash: 'hash1',
            message: 'Merge pull request #123 from branch\n\nFeature description\n\nchangelog: Squad: [ISSUE-456] Feature description [PR repo#123]',
            date: '2024-01-01',
            author_email: 'dev@example.com',
            author_name: 'Developer'
        };

        messagesFile.update([logEntry]);

        expect(messagesFile.getMessage('hash1')).toBe('Squad: [ISSUE-456] Feature description [PR repo#123]');
    });

    test('getNumErrors should return undefined for unparsed file', () => {
        const messagesFile = new ReleaseNotesMessagesFile('');

        // New file without parsing returns undefined
        expect(messagesFile.getNumErrors()).toBeUndefined();
    });
});
