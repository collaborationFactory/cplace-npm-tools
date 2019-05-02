/**
 * Main flow command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {Upmerge} from './Upmerge';
import {ProjectPlanningRefactor} from './ProjectPlanningRefactor';

export class Flow implements ICommand {
    private static readonly PARAMETER_UPMERGE: string = 'upmerge';
    private static readonly PROJECT_PLANNING_REFACTOR: string = 'projectPlanningRefactor';

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[Flow.PARAMETER_UPMERGE]) {
            this.cmd = new Upmerge();
        } else if (params[Flow.PROJECT_PLANNING_REFACTOR]) {
            this.cmd = new ProjectPlanningRefactor();
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
