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
exports.RoundRobinWS = void 0;
const ws_provider_1 = require("./models/ws-provider");
class RoundRobinWS {
    constructor(options) {
        this.queue = [];
        this.path = '';
        this.subscriptionResults = {};
        this.currentProviderIndex = -1;
        this.providers = [];
        this._lock = false;
        this._lockedAt = 0;
        this.eventListeners = {};
        // private _excludedMethods: { [methodName: string]: 1 } = {}; // check if the method is excluded by indexing is methodName instead of scanning whole array
        this.options = {
            maxRetries: 5,
            client: {},
            reconnect: {
                autoReconnect: true,
                delay: 2000,
                maxAttempts: 1e20
            }
        };
        this.options = Object.assign(Object.assign({}, this.options), options);
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
    _validateLock() {
        return __awaiter(this, void 0, void 0, function* () {
            let _lastState = false; // to update latest timestamp of locked state
            while (true) {
                yield new Promise(r => setTimeout(r, 1000));
                if (this._lock && _lastState !== this._lock) {
                    _lastState = this._lock;
                    this._lockedAt = Date.now();
                }
                if (this._lock && this._lockedAt <= Date.now() - (1000 * 15)) {
                    this._lock = false;
                }
            }
        });
    }
    _autoDeleteSubscriptionResults() {
        return __awaiter(this, void 0, void 0, function* () {
            while (true) {
                yield new Promise(r => setTimeout(r, 1000 * 60));
                const keys = Object.keys(this.subscriptionResults);
                if (keys.length >= 700) {
                    for (const key of keys.slice(0, 350)) {
                        delete this.subscriptionResults[key];
                    }
                }
            }
        });
    }
    _autoSortProviders() {
        return __awaiter(this, void 0, void 0, function* () {
            while (true) {
                yield new Promise(r => setTimeout(r, 1000 * 15));
                const _prototype = this.providers.sort((a, b) => a.requests - b.requests);
                while (this._lock) {
                    yield new Promise(r => setTimeout(r, 1));
                }
                this.providers = _prototype;
            }
        });
    }
    subscribe(subscription) {
        return __awaiter(this, void 0, void 0, function* () {
            let subscriptionIds = [];
            for (let provider of this.providers) {
                const _subscription = yield provider.subscribe(subscription);
                subscriptionIds.push(_subscription.id);
                _subscription.on("data", (data) => {
                    var _a, _b;
                    if (!this.subscriptionResults[data.transactionHash]) {
                        7;
                        this.subscriptionResults[data.transactionHash] = data;
                        (_b = (_a = this.eventListeners)["data"]) === null || _b === void 0 ? void 0 : _b.call(_a, data);
                    }
                });
            }
            return {
                id: subscription.eventName + subscriptionIds.join(";"),
                on: (event, handler) => {
                    this.eventListeners[event] = handler;
                }
            };
        });
    }
    init(rpcList) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    requestUntil(request, maxRetries, cancel, throwErrorIfCancelled = true) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let retryCount = 0; retryCount < maxRetries; retryCount) {
                try {
                    return yield request(retryCount);
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
        });
    }
    sendAsync(request, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.requestUntil(() => __awaiter(this, void 0, void 0, function* () {
                let provider = this.provider;
                if (!provider && this.providers.length > 1) {
                    for (let index = 0; index < 3; index++) {
                        yield new Promise(r => setTimeout(r, 1000));
                        provider = this.provider;
                    }
                }
                if (!provider) {
                    throw new Error("no provider available");
                }
                return yield provider.request({
                    id: provider.requests + 1,
                    jsonrpc: "2.0",
                    method: request.method,
                    params: request.params
                });
            }), this.options.maxRetries);
            return res === null || res === void 0 ? void 0 : res.result;
        });
    }
    send(request, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.requestUntil(() => __awaiter(this, void 0, void 0, function* () {
                let provider = this.provider;
                if (!provider && this.providers.length > 1) {
                    for (let index = 0; index < 3; index++) {
                        yield new Promise(r => setTimeout(r, 1000));
                        provider = this.provider;
                    }
                }
                if (!provider) {
                    throw new Error("no provider available");
                }
                return yield provider.request({
                    id: provider.requests + 1,
                    jsonrpc: "2.0",
                    method: request.method,
                    params: request.params
                });
            }), this.options.maxRetries);
            return res === null || res === void 0 ? void 0 : res.result;
        });
    }
    request(request) {
        return __awaiter(this, void 0, void 0, function* () {
            const res = yield this.requestUntil(() => __awaiter(this, void 0, void 0, function* () {
                let provider = this.provider;
                if (!provider && this.providers.length > 1) {
                    for (let index = 0; index < 3; index++) {
                        yield new Promise(r => setTimeout(r, 1000));
                        provider = this.provider;
                    }
                }
                if (!provider) {
                    throw new Error("no provider available");
                }
                return yield provider.request({
                    id: provider.requests + 1,
                    jsonrpc: "2.0",
                    method: request.method,
                    params: request.params
                });
            }), this.options.maxRetries);
            return res === null || res === void 0 ? void 0 : res.result;
        });
    }
}
exports.RoundRobinWS = RoundRobinWS;
