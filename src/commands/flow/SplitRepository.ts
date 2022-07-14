import {ICommand, ICommandParameters} from '../models';
import * as path from 'path';
import {Repository} from '../../git';
import {Global} from '../../Global';

export class SplitRepository implements ICommand {
    private static readonly PATH_TO_TARGET_REPOSITORY: string = 'pathToTargetRepo';
    private static readonly DIRECTORIES_TO_MIGRATE: string = 'directories';
    private readonly SOURCE_TEMP_REPO: string = 'source-temp-repo';
    private readonly PROJECT_PLANNING_DIRECTORIES_TO_MIGRATE: string = '-- cf.cplace.projektplanung cf.cplace.rplanRxfImport cf.cplace.integration.ganttAndRiskmanagementAndTaskBoard' +
        ' cf.cplace.restrictToEditableParentProject cf.cplace.mainProject' +
        ' cf.cplace.lockChildrenOfProject cf.cplace.marketplace.common cf.cplace.marketplace.receiver cf.cplace.marketplace.sender cf.cplace.marketplace.testAll' +
        ' cf.cplace.integration.ganttAndTaskBoard cf.cplace.integration.ganttAndRiskmanagement' +
        ' cf.cplace.projectTree cf.cplace.pptexport cf.cplace.orgaTree cf.cplace.projektplanungCalendar cf.cplace.planauswahl cf.cplace.projektplanungMasterData' +
        ' cf.cplace.gantt cf.cplace.itemList cf.cplace.mcl cf.cplace.roles.ownerOfProject ' +
        'cf.cplace.personalScheduleWorkspace cf.cplace.marketplace.integration.receiverMainProject cf.cplace.personalScheduleWorkspaceWithMarketplace';

    private targetBranchName: string;
    private sourceRepo: Repository;
    private targetRepo: Repository;
    private sourceBranchName: string;
    private sourceDirectoriesToMigrate: string;
    private sourceCommitHash: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.sourceRepo = new Repository();

        const pathToTargetRepo = params[SplitRepository.PATH_TO_TARGET_REPOSITORY];
        if (typeof pathToTargetRepo === 'string' && pathToTargetRepo.length > 0) {
            this.targetRepo = new Repository(pathToTargetRepo);
        } else {
            console.log('missing path to target repo');
            return false;
        }
        const directories = params[SplitRepository.DIRECTORIES_TO_MIGRATE];
        if (typeof directories === 'string' && directories.length > 0) {
            this.sourceDirectoriesToMigrate = `-- ${directories}`;
        } else {
            this.sourceDirectoriesToMigrate = this.PROJECT_PLANNING_DIRECTORIES_TO_MIGRATE;
        }
        Global.isVerbose() && console.log('Source directories to be migrated : ' + this.sourceDirectoriesToMigrate);

        return true;
    }

    public execute(): Promise<void> {
        const sourceGitRepo = path.join(process.cwd(), '.git');
        return this.sourceRepo.checkIsRepo()
            .then(() => this.targetRepo.checkIsRepo())
            .then(() => this.getSourceBranch())
            .then(() => this.sourceRepo.getCurrentCommitHash())
            .then((commitHash) => this.setCommitHash(commitHash))
            .then(() => this.checkResultingBranchIsNotPresent())
            .then(() => this.sourceRepo.rawWrapper(['filter-branch', '--prune-empty', '--index-filter',
                `git rm --cached -r -q -- . ; git reset -q $GIT_COMMIT ${this.sourceDirectoriesToMigrate}`, '--', '--all']))
            .then(() => this.targetRepo.addRemote(this.SOURCE_TEMP_REPO, sourceGitRepo))
            .then(() => this.targetRepo.rawWrapper(['fetch', this.SOURCE_TEMP_REPO, `${this.sourceBranchName}:${this.targetBranchName}`]))
            .then(() => this.targetRepo.removeRemote(this.SOURCE_TEMP_REPO))
            .then(() => this.printWayForward());
    }

    private checkResultingBranchIsNotPresent(): Promise<void> {
        return this.targetRepo.listBranches().then((branches) => {
            const branch = branches.find((elem) => this.targetBranchName === elem.name.trim());
            if (branch) {
                return Promise.reject(`A branch with name ${this.targetBranchName} is already present.
                 This most probably means that, this branch has already been migrated into target repo`);
            }
            // Verbose is intentionally not used, as this message should be visible to user.
            console.log('Rewriting all the commit of cplace, this will take considerable amount of time.' +
                ' Please grab a coffee, go for a smoke or work parallel just make sure this session is not closed.');
            return Promise.resolve();
        });
    }

    private setCommitHash(commitHash: string): Promise<void> {
        this.sourceCommitHash = commitHash;
        return Promise.resolve();
    }

    private getSourceBranch(): Promise<void> {
        return this.sourceRepo.rawWrapper(['rev-parse', '--abbrev-ref', 'HEAD']).then((currentBranch) => {
            this.sourceBranchName = currentBranch.trim();
            if (this.sourceBranchName === 'master' || 'main') {
                const currentDate = new Date();
                this.targetBranchName = `source-master-${currentDate.getDate()}-${currentDate.getMonth() + 1}-${currentDate.getFullYear()}`;
            } else {
                this.targetBranchName = this.sourceBranchName;
            }
            return Promise.resolve();
        });
    }

    private printWayForward(): Promise<void> {
        console.log(`The target repository has a branch name: ${this.targetBranchName} with all the commits from branch ${this.sourceBranchName} of source repo`);
        console.log(`Please merge ${this.targetBranchName} into your working branch using below command line`);
        console.log(`git merge -m "Merging latest from ${this.sourceBranchName} of source repository with last commit hash ${this.sourceCommitHash}"
         ${this.targetBranchName} --allow-unrelated-histories`);
        return Promise.resolve();
    }
}
