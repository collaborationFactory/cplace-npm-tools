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

    private repo: Repository;
    private remote: string = 'origin';
    private push: boolean;
    private release: string;
    private showFiles: boolean;
    private allCustomers: boolean;
    private customer: string;
    private showDetails: boolean;

    private remoteReleaseBranchPattern: RegExp;

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
        let prevBranch: string | string[];
        console.log(Upmerge.REPO_DIVIDER);
        console.log(`Repository: ${this.repo.repoName}`);
        console.log(Upmerge.REPO_DIVIDER);
        return this.repo
            .status()
            .then((status) => prevBranch = status.current)
            .then(() => releaseBranches.reduce(
                (p, branch, i) => p.then(() => this.mergeReleaseBranch(branch, i, releaseBranches, cleanup)),
                BPromise.resolve()))
            .then(() => customerBranches.reduce(
                (p, branch) => p.then(() => this.mergeCustomerBranch(branch, branches, cleanup)),
                BPromise.resolve()))
            .finally(() => {
                    this.repo
                        .checkoutBranch(prevBranch)
                        .then(() => promiseAllSettledParallel(
                            [...cleanup].map((b) => this.repo.deleteBranch(b))
                        ))
                }
            );
    }

    private mergeReleaseBranch(branch: IBranchDetails, i: number, branches: IBranchDetails[], cleanup: Set<string>): BPromise {
        if (i === 0) {
            const tempBranchName = this.tempBranchName(branches[0].name);
            return this.repo.checkoutBranch(['-b', tempBranchName, branches[0].name])
                .then(() => cleanup.add(tempBranchName));
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
        return this.repo.checkoutBranch([tolerateExistingBranch ? '-B' : '-b', tempBranchName, branch.name])
            .then(() => cleanup.add(tempBranchName))
            .then(() => {
                if (this.showDetails) {
                    return upmergeChecker.analyzeRequiredMerge(tempSrcBranch, branch.name)
                }
            })
            .then(() => this.repo.merge(tempSrcBranch, {noFF: true, listFiles: this.showFiles}))
            .then(() => {
                const targetBranchName = branch.name.substr(this.remote.length + 1);
                return this.push
                    ? this.repo.push(this.remote, targetBranchName)
                    : BPromise.resolve();
            });
    }

}
