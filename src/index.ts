/**
 * A function for processing requests before they are sent
 */
export type RequestInterceptor = (
    url: string,
    options: FetchioConfig,
) => Promise<{ url: string; options: FetchioConfig }>;

/**
 * The result of a fetch operation
 */
export type FetchResult<T> = {
    success: boolean;
    data: T | null;
};

/**
 * A function for processing responses
 */
export type ResponseInterceptor = (
    response: Response,
) => Promise<FetchResult<unknown>>;

/**
 * FileSystem definitions to adapt to each platform
 */
export type FileSystemAdapter = {
    saveFile<R>(data: ArrayBuffer | Blob, filename: string): Promise<R>;
    loadFile(filename: string): Promise<Buffer | Blob | ArrayBuffer>;
};

/**
 * Fetchio configuration options
 */
export interface FetchioConfig extends RequestInit {
    requestInterceptor?: RequestInterceptor;
    responseInterceptor?: ResponseInterceptor;
    headers?: Record<string, string>;
    fs?: FileSystemAdapter;
}

/**
 * Fetchio instance with all available methods
 */
export interface Fetchio {
    /**
     * Appends a path to the current base path
     * @param append - The path to append to the current base path
     */
    path(append: string): Fetchio;

    /**
     * Performs a GET request
     * @param url - The URL to request (appended to the base path)
     * @param options - Additional request options to merge with the current configuration
     */
    get(url?: string, options?: FetchioConfig): RequestBuilder;

    /**
     * Performs a POST request
     * @param url - The URL to request (appended to the base path)
     * @param data - Optional data to send or request configuration
     * @param options - Additional request options to merge with the current configuration
     */
    post<T>(url: string, data?: T, options?: FetchioConfig): RequestBuilder;

    /**
     * Performs a PUT request
     * @param url - The URL to request (appended to the base path)
     * @param data - Optional data to send or request configuration
     * @param options - Additional request options to merge with the current configuration
     */
    put<T>(url: string, data?: T, options?: FetchioConfig): RequestBuilder;

    /**
     * Performs a PATCH request
     * @param url - The URL to request (appended to the base path)
     * @param data - Optional data to send or request configuration
     * @param options - Additional request options to merge with the current configuration
     */
    patch<T>(url: string, data?: T, options?: FetchioConfig): RequestBuilder;

    /**
     * Performs a DELETE request
     * @param url - The URL to request (appended to the base path)
     * @param options - Additional request options to merge with the current configuration
     */
    del(url?: string, options?: FetchioConfig): RequestBuilder;

    /**
     * Creates a new Fetchio instance with an appended path and merged configuration
     * @param subPath - The path to append to the current base path
     * @param pathConfig - Additional configuration to merge with the current configuration
     */
    sub(subPath: string, pathConfig?: FetchioConfig): Fetchio;
}

/**
 * Request builder that provides methods to configure the request
 */
export interface RequestBuilder extends ResponseBuilder {
    /**
     * Add a query parameter to the request URL
     * @param key - Parameter name
     * @param value - Parameter value
     */
    param(key: string, value: string): RequestBuilder;

    /**
     * Add multiple query parameters to the request URL
     * @param params - Object containing parameter key-value pairs
     */
    params(params: Record<string, string>): RequestBuilder;

    /**
     * Add a header to the request
     * @param key - Header name
     * @param value - Header value
     */
    header(key: string, value: string): RequestBuilder;

    /**
     * Add multiple headers to the request
     * @param headers - Object containing header key-value pairs
     */
    headers(headers: Record<string, string>): RequestBuilder;

    /**
     * Append a path segment to the URL
     * @param segment - Path segment to append
     */
    path(segment: string): RequestBuilder;
}

/**
 * Response builder that provides methods to process the response in different formats
 */
export interface ResponseBuilder {
    /**
     * Process the response as JSON and return it as the specified type
     */
    json<T>(): Promise<FetchResult<T>>;

    /**
     * Process the response as a string
     */
    string(): Promise<FetchResult<string>>;

    /**
     * Process the response as an ArrayBuffer
     */
    bytes(): Promise<FetchResult<ArrayBuffer>>;

    /**
     * Process the response and return void (ignoring content)
     */
    void(): Promise<FetchResult<void>>;

    /**
     * Process the response as a blob
     */
    blob(): Promise<FetchResult<Blob>>;
}

/**
 * Function that creates a new Fetchio instance
 */
export type CreateFetchio = (
    basePath?: string,
    config?: FetchioConfig,
) => Fetchio;

/**
 * Creates a Fetchio instance with the specified base path and configuration
 * @param basePath - The base URL path
 * @param config - Configuration options
 * @returns Fetchio instance with methods
 */
