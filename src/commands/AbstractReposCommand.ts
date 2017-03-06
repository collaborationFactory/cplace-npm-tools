/**
 * Abstract repos command
 */

import * as Promise from 'bluebird';
import {FLAG_VERBOSE} from '../cli';
import {fs} from '../p/fs';
import {ICommand, ICommandParameters} from './models';

export const propertiesFileName = 'parent-repos.json';

export abstract class AbstractReposCommand implements ICommand {

    public debug: boolean;

    public obj: {};

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.debug = params[FLAG_VERBOSE] as boolean;
        if (this.debug) {
            console.log('running in verbose mode');
        }

        this.obj = JSON.parse(fs.readFileSync(propertiesFileName, 'utf8'));
        if (this.debug) {
            console.log('properties', this.obj);
        }

        return true;
    }

    public abstract execute(): Promise<void>;
}
