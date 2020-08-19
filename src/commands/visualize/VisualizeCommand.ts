/**
 * General branches command
 */
import * as Promise from 'bluebird';
import {ICommand, ICommandParameters} from '../models';
import {Global} from '../../Global';
import {Repository} from '../../git';
import * as os from 'os';
import {fs} from '../../p/fs';
import {exec} from 'child_process';
import {promiseAllSettledParallel} from '../../promiseAllSettled';

export class VisualizeCommand implements ICommand {

    private static readonly FILE_NAME_BRANCHES_DOT: string = 'branches.dot';
    private static readonly FILE_NAME_BRANCHES_PNG: string = 'branches.png';
    private static readonly FILE_NAME_BRANCHES_PDF: string = 'branches.pdf';
    private static readonly PARAMETER_BRANCHES_REGEX_FOR_EXCLUSION: string = 'regexForExclusion';
    private static readonly PARAMETER_BRANCHES_REGEX_FOR_INCLUSION: string = 'regexForInclusion';
    private static readonly PARAMETER_PDF: string = 'pdf';

    private branches2containingBranches: Map<string, string[]> = new Map();
    private reducedBranches2containingBranches: Map<string, string[]> = new Map();
    private styledBranches: string[] = [];
    private regexForExclusion: string;
    private regexForInclusion: string;
    private pdf: boolean;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        for (const param of Object.keys(params)) {
            Global.isVerbose() && console.log('param', param);
        }
        const regexForExclusion = params[VisualizeCommand.PARAMETER_BRANCHES_REGEX_FOR_EXCLUSION] as string;
        if (regexForExclusion) {
            this.regexForExclusion = String(regexForExclusion);
        } else {
            this.regexForExclusion = String('HEAD|attic\/.*');
        }
        Global.isVerbose() && console.log(`using regexForExclusion ${this.regexForExclusion} for branch filtering`);

        const regexForInclusion = params[VisualizeCommand.PARAMETER_BRANCHES_REGEX_FOR_INCLUSION] as string;
        if (regexForInclusion) {
            this.regexForInclusion = String(regexForInclusion);
        } else {
            this.regexForInclusion = String('');
        }
        this.pdf = params[VisualizeCommand.PARAMETER_PDF] === true;

