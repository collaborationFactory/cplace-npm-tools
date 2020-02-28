import {GradleBuild} from './GradleBuild';
import {withTempGradleBuild} from '../test/helpers/gradle';

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
