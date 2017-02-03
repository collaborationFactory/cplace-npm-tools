/**
 * Utility class for parsing and writing a messages file
 */
import * as Promise from 'bluebird';
import {IGitLogEntry} from '../../git';
import {fs} from '../../p/fs';

type MessageEntryStatus = 'ok' | 'commented' | 'conflict';
interface IReleaseNotesMessageEntry {
    readonly hash: string;
    status: MessageEntryStatus;
    message: string;
}

export class ReleaseNotesMessagesFile {
    private readonly path: string;

    private missingEntries: Map<string, IReleaseNotesMessageEntry>;
    private hashMap: Map<string, IReleaseNotesMessageEntry>;
    private numErrors: number;

    constructor(path: string) {
        this.path = path;
    }

    public getNumCommented(): number {
        return this.numErrors;
    }

    public getMessage(hash: string): string | null {
        const entry = this.hashMap.get(hash);
        if (!entry || entry.status !== 'ok') {
            return null;
        } else {
            return entry.message;
        }
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

    public merge(other: ReleaseNotesMessagesFile): boolean {
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
                                if (currentEntry.message !== otherEntry.message) {
                                    markConflict(currentEntry, otherEntry);
                                }
                                break;
                            case 'conflict':
                                markConflict(currentEntry, otherEntry);
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

        function markConflict(currentEntry: IReleaseNotesMessageEntry, otherEntry: IReleaseNotesMessageEntry): void {
            currentEntry.status = 'conflict';
            currentEntry.message += ` <-CONFLICT-> ${otherEntry.message}`;
            console.error('Detected conflict for commit:', currentEntry.hash, currentEntry.message);
            conflict = true;
        }
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
            .then(() => {
                this.missingEntries.clear();
            });
    }

    private addMissingLogEntry(logEntry: IGitLogEntry): void {
        const entry: IReleaseNotesMessageEntry = {
            status: 'commented',
            hash: logEntry.hash,
            message: `${logEntry.message} by ${logEntry.author_name}`
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
