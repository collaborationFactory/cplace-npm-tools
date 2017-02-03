/**
 * General release-notes command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {GenerateReleaseNotes} from './GenerateReleaseNotes';
import {MergeReleaseNotes} from './MergeReleaseNotes';

export class ReleaseNotes implements ICommand {
    private static readonly PARAMETER_MERGE: string = 'merge';

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[ReleaseNotes.PARAMETER_MERGE] === true) {
            this.cmd = new MergeReleaseNotes();
        } else {
            this.cmd = new GenerateReleaseNotes();
        }
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }

}
