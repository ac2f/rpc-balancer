
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
    // private _excludedMethods: { [methodName: string]: 1 } = {}; // check if the method is excluded by indexing is methodName instead of scanning whole array
    public options: Partial<IWSConfig> = {
        maxRetries: 5,
        client: {},
        connectionTimeout: 1000 * 30,
        reconnect: {
            autoReconnect: true,
            delay: 2000,
            maxAttempts: 1e20
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
        let results: ProviderConnectInfo[] = []
        for (let i = 0; i < rpcList.length; i++) {
            const result: ProviderConnectInfo = await new Promise(async (resolve, reject) => {
                this.currentProviderIndex = i;
                const address = rpcList[i];
                if (!new RegExp(`^(ws|wss):\/\/`).test(address)) {
                    throw new Error("Address must be a websocket endpoint");
                }
                const provider = new WSProvider(address, this.options.client, this.options.reconnect, this.options.disableClientOnError, this.options.debug);
                const rejectTimeout = setTimeout(() => {
                    reject(new Error(`connection to "${address}" timed out`));
                }, this.options.connectionTimeout);
                provider.on("connect", (providerConnectionInfo) => {
                    resolve(providerConnectionInfo);
                    clearTimeout(rejectTimeout);
                });
                this.providers.push(provider);
            });
            results.push(result);
        }
        return results;
    }
    public async sendAsync(request: { method: string, params?: Array<any> }, callback: (error: any, response: any) => void): Promise<any> {
        const res = await Task.default.retryTaskUntilDone(async () => {
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
        },
            1000 * 10,
            100,
            this.options.maxRetries
        );
        return res?.result;
    }

    public async send(request: { method: string, params?: Array<any> }, callback: (error: any, response: any) => void): Promise<any> {
        const res = await Task.default.retryTaskUntilDone(async () => {
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
        }, 1000 * 10,
            100,
            this.options.maxRetries
        );

        return res?.result;
    }

    public async request(request: { method: string, params?: Array<any> }): Promise<any> {
        const res = await Task.default.retryTaskUntilDone(async () => {
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
        },
            1000 * 10,
            100,
            this.options.maxRetries
        );
        return res?.result;
    }
}
(async () => {
    console.log("initializing")
    const client = new RoundRobinWS({
        debug: true,
        reconnect: {
            autoReconnect: true,
            delay: 1000,
            maxAttempts: 1e20
        }
    });
    await client.init(["wss://eth-mainnet.nodereal.io/ws/v1/71bc9202aa514631bf984e94d9a3ae9f"]);
    await client.subscribe({
        eventName: "logs",
        meta: {
            topics: [
                "0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1"
            ]
        }
    })
    client.on("data", (data) => {
        console.log(`[${new Date().toLocaleTimeString()}] Data received:`, parseInt(data.blockNumber, 16));
    });
})();