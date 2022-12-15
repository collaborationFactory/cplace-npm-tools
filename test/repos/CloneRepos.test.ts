import {ICommandParameters} from '../../src/commands/models';
import {CloneRepos} from '../../src/commands/repos/CloneRepos';
import {basicTestSetupData, catParentReposJson, ROOT_REPO, testWith, writeParentReposJson} from '../helpers/remoteRepositories';
import {AbstractReposCommand} from '../../src/commands/repos/AbstractReposCommand';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {Global} from '../../src/Global';
import {IReposDescriptor} from '../../src/commands/repos/models';

function assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder: string, branch: string): void {
    const gitUpdateCommand = `git remote update`;
    const gitDiffCommand = `git diff --exit-code origin/${branch}`;
    child_process.execSync(
        gitUpdateCommand,
        {
            cwd: repoFolder,
            shell: 'bash'
        }
    );
    try {
        child_process.execSync(
            gitDiffCommand,
            {
                cwd: repoFolder,
                shell: 'bash'
            }
        );
    } catch (e) {
        console.log(`Git diff failed due to:
        ${e.status}
        ${e.message}
        ${e.stderr?.toString()}
        ${e.stdout?.toString()}
    `);
        throw e;
    }
}

async function testWithParentRepos(rootDir: string, parentRepos?: IReposDescriptor): Promise<string> {
    if (parentRepos) {
        writeParentReposJson(rootDir, parentRepos);

        try {
            child_process.execSync(
                'git commit -a -m "updates parent repos" && git push',
                {
                    cwd: rootDir,
                    shell: 'bash'
                }
            );
        } catch (e) {
            console.log(`Git diff failed due to:
        ${e.status}
        ${e.message}
        ${e.stderr?.toString()}
        ${e.stdout?.toString()}
         `);
            throw e;
        }

        console.log(catParentReposJson(rootDir));
    }
    const params: ICommandParameters = {};
    params[AbstractReposCommand.PARAMETER_CLONE_DEPTH] = 0;
    params[Global.PARAMETER_VERBOSE] = true;

    const cl = new CloneRepos();
    cl.prepareAndMayExecute(params, rootDir);
    await cl.execute();

    return rootDir;
}

describe('cloning the parent repos', () => {

    const expectedTagFormat = /^version\/22.2.0-0-\w+\n$/;

    test('using the initial parent-repos.json', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            return testWithParentRepos(rootDir);
        };

        const assertCloningTheParentReposBranchesOnly = async (testResult: string): Promise<void> => {
            const files = fs.readdirSync(path.resolve(testResult, '..'));
            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);

            const parentRepos = catParentReposJson(testResult);
            Object.keys(parentRepos).forEach((repo) => {
                const repoFolder = path.resolve(testResult, '..', repo);
                assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, parentRepos[repo].branch);
            });
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposBranchesOnly);
    });

    test('when tags are configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            Object.keys(parentRepos).forEach((repo) => {
                parentRepos[repo].tag = 'version/22.2.0';
            });
            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsOnly = async (testResult: string): Promise<void> => {
            const gitDescribeCommand = `git describe --long`;
            const files = fs.readdirSync(path.resolve(testResult, '..'));
            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);

            const parentRepos = catParentReposJson(testResult);
            Object.keys(parentRepos).forEach((repo) => {
                const repoFolder = path.resolve(testResult, '..', repo);
                const tagDescription = child_process.execSync(
                    gitDescribeCommand,
                    {
                        cwd: repoFolder,
                        shell: 'bash'
                    }
                );
                expect(expectedTagFormat.exec(tagDescription.toString())).toBeTruthy();
            });
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposTagsOnly);
    });

    test('when tags and branches are configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.main.tag = 'version/22.2.0';
            parentRepos.test_1.tag = 'version/22.2.0';

            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsAndBranches = async (testResult: string): Promise<void> => {
            const gitDescribeCommand = `git describe --long`;
            const files = fs.readdirSync(path.resolve(testResult, '..'));
            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);

            [ROOT_REPO, 'test_2'].forEach((repo) => {
                const repoFolder = path.resolve(testResult, '..', repo);
                assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, 'release/22.2');
            });

            ['main', 'test_1'].forEach((repo) => {
                const repoFolder = path.resolve(testResult, '..', repo);
                const tagDescription = child_process.execSync(
                    gitDescribeCommand,
                    {
                        cwd: repoFolder,
                        shell: 'bash'
                    }
                );
                expect(expectedTagFormat.exec(tagDescription.toString())).toBeTruthy();
            });
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposTagsAndBranches);
    });
});
