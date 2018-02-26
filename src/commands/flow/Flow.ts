/**
 * Main flow command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {Upmerge} from './Upmerge';

export class Flow implements ICommand {
    private static readonly PARAMETER_UPMERGE: string = 'upmerge';

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[Flow.PARAMETER_UPMERGE]) {
            this.cmd = new Upmerge();
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
