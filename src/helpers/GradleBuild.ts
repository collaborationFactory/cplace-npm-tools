import * as path from 'path';
import * as fs from 'fs';

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
            .map((line) => line.trim());
    }

    public containsGradleBuild(): boolean {
        return fs.existsSync(path.join(this.directory, GradleBuild.GRADLE_BUILD_FILE))
            && fs.existsSync(path.join(this.directory, GradleBuild.SETTINGS_FILE));
    }

    /**
     * Returns the relative paths which are referenced in the settings file
     * with `includeBuild(<path>)`.
     */
    public getIncludedCompositeRepoPaths(): string[] {
        this.ensureSettingsGradleContentRead();

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

    private ensureSettingsGradleContentRead(): void {
        if (this.settingsGradleContent !== undefined) {
            return;
        }

        const content = fs.readFileSync(
            path.join(this.directory, GradleBuild.SETTINGS_FILE),
            {encoding: 'utf8'}
        );
        this.settingsGradleContent = GradleBuild.splitAndTrimLines(content);
    }

}
