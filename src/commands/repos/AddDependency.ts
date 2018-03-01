import {AbstractReposCommand} from './AbstractReposCommand';

/**
 * Add Dependency command
 */
export class AddDependency extends AbstractReposCommand {
    private readonly plugin: string;

    constructor(plugin: string) {
        super();
        this.plugin = plugin;
    }

    public execute(): Promise<void> {
        if (Object.keys(this.parentRepos).indexOf(this.plugin) >= 0) {
            return Promise.reject(`Plugin ${this.plugin} is already a dependency.`);
        }

        return Promise.resolve();
    }

}