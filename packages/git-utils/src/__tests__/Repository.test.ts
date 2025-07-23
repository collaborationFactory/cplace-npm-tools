import {assertVoid, basicTestSetupData, COMMITED_DUMMY_FILE, ROOT_REPO, testWith} from '../../../../test/helpers/remoteRepositories';
import {Repository} from '../Repository.js';
import * as simpleGit from 'simple-git';
import * as Path from 'node:path';

const GIT_VIA_SSH_URI = `git@github.com:collaborationFactory/${ROOT_REPO}.git`;
const GIT_VIA_HTTPS_URI = `https://github.com/collaborationFactory/${ROOT_REPO}.git`;

async function remoteSetUrl(rootDir: string, remoteUri: string): Promise<void> {
    await simpleGit.simpleGit(rootDir).remote(['set-url', 'origin', remoteUri]);
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

    test('test that getLocalOriginUrl does not fail if no remote urls are configured', async () => {
        const testGetLocalOriginUrl = async (rootDir: string): Promise<string> => {
            await simpleGit.simpleGit(rootDir).remote(['remove', 'origin']);

            const result = await Repository.getLocalOriginUrl(ROOT_REPO, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBe('');
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetLocalOriginUrl, assertThatAValidRemoteIsGiven);
    });

    test('test that getLocalOriginUrl does not fail for unexpected origins', async () => {
        const testGetLocalOriginUrl = async (rootDir: string): Promise<string> => {
            await simpleGit.simpleGit(rootDir).remote(['remove', 'origin']);
            await simpleGit.simpleGit(rootDir).remote(['add', 'uncommon', GIT_VIA_SSH_URI]);

            const result = await Repository.getLocalOriginUrl(ROOT_REPO, rootDir);
            console.log(result);
            return result;
        };

        const assertThatAValidRemoteIsGiven = async (localOriginUrl: string): Promise<void> => {
            expect(localOriginUrl).toBe('');
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

    test('test sortByTagName', async () => {
        const result = `
bd37e43ace85f1b288502d17d9b2594a59fb68d2        refs/tags/version/23.1.0-RC.33
ccb775f345018cb558fa88275557b782e2f54d3a        refs/tags/version/23.1.0
c5d8c56b7abb0c7cc37929c321d18413596daf2e        refs/tags/version/23.1.0-RC.1
bd37e43ace85f1b288502d17d9b2594a59fb68d2        refs/tags/version/23.1.0-RC.2
bd37e43ace85f1b288502d17d9b2594a59fb68d2        refs/tags/version/23.1.0-RC.11
bd37e43ace85f1b288502d17d9b2594a59fb68d2        refs/tags/version/23.1.0-RC.21

ad37e43ace85f1b212342d17d9b2594a59fb68d3        refs/tags/version/FOO
luhgaoerfgao
784037e2b2e6c41b185dea781d72ed9f8bd5c8b5        refs/tags/version/23.1.0-RC.4
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.1.5
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.1
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.2
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.2-RC.0
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.3
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.4
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.1.55
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.2.5
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.12.5
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.12
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.35
5ccc9dd38e82cbc7309ce01d18a66df2b1fcbc4f        refs/tags/version/23.1.22
fae411d00a73c1e89b83c4a90517be0f36a3c06c        refs/tags/version/23.1.0-RC.3

        `;
        const sortedTags = Repository.sortByTagName('testRepo', result, 'version/23.1.*');
        console.log(sortedTags);
        expect(sortedTags).toEqual([
                                       'version/23.1.1.5',
                                       'version/23.1.1.55',
                                       'version/23.1.12.5',
                                       'version/23.1.2.5',
                                       'version/23.1.0-RC.1',
                                       'version/23.1.0-RC.2',
                                       'version/23.1.0-RC.3',
                                       'version/23.1.0-RC.4',
                                       'version/23.1.0-RC.11',
                                       'version/23.1.0-RC.21',
                                       'version/23.1.0-RC.33',
                                       'version/23.1.0',
                                       'version/23.1.1',
                                       'version/23.1.2-RC.0',
                                       'version/23.1.2',
                                       'version/23.1.3',
                                       'version/23.1.4',
                                       'version/23.1.12',
                                       'version/23.1.22',
                                       'version/23.1.35'
                                   ]);
    });

    test('test checkRepoHasPathInBranch is true', async () => {
        const testGetRemoteOriginUrl = async (rootDir: string): Promise<boolean> => {
            const repo = new Repository(Path.join(rootDir));
            return repo.checkRepoHasPathInBranch({ref: 'HEAD', pathname: COMMITED_DUMMY_FILE});
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetRemoteOriginUrl, assertVoid);
    });

    test('test checkRepoHasPathInBranch is false', async () => {
        const testGetRemoteOriginUrl = async (rootDir: string): Promise<boolean> => {
            const repo = new Repository(Path.join(rootDir));
            return !repo.checkRepoHasPathInBranch({ref: 'HEAD', pathname: 'does-not-exist'});
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteAndLocalRepos(testGetRemoteOriginUrl, assertVoid);
    });
});
