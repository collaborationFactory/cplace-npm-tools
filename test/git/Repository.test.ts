import {basicTestSetupData, ROOT_REPO, testWith} from '../helpers/remoteRepositories';
import {Repository} from '../../src/git';
import * as simpleGit from 'simple-git';

describe('testing the repository helpers', () => {

    test('test that the correct remote url is returned by getLocalOriginUrl', async () => {
        const testGetLocalOriginUrl = async (rootDir: string): Promise<string> => {
            const result = await Repository.getLocalOriginUrl(ROOT_REPO, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBeDefined();
            // The path would look like this on linux/osx:  /var/folders/jt/bcd1vz211hq913bbvmsvqd7h0000gn/T/1679059235280-cplace-cli-test-freeze-parent-repos/remote/rootRepo.git
            expect(/^.*\/remote\/rootRepo.git$/.test(localOriginUrl.trim())).toBeTruthy();
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetLocalOriginUrl, assertThatAValidRemoteIsGiven);
    });

    test('test that getRemoteOriginUrl stays with git via ssh if the local repo has ssh configured for git', async () => {
        const testGetRemoteOriginUrl = async (rootDir: string): Promise<string> => {
            // rewrite the remote url to git via https
            await simpleGit(rootDir).remote(['set-url', 'origin', 'git@github.com:collaborationFactory/rootRepo.git'], (err, execResult: string) => {
                if (err) {
                    throw err;
                } else {
                    console.log('remote set-utl result:', execResult);
                }
            });
            // assume the url in the parent repos would be for git via ssh
            const result = await Repository.getRemoteOriginUrl(ROOT_REPO, `git@github.com:collaborationFactory/${ROOT_REPO}.git`, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBeDefined();
            expect(localOriginUrl.trim()).toEqual('git@github.com:collaborationFactory/rootRepo.git');
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetRemoteOriginUrl, assertThatAValidRemoteIsGiven);
    });

    test('test that getRemoteOriginUrl returns https if the local repo has https configured for git', async () => {
        const testGetRemoteOriginUrl = async (rootDir: string): Promise<string> => {
            // rewrite the remote url to git via https
            await simpleGit(rootDir).remote(['set-url', 'origin', 'https://github.com/collaborationFactory/rootRepo.git'], (err, execResult: string) => {
                if (err) {
                    throw err;
                } else {
                    console.log('remote set-utl result:', execResult);
                }
            });
            // assume the url in the parent repos would be for git via ssh
            const result = await Repository.getRemoteOriginUrl(ROOT_REPO, `git@github.com:collaborationFactory/${ROOT_REPO}.git`, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBeDefined();
            expect(localOriginUrl.trim()).toEqual('https://github.com/collaborationFactory/rootRepo.git');
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetRemoteOriginUrl, assertThatAValidRemoteIsGiven);
    });

});
