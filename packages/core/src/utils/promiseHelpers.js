import { Global } from '../Global.js';
//#endregion
// https://stackoverflow.com/a/31424853/282229
function reflect(promise) {
    return promise.then((v) => ({ status: 'fulfilled', value: v }), (e) => ({ status: 'rejected', reason: e }));
}
class PromiseAllSettled {
    keys;
    promiseFactory;
    sequential;
    error = '';
    results = [];
    concurrency;
    constructor(keys, promiseFactory, sequential, concurrency = -1) {
        this.sequential = sequential;
        this.promiseFactory = promiseFactory;
        this.keys = keys;
        this.concurrency = concurrency;
    }
    async run() {
        this.error = '';
        this.results = [];
        if (this.sequential) {
            for (const key of this.keys) {
                const promise = this.makePromise(key);
                await this.handle(promise);
            }
        }
        else {
            if (this.concurrency > 0) {
                let startIdx = 0;
                let slice = 1;
                while (startIdx < this.keys.length) {
                    await this.handleSlice(this.keys.slice(startIdx, this.concurrency * slice));
                    startIdx += this.concurrency;
                    slice++;
                }
            }
            else {
                await this.handleSlice(this.keys);
            }
        }
        if (this.error) {
            throw new Error(this.error);
        }
        return this.results;
    }
    async handleSlice(keys) {
        const promises = keys
            .map((key) => this.makePromise(key));
        for (const promise of promises) {
            await this.handle(promise);
        }
    }
    makePromise(key) {
        let promise;
        try {
            promise = this.promiseFactory(key);
        }
        catch (e) {
            promise = Promise.reject(e);
        }
        return reflect(promise);
    }
    async handle(promise) {
        try {
            const result = await promise;
            if (result.status === 'fulfilled') {
                this.handleSuccess(result.value);
            }
            else {
                this.handleRejection(result.reason);
            }
        }
        catch (e) {
            this.handleRejection(e);
        }
    }
    handleSuccess(value) {
        this.results.push(value);
    }
    handleRejection(e) {
        Global.isVerbose() && console.error(e);
        // collect all errors
        this.error = (this.error ? this.error + '\n\t' : '') + e;
    }
}
/**
 * Creates and awaits all provided promises, either sequentially in the provided order or in parallel.
 * If all promises resolve, the returned promise resolves with an array of the individual results in the order of keys.
 * If some promises are rejected, the returned promise is rejected with a new Error that combines all the reasons; results of resolved promises are discarded.
 * <br/>
 * This method is similar to, but different in behaviour from, <code>Promise.all</code> and <code>Promise.allSettled</code>:
 * This method supports sequential promise handling, and forwards all received rejections instead of just the first.
 * This method is similar to <code>Promise.allSettled</code> in that both methods await all promises before the returned promise is settled.
 * This method is similar to <code>Promise.all</code> in that both methods return
 * a promise that is resolved with an array of results when all promises resolve and is rejected otherwise.
 *
 * @param options.keys An array of keys to iterate over and call the promiseFactory with.
 * @param options.promiseFactory A factory creating a promise for each key.
 * @param options.sequential Whether the promises should be produced and awaited sequentially, or all produced and then awaited in parallel.
 * @param options.concurrency Optional. Limits the concurrency of the parallel promise execution to batches of the size of specified positive integer. 0 or negative values mean no limit.
 * If options.sequential is true any limit is ignored.
 * @return an array of results, if all promises resolved
 * @throws an Error containing details about all rejected promises, if any promise was rejected
 */
export function promiseAllSettled(options) {
    return new PromiseAllSettled(options.keys, options.promiseFactory, options.sequential, options.concurrency).run();
}
/**
 * Awaits all provided promises, as if by calling {@link #promiseAllSettled} with
 * keys being the keys of the array,
 * promiseFactory returning the promise for each key,
 * and sequential being false.
 * @param promises An array of promises.
 * @return an array of results, if all promises resolved
 * @throws an Error containing details about all rejected promises, if any promise was rejected
 */
export function promiseAllSettledParallel(promises) {
    return promiseAllSettled({ keys: [...promises.keys()], promiseFactory: (key) => promises[key], sequential: false });
}
//# sourceMappingURL=promiseHelpers.js.map