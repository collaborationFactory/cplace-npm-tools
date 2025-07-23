import {ICommandParameters} from '../../src/commands/models';
import {CloneRepos} from '../../src/commands/repos/CloneRepos';
import {
    basicTestSetupData, multiBranchTestSetupData,
    catParentReposJson, testWith, writeAndCommitParentRepos,
    assertThatTheParentReposAreCheckedOutToTheExpectedTags, assertAllFoldersArePresent, assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch, assertVoid, gitDescribe
} from '../helpers/remoteRepositories';
import {AbstractReposCommand} from '../../src/commands/repos/AbstractReposCommand';
import {Global} from '../../src/Global';
import {IReposDescriptor} from '../../src/commands/repos/models';
import {UpdateRepos} from '../../src/commands/repos/UpdateRepos';
import * as path from 'path';

/*
 * Tests several behaviours updating the parent repositories.
 * Scenarios and expectations:
 *
 * A) only branches are configured and there are no remote tags
 *    -> use the latest remote HEAD of the branch
 * B) checked out on initial tags, only branches configured for update
 *   -> updates to the latest tag
 * C) checked out on initial tags, only branches configured for update, useSnapshot is true for one repo
 *   -> use the latest remote HEAD of the 'useSnapshot' branch
 *   -> updates to the latest tag of the other branches
 * D) checked out on initial tags, other tags are configured for update
 *    -> updates to the configured tag
 * E) branches and tags are mixed
 *   -> in case of only a branch, clone the latest tag
 *   -> in case of tag, clone the tag
 * F) in case of a tagMarker but no tag:
 *   -> use the latest tag and validate that the version matches at least the tag marker
 * G) fails if only the repo url is configured
 *   -> update requires either branch or tag
 * H) A tag that does not exist is configured
 *   -> Updating should fail at this point
 * I) A tag with another format is configured
 *   -> should be updated to the custom tag
 * J) A customer branch with useSnapshot is configured
 *   -> should be updated on the latest HEAD of the customer branch
 *   -> NOTE: will fail if shallow cloned
 * K) A customer branch is configured
 *   -> should be updated on the latest HEAD of the customer branch as remote tags are only resolved for release branches
 */

async function testWithParentRepos(rootDir: string, parentRepos: { checkout?: IReposDescriptor, update?: IReposDescriptor }, depth: number = 1): Promise<string> {
    if (parentRepos.checkout) {
        writeAndCommitParentRepos(parentRepos.checkout, rootDir);
    }
    const cloneParams: ICommandParameters = {};
    cloneParams[AbstractReposCommand.PARAMETER_CLONE_DEPTH] = depth;
    cloneParams[Global.PARAMETER_VERBOSE] = true;
    Global.parseParameters(cloneParams);
    const cl = new CloneRepos();
    cl.prepareAndMayExecute(cloneParams, rootDir);
    await cl.execute();

    console.log('---- preparing update env ----');

    if (parentRepos.update) {
        writeAndCommitParentRepos(parentRepos.update, rootDir);
    }
    const updateParams: ICommandParameters = {};
    updateParams[Global.PARAMETER_VERBOSE] = true;

    // other params to test:
    // UpdateRepos.PARAMETER_NO_FETCH
    // UpdateRepos.PARAMETER_RESET_TO_REMOTE

    Global.parseParameters(updateParams);
    const ur = new UpdateRepos();

    console.log('---- preparing update command ----');
    ur.prepareAndMayExecute(updateParams, rootDir);

    console.log('---- executing update command ----');
    await ur.execute();

    return rootDir;
}

describe('updating the parent repos', () => {

    test('C) checked out on initial tags, only branches configured for update, useSnapshot is true', async () => {
        const testCloningTheParentReposWithTagsAndBranches = async (rootDir: string): Promise<string> => {
            const updateParentRepos = catParentReposJson(rootDir);
            updateParentRepos.main.tag = 'version/22.2.0';
            updateParentRepos.main.tagMarker = 'version/22.2.0';
            updateParentRepos.test_1.tag = 'version/22.2.0';
            updateParentRepos.test_1.tagMarker = 'version/22.2.0';
            // useSnapshot is expected to take precedence
            updateParentRepos.test_2.tag = 'version/22.2.0';
            updateParentRepos.test_2.tagMarker = 'version/22.2.0';
            updateParentRepos.test_2.useSnapshot = true;

            return testWithParentRepos(rootDir, {update: updateParentRepos}, 0);
        };

        const assertThatTheReposAreBackOnTheExpectedTagOrOnTheHead = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);

            const repoFolder = path.resolve(testResult, '..', 'test_2');
            assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch(repoFolder, 'release/22.2');
            assertThatTheParentReposAreCheckedOutToTheExpectedTags({main: 'version/22.2.0', test_1: 'version/22.2.0'}, testResult);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndBranches, assertThatTheReposAreBackOnTheExpectedTagOrOnTheHead);
    });

    test('G) fails if only the repo url is configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<boolean> => {
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);
            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].branch = 'release/22.2';
            });
            Object.keys(updateParentRepos).forEach((repo) => {
                updateParentRepos[repo].branch = null as any;
            });

            // no branch or tag given in parent-repos.json
            await testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos})
                .catch((e) => {
                    // expected to fail
                    if (! (e?.message?.includes('[main]: No branch or tag given in parent-repos.json for repo main')
                        && e?.message?.includes('[test_1]: No branch or tag given in parent-repos.json for repo test_1')
                        && e?.message?.includes('[test_2]: No branch or tag given in parent-repos.json for repo test_2')
                    )) {
                        throw new Error('Did not to fail due to "[test_2]: Configured tagMarker version/22.3.3 has a higher version then the latest available tag version/22.3.2!"!');
                    }
                });
            return true;
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('master')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertVoid);
    });

    test('H) A tag that does not exist is configured', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<boolean> => {
            const updateParentRepos = catParentReposJson(rootDir);
            updateParentRepos.main.tag = 'version/22.2.99';
            await testWithParentRepos(rootDir, {update: updateParentRepos}, 0)
                .catch((e) => {
                    // expected to fail
                    console.log(e);
                    if (!e?.message?.includes('Error: Command failed: git ls-tree --name-only "version/22.2.99" "node_modules"')) {
                        throw new Error('Did not to fail with the expected reason!');
                    }
                });
            return true;
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertVoid);
    });
});

