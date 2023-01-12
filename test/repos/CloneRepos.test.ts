import {ICommandParameters} from '../../src/commands/models';
import {CloneRepos} from '../../src/commands/repos/CloneRepos';
import {
    basicTestSetupData, multiBranchTestSetupData,
    catParentReposJson, testWith, writeAndCommitParentRepos, gitDescribe,
    assertThatTheParentReposAreCheckedOutToTheExpectedTags, assertAllFoldersArePresent, assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch, assertVoid
} from '../helpers/remoteRepositories';
import {AbstractReposCommand} from '../../src/commands/repos/AbstractReposCommand';
import * as path from 'path';
import {Global} from '../../src/Global';
import {IReposDescriptor} from '../../src/commands/repos/models';

/*
 * Tests several behaviours cloning the parent repositories.
 * Scenarios and expectations:
 * A) only branches are configured and there are no remote tags
 *    -> use the latest remote HEAD of the branch
 * B) only branches are configured
 *    -> clone the latest tag
 * C) only tags are configured
 *    -> clone the specified tags
 * D) branches and tags are mixed
 *   -> in case of only a branch, clone the latest tag
 *   -> in case of tag, clone the tag
 * E) in case of 'useSnapshot'
 *   -> use the latest remote HEAD of the branch
 * F) in case of a tagMarker but no tag:
 *   -> use the latest tag and validate that the version matches at least the tag marker
 * G) only the repo url is configured
 *   -> use the latest HEAD of the default branch
 * H) A tag that does not exist is configured
 *   -> Cloning should fail at this point
 * I) A tag with another format is configured
 *   -> should be cloned to the custom tag
 * J) A customer branch with useSnapshot is configured
 *   -> should be cloned on the latest HEAD of the customer branch
 * K) A customer branch is configured
 *   -> should be cloned on the latest HEAD of the customer branch as remote tags are only resolved for release branches
 */

// tslint:disable-next-line:variable-name
const expectedTagFormat_22_2_0 = /^version\/22.2.0-0-\w+\n$/;

function assertThatTheParentsWorkingCopyIsOnTheExpectedTag(rootDir: string, expectedTagFormat: RegExp = expectedTagFormat_22_2_0): void {
    const parentRepos = catParentReposJson(rootDir);
    Object.keys(parentRepos).forEach((repo) => {
        const repoFolder = path.resolve(rootDir, '..', repo);
        const tagDescription = gitDescribe(repoFolder);
        expect(expectedTagFormat.test(tagDescription)).toBeTruthy();
    });
}

async function testWithParentRepos(rootDir: string, parentRepos?: IReposDescriptor): Promise<string> {
    if (parentRepos) {
        writeAndCommitParentRepos(parentRepos, rootDir);
    }
    const params: ICommandParameters = {};
    params[AbstractReposCommand.PARAMETER_CLONE_DEPTH] = 1;
    params[Global.PARAMETER_VERBOSE] = true;
    Global.parseParameters(params);
    const cr = new CloneRepos();
    cr.prepareAndMayExecute(params, rootDir);
    await cr.execute();

    return rootDir;
}

describe('cloning the parent repos', () => {

    test('B) using the initial parent-repos.json with branches configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            return testWithParentRepos(rootDir);
        };

        const assertCloningTheParentReposOnTheLatestTag = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);
            // is expected to be on the latest tag, that is 22.2.0
            assertThatTheParentsWorkingCopyIsOnTheExpectedTag(testResult);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposOnTheLatestTag);
    });

    test('C) when tags are configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            Object.keys(parentRepos).forEach((repo) => {
                parentRepos[repo].tag = 'version/22.2.0';
            });
            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsOnly = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);
            // is expected to be on the configured tag, that is 22.2.0
            assertThatTheParentsWorkingCopyIsOnTheExpectedTag(testResult);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposTagsOnly);
    });

    test('D) & E) when tags and branches with useSnapshot are configured', async () => {
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
            assertAllFoldersArePresent(testResult);

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

    test('G) only the repo url is configured, tags do not exist on master', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            Object.keys(parentRepos).forEach((repo) => {
                parentRepos[repo].branch = null;
            });
            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposBranchesOnly = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);

            const parentRepos = catParentReposJson(testResult);
            Object.keys(parentRepos).forEach((repo) => {
                const repoFolder = path.resolve(testResult, '..', repo);
                assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, 'master');
            });
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('master')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposBranchesOnly);
    });

    test('H) A tag that does not exist is configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<boolean> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.main.tag = 'version/22.2.99';
            await testWithParentRepos(rootDir, parentRepos)
                .catch((e) => {
                    // expected to fail
                    if (!e.includes('version/22.2.99')) {
                        throw new Error('Did not to fail with the expected reason!');
                    }
                });
            return true;
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('master')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertVoid);
    });
});

