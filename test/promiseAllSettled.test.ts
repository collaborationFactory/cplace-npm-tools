import {promiseAllSettled} from '../src/promiseAllSettled';

describe('using promiseAllSettled', () => {

    async function delay(ms: number): Promise<void> {
        return new Promise((resolve): void => {
            setTimeout(resolve, ms);
        });
    }

    async function sleep(ms: number): Promise<void> {
        await delay(ms);
    }

    const values = {
        a: 1,
        b: 2,
        c: 3,
        d: 4,
        e: 5,
        f: 6,
        g: 7,
        h: 8,
        i: 9,
        j: 10,
        k: 11,
        l: 12,
        m: 13,
        n: 14,
        o: 15,
        p: 16
    };

    const valuesInOrder: number[] = Object.keys(values).map((v) => {
        return values[v];
    });

    let resultsInExecutionOrder: number[];

    async function testPromise(key: string): Promise<number> {
        return new Promise<number>((resolve) => {
            const value = values[key];
            sleep(1000 / value).then(() => {
                resultsInExecutionOrder.push(value);
                resolve(value);
            });
        });
    }

    test('running all sequential', async () => {
        resultsInExecutionOrder = [];

        await promiseAllSettled(
            {
                keys: Object.keys(values),
                promiseFactory: (key) => {
                    return testPromise(key);
                },
                sequential: true
            }).then((result) => {
            expect(result).toEqual(valuesInOrder);
            expect(resultsInExecutionOrder).toEqual(valuesInOrder);
        });
    });

    test.each([
                  [1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]],
                  [2, [2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15]],
                  [3, [3, 2, 1, 6, 5, 4, 9, 8, 7, 12, 11, 10, 15, 14, 13, 16]],
                  [8, [8, 7, 6, 5, 4, 3, 2, 1, 16, 15, 14, 13, 12, 11, 10, 9]],
                  [9, [9, 8, 7, 6, 5, 4, 3, 2, 1, 16, 15, 14, 13, 12, 11, 10]],
                  [10, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 16, 15, 14, 13, 12, 11]],
                  [11, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 16, 15, 14, 13, 12]],
                  [15, [15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 16]],
                  [16, [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
                  [17, [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
                  [100, [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
                  [101, [16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]]
              ])
    ('running parallel with limited concurrency %p, expected %p',
     async (concurrency: number, expectedOrder: number[]) => {
         resultsInExecutionOrder = [];

         await promiseAllSettled(
             {
                 keys: Object.keys(values),
                 promiseFactory: (key) => {
                     return testPromise(key);
                 },
                 sequential: false,
                 concurrency
             }).then((result) => {
             expect(result).toEqual(valuesInOrder);
             expect(resultsInExecutionOrder).toEqual(expectedOrder);
         });
     });

    test('running all parallel', async () => {
        resultsInExecutionOrder = [];

        await promiseAllSettled(
            {
                keys: Object.keys(values),
                promiseFactory: (key) => {
                    return testPromise(key);
                },
                sequential: false
            }).then((result) => {
            expect(result).toEqual(valuesInOrder);
            expect(resultsInExecutionOrder).toEqual(valuesInOrder.reverse());
        });
    });
});