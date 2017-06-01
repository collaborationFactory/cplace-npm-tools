/**
 * Upmerge command for merging the release branches chain to master
 */
import * as Promise from 'bluebird';
import {Repository} from '../../git';
import {ICommand, ICommandParameters} from '../models';
import {ReleaseNumber} from './ReleaseNumber';
import {IGitBranchDetails} from '../../git/models';
import * as randomatic from 'randomatic';

export class Upmerge implements ICommand {
    // language=JSRegexp
    private static readonly RELEASE_BRANCH_PATTERN: string = 'release/((\\d+)(\.\\d+){0,2})';

    private static readonly PARAMETER_REMOTE: string = 'remote';
    private static readonly PARAMETER_PUSH: string = 'push';
    private static readonly PARAMETER_RELEASE: string = 'release';

    private repo: Repository;
    private remote: string = 'origin';
    private push: boolean;
    private release: string;

    private releaseBranchPattern: RegExp = new RegExp(Upmerge.RELEASE_BRANCH_PATTERN);
    private remoteReleaseBranchPattern: RegExp;

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

        this.remoteReleaseBranchPattern = new RegExp(`^${this.remote}/${Upmerge.RELEASE_BRANCH_PATTERN}$`);

        return true;
    }

    public execute(): Promise<void> {
        return this.repo
            .fetch()
            .then(() => this.checkRepoClean())
            .then(() => this.checkForRelease())
            .then((release) => {
                return this.repo
                    .listBranches()
                    .then((branches) => this.filterReleaseBranchesAndCreateOrder(release, branches));
            })
            .then((branches) => this.checkMergability(branches))
            .then((branches) => this.doMerges(branches));
    }

    private checkRepoClean(): Promise<void> {
        return this.repo
            .status()
            .then((status) => {
                if (status.behind) {
                    return Promise.reject(`current branch is ${status.behind} commits behind ${status.tracking}`);
                }

                if (['not_added', 'conflicted', 'created', 'deleted', 'modified', 'renamed'].find(k => status[k].length)) {
                    return Promise.reject('You have uncommitted changes');
                }

                return Promise.resolve();
            });
    }

    private checkForRelease(): Promise<ReleaseNumber> {
        if(this.release) {
            const rn = ReleaseNumber.parse(this.release);
            if (rn == null) {
                return Promise.reject(`Could not parse release number '${this.release}'`);
            }
            return Promise.resolve(rn);
        }

        return this.repo
            .status()
            .then((status) => {
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

        const prefix = 'upmerge-' + randomatic('Aa0', 6) + '/';
        const cleanup = [];

        let prevBranch;

        return this.repo.status()
            .then(status => prevBranch = status.current)
            .then(() => branches.reduce(
                (p, branch, i) => p.then(() => {
                    if (i === 0) {
                        return;
                    }

                    // TODO:
                    //const srcBranch = branches[i - 1];
                    const srcBranch = branches[0];

                    console.log(`merging ${srcBranch.name} into ${branch.name}`);

                    if(!branch.name.startsWith(this.remote + '/')) {
                        return Promise.reject(`Branch '${branch.name}' does not start with '${this.remote}/'`);
                    }
                    const branchName = branch.name.substr(this.remote.length + 1);
                    const tempBranch = `${prefix}${branchName}`;
                    return this.repo.checkoutBranch(['-b', tempBranch, branch.name])
                        .then(() => cleanup.push(tempBranch))
                        .then(() => this.repo.merge(srcBranch.name, true).catch(err =>
                            Promise.reject(`When trying to merge ${srcBranch.name} into ${branch.name}\n${err}`)
                        ))
                        .then(() =>
                            this.push
                                ? this.repo.push(this.remote, branchName)
                                : Promise.resolve()
                        );

                }),
                Promise.resolve()
            ))
            .finally(() =>
                this.repo.checkoutBranch(prevBranch).then(() =>
                    Promise.all(cleanup.map((b) =>
                        this.repo.deleteBranch(b)
                    ))
                )
            );
    }

}
