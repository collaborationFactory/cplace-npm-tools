import { MergeSkeleton } from '../../../src/commands/repos/MergeSkeleton';

describe('MergeSkeleton.handleFile', () => {
    function newCmd(): any {
        return new MergeSkeleton() as any;
    }

    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('keeps our version.gradle on a UU conflict (non-interactive)', async () => {
        const cmd = newCmd();
        await cmd.handleFile('version.gradle', 'U', 'U', false, 'Conflict on file');
        expect(cmd.ours.has('version.gradle')).toBe(true);
        expect(cmd.theirs.has('version.gradle')).toBe(false);
    });

    it('keeps our version.gradle on an AA conflict (new/empty repo)', async () => {
        const cmd = newCmd();
        await cmd.handleFile('version.gradle', 'A', 'A', false, 'Conflict on file');
        expect(cmd.ours.has('version.gradle')).toBe(true);
        expect(cmd.theirs.has('version.gradle')).toBe(false);
    });

    it('keeps our version.gradle even in interactive mode without prompting', async () => {
        const cmd = newCmd();
        const promptSpy = jest.spyOn(cmd, 'userChoiceOursTheirsMerge');
        await cmd.handleFile('version.gradle', 'U', 'U', true, 'Conflict on file');
        expect(cmd.ours.has('version.gradle')).toBe(true);
        expect(promptSpy).not.toHaveBeenCalled();
    });

    it('leaves other conflicted files to the default (resolve) behavior', async () => {
        const cmd = newCmd();
        await cmd.handleFile('some/other/File.java', 'U', 'U', false, 'Conflict on file');
        expect(cmd.ours.has('some/other/File.java')).toBe(false);
        expect(cmd.theirs.has('some/other/File.java')).toBe(false);
    });

    it('keeps the default ours behavior for a one-sided local modification', async () => {
        const cmd = newCmd();
        await cmd.handleFile('src/Foo.java', 'M', ' ', false, 'Conflict on file');
        expect(cmd.ours.has('src/Foo.java')).toBe(true);
    });
});
