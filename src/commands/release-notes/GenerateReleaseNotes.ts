/**
 * Command for generating release notes
 */
import {IGitLogEntry, IGitLogSummary, Repository} from '../../git';
import {Global} from '../../Global';
import {fs} from '../../p/fs';
import {ICommand, ICommandParameters} from '../models';
import {ReleaseNotesMessagesFile} from './ReleaseNotesMessagesFile';

export class GenerateReleaseNotes implements ICommand {
    private static readonly PARAMETER_FROM: string = 'from';
    private static readonly PARAMETER_TO: string = 'to';
    private static readonly PARAMETER_LANG: string = 'lang';

    private static readonly PARAMETER_FORCE: string = 'force';

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

        this.messagesFile = ReleaseNotesMessagesFile.getPathToMessages(this.lang);
        this.explicitsFile = ReleaseNotesMessagesFile.getPathToExplicits(this.lang);

        return true;
    }

    public async execute(): Promise<void> {
        Global.isVerbose() && console.log('generating release notes from', this.fromHash, 'to', this.toHash);

        const repo = new Repository();
        try {
            this.fromHash = await repo.commitExists(this.fromHash);
            Global.isVerbose() && console.log(`from commit has hash ${this.fromHash}`);
        } catch {
            throw new Error(`Commit does not exist: ${this.fromHash}`);
        }

        try {
            this.toHash = await repo.commitExists(this.toHash);
            Global.isVerbose() && console.log(`to commit has hash ${this.toHash}`);
        } catch {
            throw new Error(`Commit does not exist: ${this.toHash}`);
        }

        const log = await repo.log(this.fromHash, this.toHash);
        return await this.parseLog(log);
    }

    private async parseLog(log: IGitLogSummary): Promise<void> {
        const relevant = log.all.filter(ReleaseNotesMessagesFile.filterRelevantCommits);
        try {
            await fs.statAsync(ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES);
        } catch {
            try {
                await fs.mkdirAsync(ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES);
            } catch {
                throw new Error(`Failed to create directory ${ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES}`);
            }
        }

        const file = await this.updateMessagesFile(relevant);
        const files = await this.readExplicits(file);
        await this.generateChangelog(files.messages, files.explicits, log.all);
    }

    private async updateMessagesFile(relevant: IGitLogEntry[]): Promise<ReleaseNotesMessagesFile> {
        const file = new ReleaseNotesMessagesFile(this.messagesFile);
        await file.parse();

        const missing = file.update(relevant);
        if (missing !== 0) {
            console.log(`Update revealed ${missing} new entries - ${file.getNumErrors()} are now commented out or in conflict`);
            try {
                await file.write();
                return file;
            } catch {
                throw new Error(`Could not write messages file to ${this.messagesFile}`);
            }
        }

        if (file.getNumErrors()) {
            if (this.force) {
                Global.isVerbose() && console.warn('Some commits are commented out or in conflict in messages - continuing due to force option');
                return file;
            }
            throw new Error('Cannot generate release notes - some commits are still commented out or in conflict in messages');
        } else {
            return file;
        }
    }

    private async readExplicits(messages: ReleaseNotesMessagesFile): Promise<{ messages: ReleaseNotesMessagesFile, explicits: ReleaseNotesMessagesFile }> {
        await fs.statAsync(this.explicitsFile);

        const explicits = new ReleaseNotesMessagesFile(this.explicitsFile);
        try {
            await explicits.parse();
        } catch {
            return {messages, explicits: null};
        }

        const result = {
            messages,
            explicits
        };

        if (explicits && explicits.getNumErrors()) {
            if (this.force) {
                Global.isVerbose() && console.warn('Some commits are commented out or in conflict in explicits - continuing due to force option');
                return result;
            }
            throw new Error('Cannot generate release notes - some commits are still commented out or in conflict in explicits');
        }

        return result;
    }

    private async generateChangelog(file: ReleaseNotesMessagesFile, explicits: ReleaseNotesMessagesFile | null, log: IGitLogEntry[]): Promise<void> {
        const changelog = [`# Changelog ${new Date().toDateString()}`, ''];

        changelog.push('');
        changelog.push(`_Commit range: ${this.fromHash} - ${this.toHash}_`);
        changelog.push('');

        for (const c of log) {
            const message = file.getMessage(c.hash) || (explicits && explicits.getMessage(c.hash));
            if (message) {
                changelog.push(`   * ${message}`);
            }
        }

        await fs.writeFileAsync(GenerateReleaseNotes.FILE_NAME_CHANGELOG, changelog.join('\n'), 'utf8');
        console.log(`>> Changelog has successfully been generated in ${GenerateReleaseNotes.FILE_NAME_CHANGELOG}`);
    }
}
