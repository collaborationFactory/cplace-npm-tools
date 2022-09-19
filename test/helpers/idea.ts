import * as path from 'path';
import * as fs from 'fs';

export function writeModulesXml(rootDir: string, repositoryName: string, content: string) {
    const ideaDir = path.join(rootDir, repositoryName, '.idea');
    fs.mkdirSync(ideaDir);
    fs.writeFileSync(
        path.join(ideaDir, 'modules.xml'),
        content,
        'utf8'
    );
}

export function writeModuleIml(rootDir: string, repositoryName: string, moduleName: string, content: string) {
    const moduleDir = path.join(rootDir, repositoryName, moduleName);
    fs.mkdirSync(moduleDir);
    fs.writeFileSync(
        path.join(moduleDir, `${moduleName}.iml`),
        content,
        'utf8'
    );
}
