/**
 * Promisified declarations for Node fs module using native fs/promises
 */
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

// Re-export native fs for synchronous operations
export {fs};

// Export promisified fs methods using native fs/promises
export const statAsync = fsPromises.stat;
export const readFileAsync = (filename: string, encoding: BufferEncoding): Promise<string> => 
    fsPromises.readFile(filename, encoding);
export const appendFileAsync = (file: string, data: string | Buffer, options: BufferEncoding): Promise<void> => 
    fsPromises.appendFile(file, data, options);
export const writeFileAsync = (file: string, data: string | Buffer, options: BufferEncoding): Promise<void> => 
    fsPromises.writeFile(file, data, options);
export const mkdirAsync = fsPromises.mkdir;
export const readdirAsync = fsPromises.readdir;
export const renameAsync = fsPromises.rename;
export const unlinkAsync = fsPromises.unlink;

// Keep the sync method as-is
export const readFileSync = fs.readFileSync;
