import {Global} from './Global';

//#region PromiseSettledResult
// taken from lib.es2020.promise.d.ts of IDEA

/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */

// tslint:disable-next-line:interface-name
interface PromiseFulfilledResult<T> {
    status: 'fulfilled';
    value: T;
}

// tslint:disable-next-line:interface-name
interface PromiseRejectedResult {
    status: 'rejected';
    // tslint:disable-next-line:no-any
    reason: any;
}

type PromiseSettledResult<T> = PromiseFulfilledResult<T> | PromiseRejectedResult;

//#endregion

// https://stackoverflow.com/a/31424853/282229
function reflect<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
    return promise.then(
        (v) => ({status: 'fulfilled', value: v}),
        (e) => ({status: 'rejected', reason: e}));
}

class PromiseAllSettled<K, T> {
    private readonly keys: K[];
    private readonly promiseFactory: (key: K) => Promise<T>;
    private readonly sequential: boolean;

    private error: string;
    private results: T[];

    constructor(keys: K[], promiseFactory: (key: K) => Promise<T>, sequential: boolean) {
        this.sequential = sequential;
        this.promiseFactory = promiseFactory;
        this.keys = keys;
    }

    public async run(): Promise<T[]> {
        this.error = '';
        this.results = [];
        if (this.sequential) {
            for (const key of this.keys) {
                const promise = this.makePromise(key);
                await this.handle(promise);
            }
        } else {
            const promises = this.keys
                .map((key) => this.makePromise(key));
            for (const promise of promises) {
                await this.handle(promise);
            }
        }
        if (this.error) {
            throw new Error(this.error);
        }
        return this.results;
    }

    private makePromise(key: K): Promise<PromiseSettledResult<T>> {
        let promise: Promise<T>;
        try {
            promise = this.promiseFactory(key);
        } catch (e) {
            promise = Promise.reject(e);
        }
        return reflect(promise);
    }

    private async handle(promise: Promise<PromiseSettledResult<T>>): Promise<void> {
        try {
            const result = await promise;
            if (result.status === 'fulfilled') {
                this.handleSuccess(result.value);
            } else {
                this.handleRejection(result.reason);
            }
        } catch (e) {
            this.handleRejection(e);
        }
    }

    private handleSuccess(value: T): void {
        this.results.push(value);
    }

    private handleRejection<E>(e: E): void {
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
 * @return an array of results, if all promises resolved
 * @throws an Error containing details about all rejected promises, if any promise was rejected
 */
export function promiseAllSettled<K, T>(options: { keys: K[], promiseFactory: ((key: K) => Promise<T>), sequential: boolean }): Promise<T[]> {
    return new PromiseAllSettled(options.keys, options.promiseFactory, options.sequential).run();
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
export function promiseAllSettledParallel<T>(promises: Promise<T>[]): Promise<T[]> {
    return promiseAllSettled({keys: [...promises.keys()], promiseFactory: (key) => promises[key], sequential: false});
}
