/**
 * Upmerge command for merging the release branches chain to master
 */
import * as BPromise from 'bluebird';
import {Repository} from '../../git';
import {ICommand, ICommandParameters} from '../models';
import {ReleaseNumber} from './ReleaseNumber';
import {IGitBranchDetails} from '../../git/models';
import * as randomatic from 'randomatic';
import {IBranchDetails} from './models';
import {Global} from '../../Global';
import {promiseAllSettledParallel} from '../../promiseAllSettled';
import {UpmergeAnalyzer} from "./UpmergeAnalyzer";
import {runVerifyCommand} from './VerifyCommand';

/** A branch that received a merge in this run: the temporary branch holding the merge and the branch it is for */
interface IMergedTarget {
    tempBranchName: string;
    targetBranchName: string;
}

export class Upmerge implements ICommand {
    // language=JSRegexp
    private static readonly RELEASE_BRANCH_PATTERN: string = '((\\d+)(.\\d+){0,2})';

    private static readonly PARAMETER_REMOTE: string = 'remote';
    private static readonly PARAMETER_PUSH: string = 'push';
    private static readonly PARAMETER_RELEASE: string = 'release';
    private static readonly PARAMETER_SHOW_FILES: string = 'showFiles';
    private static readonly PARAMETER_ALL_CUSTOMERS: string = 'allCustomers';
    private static readonly PARAMETER_CUSTOMER: string = 'customer';
    private static readonly PARAMETER_SHOW_DETAILS: string = 'showDetails';
    private static readonly PARAMETER_VERIFY: string = 'verify';

    private repo: Repository;
    private remote: string = 'origin';
    private push: boolean;
    private release: string;
    private showFiles: boolean;
    private allCustomers: boolean;
    private customer: string;
    private showDetails: boolean;
    private verifyCommand: string;

    /** Branches merged in this run, in merge order and each listed once */
    private readonly mergedTargets: IMergedTarget[] = [];

    private remoteReleaseBranchPattern: RegExp;
    private startRelease: string;

    private prefix: string = 'upmerge-' + randomatic('Aa0', 6) + '/';
    private static readonly REPO_DIVIDER = '='.repeat(20);
    private static readonly BRANCH_DIVIDER = '-'.repeat(20);

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.repo = new Repository();

        const remote = params[Upmerge.PARAMETER_REMOTE];
        if (typeof remote === 'string') {
            this.remote = remote;
        }

        this.push = params[Upmerge.PARAMETER_PUSH] !== false;

        const release = params[Upmerge.PARAMETER_RELEASE];
        if (typeof release === 'string') {
            this.release = release;
        }
        this.showFiles = params[Upmerge.PARAMETER_SHOW_FILES] === true;
        this.showDetails = params[Upmerge.PARAMETER_SHOW_DETAILS] === true;

        const verify = params[Upmerge.PARAMETER_VERIFY];
        if (verify !== undefined && verify !== false) {
            if (typeof verify !== 'string' || !verify.trim()) {
                console.error('--verify needs a command, e.g. --verify "./gradlew compileJava"');
                return false;
            }
            this.verifyCommand = verify;
        }

