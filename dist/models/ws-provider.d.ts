import { WebSocketProvider } from "web3";
import { ISubscription, ISubscriptionHandler, IWSConfig, IWSProvider } from "../types";
declare class SubscriptionHandler implements ISubscriptionHandler {
    readonly id: string;
    private $listeners;
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
    get subscribeOnReconnect(): ISubscription[];
    get requests(): number;
    get available(): boolean;
    private subscriptionsMapping;
    getSubscriptionById(id: string): SubscriptionHandler;
    private onMessageHandler;
    subscribe(subscription: ISubscription): Promise<ISubscriptionHandler>;
    subscribe(subscription: ISubscription, disableAutoSubscribeOnReconnect: true): Promise<ISubscriptionHandler>;
    private init;
    constructor(address: string, clientOptions?: IWSConfig["client"], reconnect?: IWSConfig["reconnect"], disableClientOnError?: IWSConfig["disableClientOnError"]);
}
export {};