describe('updating the parent repos for a complex setup', () => {

    test('A) only branches are configured and there are no remote tags', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            return testWithParentRepos(rootDir, {});
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

    test('B) checked out on initial tags, only branches configured for update', async () => {
        const testUpdatingTheParentReposToTheLatestTag = async (rootDir: string): Promise<string> => {
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);

            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].tag = 'version/22.3.0';
            });
            return testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos});
        };

        const assertThatTheParentReposAreUpdatedToTheLatestTag = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);
            assertThatTheParentReposAreCheckedOutToTheExpectedTags({main: 'version/22.3.2', test_1: 'version/22.3.4', test_2: 'version/22.3.2'}, testResult);
        };
        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag);
    });

    test('D) checked out on initial tags, other tags are configured for update', async () => {
        const tags = {
            main: 'version/22.3.1',
            test_1: 'version/22.3.2',
            test_2: 'version/22.3.1'
        };
        const testUpdatingTheParentReposToTheLatestTag = async (rootDir: string): Promise<string> => {
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);

            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].tag = 'version/22.3.0';
            });
            Object.keys(tags).forEach((repo) => {
                updateParentRepos[repo].tag = tags[repo];
            });
            return testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos});
        };

        const assertThatTheParentReposAreUpdatedToTheLatestTag = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);
            assertThatTheParentReposAreCheckedOutToTheExpectedTags(tags, testResult);
        };
        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag);
    });

    test('E) branches and tags are mixed', async () => {
        const tags = {
            main: 'version/22.3.1',
            test_1: 'version/22.3.2'
        };
        const testUpdatingTheParentReposToTheLatestTag = async (rootDir: string): Promise<string> => {
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);

            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].tag = 'version/22.3.0';
            });
            Object.keys(tags).forEach((repo) => {
                updateParentRepos[repo].tag = tags[repo];
            });
            return testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos});
        };

        const assertThatTheParentReposAreUpdatedToTheLatestTag = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);
            assertThatTheParentReposAreCheckedOutToTheExpectedTags({test_2: 'version/22.3.2'}, testResult);
            assertThatTheParentReposAreCheckedOutToTheExpectedTags(tags, testResult);
        };
        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag);
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
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);
            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].branch = 'master';
            });
            Object.keys(tagMarker).forEach((repo) => {
                updateParentRepos[repo].tagMarker = tagMarker[repo];
            });
            return testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos});
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
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);
            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].branch = 'master';
            });
            updateParentRepos.main.tagMarker = 'version/22.3.1';
            updateParentRepos.test_1.tagMarker = 'version/22.3.1';
            // there is no tag 22.3.2
            updateParentRepos.test_2.tagMarker = 'version/22.3.3';

            await testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos})
                .catch((e) => {
                    // expected to fail
                    if (!e?.message?.endsWith('[test_2]: Configured tagMarker version/22.3.3 has a higher patch version then the latest available tag version/22.3.2!')) {
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
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);
            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].branch = 'master';
            });
            updateParentRepos.test_2.tag = 'custom/22.4.0-A-2';

            return testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos});
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
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);
            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].branch = 'master';
            });
            updateParentRepos.test_2.branch = 'customer/22.4-A-2';
            updateParentRepos.test_2.useSnapshot = true;

            return testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos}, 0);
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
            const checkoutParentRepos = catParentReposJson(rootDir);
            const updateParentRepos = catParentReposJson(rootDir);
            Object.keys(checkoutParentRepos).forEach((repo) => {
                checkoutParentRepos[repo].branch = 'master';
            });
            updateParentRepos.test_2.branch = 'customer/22.4-A-2';

            return testWithParentRepos(rootDir, {checkout: checkoutParentRepos, update: updateParentRepos}, 0);
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
