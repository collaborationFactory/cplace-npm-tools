import {ICommandParameters} from '../../src/commands/models';
import {CloneRepos} from '../../src/commands/repos/CloneRepos';
import {
    multiBranchTestSetupData,
    catParentReposJson, testWith, writeAndCommitParentRepos, assertThatTheParentReposAreCheckedOutToTheExpectedTags, assertAllFoldersArePresent
} from '../helpers/remoteRepositories';
import {AbstractReposCommand} from '../../src/commands/repos/AbstractReposCommand';
import {Global} from '../../src/Global';
import {IReposDescriptor} from '../../src/commands/repos/models';
import {UpdateRepos} from '../../src/commands/repos/UpdateRepos';

/*
 * Tests several behaviours updating the parent repositories.
 * Scenarios and expectations:
 * A) initially checked out tags, only branches configured for update
 *   -> updates to the latest tag
 */

async function testWithParentRepos(rootDir: string, checkoutParentRepos: IReposDescriptor, updateParentRepos: IReposDescriptor): Promise<string> {
    writeAndCommitParentRepos(checkoutParentRepos, rootDir);

    const cloneParams: ICommandParameters = {};
    cloneParams[AbstractReposCommand.PARAMETER_CLONE_DEPTH] = 1;
    cloneParams[Global.PARAMETER_VERBOSE] = true;
    Global.parseParameters(cloneParams);
    const cl = new CloneRepos();
    cl.prepareAndMayExecute(cloneParams, rootDir);
    await cl.execute();

    writeAndCommitParentRepos(updateParentRepos, rootDir);

    const updateParams: ICommandParameters = {};
    updateParams[Global.PARAMETER_VERBOSE] = true;

    // other params to test:
    // UpdateRepos.PARAMETER_NO_FETCH
    // UpdateRepos.PARAMETER_RESET_TO_REMOTE

    Global.parseParameters(updateParams);
    const ur = new UpdateRepos();
    ur.prepareAndMayExecute(updateParams, rootDir);
    await ur.execute();

    return rootDir;
}

// describe('updating the parent repos', () => {
//
// });

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
            return testWithParentRepos(rootDir, checkoutParentRepos, updateParentRepos);
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
