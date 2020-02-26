import {ReleaseNotesMessagesFile} from './ReleaseNotesMessagesFile';

test('path to messages file is computed correctly', () => {
    const dePath = ReleaseNotesMessagesFile.getPathToMessages('de');
    expect(dePath).toBe('release-notes/messages_de.db');
    const enPath = ReleaseNotesMessagesFile.getPathToMessages('en');
    expect(enPath).toBe('release-notes/messages_en.db');
});
