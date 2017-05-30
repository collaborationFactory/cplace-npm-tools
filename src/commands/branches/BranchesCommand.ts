/**
 * General branches command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {Global} from '../../Global';
import {Repository} from '../../git/Repository';
import {IGitRemoteBranchesAndCommits} from '../../git/models';
import * as os from 'os';
import {fs} from '../../p/fs';

export class BranchesCommand implements ICommand {

    private static readonly FILE_NAME_BRANCHES_DOT: string = 'branches.dot';

    private static readonly FILE_NAME_BRANCHES_PNG: string = 'branches.png';

    private branches2containingBranches: Map<string, string[]> = new Map();

    private reducedBranches2containingBranches: Map<string, string[]> = new Map();

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        return true;
    }

    public execute(): Promise<void> {
        Global.isVerbose() && console.log('running branches command in verbose mode');

        const repo = new Repository();

        console.log('Collecting branches...');
        return repo.getRemoteBranchesAndCommits().then((result: IGitRemoteBranchesAndCommits[]) => {
            console.log('Collecting branch dependencies...');
            return Promise.all(result.map((branchAndCommit: IGitRemoteBranchesAndCommits) => {
                return repo.getRemoteBranchesContainingCommit(branchAndCommit.commit).then((branches: string[]) => {
                    const index = branches.indexOf(branchAndCommit.branch);
                    if (index > -1) {
                        branches.splice(index, 1);
                    }
                    if (branches.length > 0) {
                        Global.isVerbose() && console.log('branch ' + branchAndCommit.branch + ' is contained in these branches: ' + branches);
                        Global.isVerbose() && console.log('');
                        branches.forEach((b: string) => {
                            this.put(branchAndCommit.branch, b);
                        });
                    }
                });
            })).then(() => {
                console.log('Reducing dependencies...');
                this.reduce();
            }).then(() => {
                console.log('Generating dot file...');
                return fs
                    .writeFileAsync(BranchesCommand.FILE_NAME_BRANCHES_DOT, this.generateDot(this.reducedBranches2containingBranches), 'utf8')
                    .then(() => {
                        console.log(`>> dot file has successfully been graphgenerated in ${BranchesCommand.FILE_NAME_BRANCHES_DOT}`);
                        console.log('>> now you can generate a png file with graphviz:');
                        console.log(`>> dot -Tpng ${BranchesCommand.FILE_NAME_BRANCHES_DOT} > ${BranchesCommand.FILE_NAME_BRANCHES_PNG}`);
                    });
            });
        });
    }

    private generateDot(branches2containingBranches: Map<string, string[]>): string {
        const eol = os.EOL;
        let dotString = 'digraph G {' + eol;
        branches2containingBranches.forEach((containingBranches, branch, map) => {
            containingBranches.forEach((containingBranch) => {
                dotString += '    "' + branch + '" -> "' + containingBranch + '";' + eol;
            });
            if (branch.indexOf('release/') === 0) {
                dotString += '    "' + branch + '" [style=bold,color="red"];' + eol;
            }
            if (branch.indexOf('customer/') === 0) {
                dotString += '    "' + branch + '" [style=bold,color="blue"];' + eol;
            }
            if (branch.indexOf('master') === 0) {
                dotString += '    "' + branch + '" [style=bold,color="green"];' + eol;
            }
        });
        dotString += '}';
        Global.isVerbose() && console.log('dotString: ' + dotString);
        return dotString;
    }

    private put(branch: string, containingBranch: string): void {
        let containingBranches;
        if (this.branches2containingBranches.has(branch)) {
            containingBranches = this.branches2containingBranches.get(branch);
        } else {
            containingBranches = [];
            this.branches2containingBranches.set(branch, containingBranches);
        }
        if (containingBranches.indexOf(containingBranch) >= 0) {
            return;
        } else {
            containingBranches.push(containingBranch);
        }
    }

    private reduce(): void {
        Global.isVerbose() && console.log('reducing');

        // cloning into reducedBranches2containingBranches
        this.branches2containingBranches.forEach((containingBranches, branch, map) => {
            this.reducedBranches2containingBranches.set(branch, containingBranches.slice(0));
        });

        // reducing
        this.branches2containingBranches.forEach((containingBranches, branch, map) => {
            containingBranches.forEach((containingBranch) => {
                this.reduceEdge(branch, containingBranch);
            });
        });
    }

    private reduceEdge(branch: string, containingBranch: string): void {
        Global.isVerbose() && console.log('reducing ' + branch + ' -> ' + containingBranch);
        while (this.edgeHasBeenRemoved(branch, containingBranch)) {
            Global.isVerbose() && console.log('edge has been removed');
        }
    }

    private edgeHasBeenRemoved(branch: string, containingBranch: string): boolean {
        this.reducedBranches2containingBranches.forEach((cbs, b, map) => {
            const indexOfContainingBranch = cbs.indexOf(containingBranch);
            const cbsContainsBoth = cbs.indexOf(branch) >= 0 && indexOfContainingBranch >= 0;
            if (cbsContainsBoth) {
                cbs.splice(indexOfContainingBranch, 1);
                // Global.isVerbose() && console.log(this.generateDot(this.reducedBranches2containingBranches));
                return true;
            }
        });
        return false;
    }
}
