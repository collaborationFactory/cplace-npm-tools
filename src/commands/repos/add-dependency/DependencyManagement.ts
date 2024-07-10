import {IReposDescriptor} from '../models';
import * as path from 'path';
import {IGitStatus, Repository} from '../../../git';
import {fs} from '../../../p/fs';

export abstract class DependencyManagement {

    protected readonly repositoryDir: string;
    protected readonly parentRepos: IReposDescriptor;

    protected constructor(repositoryDir: string, parentRepos: IReposDescriptor) {
        this.repositoryDir = repositoryDir;
        this.parentRepos = parentRepos;
    }

    public getReposDescriptorWithNewRepo(repositoryName: string): Promise<IReposDescriptor> {
        if (Object.keys(this.parentRepos).indexOf(repositoryName) >= 0) {
            throw new Error(`Repository ${repositoryName} is already a dependency.`);
        }

        const repoPath = path.resolve(this.repositoryDir, '..', repositoryName);
        return fs.statAsync(repoPath)
            .then((stats) => {
                if (!stats.isDirectory()) {
                    throw new Error(`expected a repository directory named: ${repositoryName}`);
                } else if (!this.isValidRepository(repoPath)) {
                    throw new Error(`repository ${repositoryName} is not valid!`);
                }
            })
            .then(() => new Repository(repoPath))
            .then((repo) => repo.status()
                .then((status: IGitStatus) => ({repo, status}))
            )
            .then(({repo, status}) => repo.getOriginUrl()
                .then((url) => ({status, url}))
            )
            .then(({status, url}) => ({
                ...this.parentRepos,
                [repositoryName]: {
                    branch: status.current,
                    url
                }
            }) as IReposDescriptor);
    }

    /**
     * Called after a new repository dependency has been added.
     * @param repositoryName Name of the repository that was added
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async afterNewRepoDependencyAdded(repositoryName: string): Promise<void> {
        // no default behavior
    }

    /**
     * This adds all cplace plugins present in the given repository `repositoryName`
     * as dependencies to the current repository so that they will be shown in the IDE.
     * @param repositoryName Name of the repository to scan
     */
    public abstract addAllPluginsFromRepository(repositoryName: string): Promise<void>;

    /**
     * This adds the single cplace plugin identified by `pluginName` as dependency
     * to the current repository so that it will be shown in the IDE.
     * @param pluginName Name of the plugin to add
     * @param includeTransitive Whether transitive plugin dependencies should be added, too
     */
    public abstract addSinglePlugin(pluginName: string, includeTransitive: boolean): Promise<void>;

    /**
     * Checks if the given repository is valid and can be used as dependency.
     * @param repositoryPath Path to the repository
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected isValidRepository(repositoryPath: string): boolean {
        return true;
    }
}
