/**
 * Data types for flow package
 */
import {IGitBranchDetails} from '../../git/models';
import {ReleaseNumber} from './ReleaseNumber';

export interface IBranchDetails extends IGitBranchDetails {
    customer: string;
    version: ReleaseNumber;
}

export const PROJECT_PLANNING_PARAM = '-- cf.cplace.projektplanung cf.cplace.rplanRxfImport cf.cplace.integration.ganttAndRiskmanagementAndTaskBoard' +
    ' cf.cplace.restrictToEditableParentProject cf.cplace.mainProject' +
    ' cf.cplace.lockChildrenOfProject cf.cplace.marketplace.common cf.cplace.marketplace.receiver cf.cplace.marketplace.sender cf.cplace.marketplace.testAll' +
    ' cf.cplace.integration.ganttAndTaskBoard cf.cplace.integration.ganttAndRiskmanagement' +
    ' cf.cplace.projectTree cf.cplace.pptexport cf.cplace.orgaTree cf.cplace.projektplanungCalendar cf.cplace.planauswahl cf.cplace.projektplanungMasterData' +
    ' cf.cplace.gantt cf.cplace.itemList cf.cplace.mcl cf.cplace.roles.ownerOfProject ' +
    'cf.cplace.personalScheduleWorkspace cf.cplace.marketplace.integration.receiverMainProject cf.cplace.personalScheduleWorkspaceWithMarketplace';