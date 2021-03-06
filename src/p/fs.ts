/**
 * Promisified declarations for Node fs module
 */
import * as Promise from 'bluebird';
import * as fs from 'fs';
import {PathLike} from 'fs';

Promise.promisifyAll(fs);

declare module 'fs' {

    export function statAsync(path: string | Buffer): Promise<Stats>;

    /*
     * Asynchronous readFile - Asynchronously reads the entire contents of a file.
     *
     * @param fileName
     * @param encoding
     */
    export function readFileAsync(filename: string, encoding: string): Promise<string>;

    export function appendFileAsync(file: string | Buffer | number, data: string | Buffer, options: string): Promise<void>;

    export function writeFileAsync(file: string | Buffer | number, data: string | Buffer, options: string): Promise<void>;

    /*
     * Asynchronous mkdir - creates the directory specified in {path}.  Parameter {mode} defaults to 0777.
     *
     * @param path
     */
    export function mkdirAsync(path: string | Buffer): Promise<void>;

    export function readFileSync(filename: string, encoding: string): string;

    export function readdirAsync(path: string | Buffer): Promise<string[]>;

    export function renameAsync(oldPath: PathLike, newPath: PathLike): Promise<void>;

    export function unlinkAsync(path: PathLike): Promise<void>;
}

export {fs};
