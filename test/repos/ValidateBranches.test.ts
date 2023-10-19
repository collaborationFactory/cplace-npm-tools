import {assertVoid, basicTestSetupData, catParentReposJson, testWith} from '../helpers/remoteRepositories';
import {IReposDescriptor} from '../../src/commands/repos/models';
import {IReposValidationResult, ValidateBranches} from '../../src/commands/repos/ValidateBranches';
import {ICommandParameters} from '../../src/commands/models';
import {Global} from '../../src/Global';
import {enforceNewline} from '../../src/util';
import * as path from 'path';
import * as fs from 'fs';

function writeParentRepos(dir: string, newParentRepos: IReposDescriptor): void {
    const newParentReposContent = enforceNewline(JSON.stringify(newParentRepos, null, 2));
    const parentRepos = path.join(dir, 'parent-repos.json');
    fs.writeFileSync(parentRepos, newParentReposContent, 'utf8');
}

function assertBasicStructureConsistency(validationResult: IReposValidationResult): void {
    // test if all expected repos are mapped
    expect(Array.from(validationResult.dependenciesMap.keys()).sort()).toEqual(['main', 'test_1', 'test_2']);

    // test if the count of dependent repos to a parent repo is correct
    // tslint:disable:no-backbone-get-set-outside-model
    expect(validationResult.dependenciesMap.get('main').length).toEqual(4);
    expect(validationResult.dependenciesMap.get('test_1').length).toEqual(2);
    expect(validationResult.dependenciesMap.get('test_2').length).toEqual(1);
    // tslint:enable:no-backbone-get-set-outside-model

    // tests if the first level of repositories status is applied correctly from the root parent repos to the transitive structure
    Object.entries(validationResult.rootDependencies.reposDescriptor).forEach(([repoName, repoStatus]) => {
        expect(validationResult.rootDependencies.transitiveDependencies.get(repoName).repoStatus).toEqual(repoStatus);
    });
}

describe('validate the transitive of the root parent repos json for a basic setup', () => {
    test('all branches are correctly configured', async () => {
        const testBranches = async (rootDir: string): Promise<IReposValidationResult> => {
            const parentRepos = catParentReposJson(rootDir);

            writeParentRepos(path.join(rootDir, '..', 'test_1'), {
                main: {url: parentRepos.main.url, branch: 'release/22.2'}
            });
            writeParentRepos(path.join(rootDir, '..', 'test_2'), {
                main: {url: parentRepos.main.url, branch: 'release/22.2'},
                test_1: {url: parentRepos.test_1.url, branch: 'release/22.2'}
            });

            const params: ICommandParameters = {};
            params[Global.PARAMETER_VERBOSE] = true;

            Global.parseParameters(params);
            const vb = new ValidateBranches();
            vb.prepareAndMayExecute(params, rootDir);
            await vb.execute();

            return vb.validateAndReport();
        };

        const assertThatThereAreNoDiffs = async (validationResult: IReposValidationResult): Promise<void> => {
            assertBasicStructureConsistency(validationResult);

            // there must be no differences
            expect(validationResult.report.diffStatistic.size).toEqual(0);
            expect(validationResult.report.reposWithDiff.size).toEqual(0);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithFolders(testBranches, assertThatThereAreNoDiffs);
    });

    test('branches are not correctly configured', async () => {
        const testBranches = async (rootDir: string): Promise<IReposValidationResult> => {
            const parentRepos = catParentReposJson(rootDir);

            writeParentRepos(path.join(rootDir, '..', 'test_1'), {
                main: {url: parentRepos.main.url, branch: 'release/22.2'}
            });
            writeParentRepos(path.join(rootDir, '..', 'test_2'), {
                main: {url: parentRepos.main.url, branch: 'customer/custom/abc/22.2-ABC', artifactGroup: 'cf.cplace.abc'},
                test_1: {url: parentRepos.test_1.url, branch: 'release/22.2'}
            });

            const params: ICommandParameters = {};
            params[Global.PARAMETER_VERBOSE] = true;
            params[ValidateBranches.PARAMETER_INCLUDE] = 'branch artifactGroup';

            Global.parseParameters(params);
            const vb = new ValidateBranches();
            vb.prepareAndMayExecute(params, rootDir);

            return vb.validateAndReport();
        };

        const assertBranches = async (validationResult: IReposValidationResult): Promise<void> => {
            assertBasicStructureConsistency(validationResult);
            expect(validationResult.report.diffStatistic.size).toEqual(4);
            expect(validationResult.report.reposWithDiff.size).toEqual(1);
            expect(Array.from(validationResult.report.reposWithDiff.keys())).toEqual(['main']);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithFolders(testBranches, assertBranches);
    });

    test('a transitive repo is missing', async () => {
        const testBranches = async (rootDir: string): Promise<boolean> => {
            const parentRepos = catParentReposJson(rootDir);

            writeParentRepos(path.join(rootDir, '..', 'test_1'), {
                main: {url: parentRepos.main.url, branch: 'release/22.2'},
                missing: {url: 'git@cplace.test.de:missing.git', branch: 'release/22.2'}
            });
            writeParentRepos(path.join(rootDir, '..', 'test_2'), {
                main: {url: parentRepos.main.url, branch: 'customer/custom/abc/22.2-ABC', artifactGroup: 'cf.cplace.abc'},
                test_1: {url: parentRepos.test_1.url, branch: 'release/22.2'}
            });

            const params: ICommandParameters = {};
            params[Global.PARAMETER_VERBOSE] = true;
            params[ValidateBranches.PARAMETER_INCLUDE] = 'branch artifactGroup';

            Global.parseParameters(params);
            const vb = new ValidateBranches();
            vb.prepareAndMayExecute(params, rootDir);

            try {
                vb.validateAndReport();
            } catch (e) {
                if (e?.message?.includes('[rootRepo]: Missing repositories! Reference paths:')
                    && e?.message?.includes('rootRepo -> test_1 -> * missing')
                    && e?.message?.includes('rootRepo -> test_2 -> test_1 -> * missing')
                ) {
                    return true;
                } else {
                    throw new Error(`Did not fail as expected!Original message:\n${e?.message}`);
                }
            }
            return false;
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithFolders(testBranches, assertVoid);
    });
});
