/**
 * General repo based command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {CloneRepos} from './CloneRepos';
import {UpdateRepos} from './UpdateRepos';
import {WriteRepos} from './WriteRepos';
import {BranchRepos} from './BranchRepos';
import {AddDependency} from './AddDependency';

export class Repos implements ICommand {
    public static readonly PARAMETER_BRANCH: string = 'branch';
    public static readonly PARAMETER_BRANCH_SHORT: string = 'b';
    private static readonly PARAMETER_UPDATE: string = 'update';
    private static readonly PARAMETER_UPDATE_SHORT: string = 'u';
    private static readonly PARAMETER_WRITE: string = 'write';
    private static readonly PARAMETER_WRITE_SHORT: string = 'w';
    private static readonly PARAMETER_CLONE: string = 'clone';
    private static readonly PARAMETER_CLONE_SHORT: string = 'c';
    private static readonly PARAMETER_ADD_DEPENDENCY: string = 'add-dependency';
    private static readonly PARAMETER_ADD_DEPENDENCY_SHORT: string = 'd';

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[Repos.PARAMETER_UPDATE] || params[Repos.PARAMETER_UPDATE_SHORT]) {
            this.cmd = new UpdateRepos();
        } else if (params[Repos.PARAMETER_WRITE] || params[Repos.PARAMETER_WRITE_SHORT]) {
            this.cmd = new WriteRepos();
        } else if (params[Repos.PARAMETER_CLONE] || params[Repos.PARAMETER_CLONE_SHORT]) {
            this.cmd = new CloneRepos();
        } else if (params[Repos.PARAMETER_BRANCH] || params[Repos.PARAMETER_BRANCH_SHORT]) {
            this.cmd = new BranchRepos();
        } else if (params[Repos.PARAMETER_ADD_DEPENDENCY] || params[Repos.PARAMETER_ADD_DEPENDENCY_SHORT]) {
            let plugin: string;
            if (params[Repos.PARAMETER_ADD_DEPENDENCY]) {
                plugin = params[Repos.PARAMETER_ADD_DEPENDENCY] as string;
            } else {
                plugin = params[Repos.PARAMETER_ADD_DEPENDENCY_SHORT] as string;
            }
            this.cmd = new AddDependency(plugin);
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
