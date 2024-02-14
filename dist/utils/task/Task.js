"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryTaskUntilDone = exports.waitTask = exports.TimeoutError = void 0;
class TimeoutError extends Error {
    constructor(timeout) {
        super(`exceed ${timeout} ms`);
    }
}
exports.TimeoutError = TimeoutError;
const waitTask = (task, timeout = 60000) => {
    return Promise.race([
        new Promise(async (resolve, reject) => {
            try {
                resolve(await task());
            }
            catch (error) {
                reject(error);
            }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new TimeoutError(timeout)), timeout)),
    ]);
};
exports.waitTask = waitTask;
const retryTaskUntilDone = (task, timeout = 60000, delayRetrying = 1000, repeat = 2, continueOnError) => {
    return new Promise(async (resolve, reject) => {
        let c = 0;
        while (repeat <= 0 || c < repeat) {
            try {
                resolve(await (0, exports.waitTask)(task, timeout));
                return;
            }
            catch (error) {
                if (!(error instanceof TimeoutError) && continueOnError && !continueOnError(error)) {
                    return;
                }
            }
            c++;
            await new Promise(r => setTimeout(r, delayRetrying));
        }
    });
};
exports.retryTaskUntilDone = retryTaskUntilDone;
exports.default = {
    waitTask: exports.waitTask,
    retryTaskUntilDone: exports.retryTaskUntilDone
};
