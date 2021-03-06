/**
 * Command for checking whether all relevant messages are correctly set
 */
import * as Promise from 'bluebird';
import {IGitLogEntry, Repository} from '../../git';
import {Global} from '../../Global';
import {ICommand, ICommandParameters} from '../models';
import {ReleaseNotesMessagesFile} from './ReleaseNotesMessagesFile';
import {promiseAllSettledParallel} from '../../promiseAllSettled';

export class CheckMessages implements ICommand {
    private static readonly PARAMETER_CHECK_SIZE: string = 'size';

    private logSize: number;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        const checkSize = params[CheckMessages.PARAMETER_CHECK_SIZE];
        if (typeof checkSize === 'number') {
            this.logSize = checkSize;
        } else {
            this.logSize = 100;
        }
        Global.isVerbose() && console.log(`checking ${this.logSize} last commits`);
        return true;
    }

    public execute(): Promise<void> {
        let messages;

        const repo = new Repository();
        return ReleaseNotesMessagesFile
            .getAllMessagesFiles()
            .then((files) => {
                messages = files;
                return promiseAllSettledParallel(files.map((f) => f.parse()));
            })
            .then(() => repo.logLast(this.logSize))
            .then((log) => log.all.filter(ReleaseNotesMessagesFile.filterRelevantCommits))
            .then((relevant) => promiseAllSettledParallel(messages.map((f) => this.checkLog(f, relevant))))
            .then(() => Global.isVerbose() && console.log('successfully checked all files'));
    }

    private checkLog(file: ReleaseNotesMessagesFile, relevant: IGitLogEntry[]): Promise<void> {
        file.update(relevant);
        if (file.getNumErrors()) {
            const msg = `Messages file ${file.getPath()} does not contain all commits`;
            console.error(msg);
            return Promise.reject(msg);
        } else {
            Global.isVerbose() && console.log(`messages file ${file.getPath()} is clean`);
            return Promise.resolve();
        }
    }
}
