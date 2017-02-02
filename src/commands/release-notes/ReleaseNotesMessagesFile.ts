/**
 * Utility class for parsing and writing a messages file
 */
import * as Promise from 'bluebird';
import {IGitLogEntry} from '../../git';
import {fs} from '../../p/fs';

interface IReleaseNotesMessageEntry {
    readonly commented: boolean;
    readonly hash: string;
    readonly message: string;
}

export class ReleaseNotesMessagesFile {
    private readonly path: string;

    private entries: IReleaseNotesMessageEntry[];
    private missingEntries: IReleaseNotesMessageEntry[];
    private hashMap: Map<string, IReleaseNotesMessageEntry>;
    private numCommented: number;

    constructor(path: string) {
        this.path = path;
    }

    public getNumCommented(): number {
        return this.numCommented;
    }

    public getMessage(hash: string): string | null {
        const entry = this.hashMap.get(hash);
        if (!entry || entry.commented) {
            return null;
        } else {
            return entry.message;
        }
    }

    public parse(): Promise<void> {
        this.entries = [];
        this.missingEntries = [];
        this.hashMap = new Map();
        this.numCommented = 0;

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
                        const commented = l.startsWith('#');
                        let hash = l.substr(0, sep);
                        if (commented) {
                            hash = hash.substr(1);
                        }
                        const message = l.substr(sep + 1);

                        return {
                            commented,
                            hash,
                            message
                        };
                    })
                    .forEach((e) => {
                        this.entries.push(e);
                        this.hashMap.set(e.hash, e);
                        if (e.commented) {
                            this.numCommented += 1;
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
            .forEach((l) => this.addMissingEntry(l));
        return this.missingEntries.length;
    }

    public write(): Promise<void> {
        if (!this.missingEntries.length) {
            return Promise.resolve();
        }

        const content = this.missingEntries
            .map((e) => {
                const hash = (e.commented ? '#' : '') + e.hash;
                return `${hash}:${e.message}`;
            })
            .join('\n') + '\n';
        return fs
            .appendFileAsync(this.path, content, 'utf8')
            .then(() => {
                this.entries = this.entries.concat(this.missingEntries);
            });
    }

    private addMissingEntry(logEntry: IGitLogEntry): void {
        const entry = {
            commented: true,
            hash: logEntry.hash,
            message: `${logEntry.message} by ${logEntry.author_name}`
        };
        this.missingEntries.push(entry);
        this.hashMap.set(logEntry.hash, entry);
        this.numCommented += 1;
    }
}
