import { expect, describe, it, beforeAll, afterAll, mock } from "bun:test";
import {
    createFetchio,
    type FetchResult,
    type FetchioConfig,
} from "./src/index";

interface ApiResponse<T = any> {
    message: string;
    data?: T;
}

let server: Bun.Server;

beforeAll(() => {
    // Start the test server
    server = Bun.serve({
        port: 3000,
        routes: {
            // Primary routes
            "/hello": {
                GET: () => Response.json({ message: "Hello GET" }),
                POST: async (req) => {
                    const body = await req.json().catch(() => ({}));
                    return Response.json({ message: "Hello POST", data: body });
                },
                PUT: async (req) => {
                    const body = await req.json().catch(() => ({}));
                    return Response.json({ message: "Hello PUT", data: body });
                },
                DELETE: () =>
                    new Response("", {
                        status: 200,
                    }),
                PATCH: async (req) => {
                    const body = await req.json().catch(() => ({}));
                    return Response.json({
                        message: "Hello PATCH",
                        data: body,
                    });
                },
            },

            // Nested routes
            "/hello/world": {
                GET: () => Response.json({ message: "Hello World GET" }),
                POST: async (req) => {
                    const body = await req.json().catch(() => ({}));
                    return Response.json({
                        message: "Hello World POST",
                        data: body,
                    });
                },
                PUT: async (req) => {
                    const body = await req.json().catch(() => ({}));
                    return Response.json({
                        message: "Hello World PUT",
                        data: body,
                    });
                },
                DELETE: () => new Response("", { status: 204 }),
                PATCH: async (req) => {
                    const body = await req.json().catch(() => ({}));
                    return Response.json({
                        message: "Hello World PATCH",
                        data: body,
                    });
                },
            },

            // Query param test route
            "/query": {
                GET: (req) => {
                    const url = new URL(req.url);
                    const params = Object.fromEntries(
                        url.searchParams.entries(),
                    );
                    return Response.json({ params });
                },
            },

            // Headers test route
            "/headers": {
                GET: (req) => {
                    const headers: Record<string, string> = {};
                    req.headers.forEach((value, key) => {
                        headers[key] = value;
                    });
                    return Response.json({ headers });
                },
            },

            // Different response formats route
            "/formats": {
                GET: (req) => {
                    const url = new URL(req.url);
                    const format = url.searchParams.get("format") || "json";

                    if (format === "text") {
                        return new Response("Plain text response", {
                            headers: { "Content-Type": "text/plain" },
                        });
                    } else if (format === "blob") {
                        return new Response(
                            new Blob(["Blob data"], {
                                type: "application/octet-stream",
                            }),
                            {
                                headers: {
                                    "Content-Type": "application/octet-stream",
                                },
                            },
                        );
                    } else if (format === "arrayBuffer") {
                        const bufferData = new TextEncoder().encode(
                            "Binary data",
                        );
                        return new Response(bufferData, {
                            headers: {
                                "Content-Type": "application/octet-stream",
                            },
                        });
                    } else {
                        return Response.json({ format: "json data" });
                    }
                },
            },

            // Form data test route
            "/form": {
                POST: async (req) => {
                    try {
                        let data: Record<string, string> = {};

                        const contentType = req.headers.get("content-type");
                        if (
                            contentType &&
                            contentType.includes(
                                "application/x-www-form-urlencoded",
                            )
                        ) {
                            const formText = await req.text();
                            const params = new URLSearchParams(formText);
                            
                            // Convert params to a plain object
                            for (const pair of params.entries()) {
                                data[pair[0]] = pair[1];
                            }
                        }

                        return Response.json({ success: true, data });
                    } catch (e) {
                        return Response.json(
                            { success: false, error: String(e) },
                            { status: 400 },
                        );
                    }
                },
            },

            // String payload test route
            "/string-payload": {
                POST: async (req) => {
                    const text = await req.text();
                    return Response.json({ received: text });
                },
            },

            // Error simulation routes
            "/error/bad-request": new Response("Bad Request", { status: 400 }),
            "/error/unauthorized": new Response("Unauthorized", {
                status: 401,
            }),
            "/error/forbidden": new Response("Forbidden", { status: 403 }),
            "/error/not-found": new Response("Not Found", { status: 404 }),
            "/error/server-error": new Response("Internal Server Error", {
                status: 500,
            }),
        },

        // Fallback handler
        fetch(req) {
            return new Response("Not Found", { status: 404 });
        },
    });
});

