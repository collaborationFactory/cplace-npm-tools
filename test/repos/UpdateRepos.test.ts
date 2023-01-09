import {ICommandParameters} from '../../src/commands/models';
import {CloneRepos} from '../../src/commands/repos/CloneRepos';
import {
    basicTestSetupData, multiBranchTestSetupData,
    catParentReposJson, testWith, writeAndCommitParentRepos,
    assertThatTheParentReposAreCheckedOutToTheExpectedTags, assertAllFoldersArePresent, assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch
} from '../helpers/remoteRepositories';
import {AbstractReposCommand} from '../../src/commands/repos/AbstractReposCommand';
import {Global} from '../../src/Global';
import {IReposDescriptor} from '../../src/commands/repos/models';
import {UpdateRepos} from '../../src/commands/repos/UpdateRepos';
import * as path from 'path';

/*
 * Tests several behaviours updating the parent repositories.
 * Scenarios and expectations:
 * A) initially checked out tags, only branches configured for update
 *   -> updates to the latest tag
 * B) initially checked out tags, only branches configured for update, useSnapshot is true
 *   -> use the latest remote HEAD of the branch
 */

async function testWithParentRepos(rootDir: string, parentRepos: { checkout?: IReposDescriptor, update?: IReposDescriptor }): Promise<string> {
    if (parentRepos.checkout) {
        writeAndCommitParentRepos(parentRepos.checkout, rootDir);
    }
    const cloneParams: ICommandParameters = {};
    cloneParams[AbstractReposCommand.PARAMETER_CLONE_DEPTH] = 1;
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

    test('B) initially checked out tags, only branches configured for update, useSnapshot is true', async () => {
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

            return testWithParentRepos(rootDir, {update: updateParentRepos});
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

});

describe('updating the parent repos for a complex setup', () => {

    test('A) initially checked out tags, only branches configured for update', async () => {
        const tags = {
            main: 'version/22.3.2',
            test_1: 'version/22.3.4',
            test_2: 'version/22.3.2'
        };
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
            assertThatTheParentReposAreCheckedOutToTheExpectedTags(tags, testResult);
        };
        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testUpdatingTheParentReposToTheLatestTag, assertThatTheParentReposAreUpdatedToTheLatestTag);
    });

});
