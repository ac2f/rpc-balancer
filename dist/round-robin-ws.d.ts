import { ProviderConnectInfo } from "web3";
import { IWSConfig, RPC, ISubscription } from "./types";
export declare class RoundRobinWS {
    queue: RPC[];
    path: string;
    private subscriptionResults;
    private currentProviderIndex;
    private providers;
    private _lock;
    private _lockedAt;
    private eventListeners;
    options: Partial<IWSConfig>;
    constructor(options: Partial<IWSConfig>);
    private get provider();
    private _validateLock;
    private _autoDeleteSubscriptionResults;
    private _autoSortProviders;
    on(event: string, callback: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
    subscribe(subscription: ISubscription): Promise<void>;
    init(rpcList: string[]): Promise<ProviderConnectInfo[]>;
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
