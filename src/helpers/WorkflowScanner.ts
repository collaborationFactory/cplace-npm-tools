/**
 * Utility class for scanning and analyzing GitHub Actions workflows
 * Provides functionality to discover, parse, and compare workflows
 */
import * as fs from 'fs';
import * as path from 'path';
import { Global } from '../Global';
import { SkeletonManager } from './SkeletonManager';
import { Repository } from '../git';
import { IWorkflowInfo, IWorkflowStatus } from '../commands/repos/workflows';

export class WorkflowScanner {

    /**
     * Scan workflows from skeleton repository and compare with local repository
     */
    public static async scanWorkflows(repo: Repository, skeletonBranch: string): Promise<IWorkflowStatus> {
        try {
            Global.isVerbose() && console.log('Scanning workflows from skeleton repository and local repository');

            // Get skeleton workflows
            const skeletonWorkflows = await WorkflowScanner.getSkeletonWorkflows(repo, skeletonBranch);

            // Get local workflows
            const localWorkflows = await WorkflowScanner.getLocalWorkflows(repo.workingDir);

            // Create status comparison
            const status: IWorkflowStatus = {
                available: skeletonWorkflows,
                existing: localWorkflows
            };

            // Mark which skeleton workflows already exist locally
            status.available.forEach(skeletonWorkflow => {
                skeletonWorkflow.exists = localWorkflows.some(localWorkflow =>
                    localWorkflow.fileName === skeletonWorkflow.fileName
                );
            });

            Global.isVerbose() && console.log(`Found ${status.available.length} skeleton workflows, ${status.existing.length} local workflows`);
            return status;

        } catch (error) {
            throw new Error(`Failed to scan workflows: ${error instanceof Error ? error.message : error}`);
        }
    }

    /**
     * Get workflows from skeleton repository
     */
    private static async getSkeletonWorkflows(repo: Repository, skeletonBranch: string): Promise<IWorkflowInfo[]> {
        try {
            const workflowFiles = await SkeletonManager.listWorkflowsInBranch(repo, skeletonBranch);
            const workflows: IWorkflowInfo[] = [];

            for (const filePath of workflowFiles) {
                const fileName = path.basename(filePath);

                try {
                    // Get file content to parse metadata
                    const content = await SkeletonManager.getFileContentFromRemote(repo, skeletonBranch, filePath);
                    const workflowInfo = WorkflowScanner.parseWorkflowInfo(fileName, content);
                    workflowInfo.exists = false; // Will be set later during comparison
                    workflows.push(workflowInfo);

                } catch (error) {
                    // If we can't parse the workflow, create basic info
                    Global.isVerbose() && console.log(`Could not parse workflow ${fileName}: ${error}`);
                    workflows.push({
                        name: WorkflowScanner.extractNameFromFileName(fileName),
                        fileName: fileName,
                        exists: false
                    });
                }
            }

            return workflows.sort((a, b) => a.fileName.localeCompare(b.fileName));

        } catch (error) {
            if (error instanceof Error && error.message.includes('.github/workflows')) {
                Global.isVerbose() && console.log('No workflows found in skeleton repository');
                return [];
            }
            throw error;
        }
    }

    /**
     * Get workflows from local repository
     */
    private static async getLocalWorkflows(workingDir: string): Promise<IWorkflowInfo[]> {
        try {
            const workflowsDir = path.join(workingDir, '.github', 'workflows');

            if (!fs.existsSync(workflowsDir)) {
                Global.isVerbose() && console.log('No local .github/workflows directory found');
                return [];
            }

            const files = fs.readdirSync(workflowsDir);
            const workflowFiles = files.filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
            const workflows: IWorkflowInfo[] = [];

            for (const fileName of workflowFiles) {
                const filePath = path.join(workflowsDir, fileName);

                try {
                    const content = fs.readFileSync(filePath, 'utf8');
                    const workflowInfo = WorkflowScanner.parseWorkflowInfo(fileName, content);
                    workflowInfo.exists = true;
                    workflows.push(workflowInfo);

                } catch (error) {
                    // If we can't parse the workflow, create basic info
                    Global.isVerbose() && console.log(`Could not parse local workflow ${fileName}: ${error}`);
                    workflows.push({
                        name: WorkflowScanner.extractNameFromFileName(fileName),
                        fileName: fileName,
                        exists: true
                    });
                }
            }

            return workflows.sort((a, b) => a.fileName.localeCompare(b.fileName));

        } catch (error) {
            Global.isVerbose() && console.log(`Error scanning local workflows: ${error}`);
            return [];
        }
    }

    /**
     * Parse workflow metadata from YAML content using simple regex extraction
     * Avoids dependency on YAML parser for basic metadata extraction
     */
    private static parseWorkflowInfo(fileName: string, content: string): IWorkflowInfo {
        // Extract workflow name from YAML content using regex
        let workflowName: string | undefined;
        const nameMatch = content.match(/^name:\s*["']?([^"'\n]+)["']?/m);
        if (nameMatch) {
            workflowName = nameMatch[1].trim();
        }

        const workflowInfo: IWorkflowInfo = {
            name: workflowName || WorkflowScanner.extractNameFromFileName(fileName),
            fileName: fileName,
            exists: false // Will be set by caller
        };


        return workflowInfo;
    }

    /**
     * Extract a readable name from the filename
     */
    private static extractNameFromFileName(fileName: string): string {
        // Remove extension
        const nameWithoutExt = fileName.replace(/\.(ya?ml)$/, '');

        // Convert kebab-case and snake_case to Title Case
        return nameWithoutExt
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }


    /**
     * Format workflow status for display
     */
    public static formatWorkflowStatus(status: IWorkflowStatus): string {
        const lines: string[] = [];

        if (status.available.length === 0) {
            lines.push('No workflows found in skeleton repository.');
            return lines.join('\n');
        }

        // Header
        lines.push('Available workflows from skeleton repository:\n');

        // Table header
        const nameWidth = Math.max(20, Math.max(...status.available.map(w => w.name.length)) + 2);
        const fileWidth = Math.max(15, Math.max(...status.available.map(w => w.fileName.length)) + 2);

        const headerLine = `Name`.padEnd(nameWidth) + `File`.padEnd(fileWidth) + `Status`;
        const separatorLine = '-'.repeat(headerLine.length);

        lines.push(headerLine);
        lines.push(separatorLine);

        // Workflow rows
        for (const workflow of status.available) {
            const name = workflow.name.padEnd(nameWidth);
            const file = workflow.fileName.padEnd(fileWidth);
            const statusText = (workflow.exists ? 'Present' : 'Missing');

            lines.push(`${name}${file}${statusText}`);
        }

        // Summary
        const presentCount = status.available.filter(w => w.exists).length;
        const missingCount = status.available.length - presentCount;

        lines.push('');
        lines.push(`Summary: ${status.available.length} total, ${presentCount} present, ${missingCount} missing`);

        return lines.join('\n');
    }
}

