import {ICommandParameters} from '../models';
import {IRefactoringCommand} from './IRefactoringCommand';
import * as path from 'path';
import * as fs from 'fs';
import {Global} from '../../Global';

/**
 * This command will refactor an "old" plugin structure using only `src/classes/...` or `src/java/...`
 * to a proper Maven-like source folder structure with proper `src/main/java` and `src/test/java`.
 */
export class RefactorTestSourcesCommand implements IRefactoringCommand {

    private pluginName: string;
    private pluginPath: string;
    private sourcesPath: string;

    private mainSourcesPath: string;
    private testSourcesPath: string;
    private packageSourcesRoot: string;

    // TODO: handle resource folders...?

    private static async createDirectoryIfMissing(dirPath: string): Promise<void> {
        console.log(`createDirectoryIfMissing: ${dirPath}`);
        if (fs.existsSync(dirPath)) {
            const srcMainStats = await fs.statAsync(dirPath);
            if (!srcMainStats.isDirectory()) {
                throw Error(`${dirPath} exists but is not a directory`);
            }
        } else {
            await fs.mkdirAsync(dirPath);
        }
    }

    public setPluginName(pluginName: string): void {
        this.pluginName = pluginName;
    }

    public prepareAndMayExecute(params: ICommandParameters): boolean {
        this.pluginPath = path.resolve(process.cwd(), this.pluginName);
        if (!fs.existsSync(this.pluginPath)) {
            console.error(`Plugin directory ${this.pluginPath} does not exist`);
            return false;
        }

        let potentialSrcPath = path.resolve(this.pluginPath, 'src', 'classes');
        if (!fs.existsSync(potentialSrcPath)) {
            const srcClasses = potentialSrcPath;
            potentialSrcPath = path.resolve.apply(null, [this.pluginPath, 'src', ...this.pluginName.split('.')]);
            if (!fs.existsSync(potentialSrcPath)) {
                console.error(`Could find sources directory for plugin ${this.pluginName} - tried the following directories:`);
                console.error(`- ${srcClasses}`);
                console.error(`- ${potentialSrcPath}`);
                return false;
            } else {
                this.sourcesPath = path.resolve(this.pluginPath, 'src');
            }
        } else {
            this.sourcesPath = potentialSrcPath;
        }

        this.packageSourcesRoot = path.resolve.apply(null, [this.sourcesPath, ...this.pluginName.split('.')]);

        return true;
    }

    public async execute(): Promise<void> {
        await this.ensureNewDirectoriesExist();
        await this.moveTestPackage();
    }

    private async ensureNewDirectoriesExist(): Promise<void> {
        const srcMainPath = path.resolve(this.pluginPath, 'src', 'main');
        await RefactorTestSourcesCommand.createDirectoryIfMissing(srcMainPath);
        const srcMainJavaPath = path.resolve(srcMainPath, 'java');
        await RefactorTestSourcesCommand.createDirectoryIfMissing(srcMainPath);
        this.mainSourcesPath = srcMainJavaPath;

        const srcTestPath = path.resolve(this.pluginPath, 'src', 'test');
        await RefactorTestSourcesCommand.createDirectoryIfMissing(srcTestPath);
        const srcTestJavaPath = path.resolve(srcTestPath, 'java');
        await RefactorTestSourcesCommand.createDirectoryIfMissing(srcTestJavaPath);
        this.testSourcesPath = srcTestJavaPath;
    }

    private async moveTestPackage(): Promise<void> {
        const testPackageSources = path.resolve(this.packageSourcesRoot, 'test');
        if (!fs.existsSync(this.testSourcesPath)) {
            Global.isVerbose() && console.log(`Test package does not exist for ${this.pluginName}: ${testPackageSources}`);
            return;
        }

        const pluginNameParts = [...this.pluginName.split('.'), 'test'];
        let testPackageTestPath = this.testSourcesPath;
        for (const part of pluginNameParts) {
            testPackageTestPath = path.join(testPackageTestPath, part);
            await RefactorTestSourcesCommand.createDirectoryIfMissing(testPackageTestPath);
        }

        Global.isVerbose() && console.log(`Moving test package for ${this.pluginName} to: ${testPackageTestPath}`);
        await fs.renameAsync(testPackageSources, testPackageTestPath);
        console.log(`Moved test package ${this.pluginName}.test to ${testPackageTestPath}`);
    }
}
