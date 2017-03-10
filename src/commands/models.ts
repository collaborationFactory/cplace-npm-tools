/**
 * CLI Command relevant models
 */
import * as Promise from 'bluebird';

export interface ICommandParameters {
    [param: string]: number | boolean | string;
}

export interface ICommand {
    prepareAndMayExecute(params: ICommandParameters): boolean;
    execute(): Promise<void>;
}