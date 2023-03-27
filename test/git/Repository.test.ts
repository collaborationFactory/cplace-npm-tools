import {basicTestSetupData, ROOT_REPO, testWith} from '../helpers/remoteRepositories';
import {Repository} from '../../src/git';
import * as simpleGit from 'simple-git';

const GIT_VIA_SSH_URI = `git@github.com:collaborationFactory/${ROOT_REPO}.git`;
const GIT_VIA_HTTPS_URI = `https://github.com/collaborationFactory/${ROOT_REPO}.git`;

async function remoteSetUrl(rootDir: string, remoteUri: string): Promise<void> {
    await simpleGit(rootDir).remote(['set-url', 'origin', remoteUri], (err, execResult: string) => {
        if (err) {
            throw err;
        } else {
            console.log('remote set-utl result:', execResult);
        }
    });
}

describe('testing the repository helpers', () => {

    test('test that the correct remote url is returned by getLocalOriginUrl', async () => {
        const testGetLocalOriginUrl = async (rootDir: string): Promise<string> => {
            const result = await Repository.getLocalOriginUrl(ROOT_REPO, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBeDefined();
            // The path would look like this on linux/osx: /var/folders/jt/bcd1vz211hq913bbvmsvqd7h0000gn/T/1679059235280-cplace-cli-test-freeze-parent-repos/remote/rootRepo.git
            expect(/^.*\/remote\/rootRepo.git$/.test(localOriginUrl.trim())).toBeTruthy();
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetLocalOriginUrl, assertThatAValidRemoteIsGiven);
    });

    test('test getRemoteOriginUrl, local: ssh, remote: ssh -> ssh', async () => {
        const testGetRemoteOriginUrl = async (rootDir: string): Promise<string> => {
            // rewrite the remote url to git via https
            await remoteSetUrl(rootDir, GIT_VIA_SSH_URI);

            // assume the url in the parent repos would be for git via ssh
            const result = await Repository.getRemoteOriginUrl(ROOT_REPO, GIT_VIA_SSH_URI, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBeDefined();
            expect(localOriginUrl.trim()).toEqual(GIT_VIA_SSH_URI);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetRemoteOriginUrl, assertThatAValidRemoteIsGiven);
    });

    test('test getRemoteOriginUrl, local: https, remote: https -> https', async () => {
        const testGetRemoteOriginUrl = async (rootDir: string): Promise<string> => {
            // rewrite the remote url to git via https
            await remoteSetUrl(rootDir, GIT_VIA_HTTPS_URI);

            // assume the url in the parent repos would be for git via ssh
            const result = await Repository.getRemoteOriginUrl(ROOT_REPO, GIT_VIA_HTTPS_URI, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBeDefined();
            expect(localOriginUrl.trim()).toEqual(GIT_VIA_HTTPS_URI);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetRemoteOriginUrl, assertThatAValidRemoteIsGiven);
    });

    test('test getRemoteOriginUrl, local: https, remote: ssh -> https', async () => {
        const testGetRemoteOriginUrl = async (rootDir: string): Promise<string> => {
            // rewrite the remote url to git via https
            await remoteSetUrl(rootDir, GIT_VIA_HTTPS_URI);

            // assume the url in the parent repos would be for git via ssh
            const result = await Repository.getRemoteOriginUrl(ROOT_REPO, GIT_VIA_SSH_URI, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBeDefined();
            expect(localOriginUrl.trim()).toEqual(GIT_VIA_HTTPS_URI);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetRemoteOriginUrl, assertThatAValidRemoteIsGiven);
    });

    test('test getRemoteOriginUrl, local: ssh, remote: https -> ssh', async () => {
        const testGetRemoteOriginUrl = async (rootDir: string): Promise<string> => {
            // rewrite the remote url to git via ssh
            await remoteSetUrl(rootDir, GIT_VIA_SSH_URI);

            // assume the url in the parent repos would be for git via https
            const result = await Repository.getRemoteOriginUrl(ROOT_REPO, GIT_VIA_HTTPS_URI, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBeDefined();
            expect(localOriginUrl.trim()).toEqual(GIT_VIA_SSH_URI);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetRemoteOriginUrl, assertThatAValidRemoteIsGiven);
    });

});
