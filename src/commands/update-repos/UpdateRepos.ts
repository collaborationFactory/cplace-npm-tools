/**
 * General update-repos command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {DoUpdateRepos} from './DoUpdateRepos';

export class UpdateRepos implements ICommand {

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.cmd = new DoUpdateRepos();
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }
}
