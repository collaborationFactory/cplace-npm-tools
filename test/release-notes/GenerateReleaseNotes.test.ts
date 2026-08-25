import { GenerateReleaseNotes } from '../../src/commands/release-notes/GenerateReleaseNotes';
import { IGitLogEntry } from '../../src/git';

const releaseNotes: GenerateReleaseNotes = new GenerateReleaseNotes();
const log1: IGitLogEntry = {
    squad: 'UIX',
    date: '10.10.2020',
    author_email: 'a',
    author_name: 'a',
    message: 'changelog: UIX: [PFM-ISSUE-1] Refactored IconAttributeControl to be CplaceSingleIconControl [PR cplace-frontend-applications#539]',
    hash: 'a'
};
const log2: IGitLogEntry = {
    squad: 'Frontend-Core',
    date: '09.10.2020',
    author_email: 'b',
    author_name: 'b',
    message: 'changelog: Frontend-Core: [PFM-ISSUE-2] Fix: Fixed documentation for Storybook generation [PR cplace-frontend-applications#595]',
    hash: 'b'
};
const log3: IGitLogEntry = {
    squad: 'Frontend-Core',
    date: '10.10.2020',
    author_email: 'b',
    author_name: 'b',
    message: 'changelog: Frontend-Core: [PFM-ISSUE-3] Fix: pinned nx cloud to a version instead of latest [PR cplace-frontend-applications#594]',
    hash: 'b'
};
const log4: IGitLogEntry = {
    squad: 'Frontend-Core',
    date: '09.10.2020',
    author_email: 'b',
    author_name: 'b',
    message: 'changelog: Frontend-Core: [PFM-TASK-4] Registered CplacePasswordControl [PR cplace-frontend-applications#579]',
    hash: 'b'
};
const log5: IGitLogEntry = {
    squad: 'UIX',
    date: '09.10.2020',
    author_email: 'b',
    author_name: 'b',
    message: 'changelog: UIX: [PFM-TASK-5] some awesome feature [PR cplace-frontend-applications#520]',
    hash: 'b'
};
const log6: IGitLogEntry = {
    squad: '',
    date: '09.10.2020',
    author_email: 'b',
    author_name: 'b',
    message: 'changelog: [PFM-TASK-6] some awesome feature [PR cplace-frontend-applications#520]',
    hash: 'b'
};

test('can sort by squad (which may be empty) and then by date', () => {
    const logs = releaseNotes.sortLogs([log2, log4, log5, log1, log3, log6]);
    expect(logs[0]).toBe(log6);
    expect(logs[1]).toBe(log2);
    expect(logs[2]).toBe(log4);
    expect(logs[3]).toBe(log3);
    expect(logs[4]).toBe(log5);
    expect(logs[5]).toBe(log1);
});

test('sort result is stable for permuted input: squad and date grouping holds regardless of entry order', () => {
    const logs = releaseNotes.sortLogs([log6, log1, log3, log5, log4, log2]);
    expect(logs[0]).toBe(log6);
    // log4 and log2 share squad and date — their relative order reflects input order
    expect(logs[1]).toBe(log4);
    expect(logs[2]).toBe(log2);
    expect(logs[3]).toBe(log3);
    expect(logs[4]).toBe(log5);
    expect(logs[5]).toBe(log1);
});
