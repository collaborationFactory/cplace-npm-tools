/**
 * CLI Command relevant models
 */

export interface ICommandParameters {
    [param: string]: number | boolean | string;
}

export interface ICommand {
    prepareAndMayExecute(params: ICommandParameters): boolean;
    execute(): Promise<null>;
}
