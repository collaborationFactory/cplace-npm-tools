import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as rimraf from 'rimraf';
import {GradleBuild} from './GradleBuild';

test('Splitting and trimming lines', () => {
    const lines = `first\n`
        + `second\n`
        + `\tthird\r\n`
        + `   fourth`;
    expect(GradleBuild.splitAndTrimLines(lines)).toEqual(
        ['first', 'second', 'third', 'fourth']
    );
});

test('Directory is detected as gradle build', (done) => {
    withTempGradleBuild(done, (dir) => {
        const build = new GradleBuild(dir);
        expect(build.containsGradleBuild()).toBe(true);
    });
});

test('Composite build repo extraction works correctly', (done) => {
    const settingsGradleContent = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            + `includeBuild('../main') {\n`
            + `}\n`
            + `\n`
            + `includeBuild("../../other-project") {}\n`
            ;
    };

    withTempGradleBuild(
        done,
        (dir) => {
            const build = new GradleBuild(dir);
            expect(build.getIncludedCompositeRepoPaths()).toEqual(
                ['../main', '../../other-project']
            );
        },
        undefined,
        settingsGradleContent
    );
});

function createTempGradleBuildDirectory(buildGradleContent?: () => string, settingsGradleContent?: () => string): string {
    const dirPath = path.join(
        os.tmpdir(),
        new Date().getTime() + '-cplace-cli-test'
    );
    fs.mkdirSync(dirPath);

    const buildGradle = path.join(dirPath, 'build.gradle');
    fs.writeFileSync(buildGradle, buildGradleContent ? buildGradleContent() : '', {encoding: 'utf8'});
    const settingsGradle = path.join(dirPath, 'settings.gradle');
    fs.writeFileSync(settingsGradle, settingsGradleContent ? settingsGradleContent() : '', {encoding: 'utf8'});

    return dirPath;
}

function withTempGradleBuild(done: () => void, func: (directory: string) => void, buildGradleContent?: () => string, settingsGradleContent?: () => string): void {
    const dir = createTempGradleBuildDirectory(buildGradleContent, settingsGradleContent);
    func(dir);
    rimraf(dir, (e) => {
        if (e) {
            console.error('failed to remove directory', e);
            throw e;
        }
        done();
    });
}
