/**
 * CLI Command relevant models
 */

export interface ICommandParameters {
    [param: string]: unknown;
}

export interface ICommand {
    prepareAndMayExecute(params: ICommandParameters): boolean;
    execute(): Promise<void>;
}