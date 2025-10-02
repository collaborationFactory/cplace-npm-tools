import { WorkflowScanner } from '../../src/helpers/WorkflowScanner';
import { SkeletonManager } from '../../src/helpers/SkeletonManager';
import { Repository } from '../../src/git';
import { Global } from '../../src/Global';
import { IWorkflowStatus } from '../../src/commands/repos/workflows/models';
import * as fs from 'fs';

jest.mock('../../src/Global');
jest.mock('../../src/helpers/SkeletonManager');
jest.mock('fs');

describe('WorkflowScanner', () => {
    const mockGlobal = Global as jest.Mocked<typeof Global>;
    const mockSkeletonManager = SkeletonManager as jest.Mocked<typeof SkeletonManager>;
    const mockFs = fs as jest.Mocked<typeof fs>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        mockGlobal.isVerbose.mockReturnValue(false);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('parseWorkflowInfo', () => {
        it('should extract workflow name from YAML content', () => {
            const yamlContent = `
name: CI Pipeline
on:
  push:
    branches: [ main ]
`;
            const result = (WorkflowScanner as any).parseWorkflowInfo('ci.yml', yamlContent, 100);

            expect(result.name).toBe('CI Pipeline');
            expect(result.fileName).toBe('ci.yml');
            expect(result.exists).toBe(false);
        });

        it('should extract workflow name with quotes', () => {
            const yamlContent = `name: "Deploy to Production"`;
            const result = (WorkflowScanner as any).parseWorkflowInfo('deploy.yml', yamlContent);

            expect(result.name).toBe('Deploy to Production');
        });

        it('should extract workflow name with single quotes', () => {
            const yamlContent = `name: 'Test Suite'`;
            const result = (WorkflowScanner as any).parseWorkflowInfo('test.yml', yamlContent);

            expect(result.name).toBe('Test Suite');
        });

        it('should fallback to filename when name not found', () => {
            const yamlContent = `on: push`;
            const result = (WorkflowScanner as any).parseWorkflowInfo('complex-workflow.yml', yamlContent);

            expect(result.name).toBe('Complex Workflow');
        });
    });

    describe('extractNameFromFileName', () => {
        it('should convert kebab-case to Title Case', () => {
            const result = (WorkflowScanner as any).extractNameFromFileName('ci-cd-pipeline.yml');
            expect(result).toBe('Ci Cd Pipeline');
        });

        it('should convert snake_case to Title Case', () => {
            const result = (WorkflowScanner as any).extractNameFromFileName('run_tests.yaml');
            expect(result).toBe('Run Tests');
        });

        it('should handle mixed case', () => {
            const result = (WorkflowScanner as any).extractNameFromFileName('deploy_to-production.yml');
            expect(result).toBe('Deploy To Production');
        });

        it('should handle single word', () => {
            const result = (WorkflowScanner as any).extractNameFromFileName('build.yml');
            expect(result).toBe('Build');
        });
    });


    describe('formatWorkflowStatus', () => {
        it('should display message when no workflows found', () => {
            const status: IWorkflowStatus = {
                available: [],
                existing: []
            };

            const result = WorkflowScanner.formatWorkflowStatus(status);
            expect(result).toBe('No workflows found in skeleton repository.');
        });

        it('should format workflow table correctly', () => {
            const status: IWorkflowStatus = {
                available: [
                    {
                        name: 'CI Pipeline',
                        fileName: 'ci.yml',
                        exists: true
                    },
                    {
                        name: 'Deploy',
                        fileName: 'deploy.yml',
                        exists: false
                    }
                ],
                existing: []
            };

            const result = WorkflowScanner.formatWorkflowStatus(status);

            expect(result).toContain('Available workflows from skeleton repository:');
            expect(result).toContain('CI Pipeline');
            expect(result).toContain('Deploy');
            expect(result).toContain('ci.yml');
            expect(result).toContain('deploy.yml');
            expect(result).toContain('Present');
            expect(result).toContain('Missing');
            expect(result).toContain('Summary: 2 total, 1 present, 1 missing');
        });
    });

    describe('scanWorkflows', () => {
        let mockRepo: jest.Mocked<Repository>;

        beforeEach(() => {
            mockRepo = {
                workingDir: '/test/repo'
            } as any;
        });

        it('should scan skeleton and local workflows successfully', async () => {
            // Mock skeleton workflows
            mockSkeletonManager.listWorkflowsInBranch.mockResolvedValue([
                '.github/workflows/ci.yml',
                '.github/workflows/deploy.yml'
            ]);

            mockSkeletonManager.getFileContentFromRemote
                .mockResolvedValueOnce('name: CI Pipeline\non: push')
                .mockResolvedValueOnce('name: Deploy\non: workflow_dispatch');

            // Mock local workflows
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readdirSync.mockReturnValue(['ci.yml'] as any);
            mockFs.readFileSync.mockReturnValue('name: CI Pipeline\non: push');
            mockFs.statSync.mockReturnValue({ size: 100 } as any);

            const result = await WorkflowScanner.scanWorkflows(mockRepo, 'version/25.4');

            expect(result.available).toHaveLength(2);
            expect(result.existing).toHaveLength(1);
            expect(result.available[0].exists).toBe(true); // ci.yml exists locally
            expect(result.available[1].exists).toBe(false); // deploy.yml doesn't exist locally
        });

        it('should handle missing local workflows directory', async () => {
            mockSkeletonManager.listWorkflowsInBranch.mockResolvedValue(['.github/workflows/ci.yml']);
            mockSkeletonManager.getFileContentFromRemote.mockResolvedValue('name: CI\non: push');

            // No local .github/workflows directory
            mockFs.existsSync.mockReturnValue(false);

            const result = await WorkflowScanner.scanWorkflows(mockRepo, 'version/25.4');

            expect(result.available).toHaveLength(1);
            expect(result.existing).toHaveLength(0);
            expect(result.available[0].exists).toBe(false);
        });

        it('should handle skeleton repository without workflows', async () => {
            mockSkeletonManager.listWorkflowsInBranch.mockResolvedValue([]);
            mockFs.existsSync.mockReturnValue(false);

            const result = await WorkflowScanner.scanWorkflows(mockRepo, 'version/25.4');

            expect(result.available).toHaveLength(0);
            expect(result.existing).toHaveLength(0);
        });

        it('should handle errors when parsing skeleton workflows', async () => {
            mockSkeletonManager.listWorkflowsInBranch.mockResolvedValue(['.github/workflows/broken.yml']);
            mockSkeletonManager.getFileContentFromRemote.mockRejectedValue(new Error('Access denied'));

            mockFs.existsSync.mockReturnValue(false);

            const result = await WorkflowScanner.scanWorkflows(mockRepo, 'version/25.4');

            expect(result.available).toHaveLength(1);
            expect(result.available[0].name).toBe('Broken'); // Fallback to filename
        });

        it('should propagate errors from skeleton operations', async () => {
            mockSkeletonManager.listWorkflowsInBranch.mockRejectedValue(new Error('Network error'));

            await expect(WorkflowScanner.scanWorkflows(mockRepo, 'version/25.4'))
                .rejects.toThrow('Failed to scan workflows: Network error');
        });
    });
});
