/**
 * Data types for flow package
 */
import {IGitBranchDetails} from '../../git/models';
import {ReleaseNumber} from './ReleaseNumber';

export interface IBranchDetails extends IGitBranchDetails {
    customer: string;
    version: ReleaseNumber;
}
