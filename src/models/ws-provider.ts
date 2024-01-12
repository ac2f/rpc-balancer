import { WebSocketProvider } from "web3";
import { ISubscription, ISubscriptionHandler, ISubscriptionWithAlias, IWSConfig, IWSProvider } from "../types";

class SubscriptionHandler implements ISubscriptionHandler {
    private $id: string;
    private $listeners: { [event: string]: (...args: any[]) => void } = {}
    public get id() {
        return this.$id;
    }
    public get listeners() {
        return this.$listeners;
    }
    public emit: (event: string, message: any) => void = (event, message) => {
        if (event === "updateSubscriptionId") {
            this.$id = message;
        }
        this.$listeners[event]?.(message);
    };
    public on: (event: string, handler: (data: string) => void) => void = (event, handler) => {
        this.$listeners[event] = handler;
    }
    constructor(id: string) {
        this.$id = id;
    }
}
export class WSProvider extends WebSocketProvider implements IWSProvider {
    public readonly address: string;
    private $subscribeOnReconnect: ISubscriptionWithAlias[] = [];
    private $requests: number = 0;
    private $available: boolean = false;
    private _disableClientOnError?: (data: any) => boolean;
    public get subscribeOnReconnect() {
        return this.$subscribeOnReconnect;
    }
    public get requests(): number {
        if (this.$requests > 1e7) {
            this.$requests = 1;
        }
        return this.$requests;
    }
    public get available(): boolean {
        return this.$available;
    }
    private subscriptionsMapping: { [alias: string]: SubscriptionHandler } = {};
    private subscriptionIdToAlias: { [id: string]: string } = {};
    private subscriptionAliasToId: { [alias: string]: string } = {};
    public getSubscriptionAliasById(id: string): string {
        return this.subscriptionIdToAlias[id];
    }
    public getSubscriptionIdByAlias(alias: string): string {
        return this.subscriptionAliasToId[alias];
    }
    public getSubscriptionByAlias(alias: string) {
        return this.subscriptionsMapping[alias];
    }
    public getSubscriptionById(id: string) {
        return this.subscriptionsMapping[this.getSubscriptionAliasById(id)];
    }
    private async onMessageHandler() {
        this.on("message", (message: any) => {
            if (message.method === "eth_subscription") {
                const subscriptionId: string = message.params.subscription;
                const subscription = this.getSubscriptionById(subscriptionId);
                if (subscription) {
                    console.log("emitting");
                    subscription.emit("data", message.params.result);
                } else {
                    console.log("no subscription", this.subscriptionAliasToId, this.subscriptionIdToAlias, message);
                    process.exit(1);
                }
            }
        });
    }
    public newRequest() {
        this.$requests += 1;
    }
    public subscribe(subscription: ISubscriptionWithAlias,): Promise<ISubscriptionHandler>;
    public subscribe(subscription: ISubscriptionWithAlias, disableAutoSubscribeOnReconnect: true): Promise<ISubscriptionHandler>;
    public subscribe(subscription: ISubscriptionWithAlias, disableAutoSubscribeOnReconnect?: true): Promise<ISubscriptionHandler> {
        return new Promise(async (resolve, reject) => {
            this.newRequest();
            const response = await this.request({ id: this.requests + 1, method: "eth_subscribe", params: [subscription.eventName, subscription.meta ? { fromBlock: subscription.meta.fromBlock, address: subscription.meta.address, topics: subscription.meta.topics } : undefined] });
            if (response.error) {
                reject(new Error(`Event: ${subscription.eventName}\n${response.error}`));
                return;
            }
            if (!disableAutoSubscribeOnReconnect) {
                const _subscriptionStr = JSON.stringify(subscription);
                if (!this.$subscribeOnReconnect.find(subscription => JSON.stringify(subscription) === _subscriptionStr)) {
                    this.$subscribeOnReconnect.push(subscription);
                }
            }
            let handler: SubscriptionHandler;
            handler = new SubscriptionHandler(response.result);
            let _cachedSubscription = this.getSubscriptionByAlias(subscription.alias);
            this.subscriptionAliasToId[subscription.alias] = response.result;
            if (_cachedSubscription) {
                _cachedSubscription.emit("updateSubscriptionId", response.result);
            }
            this.subscriptionIdToAlias[response.result] = subscription.alias;
            this.subscriptionsMapping[response.result] = handler;
            resolve(handler);
        });
    }
    private init() {
        this.on("connect", async (data) => {
            this.$available = true;
            console.log("onConnect", data.chainId, this.address, "there is", this.subscribeOnReconnect.length, "subscription orders pending");
            for (const subscription of this.subscribeOnReconnect) {
                console.log("auto subscribing to", subscription.eventName)
                this.subscribe(subscription).then(subscription => { });
            }
            this.onMessageHandler();
        });
        this.on("close", () => {
            this.$available = false;
            for (let subscription in this.subscriptionsMapping) {
                delete this.subscriptionIdToAlias[subscription];
                delete this.subscriptionsMapping[subscription];
            }
        });
        this.on("error", (error: any) => {
            if (this._disableClientOnError && this._disableClientOnError(error)) {
                this.$available = false;
                try {
                    this.disconnect();
                } catch (error) { }
                this.$available = false; // to make sure its false in term of the ws tries to reconnect while is manually disconnecting
            }
        })
    }

    constructor(address: string, clientOptions?: IWSConfig["client"], reconnect?: IWSConfig["reconnect"], disableClientOnError?: IWSConfig["disableClientOnError"]) {
        super(address, clientOptions, reconnect);
        this.address = address;
        this._disableClientOnError = disableClientOnError;
        this.init();
    }
}