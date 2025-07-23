/**
 * Global helper class
 */
import type { ICommandParameters } from './types/commands.js';
export declare class Global {
    static readonly PARAMETER_VERBOSE: string;
    private static readonly instance;
    private verbose;
    private constructor();
    static parseParameters(params: ICommandParameters): void;
    static isVerbose(): boolean;
}