        Global.isVerbose() && console.log(`using regexForInclusion ${this.regexForInclusion} for branch filtering`);
        return true;
    }

    public execute(): Promise<void> {
        Global.isVerbose() && console.log('running branches command in verbose mode');

        const repo = new Repository();

        console.log('Collecting branches...');
        return repo.getRemoteBranchesAndCommits(this.regexForExclusion, this.regexForInclusion)
            .then((result) => {
                console.log('Collecting branch dependencies...');
                const branchPromises = result.map((branchAndCommit) => {
                    return repo.getRemoteBranchesContainingCommit(branchAndCommit.commit, this.regexForExclusion, this.regexForInclusion)
                        .then((branches: string[]) => {
                            const index = branches.indexOf(branchAndCommit.branch);
                            if (index > -1) {
                                branches.splice(index, 1);
                            }
                            if (branches.length > 0) {
                                Global.isVerbose() && console.log(`branch ${branchAndCommit.branch} is contained in these branches: ${branches}`);
                                Global.isVerbose() && console.log('');
                                branches.forEach((b: string) => {
                                    this.put(branchAndCommit.branch, b);
                                });
                            } else {
                                Global.isVerbose() && console.log(`branch ${branchAndCommit.branch} is contained in no other branch.`);
                                this.put(branchAndCommit.branch, null);
                            }
                        });
                });
                return promiseAllSettledParallel(branchPromises).then(() => {
                    console.log('Reducing dependencies...');
                    this.reduce();
                }).then(() => {
                    console.log('Generating dot file...');
                    return fs
                        .writeFileAsync(VisualizeCommand.FILE_NAME_BRANCHES_DOT, this.generateDot(), 'utf8')
                        .then(() => {
                            if (this.pdf) {
                                return this.generatePdf();
                            } else {
                                console.log(`>> dot file has successfully been generated in ${VisualizeCommand.FILE_NAME_BRANCHES_DOT}`);
                                console.log('>> you can now generate a png file with graphviz:');
                                console.log(`>> dot -Tpng ${VisualizeCommand.FILE_NAME_BRANCHES_DOT} > ${VisualizeCommand.FILE_NAME_BRANCHES_PNG}`);
                            }
                        });
                });
            });
    }

    private generateDot(): string {
        const branchStrings: string[] = [];
        this.reducedBranches2containingBranches.forEach((containingBranches, branch) => {
            containingBranches.forEach((containingBranch) => {
                branchStrings.push(`    "${branch}" -> "${containingBranch}";${os.EOL}${this.createStyle(containingBranch)}`);
            });
            branchStrings.push(this.createStyle(branch));
        });
        const dotString = `digraph G {${os.EOL}${branchStrings.join('')}}`;
        Global.isVerbose() && console.log('dotString: ' + dotString);
        return dotString;
    }

    private generatePdf(): Promise<void> {
        return new Promise((resolve, reject) => {
            exec(
                `dot -Tpdf ${VisualizeCommand.FILE_NAME_BRANCHES_DOT} > ${VisualizeCommand.FILE_NAME_BRANCHES_PDF}`,
                (err) => {
                    if (err) {
                        return reject(err);
                    } else {
                        console.log(`Generated ${VisualizeCommand.FILE_NAME_BRANCHES_PDF}`);
                        return resolve();
                    }
                }
            );
        });
    }

    private createStyle(branch: string): string {
        if (this.styledBranches.indexOf(branch) >= 0) {
            return '';
        } else {
            const result: string[] = [];
            if (branch.indexOf('release/') === 0) {
                result.push(`    "${branch}" [style=bold,color="red"];${os.EOL}`);
                this.styledBranches.push(branch);
            }
            if (branch.indexOf('customer/') === 0) {
                result.push(`    "${branch}" [style=bold,color="blue"];${os.EOL}`);
                this.styledBranches.push(branch);
            }
            if (branch.indexOf('master') === 0) {
                result.push(`    "${branch}" [style=bold,color="green"];${os.EOL}`);
                this.styledBranches.push(branch);
            }
            return result.join('');
        }
    }

    private put(branch: string, containingBranch?: string): void {
        let containingBranches;
        if (this.branches2containingBranches.has(branch)) {
            containingBranches = this.branches2containingBranches.get(branch);
        } else {
            containingBranches = [];
            this.branches2containingBranches.set(branch, containingBranches);
        }
        if (!containingBranch || containingBranches.indexOf(containingBranch) >= 0) {
            return;
        } else {
            containingBranches.push(containingBranch);
        }
    }

    private reduce(): void {
        Global.isVerbose() && console.log('reducing');

        // cloning into reducedBranches2containingBranches
        this.branches2containingBranches.forEach((containingBranches, branch) => {
            this.reducedBranches2containingBranches.set(branch, containingBranches.slice(0));
        });

        // reducing
        this.branches2containingBranches.forEach((containingBranches, branch) => {
            containingBranches.forEach((containingBranch) => {
                this.reduceEdge(branch, containingBranch);
            });
        });
    }

    private reduceEdge(branch: string, containingBranch: string): void {
        Global.isVerbose() && console.log(`reducing ${branch} -> ${containingBranch}`);
        this.reducedBranches2containingBranches.forEach((cbs) => {
            const indexOfContainingBranch = cbs.indexOf(containingBranch);
            const cbsContainsBoth = cbs.indexOf(branch) >= 0 && indexOfContainingBranch >= 0;
            if (cbsContainsBoth) {
                cbs.splice(indexOfContainingBranch, 1);
                Global.isVerbose() && console.log(`removing edge between ${branch} and ${containingBranch}`);
            }
        });
    }

}
