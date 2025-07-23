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
export declare function promiseAllSettled<K, T>(options: {
    keys: K[];
    promiseFactory: ((key: K) => Promise<T>);
    sequential: boolean;
    concurrency?: number;
}): Promise<T[]>;
/**
 * Awaits all provided promises, as if by calling {@link #promiseAllSettled} with
 * keys being the keys of the array,
 * promiseFactory returning the promise for each key,
 * and sequential being false.
 * @param promises An array of promises.
 * @return an array of results, if all promises resolved
 * @throws an Error containing details about all rejected promises, if any promise was rejected
 */
export declare function promiseAllSettledParallel<T>(promises: Array<Promise<T>>): Promise<T[]>;
