/**
 * General repo based command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {CloneRepos} from './CloneRepos';
import {UpdateRepos} from './UpdateRepos';
import {WriteRepos} from './WriteRepos';

export class Repos implements ICommand {
    private static readonly PARAMETER_UPDATE: string = 'update';
    private static readonly PARAMETER_UPDATE_SHORT: string = 'u';
    private static readonly PARAMETER_WRITE: string = 'write';
    private static readonly PARAMETER_WRITE_SHORT: string = 'w';
    private static readonly PARAMETER_CLONE: string = 'clone';
    private static readonly PARAMETER_CLONE_SHORT: string = 'c';

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[Repos.PARAMETER_UPDATE] || params[Repos.PARAMETER_UPDATE_SHORT]) {
            this.cmd = new UpdateRepos();
        } else if (params[Repos.PARAMETER_WRITE] || params[Repos.PARAMETER_WRITE_SHORT]) {
            this.cmd = new WriteRepos();
        } else if (params[Repos.PARAMETER_CLONE] || params[Repos.PARAMETER_CLONE_SHORT]) {
            this.cmd = new CloneRepos();
        } else {
            console.error('unknown repos command');
            return false;
        }
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }

}
