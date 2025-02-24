import { ICommand, ICommandParameters } from '../models';
import { RewriteVersions } from './RewriteVersions';

export class Version implements ICommand {
    private static readonly PARAMETER_REWRITE: string = 'rewriteVersions';
    private cmd: ICommand;

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        if (params[Version.PARAMETER_REWRITE]) {
            this.cmd = new RewriteVersions();
        } else {
            console.error('No version command specified');
            return false;
        }
        return this.cmd.prepareAndMayExecute(params);
    }

    public execute(): Promise<void> {
        return this.cmd.execute();
    }
}
