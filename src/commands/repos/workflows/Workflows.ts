/**
 * General workflows command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../../models';
import {WorkflowsList} from './WorkflowsList';
import {WorkflowsAdd} from './WorkflowsAdd';

export class Workflows implements ICommand {
    public static readonly PARAMETER_LIST: string = 'list';
    public static readonly PARAMETER_ADD_WORKFLOWS: string = 'addWorkflows';
    public static readonly PARAMETER_ADD_WORKFLOWS_KEBAB: string = 'add-workflows';

    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[Workflows.PARAMETER_LIST]) {
            this.cmd = new WorkflowsList();
        } else if (params[Workflows.PARAMETER_ADD_WORKFLOWS] || params[Workflows.PARAMETER_ADD_WORKFLOWS_KEBAB]) {
            this.cmd = new WorkflowsAdd();
        } else {
            console.error('Error: Unknown or missing workflows subcommand!');
            return false;
        }
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }
}