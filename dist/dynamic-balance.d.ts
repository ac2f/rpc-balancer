import { IHTTPConfig, ResponseResult, RPC } from "./types";
export declare class LoadBalanceRPC {
    queue: RPC[];
    responseResults: {
        [key: string]: ResponseResult;
    };
    path: string;
    options: IHTTPConfig;
    constructor(options: IHTTPConfig);
    sortQueue(): RPC[];
    storeResult(result: ResponseResult): void;
    init(rpcList: string[]): Promise<RPC[]>;
    updateQueue: (idx: number, val: RPC) => void;
    getQueue: () => RPC[];
    sendAsync(request: {
        method: string;
        params?: Array<any>;
    }, callback: (error: any, response: any) => void): Promise<any>;
    send(request: {
        method: string;
        params?: Array<any>;
    }, callback: (error: any, response: any) => void): Promise<any>;
    request(request: {
        method: string;
        params?: Array<any>;
    }, retries?: number): Promise<any>;
}
