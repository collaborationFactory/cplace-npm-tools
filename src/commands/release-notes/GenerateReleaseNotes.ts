/**
 * Command for generating release notes
 */
import { IGitLogEntry, IGitLogSummary, Repository } from '../../git';
import { Global } from '../../Global';
import { fs } from '../../p/fs';
import { ICommand, ICommandParameters } from '../models';
import { ReleaseNotesMessagesFile } from './ReleaseNotesMessagesFile';
import { ReleaseNumber } from '../flow/ReleaseNumber';
import { execSync } from 'child_process';
import * as path from 'path';

export class GenerateReleaseNotes implements ICommand {
    private static readonly PARAMETER_FROM: string = 'from';
    private static readonly PARAMETER_TO: string = 'to';
    private static readonly PARAMETER_LANG: string = 'lang';
    private static readonly PARAMETER_RELEASE: string = 'release';
    private static readonly PARAMETER_DOCS: string = 'docs';

    private static readonly PARAMETER_FORCE: string = 'force';

    private static readonly FILE_NAME_CHANGELOG: string = 'CHANGELOG.md';

    private fromHash: string;
    private toHash: string;
    private lang: string;
    private force: boolean;
    private release: ReleaseNumber = null;

    private messagesFile: string;
    private explicitsFile: string;
    private repo: Repository;
    private changelog: string[];
    private generateMarkdownForDocs: boolean = false;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        let release = params[GenerateReleaseNotes.PARAMETER_RELEASE] as string;
        if (release) {
            release = release.replace('release/', '');
            this.release = ReleaseNumber.parse(release);
        }

        const docs = params[GenerateReleaseNotes.PARAMETER_DOCS] as boolean;
        if (docs) {
            this.generateMarkdownForDocs = docs;
        }

        const fromHash = params[GenerateReleaseNotes.PARAMETER_FROM] as string;
        if (!release && !fromHash) {
            console.error(`Missing required parameter '${GenerateReleaseNotes.PARAMETER_FROM}'`);
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
        this.repo = new Repository();

        if (this.release) {
            console.log('generating changelogs for release branch: ', this.release.releaseBranchName());
            const predecessorReleaseBranch = this.release.getMajorOrMinorPredecessorRelease().releaseBranchName();
            if (this.repo.checkBranchExistsOnRemote(this.release.releaseBranchName()) && this.repo.checkBranchExistsOnRemote(predecessorReleaseBranch)) {
                const fetchAll = execSync(`git fetch --all`).toString();
                Global.isVerbose() && console.log(fetchAll);
                this.fromHash = execSync(`git log -n 1 --pretty=format:"%H" origin/${this.release.getMajorOrMinorPredecessorRelease().releaseBranchName()}`).toString();
                this.toHash = execSync(`git log -n 1 --pretty=format:"%H" origin/${this.release.releaseBranchName()}`).toString();
            } else {
                console.error(`Either given release branch or branch of predecessor release does not exist on remote.`);
                process.exit(1);
            }
        } else {
            console.log(`generating changelogs for given --from Hash ${this.fromHash} and --to Hash ${this.toHash}`);
            try {
                this.fromHash = await this.repo.commitExists(this.fromHash);
                Global.isVerbose() && console.log(`from commit has hash ${this.fromHash}`);
            } catch {
                throw new Error(`Commit does not exist: ${this.fromHash}`);
            }

            try {
                this.toHash = await this.repo.commitExists(this.toHash);
                Global.isVerbose() && console.log(`--to commit has hash ${this.toHash}`);
            } catch {
                throw new Error(`Commit does not exist: ${this.toHash}`);
            }
        }

        console.log(`commits for --from Hash ${this.fromHash} and --to Hash ${this.toHash} exist `);
        const log = await this.repo.log(this.fromHash, this.toHash);
        return await this.parseLog(log);
    }

