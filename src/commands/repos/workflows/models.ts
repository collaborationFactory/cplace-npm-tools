/**
 * Workflows command models and interfaces
 */

export interface IWorkflowInfo {
    name: string;
    fileName: string;
    description?: string;
    size?: number;
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