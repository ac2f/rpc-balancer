import { WebSocketProvider } from "web3";
import { ISubscriptionHandler, ISubscriptionWithAlias, IWSConfig, IWSProvider } from "../types";
declare class SubscriptionHandler implements ISubscriptionHandler {
    private $id;
    private $listeners;
    get id(): string;
    get listeners(): {
        [event: string]: (...args: any[]) => void;
    };
    emit: (event: string, message: any) => void;
    on: (event: string, handler: (data: string) => void) => void;
    constructor(id: string);
}
export declare class WSProvider extends WebSocketProvider implements IWSProvider {
    readonly address: string;
    private $subscribeOnReconnect;
    private $requests;
    private $available;
    private _disableClientOnError?;
    get subscribeOnReconnect(): ISubscriptionWithAlias[];
    get requests(): number;
    get available(): boolean;
    private subscriptionsMapping;
    private subscriptionIdToAlias;
    getSubscriptionByAlias(alias: string): SubscriptionHandler;
    getSubscriptionById(id: string): SubscriptionHandler;
    private onMessageHandler;
    newRequest(): void;
    subscribe(subscription: ISubscriptionWithAlias): Promise<ISubscriptionHandler>;
    subscribe(subscription: ISubscriptionWithAlias, disableAutoSubscribeOnReconnect: true): Promise<ISubscriptionHandler>;
    private init;
    clientOptions: any;
    constructor(address: string, clientOptions?: IWSConfig["client"], reconnect?: IWSConfig["reconnect"], disableClientOnError?: IWSConfig["disableClientOnError"]);
}
export {};
