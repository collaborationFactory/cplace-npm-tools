/**
 * Command Runner implementation
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from './models';
import {ReleaseNotes} from './release-notes';
import {Repos} from './repos';
import {VisualizeDelegate} from './visualize';

const REGISTERED_COMMANDS: {[cmd: string]: ICommand} = {
    'release-notes': new ReleaseNotes(),
    'visualize': new VisualizeDelegate(),
    'repos': new Repos()
};

export type Result = 'missing' | 'failed' | 'success';

export function run(cmd: string, params: ICommandParameters): Promise<Result> {
    if (!REGISTERED_COMMANDS.hasOwnProperty(cmd)) {
        console.error('UNKNOWN COMMAND:', cmd);
        return Promise.reject('missing');
    }

    const command = REGISTERED_COMMANDS[cmd];
    if (!command.prepareAndMayExecute(params)) {
        return Promise.reject('failed');
    }

    return command
        .execute()
        .then(
            () => Promise.resolve('success'),
            (e) => Promise.reject(e)
        );
}
