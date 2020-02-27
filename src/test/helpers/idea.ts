import {fs} from '../../p/fs';
import * as path from 'path';

export async function writeModulesXml(rootDir: string, repositoryName: string, content: string): Promise<void> {
    const ideaDir = path.join(rootDir, repositoryName, '.idea');
    await fs.mkdirAsync(ideaDir);
    await fs.writeFileAsync(
        path.join(ideaDir, 'modules.xml'),
        content,
        'utf8'
    );
}
