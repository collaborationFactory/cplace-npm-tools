/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
/**
 * Promisified declarations for Node fs module using native fs/promises
 */
import * as fs from 'fs';
export { fs };
export declare const statAsync: typeof fs.promises.stat;
export declare const readFileAsync: (filename: string, encoding: BufferEncoding) => Promise<string>;
export declare const appendFileAsync: (file: string, data: string | Buffer, options: BufferEncoding) => Promise<void>;
export declare const writeFileAsync: (file: string, data: string | Buffer, options: BufferEncoding) => Promise<void>;
export declare const mkdirAsync: typeof fs.promises.mkdir;
export declare const readdirAsync: typeof fs.promises.readdir;
export declare const renameAsync: typeof fs.promises.rename;
export declare const unlinkAsync: typeof fs.promises.unlink;
export declare const readFileSync: typeof fs.readFileSync;
