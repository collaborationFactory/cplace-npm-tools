import {DependencyManagement} from './DependencyManagement';
import {IReposDescriptor} from '../models';
import * as path from 'path';
import {GradleBuild} from '../../../helpers/GradleBuild';
import {fs} from '../../../p/fs';

export class GradleDependencyManagement extends DependencyManagement {

    private readonly gradleBuild: GradleBuild;

    constructor(repositoryDir: string, parentRepos: IReposDescriptor) {
        super(repositoryDir, parentRepos);
        this.gradleBuild = new GradleBuild(this.repositoryDir);

        if (!this.gradleBuild.containsGradleBuild()) {
            throw new Error(`${this.repositoryDir} does not contain a gradle build`);
        }
    }

    public async afterNewRepoDependencyAdded(repositoryName: string): Promise<void> {
        console.log(`Your parent-repos.json has been updated.`);
        console.warn(`ATTENTION: You have to update your build files manually!`);
        console.warn(`        >> build.gradle:      Update the cplaceRepositories block and add this repository`);
        console.warn(`        >> settings.gradle:   Add an includeBuild("../${repositoryName}")`);
    }

    public async addAllPluginsFromRepository(repositoryName: string): Promise<void> {
        console.log(`The plugins from ${repositoryName} will automatically be available`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public async addSinglePlugin(pluginName: string, includeTransitive: boolean): Promise<void> {
        const gradleBuilds = Object.keys(this.parentRepos)
            .map((repoName) => new GradleBuild(path.join(this.repositoryDir, '..', repoName)));

        gradleBuilds.forEach((build) => {
            const repoName = path.dirname(build.getDirectory());
            if (!build.containsGradleBuild()) {
                throw new Error(`Repository ${repoName} is not a Gradle build - did you check out all correct branches?`);
            } else if (!this.gradleBuild.hasCompositeRepoReference(path.join('..', repoName))) {
                throw new Error(`Repository ${repoName} is present in parent-repos.json but not included as composite build!`);
            }
        });

        const pluginDescriptors = gradleBuilds
            .map((build) => path.join(build.getDirectory(), pluginName, 'pluginDescriptor.json'))
            .filter((pluginDescriptor) => fs.existsSync(pluginDescriptor));

        if (pluginDescriptors.length === 0) {
            throw new Error(`Could not find plugin ${pluginName} in any referenced repository`);
        } else if (pluginDescriptors.length > 1) {
            throw new Error(`Found plugin ${pluginName} at multiple locations: ${pluginDescriptors.join(', ')}`);
        }

        console.log(`Found plugin ${pluginName} at ${path.basename(pluginDescriptors[0])}`);
        console.warn(`NOT SUPPORTED: Adding dependencies to a Gradle-based build via cplace-cli is not supported`);
        console.warn(`               The plugins have to be included in the owning repository's settings.gradle file`);
    }

    protected isValidRepository(repositoryPath: string): boolean {
        const gradleBuild = new GradleBuild(repositoryPath);
        if (!gradleBuild.containsGradleBuild()) {
            console.warn(`Repository ${repositoryPath} does not contain a gradle build.`);
            return false;
        } else {
            return true;
        }
    }
}
