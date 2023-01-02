import {ICommandParameters} from '../../src/commands/models';
import {CloneRepos} from '../../src/commands/repos/CloneRepos';
import {basicTestSetupData, catParentReposJson, multiBranchTestSetupData, testWith, writeParentReposJson} from '../helpers/remoteRepositories';
import {AbstractReposCommand} from '../../src/commands/repos/AbstractReposCommand';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {Global} from '../../src/Global';
import {IReposDescriptor} from '../../src/commands/repos/models';

/*
 * Tests several behaviours cloning the parent repositories.
 * Scenarios and expectations:
 * 1) - only branches are configured
 *    -> clone the latest tag
 * 2) - only tags are configured
 *    -> clone the specified tags
 * 3) - branches and tags are mixed
 *   -> in case of only a branch, clone the latest tag
 *   -> in case of tag, clone the tag
 * 4) in case of 'useSnapshot'
 *   -> use the latest remote HEAD of the branch
 * 5) in case of a tagMarker but no tag:
 *   -> use the latest tag and validate that the version matches at least the tag marker
 */

// tslint:disable-next-line:variable-name
const expectedTagFormat_22_2_0 = /^version\/22.2.0-0-\w+\n$/;

function gitDescribe(repoFolder: string): string {
    let tagDescription: Buffer;
    try {
        tagDescription = child_process.execSync(
            'git describe --long',
            {
                cwd: repoFolder,
                shell: 'bash'
            }
        );
    } catch (e) {
        console.log(`Git describe failed in ${repoFolder} due to:
        ${e.status}
        ${e.message}
        ${e.stderr?.toString()}
        ${e.stdout?.toString()}
    `);
        throw e;
    }
    return tagDescription.toString();
}

function assertThatTheParentsWorkingCopyIsOnTheExpectedTag(rootDir: string, expectedTagFormat: RegExp = expectedTagFormat_22_2_0): void {
    const parentRepos = catParentReposJson(rootDir);
    Object.keys(parentRepos).forEach((repo) => {
        const repoFolder = path.resolve(rootDir, '..', repo);
        const tagDescription = gitDescribe(repoFolder);
        expect(expectedTagFormat.test(tagDescription)).toBeTruthy();
    });
}

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
            console.log(`Git commit or push failed in ${rootDir} due to:
        ${e.status}
        ${e.message}
        ${e.stderr?.toString()}
        ${e.stdout?.toString()}
         `);
            throw e;
        }
    }
    const params: ICommandParameters = {};
    params[AbstractReposCommand.PARAMETER_CLONE_DEPTH] = 1;
    params[Global.PARAMETER_VERBOSE] = true;
    Global.parseParameters(params);
    const cl = new CloneRepos();
    cl.prepareAndMayExecute(params, rootDir);
    await cl.execute();

    return rootDir;
}

