import {ICommandParameters} from '../models';
import {IRefactoringCommand} from './IRefactoringCommand';

/**
 * This command will refactor an "old" plugin structure using only `src/classes/...` or `src/java/...`
 * to a proper Maven-like source folder structure with proper `src/main/java` and `src/test/java`.
 */
export class RefactorTestSourcesCommand implements IRefactoringCommand {

    private pluginName: string;

    public setPluginName(pluginName: string): void {
        this.pluginName = pluginName;
    }

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        return true;
    }

    public execute(): Promise<void> {
        return new Promise<void>((resolve) => {
            console.log(`RefactorTestSourcesCommand: ${this.pluginName}`);
            resolve();
        });
    }
}
