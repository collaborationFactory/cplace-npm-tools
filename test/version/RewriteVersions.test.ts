import { RewriteVersions } from '../../src/commands/version/RewriteVersions';
import { ICommandParameters } from '../../src/commands/models';
import * as fs from 'fs';
import * as path from 'path';
import { Global } from "../../src/Global";

describe('RewriteVersions', () => {
    let testRootDir: string;
    const rootDir = 'collaborationFactory/root';
    const mainDir = 'collaborationFactory/main';
    const pawDir = 'collaborationFactory/cplace-paw';
    const projectPlanningDir = 'collaborationFactory/cplace-project-planning';

    beforeEach(() => {
        testRootDir = fs.mkdtempSync('rewrite-versions-test-');
        createTestStructure();
        jest.spyOn(Global, 'isVerbose').mockReturnValue(true);
    });

    afterEach(() => {
        fs.rmSync(testRootDir, { recursive: true, force: true });
    });

    test('should set main version to .999 and ignore paw/project-planning versions since they are on release branches', async () => {
        updateBranches({ main: 'customer/test-customer-branch' });
        await executeRewriteVersions();

        assertArtifactVersions({
            root: { main: '24.2.999' },
            projectPlanning: { main: '24.2.999' },
            paw: { main: '24.2.999' }
        });

        assertVersionGradleContent(mainDir, "currentVersion='24.2.999'");
    });

    test('should set version to .999 for main and paw since both have non-release branches', async () => {
        updateBranches({
            main: 'customer/test-customer-branch',
            'cplace-paw': 'feature/new-test-feature'
        });
        await executeRewriteVersions();

        assertArtifactVersions({
            root: { main: '24.2.999', 'cplace-paw': '24.2.999' },
            projectPlanning: { main: '24.2.999', 'cplace-paw': '24.2.999' },
            paw: { main: '24.2.999' }
        });
    });

    test('should overwrite existing currentVersion in paw version.gradle when paw has non-release branch', async () => {
        updateBranches({
            main: 'customer/test-customer-branch',
            'cplace-paw': 'feature/new-test-feature'
        });
        createVersionFileWithCurrentVersion(path.join(testRootDir, pawDir));
        await executeRewriteVersions();

        assertArtifactVersions({
            root: { main: '24.2.999', 'cplace-paw': '24.2.999' },
            projectPlanning: { main: '24.2.999', 'cplace-paw': '24.2.999' },
            paw: { main: '24.2.999' }
        });
    });

    test.each([
        {
            name: 'release branches',
            branches: {
                main: 'release/24.2',
                'cplace-paw': 'release/24.1',
                'cplace-project-planning': 'release/24.2'
            }
        },
        {
            name: 'master/main branches',
            branches: {
                main: 'master',
                'cplace-paw': 'main',
                'cplace-project-planning': 'master'
            }
        }
    ])('should not change versions when all branches are $name', async ({ branches }) => {
        updateBranches(branches);
        await executeRewriteVersions();

        assertNoArtifactVersions();
        assertNoCurrentVersions();
    });

    test('should handle missing parent-repos.json gracefully', async () => {
        fs.unlinkSync(path.join(testRootDir, rootDir, 'parent-repos.json'));

        const rewriteVersions = new RewriteVersions();
        const params: ICommandParameters = {};
        expect(rewriteVersions.prepareAndMayExecute(params, path.join(testRootDir, rootDir))).toBe(false);
    });

    test('should handle empty parent-repos.json gracefully', async () => {
        fs.writeFileSync(path.join(testRootDir, rootDir, 'parent-repos.json'), '{}');
        await executeRewriteVersions();

        assertNoArtifactVersions();
        assertNoCurrentVersions();
    });

    function createTestStructure(): void {
        const dirs = [
            path.join(testRootDir, mainDir),
            path.join(testRootDir, rootDir),
            path.join(testRootDir, pawDir),
            path.join(testRootDir, projectPlanningDir)
        ];
        dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));

        createParentRepoFile(path.join(testRootDir, rootDir), ['main', 'cplace-paw', 'cplace-project-planning']);
        createParentRepoFile(path.join(testRootDir, pawDir), ['main']);
        createParentRepoFile(path.join(testRootDir, projectPlanningDir), ['main', 'cplace-paw']);

        dirs.forEach(dir => createVersionFile(dir));
    }

    function updateBranches(branches: Record<string, string>): void {
        const rootParentReposPath = path.join(testRootDir, rootDir, 'parent-repos.json');
        const parentRepos = JSON.parse(fs.readFileSync(rootParentReposPath, 'utf8'));
        Object.entries(branches).forEach(([repo, branch]) => {
            parentRepos[repo].branch = branch;
        });
        fs.writeFileSync(rootParentReposPath, JSON.stringify(parentRepos, null, 2));
    }

    async function executeRewriteVersions(): Promise<void> {
        const rewriteVersions = new RewriteVersions();
        const params: ICommandParameters = {};
        rewriteVersions.prepareAndMayExecute(params, path.join(testRootDir, rootDir));
        await rewriteVersions.execute();
    }

    function assertArtifactVersions(expected: Record<string, Record<string, string>>): void {
        const dirMap = {
            root: rootDir,
            projectPlanning: projectPlanningDir,
            paw: pawDir
        };
        Object.entries(expected).forEach(([key, versions]) => {
            const repoPath = path.join(testRootDir, dirMap[key], 'parent-repos.json');
            const parentRepos = JSON.parse(fs.readFileSync(repoPath, 'utf8'));
            Object.entries(versions).forEach(([repo, version]) => {
                expect(parentRepos[repo].artifactVersion).toBe(version);
            });
            Object.keys(parentRepos).forEach(repo => {
                if (!versions[repo]) {
                    expect(parentRepos[repo].artifactVersion).toBeUndefined();
                }
            });
        });
    }

    function assertNoArtifactVersions(): void {
        const dirs = [rootDir, projectPlanningDir, pawDir];
        dirs.forEach(dir => {
            const repoPath = path.join(testRootDir, dir, 'parent-repos.json');
            const parentRepos = JSON.parse(fs.readFileSync(repoPath, 'utf8'));
            Object.values(parentRepos).forEach(repo => {
                expect(repo['artifactVersion']).toBeUndefined();
            });
        });
    }

    function assertNoCurrentVersions(): void {
        const dirs = [mainDir, rootDir, pawDir, projectPlanningDir];
        dirs.forEach(dir => {
            const content = fs.readFileSync(path.join(testRootDir, dir, 'version.gradle'), 'utf8');
            expect(content).not.toContain('currentVersion');
        });
    }

    function assertVersionGradleContent(dir: string, expectedContent: string): void {
        const content = fs.readFileSync(path.join(testRootDir, dir, 'version.gradle'), 'utf8');
        expect(content).toContain(expectedContent);
    }

    function createParentRepoFile(dir: string, repos: string[]): void {
        const parentRepos = repos.reduce((acc, repo) => {
            const repoName = repo === 'cplace' ? 'main' : repo;
            acc[repoName] = {
                url: `git@github.com:collaborationFactory/${repo}.git`,
                branch: 'release/24.2'
            };
            return acc;
        }, {});
        fs.writeFileSync(path.join(dir, 'parent-repos.json'), JSON.stringify(parentRepos, null, 2));
    }

    function createVersionFile(dir: string): void {
        const content = `
ext {
    createdOnBranch='release/24.2'
    cplaceVersion='24.2'
}`;
        fs.writeFileSync(path.join(dir, 'version.gradle'), content);
    }

    function createVersionFileWithCurrentVersion(dir: string): void {
        const content = `
ext {
    currentVersion='24.2.9'
    createdOnBranch='release/24.2'
    cplaceVersion='24.2'
}`;
        fs.writeFileSync(path.join(dir, 'version.gradle'), content);
    }
});