/**
 * Core branch visualization logic
 */
import { Global } from '@cplace-cli/core';
import { Repository } from '@cplace-cli/git-utils';
import * as os from 'os';
import { writeFile } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// TODO: This should be moved to a shared package or core
const MASTER = 'master';
const MAIN = 'main';

export interface VisualizeOptions {
    regexForExclusion?: string;
    regexForInclusion?: string;
    pdf?: boolean;
}

export class Visualize {
    private static readonly FILE_NAME_BRANCHES_DOT: string = 'branches.dot';
    private static readonly FILE_NAME_BRANCHES_PNG: string = 'branches.png';
    private static readonly FILE_NAME_BRANCHES_PDF: string = 'branches.pdf';

    private branches2containingBranches: Map<string, string[]> = new Map();
    private reducedBranches2containingBranches: Map<string, string[]> = new Map();
    private styledBranches: string[] = [];
    private regexForExclusion: string;
    private regexForInclusion: string;
    private pdf: boolean;

    constructor(options: VisualizeOptions) {
        this.regexForExclusion = options.regexForExclusion || 'HEAD|attic/.*';
        this.regexForInclusion = options.regexForInclusion || '';
        this.pdf = options.pdf || false;

        Global.isVerbose() && console.log(`using regexForExclusion ${this.regexForExclusion} for branch filtering`);
        Global.isVerbose() && console.log(`using regexForInclusion ${this.regexForInclusion} for branch filtering`);
    }

    public async execute(): Promise<void> {
        Global.isVerbose() && console.log('running branches command in verbose mode');

        const repo = new Repository();

        console.log('Collecting branches...');
        const result = await repo.getRemoteBranchesAndCommits(this.regexForExclusion, this.regexForInclusion);
        
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
                        this.put(branchAndCommit.branch, undefined);
                    }
                });
        });

        await Promise.allSettled(branchPromises);
        
        console.log('Reducing dependencies...');
        this.reduce();
        
        console.log('Generating dot file...');
        await writeFile(Visualize.FILE_NAME_BRANCHES_DOT, this.generateDot(), 'utf8');
        
        if (this.pdf) {
            await this.generatePdf();
        } else {
            console.log(`>> dot file has successfully been generated in ${Visualize.FILE_NAME_BRANCHES_DOT}`);
            console.log('>> you can now generate a png file with graphviz:');
            console.log(`>> dot -Tpng ${Visualize.FILE_NAME_BRANCHES_DOT} > ${Visualize.FILE_NAME_BRANCHES_PNG}`);
        }
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

    private async generatePdf(): Promise<void> {
        try {
            await execAsync(
                `dot -Tpdf ${Visualize.FILE_NAME_BRANCHES_DOT} > ${Visualize.FILE_NAME_BRANCHES_PDF}`
            );
            console.log(`Generated ${Visualize.FILE_NAME_BRANCHES_PDF}`);
        } catch (err) {
            throw new Error(`Failed to generate PDF: ${err}`);
        }
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
            if (branch.indexOf(MASTER) === 0 || branch.indexOf(MAIN) === 0) {
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