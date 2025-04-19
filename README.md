# Fetchio

A fluent and composoble HTTP Client for TypeScript applications.

## Overview

Fetchio is a client that provides a fluent interface for making HTTP requests. Built on top of the native `fetch` API, with the API inspired by `Axios`.

## API Reference

### Creating an Instance

```typescript
const api = createFetchio(basePath?, config?);
```

- `basePath`: (Optional) Base URL for all requests. Defaults to `/`.
- `config`: (Optional) Configuration options for all requests.

### Main Methods

#### HTTP Methods

Each HTTP method provides granular options for configuring the request.

- `get(url?, options?)`: Perform a GET request
- `post(url, data?, options?)`: Perform a POST request with optional data
- `put(url, data?, options?)`: Perform a PUT request with optional data
- `patch(url, data?, options?)`: Perform a PATCH request with optional data
- `del(url?, options?)`: Perform a DELETE request

#### Path Management

- `sub(subPath, pathConfig?)`: Create a new Fetchio instance with an appended path and merged configuration

### Request Builder Methods

Methods for configuring requests before sending:

- `param(key, value)`: Add a single query parameter
- `params(paramsObject)`: Add multiple query parameters
- `header(key, value)`: Add a single header
- `headers(headersObject)`: Add multiple headers
- `path(segment)`: Append a path segment to the URL

### Response Processing Methods

Methods for processing the response in different formats:

- `json<T>()`: Process response as JSON and cast to type T
- `string()`: Process response as text
- `bytes()`: Process response as ArrayBuffer
- `blob()`: Process response as Blob
- `void()`: Process response and return void (ignore content)

### Configuration

The `FetchioConfig` interface extends the standard `RequestInit` interface with additional options:

```typescript
interface FetchioConfig extends RequestInit {
  requestInterceptor?: RequestInterceptor;
  responseInterceptor?: ResponseInterceptor;
  headers?: Record<string, string>;
  fs?: FileSystemAdapter;
}
```

### Interceptors

Interceptors allow you to modify requests before they are sent or process responses before they are returned:

#### Request Interceptor

```typescript
type RequestInterceptor = (
  url: string,
  options: FetchioConfig
) => Promise<{ url: string; options: FetchioConfig }>;
```

Example:

```typescript
const api = createFetchio('https://api.example.com', {
  requestInterceptor: async (url, options) => {
    // Add authentication token to all requests
    return {
      url,
      options: {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${getAuthToken()}`
        }
      }
    };
  }
});
```

#### Response Interceptor

```typescript
type ResponseInterceptor = (
  response: Response
) => Promise<FetchResult<unknown>>;
```

Example:

```typescript
const api = createFetchio('https://api.example.com', {
  responseInterceptor: async (response) => {
    if (response.status === 401) {
      // Handle unauthorized requests
      refreshToken();
      return { success: false, data: null };
    }

    const data = await response.json().catch(() => null);
    return { success: response.ok, data };
  }
});
```

## Usage Examples

### Chaining Multiple Operations

```typescript
const result = await api
  .get('/users')
  .param('role', 'admin')
  .header('X-Custom-Header', 'value')
  .json();
```

### Working with Sub-Paths

```typescript
// Create a base API instance
const api = createFetchio('https://api.example.com');

// Create a sub-instance for users endpoint
const usersApi = api.sub('/users', {
  headers: { 'X-API-Version': '2.0' }
});

// Or create a different path if you don't need to modify config.
const usersApi = api.path('/users');

// Get all users
const allUsers = await usersApi.get().json();

// Get a specific user
const user = await usersApi.get('/123').json();

// Create a new user
const newUser = await usersApi.post('/', { name: 'Alice' }).json();

// Update a new user
const updatedUser = await usersApi.put('/123', { name: 'Bob' }).void();

// Delete a user
const deletedUser = await usersApi.delete('/123').void();

### Using Different Response Formats

```typescript
// Get JSON response
const jsonData = await api.get('/data').json();

// Get plain text response
const textData = await api.get('/text-content').string();

// Download a file as an ArrayBuffer
const fileData = await api.get('/files/document.pdf').bytes();

// Process response as a Blob
const imageBlob = await api.get('/images/photo.jpg').blob();
```

### Error Handling

```typescript
const result = await api.get('/users/123').json();

if (!result.success) {
  // Handle error case
  console.error('Failed to fetch user:', result.data);
} else {
  // Handle success case
  const user = result.data;
  console.log('User details:', user);
}
```
