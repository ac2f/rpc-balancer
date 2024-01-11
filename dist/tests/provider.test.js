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
const round_robin_ws_1 = require("../round-robin-ws");
(() => __awaiter(void 0, void 0, void 0, function* () {
    const subscriptions = [{ eventName: "logs", meta: {} }];
    const roundRobin = new round_robin_ws_1.RoundRobinWS({
        client: {},
        disableClientOnError: (error) => {
            return String(error).includes("429");
        },
        maxRetries: 15
    });
    roundRobin.init([
        "wss://eth-mainnet.nodereal.io/ws/v1/YOUR_NODEREAL_API_KEY"
    ]).then(e => e.subscribe(subscriptions[0]).then(subscription => {
        console.log("subscribed to", subscription.id);
        subscription.on("data", (data) => {
            console.log("data from", e.options, "data:", data);
        });
    }));
    // new WSProvider("wss://eth-mainnet.nodereal.io/ws/v1/YOUR_NODEREAL_API_KEY").subscribe(subscriptions[0]).then(subscription => {
    //     console.log("subscribed to", subscription.id);
    //     subscription.on("data", (data) => {
    //         // console.log("on data subscription", data, typeof data);
    //     })
    // });
}))();
