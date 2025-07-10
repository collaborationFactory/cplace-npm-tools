/**
 * Command Runner implementation
 */
import * as Promise from 'bluebird';
import {Flow} from './flow';
import {ICommand, ICommandParameters} from './models';
import {ReleaseNotes} from './release-notes';
import {Repos} from './repos';
import {VisualizeDelegate} from './visualize';
import {RefactorDelegate} from './refactor';
import {E2E} from './e2e';
import {Version} from "./version";

export class UnknownCommandError extends Error {
    constructor(command: string) {
        super(`Unknown command: ${command}`);
        this.name = 'UnknownCommandError';
    }
}

const REGISTERED_COMMANDS: { [cmd: string]: ICommand } = {
    'release-notes': new ReleaseNotes(),
    'repos': new Repos(),
    'flow': new Flow(),
    'visualize': new VisualizeDelegate(),
    'refactor': new RefactorDelegate(),
    'e2e': new E2E(),
    'version': new Version()
};

export type Result = 'missing' | 'failed' | 'success';

export function run(cmd: string, params: ICommandParameters): Promise<Result> {

    if(REGISTERED_COMMANDS[cmd] === undefined) {
        return Promise.reject(new UnknownCommandError(cmd));
    }

    const command = REGISTERED_COMMANDS[cmd];
    if (!command.prepareAndMayExecute(params)) {
        return Promise.reject('failed to prepare command');
    }

    return command
        .execute()
        .then(
            () => Promise.resolve('success'),
            (e) => Promise.reject(e)
        );
}
