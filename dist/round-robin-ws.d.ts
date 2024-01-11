import { IWSConfig, RPC, ISubscriptionHandler, ISubscription } from "./types";
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
    subscribe(subscription: ISubscription): Promise<ISubscriptionHandler>;
    init(rpcList: string[]): Promise<RoundRobinWS>;
    private requestUntil;
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
