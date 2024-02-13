"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSProvider = void 0;
const web3_1 = require("web3");
class SubscriptionHandler {
    $id;
    $listeners = {};
    get id() {
        return this.$id;
    }
    get listeners() {
        return this.$listeners;
    }
    emit = (event, message) => {
        if (event === "updateSubscriptionId") {
            this.$id = message;
        }
        this.$listeners[event]?.(message);
    };
    on = (event, handler) => {
        this.$listeners[event] = handler;
    };
    constructor(id) {
        this.$id = id;
    }
}
class WSProvider extends web3_1.WebSocketProvider {
    address;
    $subscribeOnReconnect = [];
    $requests = 0;
    $available = false;
    _disableClientOnError;
    get subscribeOnReconnect() {
        return this.$subscribeOnReconnect;
    }
    get requests() {
        if (this.$requests > 1e7) {
            this.$requests = 1;
        }
        return this.$requests;
    }
    get available() {
        return this.$available;
    }
    subscriptionsMapping = {};
    subscriptionIdToAlias = {};
    getSubscriptionByAlias(alias) {
        return this.subscriptionsMapping[alias];
    }
    getSubscriptionById(id) {
        return this.subscriptionsMapping[this.subscriptionIdToAlias[id]];
    }
    async onMessageHandler() {
        this.on("message", (message) => {
            if (message.method === "eth_subscription") {
                const subscriptionId = message.params.subscription;
                const subscription = this.getSubscriptionById(subscriptionId);
                if (subscription) {
                    subscription.emit("data", message.params.result);
                }
            }
        });
    }
    newRequest() {
        this.$requests += 1;
    }
    async subscribe(subscription, disableAutoSubscribeOnReconnect) {
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
        let handler;
        let _cachedSubscription = this.getSubscriptionByAlias(subscription.alias);
        if (_cachedSubscription) {
            _cachedSubscription.emit("updateSubscriptionId", response.result);
            handler = _cachedSubscription;
        }
        else {
            handler = new SubscriptionHandler(response.result);
        }
        this.subscriptionIdToAlias[response.result] = subscription.alias;
        this.subscriptionsMapping[subscription.alias] = handler;
        // this.debug && console.log("subscribed:", handler, response);
        this.debug && console.log("subscribed to", subscription);
        return handler;
        // for (let index = 0; index < maxRetries; index++) {
        //     try {
        //         return await new Promise(async (resolve, reject) => {
        //         });
        //     } catch (error) {
        //         if (this.debug) {
        //             console.log(error);
        //         }
        //         // if (!(error instanceof ConnectionNotOpenError)) {
        //         //     break;
        //         // }
        //         if (index >= (maxRetries - 1)) {
        //             try {
        //                 this?.debug && console.log("disconnecting")
        //                 this.disconnect();
        //             } catch (error) { }
        //             this.debug && console.log("reconnecting")
        //             this.connect();
        //             break;
        //         }
        //         await new Promise(r => setTimeout(r, 2000));
        //     }
        // }
        // throw new Error("coudln't subscribe");
        // // while (true) {
        // // }
    }
    init() {
        this.on("connect", async (data) => {
            this.$available = true;
            this.debug && console.log("onConnect", data.chainId, this.address, "there is", this.subscribeOnReconnect.length, "subscription orders pending");
            for (const subscription of this.subscribeOnReconnect) {
                while (true) {
                    try {
                        await this.subscribe(subscription);
                        this.debug && console.log("auto subscribe, subscription alias:", subscription.alias);
                        break;
                    }
                    catch (error) {
                        if (error instanceof web3_1.ConnectionTimeoutError) {
                            this.debug && console.log("conenction not open, reconnecting..");
                            try {
                                this._reconnect();
                                this.debug && console.log("reconnected");
                            }
                            catch (error) {
                                this.debug && console.log("error while reconnecting.. error:", error);
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
        this.on("error", (error) => {
            if (this._disableClientOnError && this._disableClientOnError(error)) {
                this.$available = false;
                try {
                    this.disconnect();
                }
                catch (error) { }
                this.$available = false; // to make sure its false in term of the ws tries to reconnect while is manually disconnecting
            }
        });
    }
    debug = false;
    constructor(address, clientOptions, reconnect, disableClientOnError, debug) {
        super(address, clientOptions, reconnect);
        this.debug = !!debug;
        this.address = address;
        this._disableClientOnError = disableClientOnError;
        this.init();
    }
}
exports.WSProvider = WSProvider;
