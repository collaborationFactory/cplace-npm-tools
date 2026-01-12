import {CliRunner, ICliResult} from './cliRunner';
import {ITestSetupData, testWith, ILocalRepoData} from '../../test/helpers/remoteRepositories';

/**
 * E2E test runner that wraps existing test helpers with CLI execution layer
 */
export class E2ETestRunner {
    private readonly cliRunner: CliRunner;
    private readonly testSetupData: ITestSetupData;
    private branchUnderTest: string = 'master';
    private readonly branchesToCheckout: string[] = [];
    private debug: boolean = false;

    constructor(testSetupData: ITestSetupData) {
        this.cliRunner = new CliRunner();
        this.testSetupData = testSetupData;
    }

    /**
     * Set the branch to test
     */
    public withBranchUnderTest(branch: string): E2ETestRunner {
        this.branchUnderTest = branch;
        return this;
    }

    /**
     * Set additional branches to checkout
     */
    public withBranchesToCheckout(branches: string[]): E2ETestRunner {
        this.branchesToCheckout.push(...branches);
        return this;
    }

    /**
     * Enable debug logging
     */
    public withDebug(debug: boolean): E2ETestRunner {
        this.debug = debug;
        return this;
    }

    /**
     * Run E2E test with remote repos only (read-only commands)
     */
    public async runWithRemoteRepos<T>(
        testCase: (rootDir: string, cliRunner: CliRunner, remoteRepos?: ILocalRepoData[]) => Promise<T>,
        assertion: (testResult: T) => Promise<void>
    ): Promise<void> {
        const testRunner = testWith(this.testSetupData)
            .withBranchUnderTest(this.branchUnderTest)
            .withBranchesToCheckout(this.branchesToCheckout)
            .withDebug(this.debug);

        return testRunner.evaluateWithRemoteRepos(
            async (rootDir: string, remoteRepos?: ILocalRepoData[]) => {
                return await testCase(rootDir, this.cliRunner, remoteRepos);
            },
            assertion
        );
    }

    /**
     * Run E2E test with remote and local repos (write commands)
     */
    public async runWithRemoteAndLocalRepos<T>(
        testCase: (rootDir: string, cliRunner: CliRunner) => Promise<T>,
        assertion: (testResult: T) => Promise<void>
    ): Promise<void> {
        const testRunner = testWith(this.testSetupData)
            .withBranchUnderTest(this.branchUnderTest)
            .withBranchesToCheckout(this.branchesToCheckout)
            .withDebug(this.debug);

        return testRunner.evaluateWithRemoteAndLocalRepos(
            async (rootDir: string) => {
                return await testCase(rootDir, this.cliRunner);
            },
            assertion
        );
    }

    /**
     * Execute CLI command in working directory
     */
    public async executeCli(
        args: string[],
        rootDir: string,
        options: {env?: NodeJS.ProcessEnv; timeout?: number} = {}
    ): Promise<ICliResult> {
        return await this.cliRunner.execute(args, {
            cwd: rootDir,
            ...options
        });
    }
}