afterAll(() => {
    server.stop();
});

describe("Fetchio API", () => {
    const baseUrl = "http://localhost:3000";

    describe("HTTP methods", () => {
        it("should perform GET request", async () => {
            const api = createFetchio(baseUrl);

            const result = await api.get("/hello").json<ApiResponse>();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.message).toBe("Hello GET");
        });

        it("should perform POST request with data", async () => {
            const api = createFetchio(baseUrl);

            const testData = { name: "Test", value: 123 };
            const result = await api
                .post("/hello", testData)
                .json<ApiResponse<typeof testData>>();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.message).toBe("Hello POST");
            expect(result.data?.data).toEqual(testData);
        });

        it("should perform PUT request with data", async () => {
            const api = createFetchio(baseUrl);

            const testData = { id: 1, name: "Updated" };
            const result = await api
                .put("/hello", testData)
                .json<ApiResponse<typeof testData>>();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.message).toBe("Hello PUT");
            expect(result.data?.data).toEqual(testData);
        });

        it("should perform PATCH request with data", async () => {
            const api = createFetchio(baseUrl);

            const testData = { id: 1, field: "patched" };
            const result = await api
                .patch("/hello", testData)
                .json<ApiResponse<typeof testData>>();

            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.message).toBe("Hello PATCH");
            expect(result.data?.data).toEqual(testData);
        });

        it("should perform DELETE request", async () => {
            const api = createFetchio(baseUrl);

            const result = await api.del("/hello").void();

            expect(result.success).toBe(true);
            expect(result.data).toBe(null);
        });
    });

    describe("Path chaining", () => {
        it("should use correct paths when chaining", async () => {
            const api = createFetchio(baseUrl);

            const helloApi = api.path("/hello");
            const worldApi = helloApi.path("/world");

            const result = await worldApi.get().json<ApiResponse>();

            expect(result.success).toBe(true);
            expect(result.data?.message).toBe("Hello World GET");
        });

        it("should handle nested paths with data", async () => {
            const api = createFetchio(baseUrl);

            const helloWorldApi = api.path("/hello").path("/world");
            const testData = { action: "test" };

            const result = await helloWorldApi
                .post("", testData)
                .json<ApiResponse<typeof testData>>();

            expect(result.success).toBe(true);
            expect(result.data?.message).toBe("Hello World POST");
            expect(result.data?.data).toEqual(testData);
        });

        it("should handle path chaining in request builder", async () => {
            const api = createFetchio(baseUrl);

            const result = await api
                .get("/hello")
                .path("/world")
                .json<ApiResponse>();

            expect(result.success).toBe(true);
            expect(result.data?.message).toBe("Hello World GET");
        });
    });

    describe("Sub-path creation", () => {
        it("should create a sub-path instance with merged config", async () => {
            const api = createFetchio(baseUrl);

            const headers = { "X-Custom": "custom-value" };
            const helloApi = api.sub("/hello", { headers });

            const result = await helloApi.get().json<ApiResponse>();

            expect(result.success).toBe(true);
            expect(result.data?.message).toBe("Hello GET");
        });
    });

    describe("Query parameters", () => {
        it("should add a single query parameter", async () => {
            const api = createFetchio(baseUrl);

            const result = await api
                .get("/query")
                .param("key", "value")
                .json<{ params: Record<string, string> }>();

            expect(result.success).toBe(true);
            expect(result.data?.params).toEqual({ key: "value" });
        });

        it("should add multiple query parameters", async () => {
            const api = createFetchio(baseUrl);
            const params = { param1: "value1", param2: "value2" };

            const result = await api
                .get("/query")
                .params(params)
                .json<{ params: Record<string, string> }>();

            expect(result.success).toBe(true);
            expect(result.data?.params).toEqual(params);
        });
    });

    describe("Headers", () => {
        it("should add a single header", async () => {
            const api = createFetchio(baseUrl);

            const result = await api
                .get("/headers")
                .header("X-Custom-Header", "custom-value")
                .json<{ headers: Record<string, string> }>();

            expect(result.success).toBe(true);
            expect(result.data?.headers["x-custom-header"]).toBe(
                "custom-value",
            );
        });

        it("should add multiple headers", async () => {
            const api = createFetchio(baseUrl);
            const customHeaders = {
                "X-Custom-1": "value1",
                "X-Custom-2": "value2",
            };

            const result = await api
                .get("/headers")
                .headers(customHeaders)
                .json<{ headers: Record<string, string> }>();

            expect(result.success).toBe(true);
            expect(result.data?.headers["x-custom-1"]).toBe("value1");
            expect(result.data?.headers["x-custom-2"]).toBe("value2");
        });
    });

    describe("Response formats", () => {
        it("should handle JSON response", async () => {
            const api = createFetchio(baseUrl);

            const result = await api
                .get("/formats")
                .param("format", "json")
                .json<{ format: string }>();

            expect(result.success).toBe(true);
            expect(result.data?.format).toBe("json data");
        });

        it("should handle text response", async () => {
            const api = createFetchio(baseUrl);

            const result = await api
                .get("/formats")
                .param("format", "text")
                .string();

            expect(result.success).toBe(true);
            expect(result.data).toBe("Plain text response");
        });

        it("should handle binary response", async () => {
            const api = createFetchio(baseUrl);

            const result = await api
                .get("/formats")
                .param("format", "arrayBuffer")
                .bytes();

            expect(result.success).toBe(true);
            expect(result.data).toBeInstanceOf(ArrayBuffer);
            const text = new TextDecoder().decode(
                new Uint8Array(result.data as ArrayBuffer),
            );
            expect(text).toBe("Binary data");
        });

        it("should handle blob response", async () => {
            const api = createFetchio(baseUrl);

            const result = await api
                .get("/formats")
                .param("format", "blob")
                .blob();

            expect(result.success).toBe(true);
            expect(result.data).toBeInstanceOf(Blob);
            const text = await (result.data as Blob).text();
            expect(text).toBe("Blob data");
        });

        it("should handle void response", async () => {
            const api = createFetchio(baseUrl);

            const result = await api.del("/hello").void();

            expect(result.success).toBe(true);
            expect(result.data).toBe(null);
        });
    });

    describe("Payload types", () => {
        it("should handle string payload", async () => {
            const api = createFetchio(baseUrl);
            const testString = "This is a string payload";

            const result = await api
                .post("/string-payload", testString)
                .json<{ received: string }>();

            expect(result.success).toBe(true);
            expect(result.data?.received).toBe(testString);
        });

        it("should handle FormData payload", async () => {
            const api = createFetchio(baseUrl);
            // Create actual FormData instance to test FormData handling
            const formData = new FormData();
            formData.append("field1", "value1");
            formData.append("field2", "value2");

            const result = await api
                .post("/form", formData)
                .json<{ success: boolean; data: Record<string, string> }>();

            expect(result.success).toBe(true);
            expect(result.data?.success).toBe(true);
            expect(result.data?.data).toEqual({
                field1: "value1",
                field2: "value2",
            });
        });
    });

    describe("Error handling", () => {
        it("should handle 4xx errors", async () => {
            const api = createFetchio(baseUrl);

            const result = await api.get("/error/bad-request").string();
            expect(result.success).toBe(false);
            expect(result.data).toBe("Bad Request");
        });

        it("should handle 5xx errors", async () => {
            const api = createFetchio(baseUrl);

            const result = await api.get("/error/server-error").string();

            expect(result.success).toBe(false);
            expect(result.data).toBe("Internal Server Error");
        });
    });

    describe("Interceptors", () => {
        it("should use request interceptors", async () => {
            const requestInterceptor = mock((url, options) => {
                return Promise.resolve({
                    url: url,
                    options: {
                        ...options,
                        headers: { ...options.headers, "X-Test": "test-value" },
                    },
                });
            });

            const api = createFetchio(baseUrl, { requestInterceptor });
            await api.get("/hello").json();

            expect(requestInterceptor).toHaveBeenCalled();
            expect(requestInterceptor.mock.calls[0][0]).toBe(
                "http://localhost:3000/hello",
            );
        });

        it("should use response interceptors", async () => {
            const responseInterceptor = mock((response) => {
                return Promise.resolve({
                    success: response.status === 200,
                    data: { intercepted: true },
                });
            });

            const api = createFetchio("/", {
                requestInterceptor: async (url, options) => {
                    return { url: `${baseUrl}${url}`, options };
                },
                responseInterceptor,
            });

            const result = await api.get("/hello").json();

            expect(responseInterceptor).toHaveBeenCalled();
            expect(result.data).toEqual({ intercepted: true });
        });
    });
});
