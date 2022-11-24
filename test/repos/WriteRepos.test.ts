import {IReposDescriptor, IRepoStatus} from '../../src/commands/repos/models';
import {ICommandParameters} from '../../src/commands/models';
import {WriteRepos} from '../../src/commands/repos/WriteRepos';
import {basicTestSetupData, multiBranchTestSetupData, testWith} from '../helpers/remoteRepositories';
import * as fs from 'fs';
import * as path from 'path';

const catParentReposJson = (rootDir: string) => {
    return fs.readFileSync(path.join(rootDir, 'parent-repos.json')).toString();
};

describe('writing the parent repos json for a basic setup', () => {

    const assertRaw = async (parentRepos: string) => {
        const parentReposJson = JSON.parse(parentRepos);
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
        const testRaw = async (rootDir: string) => {
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
        const testUsingCommits = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
            return catParentReposJson(rootDir);
        };

        const assertUsingCommits = async (parentRepos: string) => {
            const parentReposJson = JSON.parse(parentRepos);
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
        const testUsingTags = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;
            params[WriteRepos.PARAMETER_USE_TAGS] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
            return catParentReposJson(rootDir);
        };

        const assertUsingTags = async (parentRepos: string) => {
            const parentReposJson = JSON.parse(parentRepos);
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
        const testUnFreeze = async (rootDir: string) => {
            const prepareParams: ICommandParameters = {};
            prepareParams[WriteRepos.PARAMETER_FREEZE] = true;
            prepareParams[WriteRepos.PARAMETER_USE_TAGS] = true;

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
        const testUsingTags = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;
            params[WriteRepos.PARAMETER_USE_TAGS] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
            return catParentReposJson(rootDir);
        };

        const assertUsingTags = async (parentRepos: string) => {
            const parentReposJson = JSON.parse(parentRepos);
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
        const testUsingTags = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;
            params[WriteRepos.PARAMETER_USE_TAGS] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
            return catParentReposJson(rootDir);
        };

        const assertUsingTags = async (parentRepos: string) => {
            const parentReposJson = JSON.parse(parentRepos);
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
        const testUsingTags = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;
            params[WriteRepos.PARAMETER_USE_TAGS] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
            return catParentReposJson(rootDir);
        };

        const assertUsingTags = async (parentRepos: string) => {
            const parentReposJson = JSON.parse(parentRepos);
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
        const testUsingCommits = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
            return catParentReposJson(rootDir);
        };

        const assertUsingCommits = async (parentRepos: string) => {
            const parentReposJson = JSON.parse(parentRepos);
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
