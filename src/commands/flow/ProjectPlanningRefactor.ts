import {ICommand, ICommandParameters} from '../models';
import * as path from 'path';
import {Repository} from '../../git';

export class ProjectPlanningRefactor implements ICommand {
    private static readonly PATH_TO_PROJECT_PLANNING_REPO: string = 'pathProjectPlanning';
    private readonly CPLACE_TEMP_REPO: string = 'cplace-temp-repo';
    private readonly PROJECT_PLANNING_PARAM: string = '-- cf.cplace.projektplanung cf.cplace.rplanRxfImport cf.cplace.integration.ganttAndRiskmanagementAndTaskBoard' +
        ' cf.cplace.restrictToEditableParentProject cf.cplace.mainProject' +
        ' cf.cplace.lockChildrenOfProject cf.cplace.marketplace.common cf.cplace.marketplace.receiver cf.cplace.marketplace.sender cf.cplace.marketplace.testAll' +
        ' cf.cplace.integration.ganttAndTaskBoard cf.cplace.integration.ganttAndRiskmanagement' +
        ' cf.cplace.projectTree cf.cplace.pptexport cf.cplace.orgaTree cf.cplace.projektplanungCalendar cf.cplace.planauswahl cf.cplace.projektplanungMasterData' +
        ' cf.cplace.gantt cf.cplace.itemList cf.cplace.mcl cf.cplace.roles.ownerOfProject ' +
        'cf.cplace.personalScheduleWorkspace cf.cplace.marketplace.integration.receiverMainProject cf.cplace.personalScheduleWorkspaceWithMarketplace';

    private targetBranchName: string;
    private cplaceRepo: Repository;
    private projectPlanningRepo: Repository;
    private sourceBranchName: string;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.cplaceRepo = new Repository();

        const pathProjectPlanning = params[ProjectPlanningRefactor.PATH_TO_PROJECT_PLANNING_REPO];
        if (typeof pathProjectPlanning === 'string' && pathProjectPlanning.length > 0) {
            this.projectPlanningRepo = new Repository(pathProjectPlanning);
        } else {
            console.log('missing path to project planning repo');
            return false;
        }
        return true;
    }

    public execute(): Promise<void> {
        const localCplaceGit = path.join(process.cwd(), '.git');
        return this.cplaceRepo.checkIsRepo()
            .then(() => this.projectPlanningRepo.checkIsRepo())
            .then(() => this.getSourceBranch())
            .then(() => this.checkProjectPlanningRepoIsOnMaster())
            .then(() => this.checkResultingBranchIsNotPresent())
            .then(() => this.cplaceRepo.rawWrapper(['filter-branch', '--prune-empty', '--index-filter',
                `git rm --cached -r -q -- . ; git reset -q $GIT_COMMIT ${this.PROJECT_PLANNING_PARAM}`, '--', '--all']))
            .then(() => this.projectPlanningRepo.addRemote(this.CPLACE_TEMP_REPO, localCplaceGit))
            .then(() => this.projectPlanningRepo.rawWrapper(['checkout', '-b', this.targetBranchName]))
            .then(() => this.projectPlanningRepo.rawWrapper(['pull', this.CPLACE_TEMP_REPO, this.sourceBranchName, '--allow-unrelated-histories']))
            .then(() => this.projectPlanningRepo.removeRemote(this.CPLACE_TEMP_REPO));
    }

    private checkResultingBranchIsNotPresent(): Promise<void> {
        return this.projectPlanningRepo.listBranches().then((branches) => {
            const branch = branches.find((elem) => this.targetBranchName === elem.name.trim());
            if (branch) {
                return Promise.reject(`A branch with name ${this.targetBranchName} is already present.
                 This most probably means that, this branch has already been migrated into project planning repo`);
            }
            // Verbose is intentionally not used, as this message should be visible to user.
            console.log('Rewriting all the commit of cplace, this will take considerable amount of time.' +
                ' Please grab a coffee, go for a smoke or work parallel just make sure this session is not closed.');
            return Promise.resolve();
        });
    }

    private checkProjectPlanningRepoIsOnMaster(): Promise<void> {
        return this.projectPlanningRepo.rawWrapper(['rev-parse', '--abbrev-ref', 'HEAD']).then((currentBranch) => {
            if (currentBranch.trim() !== 'master') {
                return Promise.reject('Project planning repo is not on master, please switch to master and re run the command');
            }
            return Promise.resolve();
        });
    }

    private getSourceBranch(): Promise<void> {
        return this.cplaceRepo.rawWrapper(['rev-parse', '--abbrev-ref', 'HEAD']).then((currentBranch) => {
            this.sourceBranchName = currentBranch.trim();
            if (this.sourceBranchName === 'master') {
                const currentDate = new Date();
                this.targetBranchName = `cplace-master-${currentDate.getDate()}-${currentDate.getMonth() + 1}-${currentDate.getFullYear()}`;
            } else {
                this.targetBranchName = this.sourceBranchName;
            }
            return Promise.resolve();
        });
    }

}