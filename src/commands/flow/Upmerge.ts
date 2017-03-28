/**
 * Upmerge command for merging the release branches chain to master
 */
import * as Promise from 'bluebird';
import {Repository} from '../../git';
import {ICommand, ICommandParameters} from '../models';
import {ReleaseNumber} from './ReleaseNumber';
import {IGitBranchDetails} from '../../git/models';

export class Upmerge implements ICommand {
    // language=JSRegexp
    private static readonly RELEASE_BRANCH_PATTERN: string = 'release/((\\d+)(\.\\d+){0,2})';

    private static readonly PARAMETER_REMOTE: string = 'remote';

    private repo: Repository;
    private remote: string = 'origin';

    private releaseBranchPattern: RegExp = new RegExp(Upmerge.RELEASE_BRANCH_PATTERN);
    private remoteReleaseBranchPattern: RegExp;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.repo = new Repository();

        const remote = params[Upmerge.PARAMETER_REMOTE];
        if (typeof remote === 'string') {
            this.remote = remote;
        }

        this.remoteReleaseBranchPattern = new RegExp(`^${this.remote}/${Upmerge.RELEASE_BRANCH_PATTERN}$`);

        return true;
    }

    public execute(): Promise<void> {
        return this.repo
            .fetch()
            .then(() => this.checkForRelease())
            .then((release) => {
                return this.repo
                    .listBranches()
                    .then((branches) => this.filterReleaseBranchesAndCreateOrder(release, branches));
            })
            .then((branches) => this.checkMergability(branches))
            .then((branches) => this.doMerges(branches));
    }

    private checkForRelease(): Promise<ReleaseNumber> {
        return this.repo
            .status()
            .then((status) => {
                if (status.behind) {
                    return Promise.reject(`current branch is ${status.behind} commits behind ${status.tracking}`);
                }

                const match = this.remoteReleaseBranchPattern.exec(status.tracking);
                if (!match || match.length < 2) {
                    return Promise.reject(`tracked branch ${status.tracking} does not conform to release branch pattern ${this.remoteReleaseBranchPattern}`);
                }

                const version = match[1];
                const releaseNumber = ReleaseNumber.parse(version);
                if (!releaseNumber) {
                    return Promise.reject(`${version} is no valid Release Number`);
                } else {
                    console.log('is in release:', releaseNumber);
                    return Promise.resolve(releaseNumber);
                }
            });
    }

    private filterReleaseBranchesAndCreateOrder(release: ReleaseNumber, branches: IGitBranchDetails[]): IGitBranchDetails[] {
        const trackedRemoteBranches = new Map<String, { branch: IGitBranchDetails, releaseNumber: ReleaseNumber }>();

        branches.forEach((branch) => {
            if (branch.isRemote && !trackedRemoteBranches.has(branch.name)) {
                let version: string;

                if (branch.name === `${this.remote}/master`) {
                    version = 'master';
                } else {
                    const match = this.remoteReleaseBranchPattern.exec(branch.name);
                    if (!match || match.length < 2) {
                        return;
                    }
                    version = match[1];
                }

                const releaseNumber = ReleaseNumber.parse(version);
                if (!releaseNumber) {
                    return;
                }
                trackedRemoteBranches.set(branch.name, {branch, releaseNumber});
            } else if (branch.tracking) {
                let version: string;

                if (branch.name === 'master') {
                    version = 'master';
                } else {
                    const match = this.releaseBranchPattern.exec(branch.name);
                    if (!match || match.length < 2) {
                        return;
                    }
                    version = match[1];
                }

                const releaseNumber = ReleaseNumber.parse(version);
                if (!releaseNumber) {
                    return;
                }

                trackedRemoteBranches.set(branch.tracking, {branch, releaseNumber});
            }
        });

        return Array.from(trackedRemoteBranches)
            .map((b) => b[1])
            .filter((b) => release.compareTo(b.releaseNumber) <= 0)
            .sort((r1, r2) => {
                return r1.releaseNumber.compareTo(r2.releaseNumber);
            })
            .map((b) => b.branch);
    }

    private checkMergability(branches: IGitBranchDetails[]): Promise<IGitBranchDetails[]> {
        for (const b of branches) {
            if (b.gone) {
                return Promise.reject(`branch ${b.name} is gone - cannot upmerge`);
            }
            if (b.ahead || b.behind) {
                return Promise.reject(`branch ${b.name} differs from remote - ahead: ${b.ahead}, behind: ${b.behind}`);
            }
        }
        return Promise.resolve(branches);
    }

    private doMerges(branches: IGitBranchDetails[]): Promise<void> {
        return branches.reduce(
            (p, branch, i) => p.then(() => {
                if (i === 0) {
                    return;
                }

                const lastBranch = branches[i - 1];
                return this.repo
                    .checkoutBranch(branch.name)
                    .then(() => {
                        console.log(`merging ${lastBranch.name} into ${branch.name}`);
                    });
            }),
            Promise.resolve()
        );
    }

}
