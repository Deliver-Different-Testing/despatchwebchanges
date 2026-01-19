/**
 * API Client Tests
 */

import ApiClient, {apiClient} from './apiClient';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ApiClient', () => {
    let client: ApiClient;

    beforeEach(() => {
        client = new ApiClient();
        mockFetch.mockClear();
    });

    const createMockResponse = (options: {
        ok?: boolean;
        status?: number;
        statusText?: string;
        contentType?: string;
        body?: string;
    } = {}) => {
        const {
            ok = true,
            status = 200,
            statusText = 'OK',
            contentType = 'application/json',
            body = '',
        } = options;

        return Promise.resolve({
            ok,
            status,
            statusText,
            headers: new Headers({'content-type': contentType}),
            text: () => Promise.resolve(body),
        } as Response);
    };

    describe('Security Headers', () => {
        it.each([
            ['GET', () => client.get('/test')],
            ['POST', () => client.post('/test', {data: 'test'})],
            ['PUT', () => client.put('/test', {data: 'test'})],
            ['DELETE', () => client.delete('/test')],
        ])('should include X-Requested-With header in %s requests', async (_, makeRequest) => {
            mockFetch.mockReturnValueOnce(createMockResponse({body: '{}'}));
            await makeRequest();
            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    headers: expect.objectContaining({'X-Requested-With': 'XMLHttpRequest'}),
                })
            );
        });

        it('should include Content-Type header in requests with body', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse());
            await client.post('/test', {data: 'test'});
            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({
                    headers: expect.objectContaining({'Content-Type': 'application/json'}),
                })
            );
        });

        it('should use same-origin credentials', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse());
            await client.get('/test');
            expect(mockFetch).toHaveBeenCalledWith(
                '/test',
                expect.objectContaining({credentials: 'same-origin'})
            );
        });
    });

    describe('GET requests', () => {
        it('should make GET request with correct method', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse({body: '{"result": "success"}'}));

            const result = await client.get('/api/data');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/data',
                expect.objectContaining({method: 'GET'})
            );
            expect(result).toEqual({result: 'success'});
        });

        it('should append query parameters to URL', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse({body: '{}'}));

            await client.get('/api/data', {id: 123, name: 'test', active: true});

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/data?id=123&name=test&active=true',
                expect.any(Object)
            );
        });

        it('should skip null and undefined params', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse({body: '{}'}));

            await client.get('/api/data', {id: 123, name: undefined as any, value: null as any});

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/data?id=123',
                expect.any(Object)
            );
        });
    });

    describe('POST requests', () => {
        it('should make POST request with correct method and body', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse());

            await client.post('/api/data', {name: 'test', value: 123});

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/data',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({name: 'test', value: 123}),
                })
            );
        });

        it('should handle POST without body', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse());

            await client.post('/api/action');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/action',
                expect.objectContaining({
                    method: 'POST',
                    body: undefined,
                })
            );
        });
    });

    describe('Error handling', () => {
        it('should throw ApiError for non-ok responses', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse({
                ok: false,
                status: 400,
                statusText: 'Bad Request',
                body: 'Invalid request - missing required header',
            }));

            await expect(client.get('/api/data')).rejects.toMatchObject({
                status: 400,
                statusText: 'Bad Request',
                message: 'Invalid request - missing required header',
            });
        });

        it('should throw ApiError for 500 errors', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                body: 'Server error occurred',
            }));

            await expect(client.post('/api/data', {})).rejects.toMatchObject({
                status: 500,
                statusText: 'Internal Server Error',
            });
        });

        it('should handle error response text failure gracefully', async () => {
            mockFetch.mockReturnValueOnce(Promise.resolve({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                headers: new Headers({'content-type': 'application/json'}),
                text: () => Promise.reject(new Error('Failed to read body')),
            } as Response));

            await expect(client.get('/api/data')).rejects.toMatchObject({
                status: 500,
                message: 'Unknown error',
            });
        });
    });

    describe('Response handling', () => {
        it('should parse JSON responses', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse({body: '{"id": 1, "name": "test"}'}));

            const result = await client.get<{id: number; name: string}>('/api/data');

            expect(result).toEqual({id: 1, name: 'test'});
        });

        it('should handle empty responses', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse({body: ''}));

            const result = await client.post('/api/action');

            expect(result).toBeUndefined();
        });

        it('should handle non-JSON content type', async () => {
            mockFetch.mockReturnValueOnce(createMockResponse({contentType: 'text/plain', body: 'OK'}));

            const result = await client.post('/api/action');

            expect(result).toBeUndefined();
        });
    });

    describe('Base URL', () => {
        it('should prepend base URL to requests', async () => {
            const clientWithBase = new ApiClient('/api/v1');

            mockFetch.mockReturnValueOnce(createMockResponse({body: '{}'}));

            await clientWithBase.get('/users');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/v1/users',
                expect.any(Object)
            );
        });
    });

    describe('Default singleton', () => {
        it('should export a default apiClient instance', () => {
            expect(apiClient).toBeInstanceOf(ApiClient);
        });
    });
});
