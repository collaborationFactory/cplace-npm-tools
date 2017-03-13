/**
 * Git functions
 */
import {HandlerFunction} from 'simple-git';

declare module 'simple-git' {
    /* tslint:disable */
    // tslint disabled due to interface definition to fix simpleGit declaration
    interface Git {
        revparse(args: string[], handlerFn: HandlerFunction): Git;

        log(options: string[] | {
            from?: string,
            to?: string
            file?: string
            splitter?: string,
            format?: Object
        }, handlerFn: HandlerFunction): Git;
    }
    /* tslint:enable */
}
