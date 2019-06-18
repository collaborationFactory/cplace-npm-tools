export class E2EEnvTemplate {
    private readonly template: string;

    constructor(baseUrl: string, context: string, tenantId: string) {
        this.template = `export enum E2EENV {
    baseUrl = '${baseUrl}',
    context = '${context}',
    tenantId = '${tenantId}'
};`;
    }

    public getTemplate(): string {
        return this.template;
    }
}
