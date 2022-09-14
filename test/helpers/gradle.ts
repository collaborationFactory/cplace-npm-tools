import { withTempDirectory } from "./directories";
import * as path from "path";
import * as fs from 'fs';

export function withTempGradleBuild(func: (directory: string) => Promise<void>,
                                    buildGradleContent?: () => string,
                                    settingsGradleContent?: () => string): Promise<void> {
    return withTempDirectory(
        'gradle',
        async (dir) => {
            await createGradleBuild(dir, buildGradleContent, settingsGradleContent);
            await func(dir);
        }
    );
}

export async function createGradleBuild(gradleDirectory: string,
                                        buildGradleContent?: () => string,
                                        settingsGradleContent?: () => string): Promise<void> {
    const buildGradle = path.join(gradleDirectory, 'build.gradle');
    const settingsGradle = path.join(gradleDirectory, 'settings.gradle');
            fs.writeFileSync(buildGradle, buildGradleContent ? buildGradleContent() : '', 'utf-8'),
            fs.writeFileSync(settingsGradle, settingsGradleContent ? settingsGradleContent() : '', 'utf-8')
}
