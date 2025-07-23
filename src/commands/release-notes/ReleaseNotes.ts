/**
 * General release-notes command
 */
import {ICommand, ICommandParameters} from '../models';
import {CheckMessages} from './CheckMessages';
import {GenerateReleaseNotes} from './GenerateReleaseNotes';
import {MergeReleaseNotes} from './MergeReleaseNotes';

export class ReleaseNotes implements ICommand {
    private static readonly PARAMETER_MERGE: string = 'merge';
    private static readonly PARAMETER_CHECK: string = 'check';

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[ReleaseNotes.PARAMETER_MERGE] === true) {
            this.cmd = new MergeReleaseNotes();
        } else if (params[ReleaseNotes.PARAMETER_CHECK] === true) {
            this.cmd = new CheckMessages();
        } else {
            this.cmd = new GenerateReleaseNotes();
        }
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }

}
