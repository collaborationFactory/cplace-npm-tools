import * as path from 'path';
import * as fs from "fs";
import { IReposDescriptor } from "../../dist/commands/repos/models";
import { GradleDependencyManagement } from "../../dist/commands/repos/add-dependency/GradleDependencyManagement";
import { withRepositories } from "../helpers/repositories";
import { createGradleBuild } from "../helpers/gradle";

const allRepos: IReposDescriptor = {
    main: {
        branch: 'master',
        url: 'test.url'
    },
    test: {
        branch: 'test/branch',
        url: 'dummy.io'
    },
    entry: {
        branch: 'entry/branch',
        url: 'entry.io'
    }
};
const currentRepos: IReposDescriptor = {
    main: {
        branch: 'master',
        url: 'test.url'
    }
};

test('Adding Repository dependency works', async () => {
    const entrySettingsGradle = () => {
        return `rootProject.name = 'entryProject'\n`
            + `\n`
            ;
    };
    const testSettingsGradle = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            ;
    };
    await withRepositories(
        allRepos,
        async (rootDir) => {
            await createGradleBuild(path.join(rootDir, 'entry'), undefined, entrySettingsGradle);
            await createGradleBuild(path.join(rootDir, 'test'), undefined, testSettingsGradle);

            const mgmt = new GradleDependencyManagement(path.join(rootDir, 'entry'), currentRepos);
            const newRepos = await mgmt.getReposDescriptorWithNewRepo('test');
            expect(newRepos).toEqual({
                                         main: allRepos.main,
                                         test: allRepos.test
                                     });
        }
    );
});

test('Adding Repository fails if it does not contain a Gradle build', async () => {
    expect.assertions(1);
    const settingsGradleContent = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            + `includeBuild('../main') {\n`
            + `}\n`
            ;
    };
    try {
        await withRepositories(
            allRepos,
            async (rootDir) => {
                await createGradleBuild(path.join(rootDir, 'entry'), undefined, settingsGradleContent);
                const mgmt = new GradleDependencyManagement(path.join(rootDir, 'entry'), currentRepos);
                await mgmt.getReposDescriptorWithNewRepo('test');
            }
        );
    } catch (e) {
        expect(e).toBeTruthy();
    }
});

test('Adding all plugins as dependencies works', async () => {
    const mainSettingsGradleContent = () => {
        return `rootProject.name = 'main'\n`
            + `\n`
            + `include ':mainPlugin'\n`
            ;
    };
    const testSettingsGradleContent = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            + `includeBuild('../main') {\n`
            + `}\n`
            ;
    };
    await withRepositories(
        allRepos,
        async (rootDir) => {
            await createGradleBuild(path.join(rootDir, 'main'), undefined, mainSettingsGradleContent);
            await createGradleBuild(path.join(rootDir, 'test'), undefined, testSettingsGradleContent);

            const mgmt = new GradleDependencyManagement(path.join(rootDir, 'test'), currentRepos);
            await mgmt.addAllPluginsFromRepository('main');
        }
    );
});

test('Adding a single plugin as dependency fails if a dependent repo does not contain a gradle build', async () => {
    expect.assertions(1);
    const testSettingsGradleContent = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            + `includeBuild('../main') {\n`
            + `}\n`
            ;
    };
    try {
        await withRepositories(
            allRepos,
            async (rootDir) => {
                await createGradleBuild(path.join(rootDir, 'test'), undefined, testSettingsGradleContent);

                const mgmt = new GradleDependencyManagement(path.join(rootDir, 'test'), currentRepos);
                await mgmt.addSinglePlugin('mainPlugin', false);
            }
        );
    } catch (e) {
        expect(e).toBeTruthy();
    }
});

test('Adding a single plugin as dependency fails if we cannot find it at all', async () => {
    expect.assertions(1);
    const mainSettingsGradleContent = () => {
        return `rootProject.name = 'main'\n`
            + `\n`
            + `include ':mainPlugin'\n`
            ;
    };
    const testSettingsGradleContent = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            + `includeBuild('../main') {\n`
            + `}\n`
            ;
    };
    try {
        await withRepositories(
            allRepos,
            async (rootDir) => {
                await createGradleBuild(path.join(rootDir, 'main'), undefined, mainSettingsGradleContent);
                await createGradleBuild(path.join(rootDir, 'test'), undefined, testSettingsGradleContent);

                const mgmt = new GradleDependencyManagement(path.join(rootDir, 'test'), currentRepos);
                await mgmt.addSinglePlugin('mainPlugin', false);
            }
        );
    } catch (e) {
        expect(e).toBeTruthy();
    }
});

test('Adding a single plugin as dependency works', async () => {
    const mainSettingsGradleContent = () => {
        return `rootProject.name = 'main'\n`
            + `\n`
            + `include ':mainPlugin'\n`
            ;
    };
    const testSettingsGradleContent = () => {
        return `rootProject.name = 'testProject'\n`
            + `\n`
            + `includeBuild('../main') {\n`
            + `}\n`
            ;
    };
    await withRepositories(
        allRepos,
        async (rootDir) => {
            await createGradleBuild(path.join(rootDir, 'main'), undefined, mainSettingsGradleContent);
            await createGradleBuild(path.join(rootDir, 'test'), undefined, testSettingsGradleContent);

            const mainPluginDir = path.join(rootDir, 'main', 'mainPlugin');
            await fs.mkdirSync(mainPluginDir);
            await fs.writeFileSync(path.join(mainPluginDir, 'pluginDescriptor.json'), '', 'utf8');

            const mgmt = new GradleDependencyManagement(path.join(rootDir, 'test'), currentRepos);
            await mgmt.addSinglePlugin('mainPlugin', false);
        }
    );
});
