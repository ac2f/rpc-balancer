export declare class TimeoutError extends Error {
    constructor(timeout: number);
}
export declare const waitTask: <K>(task: () => K, timeout?: number) => Promise<K>;
export declare const retryTaskUntilDone: <K>(task: () => K | Promise<K>, timeout?: number, delayRetrying?: number, repeat?: number, continueOnError?: ((error: Error) => boolean | void | undefined | null) | undefined) => Promise<K>;
declare const _default: {
    waitTask: <K>(task: () => K, timeout?: number) => Promise<K>;
    retryTaskUntilDone: <K_1>(task: () => K_1 | Promise<K_1>, timeout?: number, delayRetrying?: number, repeat?: number, continueOnError?: ((error: Error) => boolean | void | null | undefined) | undefined) => Promise<K_1>;
};
export default _default;
