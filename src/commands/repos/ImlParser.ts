import * as fs from 'fs';
import * as xml2js from 'xml2js';
import {IIml, IImlComponent} from './models';

/**
 * Parses IntelliJ's IML files.
 */
export class ImlParser {
    private moduleIml: IIml;
    private pathToIml: string;

    constructor(pathToIml: string) {
        this.pathToIml = pathToIml;
        if (!fs.existsSync(pathToIml)) {
            throw Error(`IML ${pathToIml} does not exist`);
        }
        this.parseFile();
    }

    public getReferencedModules(): string[] {
        const components = this.moduleIml.component;
        let result: string[] = [];

        if (components) {
            components.forEach((component) => {
                if (component.$.name === 'NewModuleRootManager') {
                    result = this.getReferencedModulesFromManager(component);
                }
            });
        }

        return result;
    }

    private getReferencedModulesFromManager(component: IImlComponent): string[] {
        const entries = component.orderEntry;
        if (!entries) {
            return [];
        }

        return entries
            .map((entry) => {
                return entry.$.type && entry.$.type === 'module' ? entry.$['module-name'] : null;
            })
            .filter((name) => {
                return !!name;
            });
    }

    private parseFile(): void {
        if (this.moduleIml) {
            return;
        }

        const imlContent = fs.readFileSync(this.pathToIml, 'utf8');
        xml2js.parseString(imlContent, (err, result) => {
            this.moduleIml = result.module;
        });
    }
}
