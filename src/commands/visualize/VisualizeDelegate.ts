/**
 * Visualize command
 */
import {ICommand, ICommandParameters} from '../models';
import {VisualizeCommand} from './VisualizeCommand';

export class VisualizeDelegate implements ICommand {

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.cmd = new VisualizeCommand();
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }

}
