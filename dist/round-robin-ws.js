"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoundRobinWS = void 0;
const ws_provider_1 = require("./models/ws-provider");
class RoundRobinWS {
    queue = [];
    path = '';
    subscriptionResults = {};
    currentProviderIndex = -1;
    providers = [];
    _lock = false;
    _lockedAt = 0;
    eventListeners = {};
    // private _excludedMethods: { [methodName: string]: 1 } = {}; // check if the method is excluded by indexing is methodName instead of scanning whole array
    options = {
        maxRetries: 5,
        client: {},
        reconnect: {
            autoReconnect: true,
            delay: 2000,
            maxAttempts: 1e20
        }
    };
    constructor(options) {
        this.options = { ...this.options, ...options };
        if (options.cache) {
            // this._excludedMethods = options.cache.excludeMethods.reduce((previous, current) => {
            //     previous[current.toLowerCase()] = 1;
            //     return previous;
            // }, {} as RoundRobinWS["_excludedMethods"]);
        }
        ;
        this._validateLock();
        this._autoSortProviders();
        this._autoDeleteSubscriptionResults();
    }
    get provider() {
        for (let providerIndex = 0; providerIndex < this.providers.length; providerIndex++) {
            this.currentProviderIndex = this.currentProviderIndex + 1;
            if (this.currentProviderIndex >= this.providers.length) {
                this.currentProviderIndex = this.providers.length - 1;
            }
            const provider = this.providers[this.currentProviderIndex];
            if (provider.available)
                return provider;
        }
    }
    async _validateLock() {
        let _lastState = false; // to update latest timestamp of locked state
        while (true) {
            await new Promise(r => setTimeout(r, 1000));
            if (this._lock && _lastState !== this._lock) {
                _lastState = this._lock;
                this._lockedAt = Date.now();
            }
            if (this._lock && this._lockedAt <= Date.now() - (1000 * 15)) {
                this._lock = false;
            }
        }
    }
    async _autoDeleteSubscriptionResults() {
        while (true) {
            await new Promise(r => setTimeout(r, 1000 * 60));
            const keys = Object.keys(this.subscriptionResults);
            if (keys.length >= 700) {
                for (const key of keys.slice(0, 350)) {
                    delete this.subscriptionResults[key];
                }
            }
        }
    }
    async _autoSortProviders() {
        while (true) {
            await new Promise(r => setTimeout(r, 1000 * 15));
            const _prototype = this.providers.sort((a, b) => a.requests - b.requests);
            while (this._lock) {
                await new Promise(r => setTimeout(r, 1));
            }
            this.providers = _prototype;
        }
    }
    async subscribe(subscription) {
        let subscriptionIds = [];
        for (let provider of this.providers) {
            const _subscription = await provider.subscribe(subscription);
            subscriptionIds.push(_subscription.id);
            _subscription.on("data", (data) => {
                if (!this.subscriptionResults[data.transactionHash]) {
                    7;
                    this.subscriptionResults[data.transactionHash] = data;
                    this.eventListeners["data"]?.(data);
                }
            });
        }
        return {
            id: subscription.eventName + subscriptionIds.join(";"),
            on: (event, handler) => {
                this.eventListeners[event] = handler;
            }
        };
    }
    async init(rpcList) {
        for (let i = 0; i < rpcList.length; i++) {
            this.currentProviderIndex = i;
            const address = rpcList[i];
            if (!new RegExp(`^(ws|wss):\/\/`).test(address)) {
                throw new Error("Address must be a websocket endpoint");
            }
            const provider = new ws_provider_1.WSProvider(address, this.options.client, this.options.reconnect, this.options.disableClientOnError);
            this.providers.push(provider);
        }
        return this;
    }
    async requestUntil(request, maxRetries, cancel, throwErrorIfCancelled = true) {
        for (let retryCount = 0; retryCount < maxRetries; retryCount) {
            try {
                return await request(retryCount);
            }
            catch (error) {
                if (cancel && cancel(error)) {
                    if (throwErrorIfCancelled) {
                        throw error;
                    }
                    break;
                }
            }
        }
    }
    async sendAsync(request, callback) {
        const res = await this.requestUntil(async () => {
            let provider = this.provider;
            if (!provider && this.providers.length > 1) {
                for (let index = 0; index < 3; index++) {
                    await new Promise(r => setTimeout(r, 1000));
                    provider = this.provider;
                }
            }
            if (!provider) {
                throw new Error("no provider available");
            }
            return await provider.request({
                id: provider.requests + 1,
                jsonrpc: "2.0",
                method: request.method,
                params: request.params
            });
        }, this.options.maxRetries);
        return res?.result;
    }
    async send(request, callback) {
        const res = await this.requestUntil(async () => {
            let provider = this.provider;
            if (!provider && this.providers.length > 1) {
                for (let index = 0; index < 3; index++) {
                    await new Promise(r => setTimeout(r, 1000));
                    provider = this.provider;
                }
            }
            if (!provider) {
                throw new Error("no provider available");
            }
            return await provider.request({
                id: provider.requests + 1,
                jsonrpc: "2.0",
                method: request.method,
                params: request.params
            });
        }, this.options.maxRetries);
        return res?.result;
    }
    async request(request) {
        const res = await this.requestUntil(async () => {
            let provider = this.provider;
            if (!provider && this.providers.length > 1) {
                for (let index = 0; index < 3; index++) {
                    await new Promise(r => setTimeout(r, 1000));
                    provider = this.provider;
                }
            }
            if (!provider) {
                throw new Error("no provider available");
            }
            return await provider.request({
                id: provider.requests + 1,
                jsonrpc: "2.0",
                method: request.method,
                params: request.params
            });
        }, this.options.maxRetries);
        return res?.result;
    }
}
exports.RoundRobinWS = RoundRobinWS;
