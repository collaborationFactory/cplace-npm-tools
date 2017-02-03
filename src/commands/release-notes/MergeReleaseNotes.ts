/**
 * Custom Git Driver for merging release note files
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {ReleaseNotesMessagesFile} from './ReleaseNotesMessagesFile';

export class MergeReleaseNotes implements ICommand {
    public static readonly PARAMETER_CURRENT: string = 'current';
    public static readonly PARAMETER_OTHER: string = 'other';

    private pathToCurrent: string;
    private pathToOther: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.pathToCurrent = params[MergeReleaseNotes.PARAMETER_CURRENT] as string;
        if (!this.pathToCurrent) {
            console.error(`missing "${MergeReleaseNotes.PARAMETER_CURRENT}" parameter`);
            return false;
        }
        this.pathToOther = params[MergeReleaseNotes.PARAMETER_OTHER] as string;
        if (!this.pathToOther) {
            console.error(`missing "${MergeReleaseNotes.PARAMETER_OTHER}" parameter`);
            return false;
        }

        return true;
    }

    public execute(): Promise<void> {
        const current = new ReleaseNotesMessagesFile(this.pathToCurrent);
        const other = new ReleaseNotesMessagesFile(this.pathToOther);

        return current.parse()
            .then(() => other.parse())
            .then(() => {
                const conflicts = current.merge(other);
                return current
                    .write()
                    .then(() => {
                        console.log('Had conflicts:', conflicts);
                    });
            });
    }

}
