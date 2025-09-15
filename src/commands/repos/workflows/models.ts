/**
 * Workflows command models and interfaces
 */

export interface IWorkflowInfo {
    name: string;
    fileName: string;
    exists: boolean;
}

export interface IWorkflowStatus {
    available: IWorkflowInfo[];
    existing: IWorkflowInfo[];
}

export interface IEnvironmentFile {
    workflowName: string;
    fileName: string;
    path: string;
    exists: boolean;
}