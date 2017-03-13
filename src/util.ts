/**
 * Utility functions
 */

export function enforceNewline(text: string): string {
    return text.replace(/[\n\r]/g, '\n');
}

export function makeSingleLine(text: string): string {
    return enforceNewline(text).replace(/\s*\n\s*/g, ' ');
}
