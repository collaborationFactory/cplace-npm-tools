import {basicTestSetupData, catParentReposJson, testWith} from '../helpers/remoteRepositories';
import {IReposDescriptor} from '../../src/commands/repos/models';
import {ValidateBranches} from '../../src/commands/repos/ValidateBranches';
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

describe('validate the transitive of the root parent repos json for a basic setup', () => {
    test('all branches are correctly configured', async () => {
        const testBranches = async (rootDir: string): Promise<IReposDescriptor> => {
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

            // FIXME need to validate tree
            return catParentReposJson(rootDir);
        };

        const assertBranches = async (parentReposJson: IReposDescriptor): Promise<void> => {
            console.log('assert', parentReposJson);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithFolders(testBranches, assertBranches);
    });

    test('branches are not correctly configured', async () => {
        const testBranches = async (rootDir: string): Promise<IReposDescriptor> => {
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
            await vb.execute();

            // FIXME need to validate tree
            return catParentReposJson(rootDir);
        };

        const assertBranches = async (parentReposJson: IReposDescriptor): Promise<void> => {
            console.log('assert', parentReposJson);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithFolders(testBranches, assertBranches);
    });
});
