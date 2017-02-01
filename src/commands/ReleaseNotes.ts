/**
 * Command for generating release notes
 */
import {Git} from '../git';
import {ICommand, ICommandParameters} from './models';

export class ReleaseNotes implements ICommand {
    private static readonly PARAMETER_FROM: string = 'from';
    private static readonly PARAMETER_TO: string = 'to';

    private fromHash: string;
    private toHash: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        const fromHash = params[ReleaseNotes.PARAMETER_FROM] as string;
        if (!fromHash) {
            throw Error(`Missing required parameter "${ReleaseNotes.PARAMETER_FROM}"`);
        }
        this.fromHash = String(fromHash);

        const toHash = params[ReleaseNotes.PARAMETER_TO] as string;
        if (toHash) {
            this.toHash = String(toHash);
        } else {
            this.toHash = 'HEAD';
        }

        return true;
    }

    public execute(): Promise<null> {
        console.log('generating release notes from', this.fromHash, 'to', this.toHash ? this.toHash : 'most recent commit');

        return Git
            .commitExists(this.fromHash)
            .then(() => Git.commitExists(this.toHash), commitNotFound(this.fromHash))
            .then(
                () => {
                    console.log('done');
                },
                commitNotFound(this.fromHash)
            );

        function commitNotFound(hash: string): () => Promise<null> {
            return () => Promise.reject(`Commit does not exist: ${hash}`);
        }
    }

}
