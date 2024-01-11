import { IHTTPConfig, ResponseResult, RPC } from "./types";
export declare class RoundRobin {
    queue: RPC[];
    path: string;
    responseResults: {
        [key: string]: ResponseResult;
    };
    options: IHTTPConfig;
    constructor(options: IHTTPConfig);
    sortQueue(): RPC[];
    init(rpcList: string[]): Promise<RPC[]>;
    updateQueue: (idx: number, val: RPC) => void;
    storeResult(result: ResponseResult): void;
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
    }): Promise<any>;
}