describe('cloning the parent repos', () => {

    test('1) using the initial parent-repos.json with branches configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            return testWithParentRepos(rootDir);
        };

        const assertCloningTheParentReposBranchesOnly = async (testResult: string): Promise<void> => {
            const files = fs.readdirSync(path.resolve(testResult, '..'));
            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);
            // is expected to be on the latest tag, that is 22.2.0
            assertThatTheParentsWorkingCopyIsOnTheExpectedTag(testResult);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposBranchesOnly);
    });

    test('2) when tags are configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            Object.keys(parentRepos).forEach((repo) => {
                parentRepos[repo].tag = 'version/22.2.0';
            });
            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsOnly = async (testResult: string): Promise<void> => {
            const files = fs.readdirSync(path.resolve(testResult, '..'));
            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);

            // is expected to be on the configured tag, that is 22.2.0
            assertThatTheParentsWorkingCopyIsOnTheExpectedTag(testResult);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposTagsOnly);
    });

    test('3) & 4) when tags and branches with useSnapshot are configured', async () => {
        const testCloningTheParentReposWithTagsAndBranches = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.main.tag = 'version/22.2.0';
            parentRepos.main.tagMarker = 'version/22.2.0';
            parentRepos.test_1.tag = 'version/22.2.0';
            parentRepos.test_1.tagMarker = 'version/22.2.0';
            // useSnapshot is expected to take precedence
            parentRepos.test_2.tag = 'version/22.2.0';
            parentRepos.test_2.tagMarker = 'version/22.2.0';
            parentRepos.test_2.useSnapshot = true;

            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsAndBranches = async (testResult: string): Promise<void> => {
            const files = fs.readdirSync(path.resolve(testResult, '..'));
            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);

            let repoFolder = path.resolve(testResult, '..', 'test_2');
            assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, 'release/22.2');

            ['main', 'test_1'].forEach((repo) => {
                repoFolder = path.resolve(testResult, '..', repo);
                const tagDescription = gitDescribe(repoFolder);
                expect(expectedTagFormat_22_2_0.test(tagDescription)).toBeTruthy();
            });
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches);
    });
});
describe('cloning the parent repos for a complex setup', () => {

    test('2) when tags are configured with diverging versions', async () => {
        let expectedParentJson: IReposDescriptor;
        const tags = {
            main: 'version/22.3.2',
            test_1: 'version/22.3.4',
            test_2: 'version/22.3.2'
        };
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.main.tag = tags.main;
            parentRepos.main.tagMarker = tags.main;
            parentRepos.test_1.tag = tags.test_1;
            parentRepos.test_1.tagMarker = tags.test_1;
            parentRepos.test_2.tag = tags.test_2;
            parentRepos.test_2.tagMarker = tags.test_2;

            expectedParentJson = parentRepos;
            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsOnly = async (testResult: string): Promise<void> => {
            const files = fs.readdirSync(path.resolve(testResult, '..'));
            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);

            expect(JSON.stringify(catParentReposJson(testResult))).toEqual(JSON.stringify(expectedParentJson));

            let failed = false;
            Object.keys(tags).forEach((repo) => {
                const repoFolder = path.resolve(testResult, '..', repo);
                const tagDescription = gitDescribe(repoFolder);
                const regex = new RegExp(`${tags[repo]}-0-\\w+\\n$`);
                try {
                    expect(regex.test(tagDescription)).toBeTruthy();
                } catch (e) {
                    failed = true;
                    console.log(`Failed for ${repo}: expected tag = ${tags[repo]}, got description ${tagDescription}`);
                }

                expect(failed).toBeFalsy();
            });
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposTagsOnly);
    });

    test('3) & 4) when tags, branches and useSnapshot are configured', async () => {
        const testCloningTheParentReposWithTagsAndBranches = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.main.tag = 'version/22.3.1';
            parentRepos.main.tagMarker = 'version/22.3.1';
            parentRepos.test_2.useSnapshot = true;

            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsAndBranches = async (testResult: string): Promise<void> => {
            const files = fs.readdirSync(path.resolve(testResult, '..'));
            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);

            let repoFolder = path.resolve(testResult, '..', 'main');
            let tagDescription = gitDescribe(repoFolder);
            expect(/^version\/22.3.1-0-\w+\n$/.test(tagDescription)).toBeTruthy();

            repoFolder = path.resolve(testResult, '..', 'test_1');
            tagDescription = gitDescribe(repoFolder);
            expect(/^version\/22.3.4-0-\w+\n$/.test(tagDescription)).toBeTruthy();

            repoFolder = path.resolve(testResult, '..', 'test_2');
            assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, 'release/22.3');
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches);
    });

    test('5) fails when a wrong tagMarker is configured', async () => {

        const testCloningTheParentReposWithTagMarkersFails = async (rootDir: string): Promise<boolean> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.main.tagMarker = 'version/22.3.1';
            parentRepos.test_1.tagMarker = 'version/22.3.1';
            // there is no tag 22.3.2
            parentRepos.test_2.tagMarker = 'version/22.3.3';

            await testWithParentRepos(rootDir, parentRepos)
                .catch((e) => {
                    // expected to fail
                    if (!e.endsWith('[test_2]: Configured tagMarker version/22.3.3 has a higher version then the latest available tag version/22.3.2!')) {
                        throw new Error('Did not to fail due to "[test_2]: Configured tagMarker version/22.3.3 has a higher version then the latest available tag version/22.3.2!"!');
                    }
                });
            return true;
        };

        const assertVoid = (testResult: boolean): Promise<void> => {
            if (!testResult === true) {
                throw new Error('This test is expected to fail and should not reach the assertion!');
            }
            return;
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagMarkersFails, assertVoid);
    });
});
