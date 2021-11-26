import {ReleaseNotesMessagesFile} from './ReleaseNotesMessagesFile';
import {IGitLogEntry} from '../../git';

test('path to messages file is computed correctly', () => {
    const dePath = ReleaseNotesMessagesFile.getPathToMessages('de');
    expect(dePath).toBe('release-notes/messages_de.db');
    const enPath = ReleaseNotesMessagesFile.getPathToMessages('en');
    expect(enPath).toBe('release-notes/messages_en.db');
});

test('message that contains correct changelog is parsed correctly', () => {
    const relaseNotesMessageFile: ReleaseNotesMessagesFile = new ReleaseNotesMessagesFile('');
    let entry: IGitLogEntry = {hash: 'hashForTest', message: 'changelog: a very important fix', date: '', author_email: '', author_name: ''};
    relaseNotesMessageFile.update([entry]);
    let result = relaseNotesMessageFile.getMessage('hashForTest');
    expect(result).toBe('a very important fix');

    entry = {
        hash: 'hashForTest_1', message: 'Merge pull request #5335 from collaborationFactory/fix/ISSUE-1467-order-index-mirror-children\n' +
            '\n' +
            '    Mirror: [ISSUE-1467] Fix: Copy order index from source to mirror for hierarchical children.\n' +
            '\n' +
            '        changelog: Mirror: [ISSUE-1467] Fix: Copy order index from source to mirror for hierarchical children. [PR cplace#5335]', date: '', author_email: '', author_name: ''
    };
    relaseNotesMessageFile.update([entry]);
    result = relaseNotesMessageFile.getMessage('hashForTest_1');
    expect(result).toBe('Mirror: [ISSUE-1467] Fix: Copy order index from source to mirror for hierarchical children. [PR cplace#5335]');

});

test('message with incorrect changelog is negative/filtered', () => {
    let entry: IGitLogEntry = {hash: 'hashForTest', message: 'a very important changelog for a fix', date: '', author_email: '', author_name: ''};
    let result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(undefined);

    entry = {hash: 'hashForTest', message: 'a very important changelog: for a fix', date: '', author_email: '', author_name: ''};
    result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(undefined);

});

test('message with regular changelog is positive', () => {
    let entry: IGitLogEntry = {hash: 'hashForTest', message: 'changelog: for a fix', date: '', author_email: '', author_name: ''};
    let result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(true);

    entry = {hash: 'hashForTest', message: '   changelog: for a fix', date: '', author_email: '', author_name: ''};
    result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(true);

    entry = {hash: 'hashForTest', message: '\n \nchangelog: for a fix', date: '', author_email: '', author_name: ''};
    result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(true);

    entry = {hash: 'hashForTest', message: '\n \n   changelog: for a fix', date: '', author_email: '', author_name: ''};
    result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(true);

    entry = {hash: 'hashForTest', message: '    changelog: Platform Development: [PFM-TASK-2054]Simplified mail config validation [PR cplace#5398]', date: '', author_email: '', author_name: ''};
    result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(true);

    entry = {hash: 'hashForTest', message: 'Merge pull request #5420 from', date: '', author_email: '', author_name: ''};
    result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(true);

    entry = {
        hash: 'hashForTest', message: 'Merge pull request #5335 from collaborationFactory/fix/ISSUE-1467-order-index-mirror-children\n' +
            '\n' +
            '    Mirror: [ISSUE-1467] Fix: Copy order index from source to mirror for hierarchical children.\n' +
            '\n' +
            '        changelog: Mirror: [ISSUE-1467] Fix: Copy order index from source to mirror for hierarchical children. [PR cplace#5335]', date: '', author_email: '', author_name: ''
    };
    result = ReleaseNotesMessagesFile.filterRelevantCommits(entry);
    expect(result).toBe(true);

});
