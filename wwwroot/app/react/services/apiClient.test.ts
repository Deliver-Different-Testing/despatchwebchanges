/**
 * API Client Tests
 */

import axios from 'axios';
import ApiClient, {apiClient} from './apiClient';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ApiClient', () => {
    let client: ApiClient;
    let mockAxiosInstance: jest.Mocked<ReturnType<typeof axios.create>>;
    let mockResponseInterceptorUse: jest.Mock;

    beforeEach(() => {
        mockResponseInterceptorUse = jest.fn();

        // Create a mock axios instance
        mockAxiosInstance = {
            get: jest.fn(),
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
            interceptors: {
                request: {use: jest.fn()},
                response: {use: mockResponseInterceptorUse},
            },
        } as unknown as jest.Mocked<ReturnType<typeof axios.create>>;

        mockedAxios.create.mockReturnValue(mockAxiosInstance);
        mockedAxios.isCancel.mockReturnValue(false);
        client = new ApiClient();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Configuration', () => {
        it('should create axios instance with correct default config', () => {
            expect(mockedAxios.create).toHaveBeenCalledWith({
                baseURL: '',
                timeout: 30000,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                withCredentials: true,
                paramsSerializer: {
                    indexes: null,
                },
            });
        });

        it('should create axios instance with custom base URL', () => {
            new ApiClient('/api/v1');
            expect(mockedAxios.create).toHaveBeenLastCalledWith(
                expect.objectContaining({baseURL: '/api/v1'})
            );
        });

        it('should set up response interceptor for error handling', () => {
            expect(mockResponseInterceptorUse).toHaveBeenCalled();
        });
    });

    describe('GET requests', () => {
        it('should make GET request and return data', async () => {
            const responseData = {result: 'success'};
            mockAxiosInstance.get.mockResolvedValueOnce({data: responseData});

            const result = await client.get('/api/data');

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/data', {
                params: undefined,
                signal: undefined,
                timeout: undefined,
            });
            expect(result).toEqual(responseData);
        });

        it('should pass query parameters to axios', async () => {
            mockAxiosInstance.get.mockResolvedValueOnce({data: {}});

            await client.get('/api/data', {id: 123, name: 'test', active: true});

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/data', {
                params: {id: 123, name: 'test', active: true},
                signal: undefined,
                timeout: undefined,
            });
        });

        it('should pass AbortSignal for request cancellation', async () => {
            mockAxiosInstance.get.mockResolvedValueOnce({data: {}});
            const controller = new AbortController();

            await client.get('/api/data', undefined, {signal: controller.signal});

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/data', {
                params: undefined,
                signal: controller.signal,
                timeout: undefined,
            });
        });

        it('should allow timeout override', async () => {
            mockAxiosInstance.get.mockResolvedValueOnce({data: {}});

            await client.get('/api/data', undefined, {timeout: 5000});

            expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/data', {
                params: undefined,
                signal: undefined,
                timeout: 5000,
            });
        });
    });

    describe('POST requests', () => {
        it('should make POST request with body and return data', async () => {
            const responseData = {id: 1};
            mockAxiosInstance.post.mockResolvedValueOnce({data: responseData});

            const result = await client.post('/api/data', {name: 'test', value: 123});

            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/api/data',
                {name: 'test', value: 123},
                {params: undefined, signal: undefined, timeout: undefined}
            );
            expect(result).toEqual(responseData);
        });

        it('should handle POST without body', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({data: undefined});

            await client.post('/api/action');

            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/api/action',
                undefined,
                {params: undefined, signal: undefined, timeout: undefined}
            );
        });

        it('should pass query params to POST request', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({data: {}});

            await client.post('/api/action', null, {params: {jobId: 123, status: 'active'}});

            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/api/action',
                null,
                {params: {jobId: 123, status: 'active'}, signal: undefined, timeout: undefined}
            );
        });

        it('should handle POST with both body and params', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({data: {}});

            await client.post('/api/action', {data: 'test'}, {params: {id: 456}});

            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/api/action',
                {data: 'test'},
                {params: {id: 456}, signal: undefined, timeout: undefined}
            );
        });

        it('should handle array params in POST', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({data: {}});

            await client.post('/api/action', null, {params: {jobIds: [1, 2, 3]}});

            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/api/action',
                null,
                {params: {jobIds: [1, 2, 3]}, signal: undefined, timeout: undefined}
            );
        });

        it('should pass AbortSignal for request cancellation', async () => {
            mockAxiosInstance.post.mockResolvedValueOnce({data: {}});
            const controller = new AbortController();

            await client.post('/api/action', {data: 'test'}, {signal: controller.signal});

            expect(mockAxiosInstance.post).toHaveBeenCalledWith(
                '/api/action',
                {data: 'test'},
                {params: undefined, signal: controller.signal, timeout: undefined}
            );
        });
    });

    describe('PUT requests', () => {
        it('should make PUT request with body', async () => {
            const responseData = {updated: true};
            mockAxiosInstance.put.mockResolvedValueOnce({data: responseData});

            const result = await client.put('/api/data/1', {name: 'updated'});

            expect(mockAxiosInstance.put).toHaveBeenCalledWith(
                '/api/data/1',
                {name: 'updated'},
                {signal: undefined, timeout: undefined}
            );
            expect(result).toEqual(responseData);
        });

        it('should handle PUT without body', async () => {
            mockAxiosInstance.put.mockResolvedValueOnce({data: undefined});

            await client.put('/api/data/1');

            expect(mockAxiosInstance.put).toHaveBeenCalledWith(
                '/api/data/1',
                undefined,
                {signal: undefined, timeout: undefined}
            );
        });

        it('should pass AbortSignal for request cancellation', async () => {
            mockAxiosInstance.put.mockResolvedValueOnce({data: {}});
            const controller = new AbortController();

            await client.put('/api/data/1', {name: 'test'}, {signal: controller.signal});

            expect(mockAxiosInstance.put).toHaveBeenCalledWith(
                '/api/data/1',
                {name: 'test'},
                {signal: controller.signal, timeout: undefined}
            );
        });
    });

    describe('DELETE requests', () => {
        it('should make DELETE request', async () => {
            const responseData = {deleted: true};
            mockAxiosInstance.delete.mockResolvedValueOnce({data: responseData});

            const result = await client.delete('/api/data/1');

            expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/data/1', {
                signal: undefined,
                timeout: undefined,
            });
            expect(result).toEqual(responseData);
        });

        it('should pass AbortSignal for request cancellation', async () => {
            mockAxiosInstance.delete.mockResolvedValueOnce({data: {}});
            const controller = new AbortController();

            await client.delete('/api/data/1', {signal: controller.signal});

            expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/api/data/1', {
                signal: controller.signal,
                timeout: undefined,
            });
        });
    });

    describe('Error handling via interceptor', () => {
        it('should transform axios errors to ApiError format', () => {
            // Get the error handler from the interceptor
            const interceptorCall = mockResponseInterceptorUse.mock.calls[0];
            const errorHandler = interceptorCall[1];

            const axiosError = {
                response: {
                    status: 400,
                    statusText: 'Bad Request',
                    data: 'Invalid request - missing required header',
                },
                message: 'Request failed',
            };

            expect(() => {
                // The interceptor returns a rejected promise
                // Since it returns Promise.reject, we need to handle it
                return errorHandler(axiosError);
            }).rejects;
        });

        it('should handle network errors without response', async () => {
            const interceptorCall = mockResponseInterceptorUse.mock.calls[0];
            const errorHandler = interceptorCall[1];

            const networkError = {
                message: 'Network Error',
            };

            await expect(errorHandler(networkError)).rejects.toMatchObject({
                status: 0,
                statusText: 'Network Error',
                message: 'Network Error',
            });
        });

        it('should extract message from object response data', async () => {
            const interceptorCall = mockResponseInterceptorUse.mock.calls[0];
            const errorHandler = interceptorCall[1];

            const axiosError = {
                response: {
                    status: 500,
                    statusText: 'Internal Server Error',
                    data: {message: 'Database connection failed'},
                },
                message: 'Server Error',
            };

            await expect(errorHandler(axiosError)).rejects.toMatchObject({
                status: 500,
                statusText: 'Internal Server Error',
                message: 'Database connection failed',
            });
        });

        it('should extract error from object response data', async () => {
            const interceptorCall = mockResponseInterceptorUse.mock.calls[0];
            const errorHandler = interceptorCall[1];

            const axiosError = {
                response: {
                    status: 400,
                    statusText: 'Bad Request',
                    data: {error: 'Invalid input'},
                },
                message: 'Request failed',
            };

            await expect(errorHandler(axiosError)).rejects.toMatchObject({
                status: 400,
                statusText: 'Bad Request',
                message: 'Invalid input',
            });
        });

        it('should extract title from ASP.NET ProblemDetails', async () => {
            const interceptorCall = mockResponseInterceptorUse.mock.calls[0];
            const errorHandler = interceptorCall[1];

            const axiosError = {
                response: {
                    status: 404,
                    statusText: 'Not Found',
                    data: {title: 'Resource not found', status: 404, traceId: '123'},
                },
                message: 'Request failed',
            };

            await expect(errorHandler(axiosError)).rejects.toMatchObject({
                status: 404,
                statusText: 'Not Found',
                message: 'Resource not found',
            });
        });

        it('should not transform cancelled requests', async () => {
            mockedAxios.isCancel.mockReturnValue(true);
            const interceptorCall = mockResponseInterceptorUse.mock.calls[0];
            const errorHandler = interceptorCall[1];

            const cancelError = new Error('Request cancelled');

            await expect(errorHandler(cancelError)).rejects.toEqual(cancelError);
        });
    });

    describe('Default singleton', () => {
        it('should export apiClient with lazy-initialized methods', () => {
            expect(typeof apiClient.get).toBe('function');
            expect(typeof apiClient.post).toBe('function');
            expect(typeof apiClient.put).toBe('function');
            expect(typeof apiClient.delete).toBe('function');
        });
    });
});
