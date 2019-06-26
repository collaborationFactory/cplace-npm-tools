export interface IE2EContext {
    baseUrl: string;
    context: string;
    tenantId: string;
}

export class E2EEnvTemplate {
    private readonly template: string;

    constructor(context: IE2EContext) {
        this.template = `import { E2EENV } from './E2EENV';

export const config: E2EENV = {
    baseUrl: '${context.baseUrl}',
    context: '${context.context}',
    tenantId: '${context.tenantId}'
};
`;
    }

    public getTemplate(): string {
        return this.template;
    }
}
