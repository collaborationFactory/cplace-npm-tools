/**
 * Command for generating release notes
 */
import * as Promise from 'bluebird';
import {Git, IGitLogEntry, IGitLogSummary} from '../../git';
import {Global} from '../../Global';
import {fs} from '../../p/fs';
import {ICommand, ICommandParameters} from '../models';
import {ReleaseNotesMessagesFile} from './ReleaseNotesMessagesFile';

export class GenerateReleaseNotes implements ICommand {
    private static readonly PARAMETER_FROM: string = 'from';
    private static readonly PARAMETER_TO: string = 'to';
    private static readonly PARAMETER_LANG: string = 'lang';

    private static readonly PARAMETER_FORCE: string = 'force';

    private static readonly RELEVANCE_PATTERNS: string[] = [
        'merge pull request #\\d+', // GitHub Pull Request
        '\\bcloses? #\\d+', // GitHub Issues
        '\\bissue-\\d+', // Intranet / Project Issues
        '\\bchangelog\\b' // Explicit changelog marker
    ];

    private static readonly DIRECTORY_RELEASE_NOTES: string = 'release-notes';
    private static readonly FILE_NAME_CHANGELOG: string = 'CHANGELOG.md';

    private fromHash: string;
    private toHash: string;
    private lang: string;
    private force: boolean;

    private messagesFile: string;
    private explicitsFile: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        const fromHash = params[GenerateReleaseNotes.PARAMETER_FROM] as string;
        if (!fromHash) {
            console.error(`Missing required parameter "${GenerateReleaseNotes.PARAMETER_FROM}"`);
            return false;
        }
        this.fromHash = String(fromHash);

        const toHash = params[GenerateReleaseNotes.PARAMETER_TO] as string;
        if (toHash) {
            this.toHash = String(toHash);
        } else {
            this.toHash = 'HEAD';
        }

        const lang = params[GenerateReleaseNotes.PARAMETER_LANG] as string;
        if (lang) {
            this.lang = String(lang);
        } else {
            this.lang = 'en';
        }

        this.force = !!params[GenerateReleaseNotes.PARAMETER_FORCE];
        Global.isVerbose() && this.force && console.log('Force mode activated');

        this.messagesFile = `${GenerateReleaseNotes.DIRECTORY_RELEASE_NOTES}/messages_${this.lang}.db`;
        this.explicitsFile = `${GenerateReleaseNotes.DIRECTORY_RELEASE_NOTES}/explicits_${this.lang}.db`;

        return true;
    }

    public execute(): Promise<void> {
        Global.isVerbose() && console.log('generating release notes from', this.fromHash, 'to', this.toHash ? this.toHash : 'most recent commit');

        return Git
            .commitExists(this.fromHash)
            .then(() => Git.commitExists(this.toHash), commitNotFound(this.fromHash))
            .then(() => Git.log(this.fromHash, this.toHash), commitNotFound(this.toHash))
            .then((log: IGitLogSummary) => this.parseLog(log));

        function commitNotFound(hash: string): () => Promise<null> {
            return () => Promise.reject(`Commit does not exist: ${hash}`);
        }
    }

    private parseLog(log: IGitLogSummary): Promise<void> {
        const relevant = log.all.filter(this.filterRelevantCommits);
        return fs
            .statAsync(GenerateReleaseNotes.DIRECTORY_RELEASE_NOTES)
            .catch(() => fs.mkdirAsync(GenerateReleaseNotes.DIRECTORY_RELEASE_NOTES))
            .catch(() => Promise.reject(`Failed to create directory ${GenerateReleaseNotes.DIRECTORY_RELEASE_NOTES}`))
            .then(() => this.updateMessagesFile(relevant))
            .then((file) => this.readExplicits(file))
            .then((files) => this.generateChangelog(files.messages, files.explicits, log.all));
    }

    private filterRelevantCommits(entry: IGitLogEntry): boolean {
        if (!entry.message) {
            return false;
        }
        for (const p of GenerateReleaseNotes.RELEVANCE_PATTERNS) {
            const regExp = new RegExp(p, 'i');
            if (regExp.test(entry.message)) {
                return true;
            }
        }
    }

    private updateMessagesFile(relevant: IGitLogEntry[]): Promise<ReleaseNotesMessagesFile> {
        const file = new ReleaseNotesMessagesFile(this.messagesFile);
        return file
            .parse()
            .then(() => {
                const missing = file.update(relevant);
                if (missing !== 0) {
                    console.log(`Update revealed ${missing} new entries - ${file.getNumErrors() - missing} were already commented out or in conflict`);
                    return file.write();
                }
            })
            .catch(() => Promise.reject(`Could not write messages file to ${this.messagesFile}`))
            .then(() => {
                if (file.getNumErrors()) {
                    if (this.force) {
                        Global.isVerbose() && console.warn('Some commits are commented out or in conflict in messages - continuing due to force option');
                        return Promise.resolve(file);
                    }
                    return Promise.reject('Cannot generate release notes - some commits are still commented out or in conflict in messages');
                } else {
                    return Promise.resolve(file);
                }
            });
    }

    private readExplicits(messages: ReleaseNotesMessagesFile): Promise<{messages: ReleaseNotesMessagesFile, explicits: ReleaseNotesMessagesFile}> {
        return fs
            .statAsync(this.explicitsFile)
            .then(() => {
                const explicits = new ReleaseNotesMessagesFile(this.explicitsFile);
                return explicits
                    .parse()
                    .then(() => explicits);
            })
            .catch(() => {
                return null;
            })
            .then((explicits) => {
                const result = {
                    messages,
                    explicits
                };

                if (explicits && explicits.getNumErrors()) {
                    if (this.force) {
                        Global.isVerbose() && console.warn('Some commits are commented out or in conflict in explicits - continuing due to force option');
                        return result;
                    }
                    return Promise.reject('Cannot generate release notes - some commits are still commented out or in conflict in explicits');
                }

                return result;
            });
    }

    private generateChangelog(file: ReleaseNotesMessagesFile, explicits: ReleaseNotesMessagesFile | null, log: IGitLogEntry[]): Promise<void> {
        const changelog = [`# Changelog ${new Date().toDateString()}`, ''];

        for (const c of log) {
            const message = file.getMessage(c.hash) || (explicits && explicits.getMessage(c.hash));
            if (message) {
                changelog.push(`   * ${message}`);
            }
        }

        return fs
            .writeFileAsync(GenerateReleaseNotes.FILE_NAME_CHANGELOG, changelog.join('\n'), 'utf8')
            .then(() => {
                console.log(`>> Changelog has successfully been generated in ${GenerateReleaseNotes.FILE_NAME_CHANGELOG}`);
            });
    }
}
