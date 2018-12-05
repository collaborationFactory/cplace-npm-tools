import {ICommand} from '../models';

export interface IRefactoringCommand extends ICommand {
    setPluginName: (pluginName: string) => void;
}
