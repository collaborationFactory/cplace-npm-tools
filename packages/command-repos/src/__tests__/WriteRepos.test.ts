import {IReposDescriptor, IRepoStatus} from '../models.js';
import {ICommandParameters, Global} from '@cplace-cli/core';
import {WriteRepos} from '../subcommands/write.js';
import {basicTestSetupData, multiBranchTestSetupData, catParentReposJson, testWith} from '../../../../test/helpers/remoteRepositories';

const testUsingTags = async (rootDir: string): Promise<IReposDescriptor> => {
    const params: ICommandParameters = {};
    params[Global.PARAMETER_VERBOSE] = true;
    params[WriteRepos.PARAMETER_USE_LATEST_TAG] = true;
    Global.parseParameters(params);

    const wr = new WriteRepos();
    wr.prepareAndMayExecute(params, rootDir);
    await wr.execute();
    return catParentReposJson(rootDir);
};

const testUsingCommits = async (rootDir: string): Promise<IReposDescriptor> => {
    const params: ICommandParameters = {};
    params[Global.PARAMETER_VERBOSE] = true;
    params[WriteRepos.PARAMETER_FREEZE] = true;
    Global.parseParameters(params);

    const wr = new WriteRepos();
    wr.prepareAndMayExecute(params, rootDir);
    await wr.execute();
    return catParentReposJson(rootDir);
};

