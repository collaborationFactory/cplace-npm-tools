import {IReposDescriptor} from '../models';
import {IdeaDependencyManagement} from './IdeaDependencyManagement';
import * as path from 'path';
import {withRepositories} from '../../../test/helpers/repositories';
import {writeModulesXml} from '../../../test/helpers/idea';
import {fs} from '../../../p/fs';

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
    await withRepositories(
        allRepos,
        async (rootDir) => {
            const mgmt = new IdeaDependencyManagement(path.join(rootDir, 'entry'), currentRepos);
            const newRepos = await mgmt.getReposDescriptorWithNewRepo('test');
            expect(newRepos).toEqual({
                                         main: allRepos.main,
                                         test: allRepos.test
                                     });
        }
    );
});

test('Adding an existing repository dependency fails', async () => {
    expect.assertions(1);
    try {
        await withRepositories(
            allRepos,
            async (rootDir) => {
                const mgmt = new IdeaDependencyManagement(path.join(rootDir, 'entry'), allRepos);
                await mgmt.getReposDescriptorWithNewRepo('test');
            }
        );
    } catch (e) {
        expect(e).toBe('Repository test is already a dependency.');
    }
});

test('Adding a plugin dependency fails without modules.xml', async () => {
    expect.assertions(1);
    try {
        await withRepositories(
            allRepos,
            async (rootDir) => {
                const mgmt = new IdeaDependencyManagement(path.join(rootDir, 'entry'), allRepos);
                await mgmt.addSinglePlugin('test', false);
            }
        );
    } catch (e) {
        expect(e).toBeTruthy();
    }
});

// tslint:disable:max-line-length
test('Adding a single plugin dependency works', async () => {
    const mainModulesXmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<project version="4">\n' +
        '  <component name="ProjectModuleManager">\n' +
        '    <modules>\n' +
        '      <module fileurl="file://$PROJECT_DIR$/mainPlugin/mainPlugin.iml" filepath="$PROJECT_DIR$/mainPlugin/mainPlugin.iml"/>\n' +
        '    </modules>\n' +
        '  </component>\n' +
        '</project>';
    const testModulesXmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<project version="4">\n' +
        '  <component name="ProjectModuleManager">\n' +
        '    <modules>\n' +
        '      <module fileurl="file://$PROJECT_DIR$/testPlugin/testPlugin.iml" filepath="$PROJECT_DIR$/testPlugin/testPlugin.iml"/>\n' +
        '    </modules>\n' +
        '  </component>\n' +
        '</project>';

    await withRepositories(
        allRepos,
        async (rootDir) => {
            await writeModulesXml(rootDir, 'main', mainModulesXmlContent);
            await writeModulesXml(rootDir, 'test', testModulesXmlContent);

            const mgmt = new IdeaDependencyManagement(path.join(rootDir, 'test'), currentRepos);
            await mgmt.addSinglePlugin('mainPlugin', false);

            const content = await fs.readFileAsync(path.join(rootDir, 'test', '.idea', 'modules.xml'), 'utf8');
            expect(content).toContain(
                '<module fileurl="file://$PROJECT_DIR$/testPlugin/testPlugin.iml" filepath="$PROJECT_DIR$/testPlugin/testPlugin.iml"/>'
            );
            expect(content).toContain(
                '<module fileurl="file://$PROJECT_DIR$/../main/mainPlugin/mainPlugin.iml" filepath="$PROJECT_DIR$/../main/mainPlugin/mainPlugin.iml" group="main"/>'
            );
        }
    );
});
