/**
 * General branches command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {BranchesCommand} from './BranchesCommand';

export class BranchesDelegate implements ICommand {

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.cmd = new BranchesCommand();
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }

}
