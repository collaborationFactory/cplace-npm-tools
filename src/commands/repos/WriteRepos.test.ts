import {IRepoStatus} from './models';
import {WriteRepos} from './WriteRepos';
import {ICommandParameters} from '../models';
import {basicTestSetupData, testWith} from '../../test/helpers/remoteRepositories';

describe('writing the parent repos json', () => {

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
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluate(testRaw, assertRaw);
    });

    test('using commits', async () => {
        const testUsingCommits = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
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
            .evaluate(testUsingCommits, assertUsingCommits);
    });

    test('using tags', async () => {
        const testUsingTags = async (rootDir: string) => {
            const params: ICommandParameters = {};
            params[WriteRepos.PARAMETER_FREEZE] = true;
            params[WriteRepos.PARAMETER_USE_TAGS] = true;

            const wr = new WriteRepos();
            wr.prepareAndMayExecute(params, rootDir);
            await wr.execute();
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
            .evaluate(testUsingTags, assertUsingTags);
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
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluate(testUnFreeze, assertRaw);
    });
});