        this.allCustomers = params[Upmerge.PARAMETER_ALL_CUSTOMERS] === true;
        if (!this.allCustomers) {
            const customer = params[Upmerge.PARAMETER_CUSTOMER];
            if (typeof customer === 'string') {
                this.customer = customer;
            }
        }
        this.remoteReleaseBranchPattern = new RegExp(`^${this.remote}/release/${Upmerge.RELEASE_BRANCH_PATTERN}$`);
        return true;
    }

    public async execute(): Promise<void> {
        await this.repo.fetch({});
        await this.checkRepoClean();

        const release = await this.checkForRelease();

        const gitBranchDetails = await this.repo.listBranches();
        const branches = this.filterReleaseBranchesAndCreateOrder(release, gitBranchDetails);
        await this.checkMergability(branches);

        await this.doMerges(branches);

        // Clean up any leftover upmerge branches after successful completion
        await this.cleanupUpmergeBranches();
    }

    private async cleanupUpmergeBranches(): Promise<void> {
        try {
            const upmergePattern = /^upmerge-[A-Za-z0-9]+\/.+$/;
            const allBranches = await this.repo.listBranches();
            const localUpmergeBranches = allBranches
                .filter(b => !b.isRemote && upmergePattern.test(b.name));

            if (localUpmergeBranches.length > 0) {
                Global.isVerbose() && console.log(`Cleaning up ${localUpmergeBranches.length} leftover upmerge branches`);
                await promiseAllSettledParallel(
                    localUpmergeBranches.map(b => this.repo.deleteBranch(b.name))
                );
            }
        } catch (error) {
            console.warn(`Warning: Could not clean up leftover upmerge branches: ${error.message || error}`);
        }
    }

    private checkRepoClean(): BPromise<void> {
        return this.repo
            .status()
            .then((status) => {
                if (status.behind) {
                    return BPromise.reject(`current branch is ${status.behind} commits behind ${status.tracking}`);
                }

                if (['not_added', 'conflicted', 'created', 'deleted', 'modified', 'renamed'].find((k) => status[k].length)) {
                    return BPromise.reject('You have uncommitted changes');
                }

                return BPromise.resolve();
            });
    }

    private checkForRelease(): BPromise<ReleaseNumber> {
        if (this.release) {
            const rn = ReleaseNumber.parse(this.release);
            if (rn == null) {
                return BPromise.reject(`Could not parse release number '${this.release}'`);
            }
            this.startRelease = this.release;
            return BPromise.resolve(rn);
        }

        return this.repo
            .status()
            .then((status) => {
                const match = this.remoteReleaseBranchPattern.exec(status.tracking);
                if (!match || match.length < 2) {
                    return BPromise.reject(`tracked branch ${status.tracking} does not conform to release branch pattern ${this.remoteReleaseBranchPattern}`);
                }

                const version = match[1];
                const releaseNumber = ReleaseNumber.parse(version);
                if (!releaseNumber) {
                    return BPromise.reject(`${version} is no valid Release Number`);
                } else {
                    console.log('is in release:', releaseNumber);
                    this.startRelease = version;
                    return BPromise.resolve(releaseNumber);
                }
            });
    }

    private filterReleaseBranchesAndCreateOrder(release: ReleaseNumber, branches: IGitBranchDetails[]): IBranchDetails[] {
        const trackedRemoteBranches = new Map<string, IBranchDetails>();

        const customerPattern = this.allCustomers ? '[\\w-]*' : this.customer;
        const customerBranchPattern = new RegExp(`^${this.remote}/customer/(${customerPattern})/${Upmerge.RELEASE_BRANCH_PATTERN}$`);

        branches
            .filter((branch) => branch.isRemote && !trackedRemoteBranches.has(branch.name))
            .forEach((branch) => {
                let version: string;
                let customerName: string;

                if (ReleaseNumber.isDefaultBranch(branch.name, this.remote)) {
                    version = 'master';
                } else {
                    let match = this.remoteReleaseBranchPattern.exec(branch.name);
                    if (!match || match.length < 2) {
                        if (this.allCustomers || this.customer) {
                            match = customerBranchPattern.exec(branch.name);
                            if (!match || match.length < 3) {
                                return;
                            }
                            customerName = match[1];
                            version = match[2];
                        } else {
                            return;
                        }
                    } else {
                        version = match[1];
                    }
                }

                const releaseNumber = ReleaseNumber.parse(version);
                if (!releaseNumber) {
                    return;
                }
                trackedRemoteBranches.set(branch.name, {
                    ...branch,
                    customer: customerName,
                    version: releaseNumber
                });
            });

        return Array.from(trackedRemoteBranches)
            .map((b) => b[1])
            .filter((b) => release.compareTo(b.version) <= 0)
            .sort((r1, r2) => {
                const compareResult = r1.version.compareTo(r2.version);
                if (compareResult === 0) {
                    if (r1.customer) {
                        return r2.customer ? 0 : 1;
                    }
                    return r2.customer ? -1 : 0;
                }
                return compareResult;
            });
    }

    private checkMergability(branches: IBranchDetails[]): BPromise<IBranchDetails[]> {
        for (const b of branches) {
            if (b.gone) {
                return BPromise.reject(`branch ${b.name} is gone - cannot upmerge`);
            }
            if (b.ahead || b.behind) {
                return BPromise.reject(`branch ${b.name} differs from remote - ahead: ${b.ahead}, behind: ${b.behind}`);
            }
        }
        return BPromise.resolve(branches);
    }

    private tempBranchName(remoteBranchName: string): string {
        if (!remoteBranchName.startsWith(this.remote + '/')) {
            throw new Error(`Branch '${remoteBranchName}' does not start with '${this.remote}/'`);
        }
        return this.prefix + remoteBranchName.substr(this.remote.length + 1);
    }

    private doMerges(branches: IBranchDetails[]): BPromise<void> {

        const cleanup: Set<string> = new Set();
        const releaseBranches = branches.filter((branch) => !branch.customer);
        const customerBranches = branches.filter((branch) => branch.customer);
        console.log(Upmerge.REPO_DIVIDER);
        console.log(`Repository: ${this.repo.repoName}`);
        console.log(Upmerge.REPO_DIVIDER);
        return this.repo
            .status()
            .then(() => releaseBranches.reduce(
                (p, branch, i) => p.then(() => this.mergeReleaseBranch(branch, i, releaseBranches, cleanup)),
                BPromise.resolve()))
            .then(() => customerBranches.reduce(
                (p, branch) => p.then(() => this.mergeCustomerBranch(branch, branches, cleanup)),
                BPromise.resolve()))
            .then(() => this.verifyAndPushMergedTargets())
            .then(() => {
                // On success: checkout the last upmerged branch and delete temporary branches
                if (releaseBranches.length > 0) {
                    const lastReleaseBranch = releaseBranches[releaseBranches.length - 1];
                    return this.repo
                        .checkoutBranch(lastReleaseBranch.name.replace(this.remote + '/', ''))
                        .then(() => promiseAllSettledParallel(
                            [...cleanup].map((b) => this.repo.deleteBranch(b))
                        ));
                }
            });
    }

    private mergeReleaseBranch(branch: IBranchDetails, i: number, branches: IBranchDetails[], cleanup: Set<string>): BPromise {
        if (i === 0) {
            const tempBranchName = this.tempBranchName(branches[0].name);
            const targetBranchName = branches[0].name.substr(this.remote.length + 1);
            return this.repo.checkoutBranch(['-b', tempBranchName, branches[0].name])
                .then(() => cleanup.add(tempBranchName))
                .then(() => this.repo.setUpstreamBranch(`${this.remote}/${targetBranchName}`));
        }
        const srcBranch = branches[i - 1];
        return this.mergeBranch(branch, srcBranch, false, cleanup);
    }

    private mergeCustomerBranch(branch: IBranchDetails, branches: IBranchDetails[], cleanup: Set<string>): BPromise {
        Global.isVerbose() && console.log(`Customer branch ${branch.name} with version ${branch.version}`);

        return BPromise.resolve()
            .then(() => {
                const previousCustomerBranch = branches
                    .filter((b) => b.customer === branch.customer)
                    .sort((b1, b2) => b2.version.compareTo(b1.version))
                    .find((b) => b.version.compareTo(branch.version) < 0);
                if (!previousCustomerBranch) {
                    Global.isVerbose() && console.log('No previous branch, nothing to merge.');
                    return BPromise.resolve();
                }
                Global.isVerbose() && console.log(`Previous branch found: ${previousCustomerBranch.name}`);
                return this.mergeBranch(branch, previousCustomerBranch, false, cleanup);
            })
            .then(() => {
                const matchingReleaseBranch = branches
                    .filter((b) => !b.customer)
                    .sort((b1, b2) => b2.version.compareTo(b1.version))
                    .find((b) => b.version.compareTo(branch.version) <= 0);
                if (!matchingReleaseBranch) {
                    return BPromise.reject(`No release branch for version ${branch.version} found.`);
                }
                Global.isVerbose() && console.log(`Matching release branch for ${branch.name} is ${matchingReleaseBranch.name}`);

                return this.mergeBranch(branch, matchingReleaseBranch, true, cleanup);
            });
    }

    private mergeBranch(branch: IBranchDetails, srcBranch: IBranchDetails, tolerateExistingBranch: boolean, cleanup: Set<string>): BPromise {
        const tempSrcBranch = this.tempBranchName(srcBranch.name);
        const upmergeChecker = new UpmergeAnalyzer(this.repo);

        const needsSeparator = this.showDetails || this.showFiles;
        console.log(`${needsSeparator ? '\n' : ''}Merging ${tempSrcBranch} into ${branch.name}${needsSeparator ? '\n' + Upmerge.BRANCH_DIVIDER : ''}`);


        if (!branch.name.startsWith(this.remote + '/')) {
            return BPromise.reject(`Branch '${branch.name}' does not start with '${this.remote}/'`);
        }
        const tempBranchName = this.tempBranchName(branch.name);
        const targetBranchName = branch.name.substr(this.remote.length + 1);
        // A customer branch receives two merges. When pushes are deferred, the second merge has to build on the temporary
        // branch of the first one: resetting it to the remote branch would drop the first merge.
        const checkout = this.verifyCommand && cleanup.has(tempBranchName)
            ? this.repo.checkoutBranch(tempBranchName)
            : this.repo.checkoutBranch([tolerateExistingBranch ? '-B' : '-b', tempBranchName, branch.name]);
        return BPromise.resolve(checkout)
            .then(() => cleanup.add(tempBranchName))
            .then(() => this.repo.setUpstreamBranch(`${this.remote}/${targetBranchName}`))
            .then(() => {
                if (this.showDetails) {
                    return upmergeChecker.analyzeRequiredMerge(tempSrcBranch, branch.name)
                }
            })
            .then(() => this.repo.merge(null, tempSrcBranch, {noFF: true, listFiles: this.showFiles})
                .catch((err) => (this.push ? this.printConflictResolutionHint(targetBranchName) : BPromise.resolve())
                    .then(() => BPromise.reject(err))))
            .then(() => this.addMergedTarget({tempBranchName, targetBranchName}))
            .then(() => {
                return this.push && !this.verifyCommand
                    ? this.repo.push(this.remote, targetBranchName)
                    : BPromise.resolve();
            });
    }

    private addMergedTarget(target: IMergedTarget): void {
        if (!this.mergedTargets.some((t) => t.tempBranchName === target.tempBranchName)) {
            this.mergedTargets.push(target);
        }
    }

    /**
     * With --verify, nothing has been pushed yet when all merges are done. Runs the verify command on every merged branch
     * in merge order and pushes them only if the command succeeds on all of them.
     */
    private async verifyAndPushMergedTargets(): Promise<void> {
        if (!this.verifyCommand) {
            return;
        }

        const cwd = await this.repositoryRoot();
        for (const [index, target] of this.mergedTargets.entries()) {
            await this.verifyMergedTarget(target, cwd, this.mergedTargets.slice(0, index));
        }

        if (!this.push) {
            console.log('\nVerification passed for all merged branches, nothing pushed (--no-push)');
            return;
        }
        console.log('\nVerification passed for all merged branches, pushing');
        for (const target of this.mergedTargets) {
            await this.repo.checkoutBranch(target.tempBranchName);
            await this.repo.push(this.remote, target.targetBranchName);
        }
    }

    private async verifyMergedTarget(target: IMergedTarget, cwd: string, verifiedTargets: IMergedTarget[]): Promise<void> {
        if (!await this.hasNewCommits(target)) {
            console.log(`\nNothing merged into ${target.targetBranchName}, skipping verification`);
            return;
        }

        console.log(`\nVerifying ${target.targetBranchName} on ${target.tempBranchName}: ${this.verifyCommand}`);
        await this.repo.checkoutBranch(target.tempBranchName);

        let outcome: string;
        try {
            const result = await runVerifyCommand(this.verifyCommand, cwd);
            if (result.exitCode === 0) {
                console.log(`Verification passed for ${target.targetBranchName}`);
                return;
            }
            outcome = result.signal ? `terminated by signal ${result.signal}` : `exit code ${result.exitCode}`;
        } catch (e) {
            outcome = `command could not be started: ${e.message || e}`;
        }

        const failure = `Verification failed for ${target.targetBranchName} (${outcome})`;
        console.error(failure);
        console.log(`Nothing was pushed. The merges are on the local temporary branches, you are on ${target.tempBranchName}.`);
        if (this.push) {
            this.printFinishHint([
                'fix the problem on this branch and commit the fix',
                this.pushCommand(target.targetBranchName, verifiedTargets)
            ]);
        }
        throw new Error(`${failure}, nothing was pushed`);
    }

    /** Whether the temporary branch holds commits its target branch on the remote does not have */
    private async hasNewCommits(target: IMergedTarget): Promise<boolean> {
        const count = await this.repo.rawWrapper(['rev-list', '--count', `${this.remote}/${target.targetBranchName}..${target.tempBranchName}`]);
        return `${count}`.trim() !== '0';
    }

    private async repositoryRoot(): Promise<string> {
        const root = `${await this.repo.rawWrapper(['rev-parse', '--show-toplevel'])}`.trim();
        return root || process.cwd();
    }

    /**
     * Tells the developer how to finish an upmerge that stopped on a merge conflict. The temporary branch is named
     * differently from its target branch, so the push needs an explicit refspec. The rerun repeats the original
     * arguments: merges that are already done pass through, and starting from the conflicting branch instead would
     * skip pending customer branch merges.
     */
    private printConflictResolutionHint(targetBranchName: string): BPromise<void> {
        return BPromise.resolve(this.repo.status())
            .then((status) => {
                if (!status.conflicted.length) {
                    return;
                }
                const steps = ['resolve the conflicts and commit the merge'];
                const pendingTargets = this.mergedTargets.filter((t) => t.targetBranchName !== targetBranchName);
                if (this.verifyCommand) {
                    const unverified = ['this branch', ...pendingTargets.map((t) => t.tempBranchName)].join(', ');
                    steps.push(`run the verify command on ${unverified}: none of them has been verified yet`);
                }
                steps.push(this.pushCommand(targetBranchName, this.verifyCommand ? pendingTargets : []));
                this.printFinishHint(steps);
            })
            .catch(() => undefined);
    }

    /**
     * Prints the steps that finish a stopped upmerge, followed by the rerun of the original command. The rerun repeats
     * the original arguments: merges that are already done pass through.
     */
    private printFinishHint(steps: string[]): void {
        console.log('To finish this upmerge:');
        [...steps, `continue with: cplace-cli flow --upmerge${this.continueUpmergeOptions()}\n`]
            .forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
    }

    /**
     * The push that finishes a stopped upmerge: the current branch to its target, together with the merges of this run that
     * have not been pushed yet. Those are pushed atomically so that no target branch is left without the merges below it.
     */
    private pushCommand(targetBranchName: string, unpushedTargets: IMergedTarget[]): string {
        if (!unpushedTargets.length) {
            return `git push ${this.remote} HEAD:${targetBranchName}`;
        }
        const refspecs = unpushedTargets.map((t) => `${t.tempBranchName}:${t.targetBranchName}`);
        return `git push --atomic ${this.remote} ${refspecs.join(' ')} HEAD:${targetBranchName}`;
    }

    private continueUpmergeOptions(): string {
        const options: string[] = [`--release ${this.startRelease}`];
        if (this.remote !== 'origin') {
            options.push(`--remote ${this.remote}`);
        }
        if (this.allCustomers) {
            options.push('--all-customers');
        } else if (this.customer) {
            options.push(`--customer ${this.customer}`);
        }
        if (this.showFiles) {
            options.push('--show-files');
        }
        if (this.showDetails) {
            options.push('--show-details');
        }
        if (this.verifyCommand) {
            options.push(`--verify ${Upmerge.shellQuote(this.verifyCommand)}`);
        }
        return options.map((option) => ' ' + option).join('');
    }

    private static shellQuote(value: string): string {
        return `'${value.replace(/'/g, `'\\''`)}'`;
    }

}
