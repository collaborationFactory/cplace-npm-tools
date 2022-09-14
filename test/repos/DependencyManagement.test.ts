import * as path from 'path';
import * as fs from 'fs';
import { withRepositories } from "../helpers/repositories";
import { IReposDescriptor } from "../../src/commands/repos/models";

test('Creating a dummy repo setup works', async () => {
    const repos: IReposDescriptor = {
        main: {
            branch: 'master',
            url: 'myurl'
        },
        test: {
            branch: 'test/branch',
            url: 'another.one'
        }
    };

    await withRepositories(
        repos,
        async (rootDir) => {
            expect(fs.existsSync(path.join(rootDir, 'main'))).toBe(true);
            expect(fs.existsSync(path.join(rootDir, 'test'))).toBe(true);
        }
    );
});
