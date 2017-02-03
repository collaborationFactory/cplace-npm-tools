/**
 * Command for generating release notes
 */
import * as Promise from 'bluebird';
import {Git, IGitLogEntry, IGitLogSummary} from '../../git';
import {fs} from '../../p/fs';
import {ICommand, ICommandParameters} from '../models';
import {ReleaseNotesMessagesFile} from './ReleaseNotesMessagesFile';

export class GenerateReleaseNotes implements ICommand {
    private static readonly PARAMETER_FROM: string = 'from';
    private static readonly PARAMETER_TO: string = 'to';
    private static readonly PARAMETER_LANG: string = 'lang';

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

    private messagesFile: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        const fromHash = params[GenerateReleaseNotes.PARAMETER_FROM] as string;
        if (!fromHash) {
            throw Error(`Missing required parameter "${GenerateReleaseNotes.PARAMETER_FROM}"`);
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

        this.messagesFile = `${GenerateReleaseNotes.DIRECTORY_RELEASE_NOTES}/messages_${this.lang}.db`;

        return true;
    }

    public execute(): Promise<void> {
        console.log('generating release notes from', this.fromHash, 'to', this.toHash ? this.toHash : 'most recent commit');

        return Git
            .commitExists(this.fromHash)
            .then(() => Git.commitExists(this.toHash), commitNotFound(this.fromHash))
            .then(() => Git.log(this.fromHash, this.toHash), commitNotFound(this.fromHash))
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
            .then((file) => this.generateChangelog(file, relevant));
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
                    return Promise.reject('Cannot generate release notes - some required commits are still commented out or in conflict');
                } else {
                    return Promise.resolve(file);
                }
            });
    }

    private generateChangelog(file: ReleaseNotesMessagesFile, relevant: IGitLogEntry[]): Promise<void> {
        const changelog = [`# Changelog ${new Date().toDateString()}`, ''];

        for (const r of relevant) {
            const message = file.getMessage(r.hash);
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
