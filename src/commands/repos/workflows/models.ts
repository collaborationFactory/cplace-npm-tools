/**
 * Type definitions and interfaces for workflow management operations.
 * Used across WorkflowsAdd, WorkflowsAddInteractive, and WorkflowScanner classes.
 * Provides structured data representation for workflow metadata, status tracking, and environment file management.
 */

/**
 * Represents metadata and status information for a single workflow.
 * Used by WorkflowScanner to track available workflows and their existence status.
 * Consumed by interactive workflow selection for display and filtering purposes.
 */
export interface IWorkflowInfo {
    /** The display name of the workflow (human-readable identifier) */
    name: string;
    /** The actual file name of the workflow (e.g., 'build.yml', 'test.yaml') */
    fileName: string;
    /** Whether this workflow already exists in the current repository */
    exists: boolean;
}

/**
 * Container for categorized workflow scan results.
 * Separates available workflows from skeleton repository into existing and missing categories.
 * Used by WorkflowScanner.scanWorkflows() and consumed by interactive selection processes.
 */
export interface IWorkflowStatus {
    /** All workflows found in the skeleton repository, regardless of local existence */
    available: IWorkflowInfo[];
    /** Workflows that already exist in the current repository */
    existing: IWorkflowInfo[];
}
