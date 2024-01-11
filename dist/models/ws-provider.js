"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSProvider = void 0;
const web3_1 = require("web3");
class SubscriptionHandler {
    get listeners() {
        return this.$listeners;
    }
    constructor(id) {
        this.$listeners = {};
        this.emit = (event, message) => {
            var _a, _b;
            (_b = (_a = this.$listeners)[event]) === null || _b === void 0 ? void 0 : _b.call(_a, message);
        };
        this.on = (event, handler) => {
            this.$listeners[event] = handler;
        };
        this.id = id;
    }
}
class WSProvider extends web3_1.WebSocketProvider {
    get subscribeOnReconnect() {
        return this.$subscribeOnReconnect;
    }
    get requests() {
        return this.$requests;
    }
    get available() {
        return this.$available;
    }
    getSubscriptionById(id) {
        return this.subscriptionsMapping[id];
    }
    onMessageHandler() {
        return __awaiter(this, void 0, void 0, function* () {
            this.on("message", (message) => {
                if (message.method === "eth_subscription") {
                    const subscriptionId = message.params.subscription;
                    const subscription = this.getSubscriptionById(subscriptionId);
                    if (subscription) {
                        subscription.emit("data", message.params.result);
                    }
                }
            });
        });
    }
    subscribe(subscription, disableAutoSubscribeOnReconnect) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const response = yield this.request({ id: this.requests + 1, method: "eth_subscribe", params: [subscription.eventName, subscription.meta ? { fromBlock: subscription.meta.fromBlock, address: subscription.meta.address, topics: subscription.meta.topics } : undefined] });
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
            this.subscriptionsMapping[response.result] = handler;
            resolve(handler);
        }));
    }
    init() {
        this.on("connect", (data) => __awaiter(this, void 0, void 0, function* () {
            this.$available = true;
            console.log("connected");
            for (const subscription of this.subscribeOnReconnect) {
                this.subscribe(subscription);
            }
            this.onMessageHandler();
        }));
        this.on("close", () => {
            this.$available = false;
            for (let subscription in this.subscriptionsMapping) {
                delete this.subscriptionsMapping[subscription];
            }
        });
        this.on("error", (error) => {
            console.log("on error", error);
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
        this.$subscribeOnReconnect = [];
        this.$requests = 0;
        this.$available = false;
        this.pendingSubscriptions = {};
        this.subscriptionsMapping = {};
        this.address = address;
        this._disableClientOnError = disableClientOnError;
        this.init();
    }
}
exports.WSProvider = WSProvider;
