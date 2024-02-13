import { ConnectionNotOpenError, ConnectionTimeoutError, WebSocketProvider } from "web3";
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

    public getSubscriptionByAlias(alias: string) {
        return this.subscriptionsMapping[alias];
    }
    public getSubscriptionById(id: string) {
        return this.subscriptionsMapping[this.subscriptionIdToAlias[id]];
    }
    private async onMessageHandler() {
        this.on("message", (message: any) => {
            if (message.method === "eth_subscription") {
                const subscriptionId: string = message.params.subscription;
                const subscription = this.getSubscriptionById(subscriptionId);
                if (subscription) {
                    subscription.emit("data", message.params.result);
                }
            }
        });
    }
    public newRequest() {
        this.$requests += 1;
    }
    public subscribe(subscription: ISubscriptionWithAlias,): Promise<ISubscriptionHandler>;
    public subscribe(subscription: ISubscriptionWithAlias, disableAutoSubscribeOnReconnect: true): Promise<ISubscriptionHandler>;
    public async subscribe(subscription: ISubscriptionWithAlias, disableAutoSubscribeOnReconnect?: true): Promise<ISubscriptionHandler> {
        this.newRequest();
        const response = await this.request({ id: this.requests + 1, method: "eth_subscribe", params: [subscription.eventName, subscription.meta ? { fromBlock: subscription.meta.fromBlock, address: subscription.meta.address, topics: subscription.meta.topics } : undefined] });
        if (response.error) {
            this.debug && console.log("error:", response.error);
            throw new Error(`Event: ${subscription.eventName}\n${response.error}`);
        }
        if (!disableAutoSubscribeOnReconnect) {
            const _subscriptionStr = JSON.stringify(subscription);
            if (!this.$subscribeOnReconnect.find(subscription => JSON.stringify(subscription) === _subscriptionStr)) {
                this.$subscribeOnReconnect.push(subscription);
            }
        }
        let handler: SubscriptionHandler;
        let _cachedSubscription = this.getSubscriptionByAlias(subscription.alias);
        if (_cachedSubscription) {
            _cachedSubscription.emit("updateSubscriptionId", response.result);
            handler = _cachedSubscription;
        } else {
            handler = new SubscriptionHandler(response.result);
        }
        this.subscriptionIdToAlias[response.result] = subscription.alias;
        this.subscriptionsMapping[subscription.alias] = handler;
        // this.debug && console.log("subscribed:", handler, response);
        this.debug && console.log("subscribed to", subscription);
        return handler;
    }
    private init() {
        this.on("connect", async (data) => {
            this.$available = true;
            this.debug && console.log("onConnect", data.chainId, this.address, "there is", this.subscribeOnReconnect.length, "subscription orders pending");
            for (const subscription of this.subscribeOnReconnect) {
                while (true) {
                    try {
                        await this.subscribe(subscription);
                        this.debug && console.log("auto subscribe, subscription alias:", subscription.alias);
                        break;
                    } catch (error) {
                        if (error instanceof ConnectionTimeoutError ) {
                            this.debug && console.log("conenction not open, reconnecting..");
                            try {
                                this._reconnect();
                                this.debug && console.log("reconnected")
                            } catch (error) {
                                this.debug && console.log("error while reconnecting.. error:" , error);
                            }
                        }
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }
            this.onMessageHandler();
        });
        this.on("close", () => {
            this.$available = false;
            for (let subscription in this.subscriptionsMapping) {
                delete this.subscriptionIdToAlias[subscription];
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
    debug: boolean = false;
    constructor(address: string, clientOptions?: IWSConfig["client"], reconnect?: IWSConfig["reconnect"], disableClientOnError?: IWSConfig["disableClientOnError"], debug?: boolean) {
        super(address, clientOptions, reconnect);
        this.debug = !!debug;
        this.address = address;
        this._disableClientOnError = disableClientOnError;
        this.init();
    }
}