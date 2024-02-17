
import { ConnectionNotOpenError, ProviderConnectInfo } from "web3"
import { IWSProvider, IWSConfig, RPC, ISubscriptionHandler, ISubscription } from "./types"
import { WSProvider } from "./models/ws-provider"
import { Task } from "./utils";
import { v4 } from "uuid";
export class RoundRobinWS {
    public queue: RPC[] = []
    public path = ''
    private subscriptionResults: { [transactionHash: string]: any } = {};
    private currentProviderIndex: number = -1;
    private providers: IWSProvider[] = [];
    private _lock: boolean = false;
    private _lockedAt: number = 0;
    private eventListeners: { [key: string]: ((...args: any[]) => void)[] } = {};
    public options: Partial<IWSConfig> = {
        maxRetries: 5,
        client: {},
        connectionTimeout: 1000 * 30,
        reconnect: {
            autoReconnect: true,
            delay: 2000,
            maxAttempts: 1e20
        },
        tasks: {
            timeout: 1000 * 10,
            maxRetries: 5,
            waitBetweenAttempts: 100
        }
    };

    constructor(options: Partial<IWSConfig>) {
        this.options = { ...this.options, ...options };
        if (options.cache) {
        };
        this._validateLock();
        this._autoSortProviders();
        this._autoDeleteSubscriptionResults();
    }
    private get provider() {
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
    private async _validateLock() {
        let _lastState = false;
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
    private async _autoDeleteSubscriptionResults() {
        while (true) {
            await new Promise(r => setTimeout(r, 1000 * 60));
            const keys = Object.keys(this.subscriptionResults);
            if (keys.length >= 200) {
                for (const key of keys.slice(0, 150)) {
                    delete this.subscriptionResults[key];
                }
            }
        }
    }
    private async _autoSortProviders() {
        while (true) {
            await new Promise(r => setTimeout(r, 1000 * 15));
            const _prototype = this.providers.sort((a, b) => a.requests - b.requests);
            while (this._lock) {
                await new Promise(r => setTimeout(r, 1));
            }
            this.providers = _prototype;
        }

    }
    on(event: string, callback: (...args: any[]) => void) {
        if (typeof this.eventListeners[event]?.length !== "number") {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }
    emit(event: string, ...args: any[]) {
        if (typeof this.eventListeners[event]?.length !== "number") {
            this.eventListeners[event] = [];
        }
        for (let listener of this.eventListeners[event]) {
            listener(...args);
        }
    }
    async subscribe(subscription: ISubscription) {
        let subscriptionIds: string[] = [];
        let _subscriptionWithAlias: ISubscription & { alias: string } = { alias: v4(), ...subscription };
        for (let provider of this.providers) {
            const _subscription = await provider.subscribe(_subscriptionWithAlias);
            subscriptionIds.push(_subscription.id);
            _subscription.on("data", (data) => {
                if (!this.subscriptionResults[data.transactionHash]) {
                    this.subscriptionResults[data.transactionHash] = data;
                    this.emit("data", data);
                }
            });
        }
    }
    async init(rpcList: string[]): Promise<ProviderConnectInfo[]> {
        let promises = []
        for (let i = 0; i < rpcList.length; i++) {
            promises.push(new Promise(async (resolve, reject) => {
                this.currentProviderIndex = i;
                const address = rpcList[i];
                if (!new RegExp(`^(ws|wss):\/\/`).test(address)) {
                    throw new Error("Address must be a websocket endpoint");
                }
                const provider = new WSProvider(address, this.options.client, this.options.reconnect, this.options.disableClientOnError, this.options.debug);
                const rejectTimeout = setTimeout(() => {
                    resolve(null);
                }, this.options.connectionTimeout);
                provider.on("connect", (providerConnectionInfo) => {
                    resolve(providerConnectionInfo);
                    clearTimeout(rejectTimeout);
                });
                this.providers.push(provider);
            }));
        }
        return (await Promise.all(promises)).filter(v => !!v) as ProviderConnectInfo[];
    }
    public async sendAsync(request: { method: string, params?: Array<any> }, callback: (error: any, response: any) => void): Promise<any> {
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
        provider.newRequest();
        return await provider.request({
            id: provider.requests + 1,
            jsonrpc: "2.0",
            method: request.method,
            params: request.params
        })
    }

    public async send(request: { method: string, params?: Array<any> }, callback: (error: any, response: any) => void): Promise<any> {
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
        provider.newRequest();
        const response = await provider.request({
            id: provider.requests + 1,
            jsonrpc: "2.0",
            method: request.method,
            params: request.params
        })
        return response;

    }

    public async request(request: { method: string, params?: Array<any> }): Promise<any> {
        let provider = this.provider;
        if (!provider && this.providers.length > 1) {
            for (let index = 0; index < 3; index++) {
                await new Promise(r => setTimeout(r, 1000));
                provider = this.provider;
                if (provider) break;
            }
        }
        if (!provider) {
            throw new Error("no provider available");
        }
        provider.newRequest();
        const response = await provider.request({
            id: provider.requests + 1,
            jsonrpc: "2.0",
            method: request.method,
            params: request.params
        })
        return response;
    }
}