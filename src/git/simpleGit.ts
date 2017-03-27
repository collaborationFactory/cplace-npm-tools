/**
 * Git functions
 */
import {HandlerFunction} from 'simple-git';

declare module 'simple-git' {
    /* tslint:disable */

    // tslint disabled due to interface definition to fix simpleGit declaration
    interface BranchSummary {
        detached: boolean;
        current: string;
        all: string[];
        branches: {
            [branch: string]: BranchDetails
        }
    }

    interface BranchDetails {
        current: boolean;
        name: string;
        commit: string;
        label: string;
    }

    interface Git {

        revparse(args: string[], handlerFn: HandlerFunction): Git;

        log(options: string[] | {
            from?: string,
            to?: string
            file?: string
            splitter?: string,
            format?: Object
        }, handlerFn: HandlerFunction): Git;

        branch(options: string[], handlerFn: (error: any, branchSummary: BranchSummary) => void): Git;
    }

    /* tslint:enable */
}
