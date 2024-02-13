export class TimeoutError extends Error {
    constructor(timeout: number) {
        super(`exceed ${timeout} ms`);
    }
}
export const waitTask = <K>(task: () => K, timeout: number = 60000): Promise<K> => {
    return Promise.race([
        new Promise(async (resolve, reject) => {
            try {
                resolve(await task());
            } catch (error) {
                reject(error);
            }
        }),
        new Promise((_, reject) =>
            setTimeout(() => reject(new TimeoutError(timeout)), timeout)
        ),
    ]) as any;
}

export const retryTaskUntilDone = <K>(task: () => (Promise<K> | K), timeout: number = 60000, delayRetrying: number = 1000, repeat: number = 2, continueOnError?: (error: Error) => boolean | void | undefined | null): Promise<K> => {
    return new Promise(async (resolve, reject) => {
        let c: number = 0;
        while (repeat < 0 || c < repeat) {
            try {
                console.log("retrying..")
                resolve(await waitTask(task, timeout));
                return;
            } catch (error) {
                if (!(error instanceof TimeoutError) && continueOnError && !continueOnError(error as Error)) {
                    return;
                }
            }
            await new Promise(r => setTimeout(r, delayRetrying));
            c++;
        }
    });
}
export default {
    waitTask,
    retryTaskUntilDone
}