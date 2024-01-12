"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSProvider = void 0;
const web3_1 = require("web3");
class SubscriptionHandler {
    id;
    $listeners = {};
    get listeners() {
        return this.$listeners;
    }
    emit = (event, message) => {
        this.$listeners[event]?.(message);
    };
    on = (event, handler) => {
        this.$listeners[event] = handler;
    };
    constructor(id) {
        this.id = id;
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
        return this.$requests;
    }
    get available() {
        return this.$available;
    }
    subscriptionsMapping = {};
    getSubscriptionByAlias(alias) {
        return this.subscriptionsMapping[alias];
    }
    async onMessageHandler() {
        this.on("message", (message) => {
            if (message.method === "eth_subscription") {
                console.log("subscription data", message.id);
                const subscriptionId = message.id;
                const subscription = this.getSubscriptionByAlias(subscriptionId);
                if (subscription) {
                    subscription.emit("data", message.params.result);
                }
            }
        });
    }
    newRequest() {
        this.$requests += 1;
    }
    subscribe(subscription, disableAutoSubscribeOnReconnect) {
        return new Promise(async (resolve, reject) => {
            this.newRequest();
            const response = await this.request({ id: subscription.alias, method: "eth_subscribe", params: [subscription.eventName, subscription.meta ? { fromBlock: subscription.meta.fromBlock, address: subscription.meta.address, topics: subscription.meta.topics } : undefined] });
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
            const handler = new SubscriptionHandler(response.result);
            this.subscriptionsMapping[response.id] = handler;
            resolve(handler);
        });
    }
    init() {
        this.on("connect", async (data) => {
            this.$available = true;
            console.log("onConnect", data.chainId, this.address, "there is", this.subscribeOnReconnect.length, "subscription orders pending");
            for (const subscription of this.subscribeOnReconnect) {
                console.log("auto subscribing to", subscription.eventName);
                this.subscribe(subscription);
            }
            this.onMessageHandler();
        });
        this.on("close", () => {
            this.$available = false;
            for (let subscription in this.subscriptionsMapping) {
                delete this.subscriptionsMapping[subscription];
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
    constructor(address, clientOptions, reconnect, disableClientOnError) {
        super(address, clientOptions, reconnect);
        this.address = address;
        this._disableClientOnError = disableClientOnError;
        this.init();
    }
}
exports.WSProvider = WSProvider;
