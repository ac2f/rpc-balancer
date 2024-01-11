export declare const request: ({ url, data }: {
    url: string;
    data: {
        id: string | number;
        jsonrpc: string;
        method: string;
        params?: any;
    };
}) => Promise<import("axios").AxiosResponse<any, any>>;
