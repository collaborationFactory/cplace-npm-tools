import {ICommand, ICommandParameters} from '../models';
import {RefactorTestSourcesCommand} from './RefactorTestSourcesCommand';
import {IRefactoringCommand} from './IRefactoringCommand';

/**
 * Delegates the subcommands of the `refactor` command to their implementations
 */
export class RefactorDelegate implements ICommand {
    private static readonly PARAMETER_TEST_SOURCES: string = 'testSources';

    private static readonly PARAMETER_PLUGIN_NAME: string = 'plugin';
    private static readonly PARAMETER_PLUGIN_NAME_SHORT: string = 'p';

    private delegate: IRefactoringCommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[RefactorDelegate.PARAMETER_TEST_SOURCES] === true) {
            this.delegate = new RefactorTestSourcesCommand();
        } else {
            console.error(`Missing subcommand to specify refactoring to execute`);
            return false;
        }

        const pluginName = (params[RefactorDelegate.PARAMETER_PLUGIN_NAME] || params[RefactorDelegate.PARAMETER_PLUGIN_NAME_SHORT]) as string;
        if (!pluginName) {
            console.error(`Missing required parameter --${RefactorDelegate.PARAMETER_PLUGIN_NAME}|-${RefactorDelegate.PARAMETER_PLUGIN_NAME_SHORT}`);
            return false;
        }

        this.delegate.setPluginName(pluginName);

        return this.delegate.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.delegate.execute();
    }

}
