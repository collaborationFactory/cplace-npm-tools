import {withTempDirectory} from './directories';
import * as path from 'path';
import * as fs from 'fs';

export function withTempGradleBuild(func: (directory: string) => Promise<void>,
                                    buildGradleContent?: () => string,
                                    settingsGradleContent?: () => string): Promise<void> {
    return withTempDirectory(
        'gradle',
        async (dir) => {
            await withGradleBuild(dir, func, buildGradleContent, settingsGradleContent);
        }
    );
}

export async function withGradleBuild(gradleDirectory: string,
                                      func: (directory: string) => Promise<void>,
                                      buildGradleContent?: () => string,
                                      settingsGradleContent?: () => string): Promise<void> {
    const buildGradle = path.join(gradleDirectory, 'build.gradle');
    fs.writeFileSync(buildGradle, buildGradleContent ? buildGradleContent() : '', {encoding: 'utf8'});
    const settingsGradle = path.join(gradleDirectory, 'settings.gradle');
    fs.writeFileSync(settingsGradle, settingsGradleContent ? settingsGradleContent() : '', {encoding: 'utf8'});
    await func(gradleDirectory);
}
