import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

// Avoid circular dependency with core package
const readFileAsync = (filename: string, encoding: BufferEncoding): Promise<string> => 
    fsPromises.readFile(filename, encoding);
const writeFileAsync = (file: string, data: string | Buffer, options: BufferEncoding): Promise<void> => 
    fsPromises.writeFile(file, data, options);

export class GradleBuild {
    private static readonly GRADLE_BUILD_FILE: string = 'build.gradle';
    private static readonly SETTINGS_FILE: string = 'settings.gradle';

    private static readonly REGEX_INCLUDE_BUILD: RegExp = new RegExp(
        `includeBuild\\(['"]([^'"]+)['"]\\)\\s*{`
    );

    private readonly directory: string;
    private settingsGradleContent: string[] | undefined = undefined;

    constructor(directory: string) {
        this.directory = directory;
    }

    public static splitAndTrimLines(content: string): string[] {
        return content.split('\n')
            .map((line) => line.trimRight());
    }

    public getDirectory(): string {
        return this.directory;
    }

    /**
     * Returns whether the directory this gradle build points to contains a
     * `build.gradle` and `settings.gradle` file.
     */
    public containsGradleBuild(): boolean {
        return fs.existsSync(path.join(this.directory, GradleBuild.GRADLE_BUILD_FILE))
            && fs.existsSync(path.join(this.directory, GradleBuild.SETTINGS_FILE));
    }

    /**
     * Returns the relative paths which are referenced in the settings file
     * with `includeBuild(<path>)`.
     */
    public async getIncludedCompositeRepoPaths(): Promise<string[]> {
        await this.ensureSettingsGradleContentRead();

        return this.settingsGradleContent
            .map((line) => {
                return GradleBuild.REGEX_INCLUDE_BUILD.exec(line);
            })
            .filter((match) => {
                return !!match && match.length > 1;
            })
            .map((match) => {
                return match[1];
            });
    }

    /**
     * Returns whether the given `pathToRepo` is already included as composite build
     * @param pathToRepo Path to check
     */
    public async hasCompositeRepoReference(pathToRepo: string): Promise<boolean> {
        return (await this.getIncludedCompositeRepoPaths()).indexOf(pathToRepo) > -1;
    }

    /**
     * Adds a new composite build include to the given repository path.
     * @param pathToRepo Path that should be used in `includeBuild`
     */
    public async addNewCompositeRepo(pathToRepo: string): Promise<void> {
        if (await this.hasCompositeRepoReference(pathToRepo)) {
            return;
        }

        const newIncludeBuild = [
            `includeBuild('${pathToRepo}') {`,
            `}`,
            ``
        ];

        const newSettingsContent = [
            ...this.settingsGradleContent,
            ...newIncludeBuild
        ];

        await writeFileAsync(
            path.join(this.directory, GradleBuild.SETTINGS_FILE),
            newSettingsContent.join('\n'),
            'utf-8'
        );
        this.settingsGradleContent = undefined;
    }

    private async ensureSettingsGradleContentRead(): Promise<void> {
        if (this.settingsGradleContent !== undefined) {
            return;
        }

        const content = await readFileAsync(
            path.join(this.directory, GradleBuild.SETTINGS_FILE),
            'utf-8'
        );
        this.settingsGradleContent = GradleBuild.splitAndTrimLines(content);
    }

}
