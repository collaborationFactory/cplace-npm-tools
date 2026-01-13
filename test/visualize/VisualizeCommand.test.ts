import {VisualizeCommand} from '../../src/commands/visualize/VisualizeCommand';
import {ICommandParameters} from '../../src/commands/models';

describe('VisualizeCommand', () => {
    let visualizeCmd: VisualizeCommand;

    beforeEach(() => {
        visualizeCmd = new VisualizeCommand();
    });

    describe('prepareAndMayExecute', () => {
        test('should use default regex for exclusion when not provided', () => {
            const params: ICommandParameters = {};
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            // Default exclusion pattern should include HEAD and attic branches
            expect((visualizeCmd as any).regexForExclusion).toContain('HEAD');
            expect((visualizeCmd as any).regexForExclusion).toContain('attic');
        });

        test('should accept custom regex for exclusion', () => {
            const params: ICommandParameters = {
                regexForExclusion: 'test/.*'
            };
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((visualizeCmd as any).regexForExclusion).toBe('test/.*');
        });

        test('should use empty regex for inclusion by default', () => {
            const params: ICommandParameters = {};
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((visualizeCmd as any).regexForInclusion).toBe('');
        });

        test('should accept custom regex for inclusion', () => {
            const params: ICommandParameters = {
                regexForInclusion: 'release/.*'
            };
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((visualizeCmd as any).regexForInclusion).toBe('release/.*');
        });

        test('should handle pdf parameter', () => {
            const params: ICommandParameters = {
                pdf: true
            };
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((visualizeCmd as any).pdf).toBe(true);
        });

        test('should default pdf to false', () => {
            const params: ICommandParameters = {};
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((visualizeCmd as any).pdf).toBe(false);
        });

        test('should accept both inclusion and exclusion patterns', () => {
            const params: ICommandParameters = {
                regexForInclusion: 'feature/.*',
                regexForExclusion: 'feature/deprecated/.*'
            };
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect((visualizeCmd as any).regexForInclusion).toBe('feature/.*');
            expect((visualizeCmd as any).regexForExclusion).toBe('feature/deprecated/.*');
        });
    });

    describe('parameter handling', () => {
        test('should handle string conversion for regex parameters', () => {
            const params: ICommandParameters = {
                regexForExclusion: 'HEAD|master',
                regexForInclusion: 'release/.*|feature/.*'
            };
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            expect(typeof (visualizeCmd as any).regexForExclusion).toBe('string');
            expect(typeof (visualizeCmd as any).regexForInclusion).toBe('string');
        });

        test('should use default for empty exclusion parameter', () => {
            const params: ICommandParameters = {
                regexForExclusion: '',
                regexForInclusion: ''
            };
            const result = visualizeCmd.prepareAndMayExecute(params);

            expect(result).toBe(true);
            // Empty exclusion uses default pattern
            expect((visualizeCmd as any).regexForExclusion).toContain('HEAD');
            expect((visualizeCmd as any).regexForInclusion).toBe('');
        });
    });
});
