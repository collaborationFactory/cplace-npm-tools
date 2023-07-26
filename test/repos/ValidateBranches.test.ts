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
    test('validate', async () => {
        const testBranches = async (rootDir: string): Promise<IReposDescriptor> => {
            const parentRepos = catParentReposJson(rootDir);

            // FIXME create parent repos for each
            Object.keys(parentRepos).forEach((repo) => {
                if (repo !== 'main') {
                    writeParentRepos(path.join(rootDir, '..', repo), {
                        main: {url: 'test', branch: 'branch'}
                    });
                }
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
            .evaluateWithRemoteAndLocalRepos(testBranches, assertBranches);
    });
});
