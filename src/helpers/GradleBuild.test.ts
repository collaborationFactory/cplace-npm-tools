import {GradleBuild} from './GradleBuild';
import * as path from 'path';
import * as fs from 'fs';
import {withTempDirectory} from '../test/helpers/directories';

test('Splitting and trimming lines', () => {
    const lines = `first\n`
        + `second\n`
        + `\tthird\r\n`
        + `   fourth`;
    expect(GradleBuild.splitAndTrimLines(lines)).toEqual(
        ['first', 'second', 'third', 'fourth']
    );
});

test('Directory is detected as gradle build', async () => {
    await withTempGradleBuild(async (dir) => {
        const build = new GradleBuild(dir);
        expect(build.containsGradleBuild()).toBe(true);
    });
});

test('Composite build repo extraction works correctly', async () => {
    const settingsGradleContent = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            + `includeBuild('../main') {\n`
            + `}\n`
            + `\n`
            + `includeBuild("../../other-project") {}\n`
            ;
    };

    await withTempGradleBuild(
        async (dir) => {
            const build = new GradleBuild(dir);
            expect(build.getIncludedCompositeRepoPaths()).toEqual(
                ['../main', '../../other-project']
            );
        },
        undefined,
        settingsGradleContent
    );
});

function withTempGradleBuild(func: (directory: string) => Promise<void>,
                             buildGradleContent?: () => string,
                             settingsGradleContent?: () => string): Promise<void> {
    return withTempDirectory(
        'gradle',
        async (dir) => {
            const buildGradle = path.join(dir, 'build.gradle');
            fs.writeFileSync(buildGradle, buildGradleContent ? buildGradleContent() : '', {encoding: 'utf8'});
            const settingsGradle = path.join(dir, 'settings.gradle');
            fs.writeFileSync(settingsGradle, settingsGradleContent ? settingsGradleContent() : '', {encoding: 'utf8'});

            await func(dir);
        }
    );
}
