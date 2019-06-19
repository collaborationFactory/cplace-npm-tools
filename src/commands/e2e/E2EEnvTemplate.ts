export class E2EEnvTemplate {
    private readonly template: string;

    constructor(baseUrl: string, context: string, tenantId: string) {
        this.template =
            `export namespace E2EENV {
    export const baseUrl = '${baseUrl}';
    export const context = '${context}';
    export const tenantId = '${tenantId}';
}`;
    }

    public getTemplate(): string {
        return this.template;
    }
}
