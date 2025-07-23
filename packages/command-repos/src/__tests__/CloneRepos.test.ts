import { ICommandParameters } from '@cplace-cli/core';
import { CloneRepos } from '../subcommands/clone.js';
import {
    basicTestSetupData, multiBranchTestSetupData,
    catParentReposJson, testWith, writeAndCommitParentRepos, gitDescribe,
    assertThatTheParentReposAreCheckedOutToTheExpectedTags, assertAllFoldersArePresent, assertThatTheWorkingCopyHasNoDiffToTheRemoteBranch, assertVoid, ILocalRepoData
} from '../../../../test/helpers/remoteRepositories';
import { AbstractReposCommand } from '../utils/AbstractReposCommand.js';
import * as path from 'path';
import { Global } from '@cplace-cli/core';
import { IReposDescriptor } from '../models.js';
import * as child_process from 'child_process';

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
 * l) Tags and commit hashes are configured
 *   -> should be cloned to the tag (shallow clone) and - in case of the commits - to the branch, checked out to the commit (full clone).
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

    test('l) Tags and commit hashes are configured', async () => {

        /**
         * Returns the difference of commits between the current HEAD and the remote branch.
         * @param repoFolder the path to the repo folder
         */
        function gitGetCommitDiffToOrigin(repoFolder: string): string {
            let count: Buffer;
            try {
                count = child_process.execSync(
                    'git rev-list --count origin/release/22.3 ^HEAD',
                    {
                        cwd: repoFolder,
                        shell: 'bash'
                    }
                );
            } catch (e) {
                console.log(`Git describe failed in ${repoFolder} due to:
                ${e.status}
                ${e.message}
                ${e.stderr?.toString()}
                ${e.stdout?.toString()}
            `);
                throw e;
            }
            return count.toString().trim();
        }

        function gitIsShallowRepository(repoFolder: string): string {
            let result: Buffer;
            try {
                result = child_process.execSync(
                    'git rev-parse --is-shallow-repository',
                    {
                        cwd: repoFolder,
                        shell: 'bash'
                    }
                );
            } catch (e) {
                console.log(`Git describe failed in ${repoFolder} due to:
                ${e.status}
                ${e.message}
                ${e.stderr?.toString()}
                ${e.stdout?.toString()}
            `);
                throw e;
            }
            return result.toString().trim();
        }

        const testCloningTheParentReposWithTagsAndCommitHashes = async (rootDir: string, remoteRepos?: ILocalRepoData[]): Promise<string> => {
            const parentRepos = catParentReposJson(rootDir);
            // parent-repos scenario:
            // main -> tag
            // test1 -> commit, not HEAD
            // test2 -> commit, not HEAD
            parentRepos.main.tag = 'version/22.3.1';
            remoteRepos.forEach((remote) => {
                console.log(`${remote.name}: ${remote.url}`);

                if (remote.name === 'test_1' || remote.name === 'test_2') {
                    const commits = child_process.execSync(
                        // get the latest 2 commit hashes
                        'git log -2 --pretty=format:"%h" release/22.3',
                        {
                            cwd: remote.url,
                            shell: 'bash'
                        }
                    ).toString()
                        .split('\n');
                    console.log(commits);
                    // use the older commit
                    parentRepos[remote.name].commit = commits[1];
                }
            });
            return testWithParentRepos(rootDir, parentRepos);
        };

        const assertCloningTheParentReposTagsAndBranches = async (testResult: string): Promise<void> => {
            assertAllFoldersArePresent(testResult);
            // assertion scenario:
            // main -> tag === 'version/22.3.1'
            // test1 -> commit, HEAD == HEAD^(remote)
            // test2 -> commit, not HEAD == HEAD^(remote)

            const tagDescription = gitDescribe(path.resolve(testResult, '..', 'main'));
            expect(/^version\/22.3.1-0-\w+\n$/.test(tagDescription)).toBeTruthy();
            expect(gitIsShallowRepository(path.resolve(testResult, '..', 'main'))).toEqual('true');

            expect(gitGetCommitDiffToOrigin(path.resolve(testResult, '..', 'test_1'))).toEqual('1');
            expect(gitIsShallowRepository(path.resolve(testResult, '..', 'test_1'))).toEqual('false');

            expect(gitGetCommitDiffToOrigin(path.resolve(testResult, '..', 'test_2'))).toEqual('1');
            expect(gitIsShallowRepository(path.resolve(testResult, '..', 'test_2'))).toEqual('false');
        };

        await testWith(multiBranchTestSetupData)
            .withBranchUnderTest('release/22.3')
            .evaluateWithRemoteRepos(testCloningTheParentReposWithTagsAndCommitHashes, assertCloningTheParentReposTagsAndBranches);
    });
});
