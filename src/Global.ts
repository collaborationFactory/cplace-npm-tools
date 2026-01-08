/**
 * Global helper class
 */
import {ICommandParameters} from './commands/models';

export class Global {
    public static readonly PARAMETER_VERBOSE: string = 'verbose';
    public static readonly PARAMETER_GIT_RETRY_COUNT: string = 'gitRetryCount';
    private static readonly instance: Global = new Global();
    private verbose: boolean;
    private gitRetryCount: number;

    private constructor() {
    }

    public static parseParameters(params: ICommandParameters): void {
        Global.instance.verbose = !!params[Global.PARAMETER_VERBOSE];

        // Parse git retry count with type validation and default
        const retryCount = params[Global.PARAMETER_GIT_RETRY_COUNT];
        if (typeof retryCount === 'number' && !isNaN(retryCount) && retryCount > 0) {
            Global.instance.gitRetryCount = retryCount;
        } else {
            Global.instance.gitRetryCount = 3;
        }
    }

    public static isVerbose(): boolean {
        return Global.instance.verbose;
    }

    public static getGitRetryCount(): number {
        return Global.instance.gitRetryCount || 3;
    }
}
