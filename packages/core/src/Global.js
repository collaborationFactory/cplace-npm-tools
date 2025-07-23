export class Global {
    static PARAMETER_VERBOSE = 'verbose';
    static instance = new Global();
    verbose = false;
    constructor() {
    }
    static parseParameters(params) {
        Global.instance.verbose = !!params[Global.PARAMETER_VERBOSE];
    }
    static isVerbose() {
        return Global.instance.verbose;
    }
}
//# sourceMappingURL=Global.js.map