    public sortLogs(logs: IGitLogEntry[]): IGitLogEntry[] {
        logs = this.assignAndFilterForSquad(logs);
        return logs.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (a.squad === b.squad) {
                return dateA < dateB ? -1 : 1;
            } else {
                return a.squad < b.squad ? -1 : 1;
            }
        });
    }

    public assignAndFilterForSquad(logs: IGitLogEntry[]): IGitLogEntry[] {
        const filteredLogs: IGitLogEntry[] = [];
        const regExp = /changelog:[\s\w]+[-]*[\s\w]+:/;
        for (const log of logs) {
            if (log.message.match(regExp)) {
                log.squad = log.message.match(regExp)[0]?.replace('changelog:', '')
                    .replace(':', '')
                    .trim();
                filteredLogs.push(log);
            }
        }
        return filteredLogs;
    }

    private async parseLog(log: IGitLogSummary): Promise<void> {
        const relevant = log.all.filter(ReleaseNotesMessagesFile.filterRelevantCommits);
        if (!fs.existsSync(ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES)) {
            fs.mkdirSync(ReleaseNotesMessagesFile.DIRECTORY_RELEASE_NOTES);
        }

        const file = await this.updateMessagesFile(relevant);
        const files = await this.readExplicits(file);
        if (this.generateMarkdownForDocs) {
            this.generateChangelogDocs(files.messages, files.explicits, log.all);
        } else {
            this.generateChangelogCircleCi(files.messages, files.explicits, log.all);
        }
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
            throw new Error('Cannot generate changelogs - some commits are still commented out or in conflict in messages');
        } else {
            return file;
        }
    }

    private async readExplicits(messages: ReleaseNotesMessagesFile): Promise<{ messages: ReleaseNotesMessagesFile; explicits: ReleaseNotesMessagesFile }> {
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
            throw new Error('Cannot generate changelogs - some commits are still commented out or in conflict in explicits');
        }

        return result;
    }

    private generateChangelogCircleCi(file: ReleaseNotesMessagesFile, explicits: ReleaseNotesMessagesFile | null, log: IGitLogEntry[]): void {
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

        fs.writeFileSync(GenerateReleaseNotes.FILE_NAME_CHANGELOG, changelog.join('\n'), 'utf8');
        console.log(`>> Changelog has successfully been generated in ${GenerateReleaseNotes.FILE_NAME_CHANGELOG}`);
    }

    private generateChangelogDocs(file: ReleaseNotesMessagesFile, explicits: ReleaseNotesMessagesFile | null, log: IGitLogEntry[]): void {
        this.changelog = [`_Changelog created on ${new Date().toDateString()}_`];
        if (this.release) {
            this.changelog.push(`_for ${this.release.releaseBranchName()}_`);
        }
        this.changelog.push(' ', `_Commit range: ${this.fromHash} - ${this.toHash}_`, '');

        log = this.sortLogs(log);
        const remoteUrl = execSync('git config --get remote.origin.url')
            .toString()?.replace('.git', '')
            .replace(/(\r\n|\n|\r)/gm, '')
            .replace('git@github.com:collaborationFactory', 'https://github.com/collaborationFactory');

        if (!remoteUrl) {
            throw new Error(`Remote url of your local git repository doesn't exist.`);
        }
        for (const c of log) {
            const message = file.getMessage(c.hash) || (explicits && explicits.getMessage(c.hash));
            if (message) {
                const prNumber = message.split('#')[1]?.replace(']', '').trim();
                if (prNumber && remoteUrl) {
                    this.changelog.push(`   * ${message}(${remoteUrl}/pull/${prNumber})`);
                } else {
                    this.changelog.push(`   * ${message}`);
                }
            }
        }

        fs.writeFileSync(GenerateReleaseNotes.FILE_NAME_CHANGELOG, this.changelog.join('\n'), 'utf8');
        console.log(`>> Changelog has successfully been generated in ${GenerateReleaseNotes.FILE_NAME_CHANGELOG}`);
        this.createMarkdownForCplaceDocs();
    }

    private createMarkdownForCplaceDocs(): void {
        const pathToReleaseNotesInMarkdown = path.join(this.repo.baseDir, 'documentation', 'changelog', `_index.md`);

        const markdownHeader = `---
title: "Changelog"
weight: "10"
type: "section"
---
`;
        if (!fs.existsSync(pathToReleaseNotesInMarkdown)) {
            fs.mkdirSync(path.join(this.repo.baseDir, 'documentation', 'changelog'), {recursive: true});
        }
        fs.writeFileSync(pathToReleaseNotesInMarkdown, markdownHeader + ' ' + this.changelog.join('\n'), 'utf8');
        console.log(`>> Changelog has successfully been generated in ${path.join(process.cwd(), pathToReleaseNotesInMarkdown)}`);
    }
}
