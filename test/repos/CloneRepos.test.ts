import {ICommandParameters} from '../../src/commands/models';
import {CloneRepos} from '../../src/commands/repos/CloneRepos';
import {basicTestSetupData, testWith} from '../helpers/remoteRepositories';
import {AbstractReposCommand} from '../../src/commands/repos/AbstractReposCommand';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import {Global} from '../../src/Global';

describe('cloning the parent repos json', () => {
    test('using tags', async () => {
        const testCloningTheParentRepos = async (rootDir: string): Promise<string> => {
            const params: ICommandParameters = {};
            params[AbstractReposCommand.PARAMETER_CLONE_DEPTH] = 0;
            params[Global.PARAMETER_VERBOSE] = true;

            const cl = new CloneRepos();
            cl.prepareAndMayExecute(params, rootDir);
            await cl.execute();

            return rootDir;
        };

        const assertCloningTheParentRepos = async (testResult: string): Promise<void> => {
            console.log(`testResult: ${testResult}`);
            console.log(`cwd: ${process.cwd()}`);

            const command = `git describe`;
            console.log(
                child_process.execSync(
                    command,
                    {
                        cwd: testResult,
                        shell: 'bash'
                    }
                ).toString());

            const files = fs.readdirSync(path.join(testResult, '..'));
            console.log(`files: ${files}`);

            expect(files).toEqual(['main', 'rootRepo', 'test_1', 'test_2']);
        };

        await testWith(basicTestSetupData)
            .withBranchUnderTest('release/22.2')
            .evaluateWithRemoteRepos(testCloningTheParentRepos, assertCloningTheParentRepos);
    });
});
