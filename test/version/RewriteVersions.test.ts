import { RewriteVersions } from '../../src/commands/version/RewriteVersions';
import { ICommandParameters } from '../../src/commands/models';
import * as fs from 'fs';
import * as path from 'path';
import {Global} from "../../src/Global";

describe('RewriteVersions', () => {
    let testRootDir: string;
    const rootDir = 'collaborationFactory/root';
    const mainDir = 'collaborationFactory/main';
    const pawDir = 'collaborationFactory/cplace-paw';
    const ppDir = 'collaborationFactory/cplace-project-planning';

    beforeEach(() => {
        // Create test directories
        testRootDir = fs.mkdtempSync('rewrite-versions-test-');

        createDirs([
            path.join(testRootDir, mainDir),
            path.join(testRootDir, rootDir),
            path.join(testRootDir, pawDir),
            path.join(testRootDir, ppDir)
        ]);

        // Create initial parent repos files and version files
        createParentRepoFile(path.join(testRootDir, rootDir), ['main', 'cplace-paw', 'cplace-project-planning']);
        createParentRepoFile(path.join(testRootDir, pawDir), ['main']);
        createParentRepoFile(path.join(testRootDir, ppDir), ['main', 'cplace-paw']);

        createVersionFile(path.join(testRootDir, mainDir));
        createVersionFile(path.join(testRootDir, rootDir));
        createVersionFile(path.join(testRootDir, pawDir));
        createVersionFile(path.join(testRootDir, ppDir));

        // Mock Global.isVerbose
        jest.spyOn(Global, 'isVerbose').mockReturnValue(true);
    });

    afterEach(() => {
        // Cleanup test directory
        fs.rmSync(testRootDir, { recursive: true, force: true });
    });

    test('customer branch in main only', async () => {
        const rootParentReposPath = path.join(testRootDir, rootDir, 'parent-repos.json');
        let parentRepos = JSON.parse(fs.readFileSync(rootParentReposPath, 'utf8'));
        parentRepos.main.branch = 'customer/test-customer-branch';
        fs.writeFileSync(rootParentReposPath, JSON.stringify(parentRepos, null, 2));

        const rewriteVersions = new RewriteVersions();
        const params: ICommandParameters = {};

        rewriteVersions.prepareAndMayExecute(params, path.join(testRootDir, rootDir));
        await rewriteVersions.execute();

        // Check root parent-repos.json
        parentRepos = JSON.parse(fs.readFileSync(rootParentReposPath, 'utf8'));
        expect(parentRepos.main.artifactVersion).toBe('24.2.999');
        expect(parentRepos['cplace-paw'].artifactVersion).toBeUndefined();
        expect(parentRepos['cplace-project-planning'].artifactVersion).toBeUndefined();

        // Check PP parent-repos.json
        const ppParentRepos = JSON.parse(fs.readFileSync(path.join(testRootDir, ppDir, 'parent-repos.json'), 'utf8'));
        expect(ppParentRepos.main.artifactVersion).toBe('24.2.999');
        expect(ppParentRepos['cplace-paw'].artifactVersion).toBeUndefined();

        // Check PAW parent-repos.json
        const pawParentRepos = JSON.parse(fs.readFileSync(path.join(testRootDir, pawDir, 'parent-repos.json'), 'utf8'));
        expect(pawParentRepos.main.artifactVersion).toBe('24.2.999');

        // Check version.gradle in main
        const mainVersionGradle = fs.readFileSync(path.join(testRootDir, mainDir, 'version.gradle'), 'utf8');
        expect(mainVersionGradle).toContain("currentVersion='24.2.999'");
    });

    test('customer branch in main and cplace-paw', async () => {
        const rootParentReposPath = path.join(testRootDir, rootDir, 'parent-repos.json');
        let parentRepos = JSON.parse(fs.readFileSync(rootParentReposPath, 'utf8'));
        parentRepos.main.branch = 'customer/test-customer-branch';
        parentRepos['cplace-paw'].branch = 'feature/new-test-feature';
        fs.writeFileSync(rootParentReposPath, JSON.stringify(parentRepos, null, 2));

        const rewriteVersions = new RewriteVersions();
        const params: ICommandParameters = {};

        rewriteVersions.prepareAndMayExecute(params, path.join(testRootDir, rootDir));
        await rewriteVersions.execute();

        // Check root parent-repos.json
        parentRepos = JSON.parse(fs.readFileSync(rootParentReposPath, 'utf8'));
        expect(parentRepos.main.artifactVersion).toBe('24.2.999');
        expect(parentRepos['cplace-paw'].artifactVersion).toBe('24.2.999');
        expect(parentRepos['cplace-project-planning'].artifactVersion).toBeUndefined();

        // Check PP parent-repos.json
        const ppParentRepos = JSON.parse(fs.readFileSync(path.join(testRootDir, ppDir, 'parent-repos.json'), 'utf8'));
        expect(ppParentRepos.main.artifactVersion).toBe('24.2.999');
        expect(ppParentRepos['cplace-paw'].artifactVersion).toBe('24.2.999');

        // Check PAW parent-repos.json
        const pawParentRepos = JSON.parse(fs.readFileSync(path.join(testRootDir, pawDir, 'parent-repos.json'), 'utf8'));
        expect(pawParentRepos.main.artifactVersion).toBe('24.2.999');
    });

    test('currentVersion already set in cplace-paw', async () => {
        const rootParentReposPath = path.join(testRootDir, rootDir, 'parent-repos.json');
        let parentRepos = JSON.parse(fs.readFileSync(rootParentReposPath, 'utf8'));
        parentRepos.main.branch = 'customer/test-customer-branch';
        parentRepos['cplace-paw'].branch = 'feature/new-test-feature';
        fs.writeFileSync(rootParentReposPath, JSON.stringify(parentRepos, null, 2));

        // Create version file with existing currentVersion in PAW
        createVersionFileWithCurrentVersion(path.join(testRootDir, pawDir));

        const rewriteVersions = new RewriteVersions();
        const params: ICommandParameters = {};

        rewriteVersions.prepareAndMayExecute(params, path.join(testRootDir, rootDir));
        await rewriteVersions.execute();

        // Check root parent-repos.json
        parentRepos = JSON.parse(fs.readFileSync(rootParentReposPath, 'utf8'));
        expect(parentRepos.main.artifactVersion).toBe('24.2.999');
        expect(parentRepos['cplace-paw'].artifactVersion).toBe('24.2.999');
        expect(parentRepos['cplace-project-planning'].artifactVersion).toBeUndefined();

        // Check PP parent-repos.json
        const ppParentRepos = JSON.parse(fs.readFileSync(path.join(testRootDir, ppDir, 'parent-repos.json'), 'utf8'));
        expect(ppParentRepos.main.artifactVersion).toBe('24.2.999');
        expect(ppParentRepos['cplace-paw'].artifactVersion).toBe('24.2.999');

        // Check PAW parent-repos.json
        const pawParentRepos = JSON.parse(fs.readFileSync(path.join(testRootDir, pawDir, 'parent-repos.json'), 'utf8'));
        expect(pawParentRepos.main.artifactVersion).toBe('24.2.999');
    });

    // Helper functions
    function createDirs(dirs: string[]) {
        dirs.forEach(dir => fs.mkdirSync(dir, { recursive: true }));
    }

    function createParentRepoFile(dir: string, repos: string[]) {
        const parentRepos = repos.reduce((acc, repo) => {
            const repoName = repo === 'cplace' ? 'main' : repo;
            acc[repoName] = {
                url: `git@github.com:collaborationFactory/${repo}.git`,
                branch: 'release/24.2'
            };
            return acc;
        }, {});

        fs.writeFileSync(
            path.join(dir, 'parent-repos.json'),
            JSON.stringify(parentRepos, null, 2)
        );
    }

    function createVersionFile(dir: string) {
        const content = `
ext {
    createdOnBranch='release/24.2'
    cplaceVersion='24.2'
}
`;
        fs.writeFileSync(path.join(dir, 'version.gradle'), content);
    }

    function createVersionFileWithCurrentVersion(dir: string) {
        const content = `
ext {
    currentVersion='24.2.9'
    createdOnBranch='release/24.2'
    cplaceVersion='24.2'
}
`;
        fs.writeFileSync(path.join(dir, 'version.gradle'), content);
    }
});
