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
exports.RoundRobin = void 0;
const helper_1 = require("./helper");
class RoundRobin {
    constructor(options) {
        this.queue = [];
        this.path = '';
        this.responseResults = {};
        this.options = {
            maxConnections: 5,
            maxRetries: 5
        };
        this.updateQueue = (idx, val) => {
            // console.log(idx, val)
            this.queue[idx] = val;
            if (this.queue[0].responses.length >= 5) {
                const res = this.queue.shift();
                this.queue.push(res);
            }
            this.path = this.queue[0].url;
        };
        this.options = options;
    }
    sortQueue() {
        return this.queue.sort((a, b) => (a.avgResponse - b.avgResponse) || (a.connections - b.connections));
    }
    init(rpcList) {
        return __awaiter(this, void 0, void 0, function* () {
            for (let i = 0; i < rpcList.length; i++) {
                const url = rpcList[i];
                const res = yield (0, helper_1.request)({
                    url,
                    data: {
                        id: 1,
                        jsonrpc: "2.0",
                        method: "eth_chainId"
                    }
                });
                this.queue.push({
                    avgResponse: Number(res.headers.elapsedTime),
                    url,
                    responses: [{
                            url,
                            response: Number(res.headers.elapsedTime)
                        }],
                    connections: 0,
                    weight: 0
                });
            }
            this.queue = this.sortQueue();
            this.path = this.queue[0].url;
            return this.queue;
        });
    }
    storeResult(result) {
        this.responseResults[result.method] = result;
    }
    sendAsync(request, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.queue[0].url;
            const connections = this.queue[0].connections;
            this.updateQueue(0, Object.assign(Object.assign({}, this.queue[0]), { connections: connections + 1 }));
            // console.log(this.queue, request.method)
            const res = yield (0, helper_1.request)({
                url,
                data: {
                    id: 1,
                    jsonrpc: "2.0",
                    method: request.method,
                    params: request.params
                }
            });
            let responses = this.queue[0].responses;
            responses.push({
                url,
                response: Number(res.headers.elapsedTime)
            });
            this.updateQueue(0, Object.assign(Object.assign({}, this.queue[0]), { responses, connections: connections }));
            const data = yield res.data;
            return data.result;
        });
    }
    send(request, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this.queue[0].url;
            const connections = this.queue[0].connections;
            this.updateQueue(0, Object.assign(Object.assign({}, this.queue[0]), { connections: connections + 1 }));
            // console.log(this.queue, request.method)
            const res = yield (0, helper_1.request)({
                url,
                data: {
                    id: 1,
                    jsonrpc: "2.0",
                    method: request.method,
                    params: request.params
                }
            });
            let responses = this.queue[0].responses;
            responses.push({
                url,
                response: Number(res.headers.elapsedTime)
            });
            this.updateQueue(0, Object.assign(Object.assign({}, this.queue[0]), { responses, connections: connections }));
            const data = yield res.data;
            return data.result;
        });
    }
    request(request) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.options.cache && this.options.cache.caching && !(this.options.cache.excludeMethods.includes(request.method))) {
                const result = this.responseResults[request.method];
                if (result) {
                    const timeSpent = new Date().getTime() - result.start.getTime();
                    if (timeSpent <= this.options.cache.cacheClear) {
                        if (request.params && ((_a = result.params) === null || _a === void 0 ? void 0 : _a.sort().toString()) === request.params.sort().toString()) {
                            return result.result;
                        }
                        else if (!request.params) {
                            return result.result;
                        }
                    }
                    else {
                        delete this.responseResults[request.method];
                    }
                }
            }
            const url = this.queue[0].url;
            const connections = this.queue[0].connections;
            this.updateQueue(0, Object.assign(Object.assign({}, this.queue[0]), { connections: connections + 1 }));
            for (let i = 0; i < this.options.maxRetries; i++) {
                const res = yield (0, helper_1.request)({
                    url,
                    data: {
                        id: 1,
                        jsonrpc: "2.0",
                        method: request.method,
                        params: request.params
                    }
                });
                if (res.status >= 400) {
                    continue;
                }
                let responses = this.queue[0].responses;
                // console.log(this.queue, request.method)
                responses.push({
                    url,
                    response: Number(res.headers.elapsedTime)
                });
                let avgResponse = responses.slice().map(res => res.response).reduce((a, b) => a + b, 0) / responses.length;
                this.updateQueue(0, Object.assign(Object.assign({}, this.queue[0]), { avgResponse: avgResponse, responses: responses, connections: connections }));
                const data = yield res.data;
                this.storeResult({
                    method: request.method,
                    params: request.params,
                    result: data.result,
                    start: new Date()
                });
                return data.result;
            }
        });
    }
}
exports.RoundRobin = RoundRobin;
