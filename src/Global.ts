/**
 * Global helper class
 */
import {ICommandParameters} from './commands/models';

export class Global {
    private static readonly PARAMETER_VERBOSE: string = 'verbose';
    private static readonly instance: Global = new Global();
    private verbose: boolean;

    private constructor() {
    }

    public static parseParameters(params: ICommandParameters): void {
        Global.instance.verbose = !!params[Global.PARAMETER_VERBOSE];
    }

    public static isVerbose(): boolean {
        return Global.instance.verbose;
    }

}
