/*
 * Copyright 2026, collaboration Factory GmbH. All rights reserved.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {runVerifyCommand} from '../../src/commands/flow/VerifyCommand';

describe('runVerifyCommand', () => {
    let workDir: string;

    beforeEach(() => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-command-'));
    });

    afterEach(() => {
        fs.rmSync(workDir, {recursive: true, force: true});
    });

    it('should resolve with exit code 0 when the command succeeds', async () => {
        await expect(runVerifyCommand('exit 0', workDir)).resolves.toEqual({exitCode: 0, signal: null});
    });

    it('should resolve with the exit code of a failing command', async () => {
        await expect(runVerifyCommand('exit 3', workDir)).resolves.toEqual({exitCode: 3, signal: null});
    });

    it('should run the command through the shell in the given directory', async () => {
        const result = await runVerifyCommand('pwd > out.txt && test -f out.txt', workDir);

        expect(result.exitCode).toBe(0);
        expect(fs.realpathSync(fs.readFileSync(path.join(workDir, 'out.txt'), 'utf8').trim())).toBe(fs.realpathSync(workDir));
    });
});
