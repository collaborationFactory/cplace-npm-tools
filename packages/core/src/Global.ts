/**
 * Global helper class
 */
import type { ICommandParameters } from './types/commands.js';

export class Global {
    public static readonly PARAMETER_VERBOSE: string = 'verbose';
    private static readonly instance: Global = new Global();
    private verbose: boolean = false;

    private constructor() {
    }

    public static parseParameters(params: ICommandParameters): void {
        Global.instance.verbose = !!params[Global.PARAMETER_VERBOSE];
    }

    public static isVerbose(): boolean {
        return Global.instance.verbose;
    }
}