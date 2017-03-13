/**
 * Utility class for parsing and writing a messages file
 */
import * as Promise from 'bluebird';
import {IGitLogEntry} from '../../git';
import {Global} from '../../Global';
import {fs} from '../../p/fs';
import {enforceNewline, makeSingleLine} from '../../util';

type MessageEntryStatus = 'ok' | 'commented' | 'conflict';
interface IReleaseNotesMessageEntry {
    readonly hash: string;
    status: MessageEntryStatus;
    message: string;
}

export class ReleaseNotesMessagesFile {
    public static readonly DIRECTORY_RELEASE_NOTES: string = 'release-notes';

    private static MESSAGES_FILE_NAME_PATTERN: RegExp = new RegExp(/^messages_.*\.db$/);
    private static CHANGELOG_DEFAULT_MESSAGE_PATTERN: RegExp = new RegExp(/#changelog:\s?((.|\n(?!\n))+)/);
    private static readonly RELEVANCE_PATTERNS: string[] = [
        'merge pull request #\\d+', // GitHub Pull Request
        '\\bcloses? #\\d+', // GitHub Issues
        '\\bissue-\\d+', // Intranet / Project Issues
        '\\bchangelog\\b' // Explicit changelog marker
    ];

    private readonly path: string;

    private missingEntries: Map<string, IReleaseNotesMessageEntry>;
    private hashMap: Map<string, IReleaseNotesMessageEntry>;
    private numErrors: number;

    constructor(path: string) {
        this.path = path;
    }

    public static getPathToMessages(lang: string): string {
        return `${ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES}/messages_${lang}.db`;
    }

    public static getPathToExplicits(lang: string): string {
        return `${ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES}/explicits_${lang}.db`;
    }

    public static filterRelevantCommits(entry: IGitLogEntry): boolean {
        if (!entry.message) {
            return false;
        }
        for (const p of ReleaseNotesMessagesFile.RELEVANCE_PATTERNS) {
            const regExp = new RegExp(p, 'i');
            if (regExp.test(entry.message)) {
                return true;
            }
        }
    }

    public static getAllMessagesFiles(): Promise<ReleaseNotesMessagesFile[]> {
        return fs
            .statAsync(ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES)
            .catch(() => Promise.reject(`directory ${ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES} does not exist`))
            .then(() => fs.readdirAsync(ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES))
            .then((files) => {
                return files
                    .filter((f) => ReleaseNotesMessagesFile.MESSAGES_FILE_NAME_PATTERN.test(f))
                    .map((f) => {
                        return new ReleaseNotesMessagesFile(`${ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES}/${f}`);
                    });
            });
    }

    public getPath(): string {
        return this.path;
    }

    public getNumErrors(): number {
        return this.numErrors;
    }

    public getMessage(hash: string): string | null {
        const entry = this.hashMap.get(hash);
        return entry ? entry.message : null;
    }

    public parse(): Promise<void> {
        this.hashMap = new Map();
        this.missingEntries = new Map();
        this.numErrors = 0;

        return fs
            .readFileAsync(this.path, 'utf8')
            .then((content) => {
                content
                    .split('\n')
                    .filter((l) => {
                        return !!l && l.indexOf(':') > 0;
                    })
                    .map((l) => {
                        const sep = l.indexOf(':');
                        const status = this.getStatusFromPrefix(l);
                        let hash = l.substr(0, sep);
                        if (status !== 'ok') {
                            hash = hash.substr(1);
                        }
                        const message = l.substr(sep + 1);

                        return {
                            status,
                            hash,
                            message
                        };
                    })
                    .forEach((e) => {
                        this.hashMap.set(e.hash, e);
                        if (e.status !== 'ok') {
                            this.numErrors += 1;
                        }
                    });
            })
            .catch(() => {
                return Promise.resolve();
            });
    }

    public update(logEntries: IGitLogEntry[]): number {
        logEntries
            .filter((l) => !this.hashMap.has(l.hash))
            .forEach((l) => this.addMissingLogEntry(l));
        return this.missingEntries.size;
    }

    public merge(other: ReleaseNotesMessagesFile, base: ReleaseNotesMessagesFile): boolean {
        let conflict = false;
        for (const otherEntry of other.hashMap.values()) {
            const hash = otherEntry.hash;
            if (!this.hashMap.has(hash)) {
                this.addMissingEntry(otherEntry);
            } else {
                const currentEntry = this.hashMap.get(hash);
                switch (currentEntry.status) {
                    case 'conflict':
                        conflict = true;
                        break;
                    case 'commented':
                        this.hashMap.set(hash, otherEntry);
                        break;
                    case 'ok':
                        switch (otherEntry.status) {
                            case 'commented':
                                break;
                            case 'ok':
                            case 'conflict':
                                if (!this.resolveConflict(currentEntry, otherEntry, base)) {
                                    conflict = true;
                                }
                                break;
                            default:
                                console.error('unknown status', otherEntry.status);
                                break;
                        }
                        break;
                    default:
                        console.error('unknown status', currentEntry.status);
                        break;
                }
            }
        }
        return conflict;
    }

    public write(): Promise<void> {
        const allEntries = Array.from(this.hashMap.values());
        allEntries.sort((e1, e2) => {
            return e1.hash.localeCompare(e2.hash);
        });

        const content = allEntries
                .map((e) => {
                    const hash = this.getPrefixForStatus(e.status) + e.hash;
                    return `${hash}:${e.message}`;
                })
                .join('\n') + '\n';
        return fs
            .writeFileAsync(this.path, content, 'utf8')
            .then(
                () => {
                    this.missingEntries.clear();
                },
                (err) => {
                    Global.isVerbose() && console.error(err);
                }
            );
    }

    private resolveConflict(currentEntry: IReleaseNotesMessageEntry, otherEntry: IReleaseNotesMessageEntry, base: ReleaseNotesMessagesFile): boolean {
        if (currentEntry.message === otherEntry.message) {
            return true;
        }

        if (base.hashMap.has(currentEntry.hash)) {
            const baseEntry = base.hashMap.get(currentEntry.hash);
            if (currentEntry.message === baseEntry.message) {
                currentEntry.message = otherEntry.message;
                return true;
            } else if (otherEntry.message === baseEntry.message) {
                return true;
            }
        }

        currentEntry.status = 'conflict';
        currentEntry.message += ` <-CONFLICT-> ${otherEntry.message}`;
        console.error('Detected conflict for commit:', currentEntry.hash, currentEntry.message, '<- ->', otherEntry.message);
        return false;
    }

    private addMissingLogEntry(logEntry: IGitLogEntry): void {
        let status: MessageEntryStatus = 'commented';
        let message = `${makeSingleLine(logEntry.message)} by ${logEntry.author_name}`;

        const defaultMessage = this.extractMessageFromCommit(logEntry);
        if (defaultMessage !== null) {
            status = 'ok';
            message = defaultMessage;
        }

        const entry: IReleaseNotesMessageEntry = {
            hash: logEntry.hash,
            status,
            message
        };
        this.addMissingEntry(entry);
    }

    private addMissingEntry(entry: IReleaseNotesMessageEntry): void {
        this.missingEntries.set(entry.hash, entry);
        this.hashMap.set(entry.hash, entry);
        if (entry.status !== 'ok') {
            this.numErrors += 1;
        }
    }

    private extractMessageFromCommit(logEntry: IGitLogEntry): string | null {
        const message = enforceNewline(logEntry.message);
        const match = ReleaseNotesMessagesFile.CHANGELOG_DEFAULT_MESSAGE_PATTERN.exec(message);
        if (match === null || match.length < 2) {
            return null;
        }

        const m = makeSingleLine(match[1]).trim();
        Global.isVerbose() && console.log('found default commit message for', logEntry.hash, ':', m);
        return m;
    }

    private getPrefixForStatus(status: MessageEntryStatus): string {
        switch (status) {
            case 'ok':
                return '';
            case 'conflict':
                return '!';
            case 'commented':
                return '#';
            default:
                console.error('unknown status', status);
                return '!';
        }
    }

    private getStatusFromPrefix(l: string): MessageEntryStatus {
        if (l.startsWith('!')) {
            return 'conflict';
        } else if (l.startsWith('#')) {
            return 'commented';
        } else {
            return 'ok';
        }
    }
}