describe('cloning the parent repos for a complex setup', () => {

    test('A) using the initial parent-repos.json with branches configured but without any remote tags', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            return testWithParentRepos(rootDir);
        };

        const assertCloningTheParentReposBranchesOnly = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);

            const parentRepos = catParentReposJson(testResult);
            Object.keys(parentRepos).forEach((repo) => {
                const repoFolder = path.resolve(testResult, '..', repo);
                assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, 'release/5.20');
            });
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/5.20')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposBranchesOnly);
    });

    test('C) when tags are configured with diverging versions', async () => {
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
            assertAllFoldersArePresent(testResult);

            expect(JSON.stringify(catParentReposJson(testResult))).toEqual(JSON.stringify(expectedParentJson));

            assertThatTheParentReposAreCheckedOutToTheExpectedTags(tags, testResult);
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposTagsOnly);
    });

    test('D) & E) when tags, branches and useSnapshot are configured', async () => {
        const testCloningTheParentReposWithTagsAndBranches = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.main.tag = 'version/22.3.1';
            parentRepos.main.tagMarker = 'version/22.3.1';
            parentRepos.test_2.useSnapshot = true;

            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsAndBranches = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);

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

    test('F) in case of a tagMarker but no tag', async () => {
        const tagMarker = {
            main: 'version/22.3.1',
            test_1: 'version/22.3.3',
            test_2: 'version/22.3.1'
        };
        const expectedTags = {
            main: 'version/22.3.2',
            test_1: 'version/22.3.4',
            test_2: 'version/22.3.2'
        };
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            Object.keys(tagMarker).forEach((repo) => {
                parentRepos[repo].tagMarker = tagMarker[repo];
            });
            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsOnly = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);
            assertThatTheParentReposAreCheckedOutToTheExpectedTags(expectedTags, testResult);
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentReposTagsOnly);
    });

    test('F) in case of a tagMarker but no tag fails when a wrong tagMarker is configured', async () => {

        const testCloningTheParentReposWithTagMarkersFails = async (rootDir: string): Promise<boolean> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.main.tagMarker = 'version/22.3.1';
            parentRepos.test_1.tagMarker = 'version/22.3.1';
            // there is no tag 22.3.2
            parentRepos.test_2.tagMarker = 'version/22.3.3';

            await testWithParentRepos(rootDir, parentRepos)
                .catch((e) => {
                    // expected to fail
                    if (!e.endsWith('[test_2]: Configured tagMarker version/22.3.3 has a higher patch version then the latest available tag version/22.3.2!')) {
                        throw new Error('Did not to fail due to "[test_2]: Configured tagMarker version/22.3.3 has a higher version then the latest available tag version/22.3.2!"!');
                    }
                });
            return true;
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagMarkersFails, assertVoid);
    });

    test('I) A tag with another format is configured', async () => {
        const testCloningTheParentReposWithTagsAndBranches = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.test_2.tag = 'custom/22.4.0-A-2';

            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsAndBranches = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);

            let repoFolder = path.resolve(testResult, '..', 'main');
            let tagDescription = gitDescribe(repoFolder);
            expect(/^version\/22.4.0-0-\w+\n$/.test(tagDescription)).toBeTruthy();

            repoFolder = path.resolve(testResult, '..', 'test_1');
            tagDescription = gitDescribe(repoFolder);
            expect(/^version\/22.4.1-0-\w+\n$/.test(tagDescription)).toBeTruthy();

            repoFolder = path.resolve(testResult, '..', 'test_2');
            tagDescription = gitDescribe(repoFolder);
            expect(/^custom\/22.4.0-A-2-0-\w+\n$/.test(tagDescription)).toBeTruthy();
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.4')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches);
    });

    test('J) A customer branch with useSnapshot is configured', async () => {
        const testCloningTheParentReposWithTagsAndBranches = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.test_2.branch = 'customer/22.4-A-2';
            parentRepos.test_2.useSnapshot = true;

            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsAndBranches = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);

            let repoFolder = path.resolve(testResult, '..', 'main');
            let tagDescription = gitDescribe(repoFolder);
            expect(/^version\/22.4.0-0-\w+\n$/.test(tagDescription)).toBeTruthy();

            repoFolder = path.resolve(testResult, '..', 'test_1');
            tagDescription = gitDescribe(repoFolder);
            expect(/^version\/22.4.1-0-\w+\n$/.test(tagDescription)).toBeTruthy();

            repoFolder = path.resolve(testResult, '..', 'test_2');
            assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, 'customer/22.4-A-2');
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.4')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches);
    });

    test('K) A customer branch is configured', async () => {
        const testCloningTheParentReposWithTagsAndBranches = async (rootDir: string): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            parentRepos.test_2.branch = 'customer/22.4-A-2';

            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsAndBranches = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);

            let repoFolder = path.resolve(testResult, '..', 'main');
            let tagDescription = gitDescribe(repoFolder);
            expect(/^version\/22.4.0-0-\w+\n$/.test(tagDescription)).toBeTruthy();

            repoFolder = path.resolve(testResult, '..', 'test_1');
            tagDescription = gitDescribe(repoFolder);
            expect(/^version\/22.4.1-0-\w+\n$/.test(tagDescription)).toBeTruthy();

            repoFolder = path.resolve(testResult, '..', 'test_2');
            assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, 'customer/22.4-A-2');
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.4')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertCloningTheParentReposTagsAndBranches);
    });
});
