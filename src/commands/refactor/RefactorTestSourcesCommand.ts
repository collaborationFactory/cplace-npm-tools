import {ICommandParameters} from '../models';
import {IRefactoringCommand} from './IRefactoringCommand';
import * as path from 'path';
import * as fs from 'fs';
import {Global} from '../../Global';
import * as rimraf from 'rimraf';

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
        const testPackageTestPath = await this.moveTestPackage();
        await this.moveRemainingSourceFiles();
        await this.refactorTestSourceFiles(testPackageTestPath);
        await this.adjustImlFile();
        await this.removeOldSourceAndBuildFolder();
    }

    private async ensureNewDirectoriesExist(): Promise<void> {
        const srcMainPath = path.resolve(this.pluginPath, 'src', 'main');
        await RefactorTestSourcesCommand.createDirectoryIfMissing(srcMainPath);
        const srcMainJavaPath = path.resolve(srcMainPath, 'java');
        await RefactorTestSourcesCommand.createDirectoryIfMissing(srcMainJavaPath);
        this.mainSourcesPath = srcMainJavaPath;

        const srcTestPath = path.resolve(this.pluginPath, 'src', 'test');
        await RefactorTestSourcesCommand.createDirectoryIfMissing(srcTestPath);
        const srcTestJavaPath = path.resolve(srcTestPath, 'java');
        await RefactorTestSourcesCommand.createDirectoryIfMissing(srcTestJavaPath);
        this.testSourcesPath = srcTestJavaPath;
    }

    private async moveTestPackage(): Promise<string> {
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

        return testPackageTestPath;
    }

    private async moveRemainingSourceFiles(): Promise<void> {
        const pluginNameParts = this.pluginName.split('.');
        let pluginPackageSourcePath = this.mainSourcesPath;
        for (const part of pluginNameParts) {
            pluginPackageSourcePath = path.join(pluginPackageSourcePath, part);
            await RefactorTestSourcesCommand.createDirectoryIfMissing(pluginPackageSourcePath);
        }

        Global.isVerbose() && console.log(`Moving source package for ${this.pluginName} to: ${pluginPackageSourcePath}`);
        await fs.renameAsync(this.packageSourcesRoot, pluginPackageSourcePath);
        console.log(`Moved source package ${this.pluginName} to ${pluginPackageSourcePath}`);
    }

    private async refactorTestSourceFiles(testPackageTestPath: string): Promise<void> {
        const allTestsPath = path.resolve(testPackageTestPath, 'AllTests.java');
        if (!fs.existsSync(allTestsPath)) {
            console.warn(`Expected AllTests class but didn't exist: ${allTestsPath}`);
            return;
        }

        let content = await fs.readFileAsync(allTestsPath, 'utf8');
        content = content
            .replace('import cf.cplace.platform.test.util.PackageSuite;', 'import cf.cplace.platform.test.util.PluginSuite;')
            .replace('@RunWith(PackageSuite.class)', '@RunWith(PluginSuite.class)');
        await fs.writeFileAsync(allTestsPath, content, 'utf8');

        Global.isVerbose() && console.log(`Refactored AllTests.java: ${allTestsPath}`);
    }

    private async adjustImlFile(): Promise<void> {
        const imlPath = path.resolve(this.pluginPath, `${this.pluginName}.iml`);
        if (!fs.existsSync(imlPath)) {
            console.error(`IML file for ${this.pluginName} does not exist: ${imlPath}`);
            return;
        }

        const oldSourceFolderWithClassesEntry = `<sourceFolder url="file://$MODULE_DIR$/src/classes" isTestSource="false" />`;
        const oldSourceFolderWithoutClassesEntry = `<sourceFolder url="file://$MODULE_DIR$/src" isTestSource="false" />`;
        const newSourceAndTestFolderEntry = `<sourceFolder url="file://$MODULE_DIR$/src/main/java" isTestSource="false" />\n` +
            `      <sourceFolder url="file://$MODULE_DIR$/src/test/java" isTestSource="true" />`;

        let content = await fs.readFileAsync(imlPath, 'utf8');
        // only one of the old entries exists - so we can replace twice
        content = content
            .replace(oldSourceFolderWithClassesEntry, newSourceAndTestFolderEntry)
            .replace(oldSourceFolderWithoutClassesEntry, newSourceAndTestFolderEntry);
        await fs.writeFileAsync(imlPath, content, 'utf8');

        Global.isVerbose() && console.log(`Adjusted ${this.pluginName}.iml: ${imlPath}`);
    }

    private async removeOldSourceAndBuildFolder(): Promise<void> {
        let pathToRemove = this.sourcesPath;
        const basename = path.basename(this.sourcesPath);
        if (basename === 'src') {
            // of course we may not remove the src folder - otherwise all would be lost
            // but we can remove the first package-root folder
            pathToRemove = path.resolve(this.sourcesPath, this.pluginName.split('.')[0]);
        }

        const sourcePromise = new Promise<void>((resolve, reject) => {
            rimraf(pathToRemove, (e) => {
                if (!e) {
                    console.log(`Removed old source directory ${pathToRemove}`);
                    resolve();
                } else {
                    reject(e);
                }
            });
        });

        const buildPromise = new Promise<void>((resolve, reject) => {
            const buildPath = path.resolve(this.pluginPath, 'build');
            if (!fs.existsSync(buildPath)) {
                resolve();
                return;
            }

            rimraf(buildPath, (e) => {
                if (!e) {
                    console.log(`Removed old build directory ${buildPath}`);
                    resolve();
                } else {
                    reject(e);
                }
            });
        });

        await Promise.all([sourcePromise, buildPromise]);
    }
}
