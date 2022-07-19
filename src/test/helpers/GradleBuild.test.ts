import { GradleBuild } from "../../helpers/GradleBuild";
import { withTempGradleBuild } from "./gradle";

test('Splitting and trimming lines', () => {
    const lines = `first\n`
        + `second\n`
        + `\tthird\r\n`
        + `   fourth`;
    expect(GradleBuild.splitAndTrimLines(lines)).toEqual(
        ['first', 'second', '\tthird', '   fourth']
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
            const repoPaths = await build.getIncludedCompositeRepoPaths();
            expect(repoPaths).toEqual(
                ['../main', '../../other-project']
            );
        },
        undefined,
        settingsGradleContent
    );
});

test('Composite build detection works', async () => {
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
            expect(await build.hasCompositeRepoReference('../main')).toBe(true);
            expect(await build.hasCompositeRepoReference('../../other-project')).toBe(true);
            expect(await build.hasCompositeRepoReference('../xxxx')).toBe(false);
        },
        undefined,
        settingsGradleContent
    );
});

test('Adding a new composite build reference works', async () => {
    const settingsGradleContent = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            + `includeBuild('../main') {\n`
            + `}\n`
            ;
    };

    await withTempGradleBuild(
        async (dir) => {
            const build = new GradleBuild(dir);
            await build.addNewCompositeRepo('../../other-project');
            const repoPaths = await build.getIncludedCompositeRepoPaths();
            expect(repoPaths).toEqual(
                ['../main', '../../other-project']
            );
        },
        undefined,
        settingsGradleContent
    );
});
