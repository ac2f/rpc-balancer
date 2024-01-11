"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const round_robin_ws_1 = require("../round-robin-ws");
(async () => {
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
})();
