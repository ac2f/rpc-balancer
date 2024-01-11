"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = void 0;
const axios_1 = __importDefault(require("axios"));
const request = async ({ url, data }) => {
    const API = axios_1.default.create({
        baseURL: url
    });
    API.interceptors.request.use(config => {
        const newConfig = { ...config };
        // @ts-ignore: Object is possibly 'null'.
        newConfig.headers['startTime'] = new Date().toISOString();
        return newConfig;
    });
    API.interceptors.response.use(response => {
        const start = new Date(response.headers?.date?.toString());
        const end = new Date();
        const elapsedTime = (end.getTime() - start.getTime()) / 1000;
        response.headers['elapsedTime'] = elapsedTime.toString();
        return response;
    });
    // console.log(`${data.method} -> ${url}`)
    const res = await API({
        url: url,
        method: 'POST',
        data: data
    });
    return res;
};
exports.request = request;
