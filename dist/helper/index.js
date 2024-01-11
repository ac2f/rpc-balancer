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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = void 0;
const axios_1 = __importDefault(require("axios"));
const request = ({ url, data }) => __awaiter(void 0, void 0, void 0, function* () {
    const API = axios_1.default.create({
        baseURL: url
    });
    API.interceptors.request.use(config => {
        const newConfig = Object.assign({}, config);
        // @ts-ignore: Object is possibly 'null'.
        newConfig.headers['startTime'] = new Date().toISOString();
        return newConfig;
    });
    API.interceptors.response.use(response => {
        var _a, _b;
        const start = new Date((_b = (_a = response.headers) === null || _a === void 0 ? void 0 : _a.date) === null || _b === void 0 ? void 0 : _b.toString());
        const end = new Date();
        const elapsedTime = (end.getTime() - start.getTime()) / 1000;
        response.headers['elapsedTime'] = elapsedTime.toString();
        return response;
    });
    // console.log(`${data.method} -> ${url}`)
    const res = yield API({
        url: url,
        method: 'POST',
        data: data
    });
    return res;
});
exports.request = request;
