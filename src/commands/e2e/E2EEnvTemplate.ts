export class E2EEnvTemplate {
    private readonly template: string;

    constructor(baseUrl: string, context: string, tenantId: string) {
        this.template = `import { E2EENV } from './E2EENV';

export const config: E2EENV = {
    baseUrl: '${baseUrl}',
    context: '${context}',
    tenantId: '${tenantId}'
};
`;
    }

    public getTemplate(): string {
        return this.template;
    }
}
