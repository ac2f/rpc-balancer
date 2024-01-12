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
        console.log(`[${this.id}] emitted", ${event}`);
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
    subscriptionAliasToId = {};
    getSubscriptionAliasById(id) {
        return this.subscriptionIdToAlias[id];
    }
    getSubscriptionIdByAlias(alias) {
        return this.subscriptionAliasToId[alias];
    }
    getSubscriptionByAlias(alias) {
        return this.subscriptionsMapping[alias];
    }
    getSubscriptionById(id) {
        const aliasById = this.getSubscriptionAliasById(id);
        return this.subscriptionsMapping[aliasById];
    }
    async onMessageHandler() {
        this.on("message", (message) => {
            if (message.method === "eth_subscription") {
                const subscriptionId = message.params.subscription;
                const subscription = this.getSubscriptionById(subscriptionId);
                if (subscription) {
                    subscription.emit("data", message.params.result);
                }
                else {
                    console.log("no subscription", this.subscriptionAliasToId, this.subscriptionIdToAlias, message);
                    process.exit(1);
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
            let handler;
            handler = new SubscriptionHandler(response.result);
            let _cachedSubscription = this.getSubscriptionByAlias(subscription.alias);
            this.subscriptionAliasToId[subscription.alias] = response.result;
            if (_cachedSubscription) {
                _cachedSubscription.emit("updateSubscriptionId", response.result);
            }
            this.subscriptionIdToAlias[response.result] = subscription.alias;
            this.subscriptionsMapping[subscription.alias] = handler;
            resolve(handler);
        });
    }
    init() {
        this.on("connect", async (data) => {
            this.$available = true;
            console.log("onConnect", data.chainId, this.address, "there is", this.subscribeOnReconnect.length, "subscription orders pending");
            for (const subscription of this.subscribeOnReconnect) {
                console.log("auto subscribing to", subscription.eventName);
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