describe('writing the parent repos json for a basic setup', () => {

    const assertRaw = async (parentReposJson: IReposDescriptor): Promise<void> => {
        expect(Object.keys(parentReposJson)).toHaveLength(3);
        Object.values(parentReposJson).map((status: IRepoStatus) => {
            expect(status.url).toBeDefined();
            expect(status.branch).toEqual('release/22.2');
            expect(status.description).toBeDefined();
            expect(status.commit).toBeUndefined();
            expect(status.tag).toBeUndefined();
            expect(status.tagMarker).toBeUndefined();
        });
    };

    test('raw', async () => {
        const testRaw = async (rootDir: string): Promise<IReposDescriptor> => {
            const params: ICommandParameters = {};
            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
            return catParentReposJson(rootDir);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testRaw, assertRaw);
    });

    test('using commits', async () => {
        const assertUsingCommits = async (parentReposJson: IReposDescriptor): Promise<void> => {
            expect(Object.keys(parentReposJson)).toHaveLength(3);
            Object.values(parentReposJson).map((status: IRepoStatus) => {
                expect(status.url).toBeDefined();
                expect(status.branch).toEqual('release/22.2');
                expect(status.description).toBeDefined();
                expect(status.commit).toBeDefined();
                expect(status.tag).toBeUndefined();
                expect(status.tagMarker).toBeUndefined();
            });
        };
        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testUsingCommits, assertUsingCommits);
    });

    test('using tags', async () => {
        const assertUsingTags = async (parentReposJson: IReposDescriptor): Promise<void> => {
            expect(Object.keys(parentReposJson)).toHaveLength(3);
            Object.values(parentReposJson).map((status: IRepoStatus) => {
                expect(status.url).toBeDefined();
                expect(status.branch).toEqual('release/22.2');
                expect(status.description).toBeDefined();
                expect(status.commit).toBeUndefined();
                expect(status.tag).toEqual('version/22.2.0');
                expect(status.tagMarker).toEqual('version/22.2.0');
            });
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testUsingTags, assertUsingTags);
    });

    test('un-freeze', async () => {
        const testUnFreeze = async (rootDir: string): Promise<IReposDescriptor> => {
            const prepareParams: ICommandParameters = {};
            prepareParams[WriteRepos.PARAMETER_FREEZE] = true;
            prepareParams[WriteRepos.PARAMETER_USE_LATEST_TAG] = true;

            const prepareWr = new WriteRepos();
            prepareWr.prepareAndMayExecute(prepareParams, rootDir);
            await prepareWr.execute();

            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;
            params[WriteRepos.PARAMETER_UN_FREEZE] = true;
            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
            return catParentReposJson(rootDir);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testUnFreeze, assertRaw);
    });
});
describe('writing the parent repos json for a complex setup', () => {

    test('using tags while none exist', async () => {
        const assertUsingTags = async (parentReposJson: IReposDescriptor): Promise<void> => {
            expect(Object.keys(parentReposJson)).toHaveLength(3);
            Object.values(parentReposJson).map((status: IRepoStatus) => {
                expect(status.url).toBeDefined();
                expect(status.branch).toEqual('release/5.20');
                expect(status.description).toBeDefined();
                expect(status.commit).toBeUndefined();
                expect(status.tag).toBeUndefined();
                expect(status.tagMarker).toBeUndefined();
            });
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/5.20')
            .evaluateWithRemoteAndLocalRepos(testUsingTags, assertUsingTags);
    });

    test('using tags where some remotes dont have any tags', async () => {
        const assertUsingTags = async (parentReposJson: IReposDescriptor): Promise<void> => {
            expect(Object.keys(parentReposJson)).toHaveLength(3);
            Object.values(parentReposJson).map((status: IRepoStatus) => {
                expect(status.url).toBeDefined();
                expect(status.branch).toEqual('release/22.2');
                expect(status.description).toBeDefined();
                expect(status.commit).toBeUndefined();
            });
            assertTagVersion('main', 'version/22.2.1', parentReposJson);
            assertTagVersion('test_1', 'version/22.2.3', parentReposJson);
            assertTagVersion('test_2', undefined, parentReposJson);
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.2')
            .withBranchesToCheckout(['release/5.20', 'release/22.2', 'release/22.3', 'release/22.4'])
            .evaluateWithRemoteAndLocalRepos(testUsingTags, assertUsingTags);
    });

    test('using tags', async () => {
        const assertUsingTags = async (parentReposJson: IReposDescriptor): Promise<void> => {
            expect(Object.keys(parentReposJson)).toHaveLength(3);
            Object.values(parentReposJson).map((status: IRepoStatus) => {
                expect(status.url).toBeDefined();
                expect(status.branch).toEqual('release/22.3');
                expect(status.description).toBeDefined();
                expect(status.commit).toBeUndefined();
            });
            assertTagVersion('main', 'version/22.3.2', parentReposJson);
            assertTagVersion('test_1', 'version/22.3.4', parentReposJson);
            assertTagVersion('test_2', 'version/22.3.2', parentReposJson);
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .withBranchesToCheckout(['release/5.20', 'release/22.2', 'release/22.3', 'release/22.4'])
            .evaluateWithRemoteAndLocalRepos(testUsingTags, assertUsingTags);
    });

    test('using commits', async () => {
        const assertUsingCommits = async (parentReposJson: IReposDescriptor): Promise<void> => {
            expect(Object.keys(parentReposJson)).toHaveLength(3);
            Object.values(parentReposJson).map((status: IRepoStatus) => {
                expect(status.url).toBeDefined();
                expect(status.branch).toEqual('release/5.20');
                expect(status.description).toBeDefined();
                expect(status.commit).toBeDefined();
                expect(status.tag).toBeUndefined();
                expect(status.tagMarker).toBeUndefined();
            });
        };
        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/5.20')
            .withDebug(false)
            .evaluateWithRemoteAndLocalRepos(testUsingCommits, assertUsingCommits);
    });

    function assertTagVersion(repo: string, tag: string, parentReposJson: IReposDescriptor): void {
        const repoToCheck: IRepoStatus = parentReposJson[repo];
        if (!repoToCheck) {
            throw new Error(`[${repo}] is not defined in [${Object.keys(parentReposJson).join(', ')}]!`);
        }
        expect(repoToCheck.tag).toEqual(tag);
        expect(repoToCheck.tagMarker).toEqual(tag);
    }
});
