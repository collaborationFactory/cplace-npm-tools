/**
 * Utility functions
 */

export function enforceNewline(text: string): string {
    return text.replace(/\r\n?/g, '\n');
}

export function makeSingleLine(text: string): string {
    return enforceNewline(text)
        .trim()
        .replace(/\s*\n\s*/g, ' ');
}
