/**
 * Main flow command
 */
import {ICommand, ICommandParameters} from '../models';
import {Upmerge} from './Upmerge';
import {SplitRepository} from './SplitRepository';

export class Flow implements ICommand {
    private static readonly PARAMETER_UPMERGE: string = 'upmerge';
    private static readonly SPLIT_REPOSITORY: string = 'splitRepository';

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[Flow.PARAMETER_UPMERGE]) {
            this.cmd = new Upmerge();
        } else if (params[Flow.SPLIT_REPOSITORY]) {
            this.cmd = new SplitRepository();
        } else {
            console.error('unknown flow command');
            return false;
        }
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }

}