export const createFetchio: CreateFetchio = (basePath = "/", config = {}) => {
    // Creates a request builder with the given parameters
    const createRequest = (
        url: string,
        method: string,
        payload?: unknown,
        options: FetchioConfig = {},
    ): RequestBuilder => {
        let finalUrl = basePath + url;
        let queryParams: Record<string, string> = {};
        let requestConfig: FetchioConfig = { ...config, ...options, method };

        if (payload) {
            if (payload instanceof FormData) {
                requestConfig.headers = {
                    "Content-Type": "application/x-www-form-urlencoded",
                    ...requestConfig.headers,
                };
                const formParams = new URLSearchParams();
                for (const [key, value] of payload.entries()) {
                    formParams.append(key, value);
                }
                requestConfig.body = formParams.toString();
            } else if (typeof payload === "object") {
                requestConfig.headers = {
                    ...requestConfig.headers,
                    ...payload,
                };
                requestConfig.body = JSON.stringify(payload);
            } else if (typeof payload === "string") {
                requestConfig.headers = {
                    "Content-Type": "text/plain",
                    ...requestConfig.headers,
                };
                requestConfig.body = payload;
            }
        }

        const processResponse = async <T>(
            response: Response,
            type: "json" | "text" | "arrayBuffer" | "void" | "blob",
        ): Promise<FetchResult<T>> => {
            if (
                requestConfig.responseInterceptor &&
                typeof requestConfig.responseInterceptor === "function"
            ) {
                const middlewareResult =
                    await requestConfig.responseInterceptor(response);
                return middlewareResult as FetchResult<T>;
            }

            const isSuccess = response.ok;
            let data: T | null = null;

            if (type === "json") {
                data = (await response.json()) as T;
            } else if (type === "text") {
                data = (await response.text()) as unknown as T;
            } else if (type === "arrayBuffer") {
                data = (await response.arrayBuffer()) as unknown as T;
            } else if (type === "blob") {
                data = (await response.blob()) as unknown as T;
            }

            return { success: isSuccess, data };
        };

        const buildUrl = (): string => {
            if (Object.keys(queryParams).length > 0) {
                let urlWithParams = finalUrl + "?";
                Object.entries(queryParams).forEach(([key, value]) => {
                    urlWithParams += `${key}=${value}&`;
                });
                return urlWithParams.slice(0, -1);
            }

            return finalUrl;
        };

        const executeRequest = async (): Promise<Response> => {
            let requestUrl = buildUrl();
            let requestOptions = requestConfig;

            if (
                requestOptions.requestInterceptor &&
                typeof requestOptions.requestInterceptor === "function"
            ) {
                const intercepted = await requestOptions.requestInterceptor(
                    requestUrl,
                    requestOptions,
                );
                requestUrl = intercepted.url;
                requestOptions = intercepted.options;
            }

            return fetch(requestUrl, requestOptions);
        };

        const builder: RequestBuilder = {
            param: (key: string, value: string) => {
                queryParams[key] = value;
                return builder;
            },

            params: (params: Record<string, string>) => {
                queryParams = { ...queryParams, ...params };
                return builder;
            },

            header: (key: string, value: string) => {
                requestConfig.headers = {
                    ...requestConfig.headers,
                    [key]: value,
                };
                return builder;
            },

            headers: (headers: Record<string, string>) => {
                requestConfig.headers = {
                    ...requestConfig.headers,
                    ...headers,
                };
                return builder;
            },

            path: (segment: string) => {
                finalUrl = finalUrl + segment;
                return builder;
            },

            json: async <T>() => {
                const response = await executeRequest();
                return processResponse<T>(response, "json");
            },

            string: async () => {
                const response = await executeRequest();
                return processResponse<string>(response, "text");
            },

            bytes: async () => {
                const response = await executeRequest();
                return processResponse<ArrayBuffer>(response, "arrayBuffer");
            },

            void: async () => {
                const response = await executeRequest();
                return processResponse<void>(response, "void");
            },

            blob: async () => {
                const response = await executeRequest();
                return processResponse<Blob>(response, "blob");
            },
        };

        return builder;
    };

    const fetchio: Fetchio = {
        path: (append: string): Fetchio => {
            const newPath = basePath.concat(append);
            return createFetchio(newPath, {
                ...config,
            });
        },

        get: (url: string = "", options?: FetchioConfig): RequestBuilder => {
            return createRequest(
                url,
                "GET",
                undefined,
                options as FetchioConfig,
            );
        },

        post: <T>(
            url: string = "",
            data?: T,
            options?: FetchioConfig,
        ): RequestBuilder => {
            return createRequest(url, "POST", data, options);
        },

        put: <T>(
            url: string = "",
            data?: T,
            options?: FetchioConfig,
        ): RequestBuilder => {
            return createRequest(url, "PUT", data, options);
        },

        patch: <T>(
            url: string = "",
            data?: T,
            options?: FetchioConfig,
        ): RequestBuilder => {
            return createRequest(url, "PATCH", data, options);
        },

        del: (url: string = "", options?: FetchioConfig): RequestBuilder => {
            return createRequest(
                url,
                "DELETE",
                undefined,
                options as FetchioConfig,
            );
        },

        sub: (subPath: string, pathConfig: FetchioConfig = {}) =>
            createFetchio(basePath.concat(subPath), {
                ...config,
                ...pathConfig,
            }),
    };

    return fetchio;
};
