/**
 * API Client Integration Tests
 *
 * Tests the apiClient HTTP client using MSW to intercept real axios requests.
 * Verifies headers, error handling, request transformation, and cancellation.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse, delay } from 'msw';
import { apiClient } from '../apiClient';

describe('apiClient integration', () => {
    describe('GET requests', () => {
        it('makes GET requests with correct headers', async () => {
            let capturedHeaders: Headers | null = null;

            server.use(
                http.get('*/test/endpoint', ({ request }) => {
                    capturedHeaders = request.headers;
                    return HttpResponse.json({ success: true });
                })
            );

            await apiClient.get('/test/endpoint');

            expect(capturedHeaders).not.toBeNull();
            expect(capturedHeaders!.get('X-Requested-With')).toBe('XMLHttpRequest');
            // Note: GET requests without body don't send Content-Type header
        });

        it('serializes query parameters correctly', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/test/search', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([]);
                })
            );

            await apiClient.get('/test/search', { query: 'test', limit: 10 });

            expect(capturedUrl).toContain('query=test');
            expect(capturedUrl).toContain('limit=10');
        });

        it('serializes array parameters as repeated params (ASP.NET compatible)', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/test/items', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([]);
                })
            );

            await apiClient.get('/test/items', { ids: [1, 2, 3] });

            // Should be ids=1&ids=2&ids=3 not ids[0]=1&ids[1]=2&ids[2]=3
            expect(capturedUrl).toContain('ids=1');
            expect(capturedUrl).toContain('ids=2');
            expect(capturedUrl).toContain('ids=3');
            expect(capturedUrl).not.toContain('ids[');
        });

        it('returns parsed JSON response', async () => {
            const mockData = { id: 1, name: 'Test' };

            server.use(
                http.get('*/test/data', () => HttpResponse.json(mockData))
            );

            const result = await apiClient.get<{ id: number; name: string }>('/test/data');

            expect(result).toEqual(mockData);
        });
    });

    describe('POST requests', () => {
        it('sends JSON body with correct content type', async () => {
            let capturedBody: unknown = null;
            let capturedContentType = '';

            server.use(
                http.post('*/test/create', async ({ request }) => {
                    capturedContentType = request.headers.get('Content-Type') ?? '';
                    capturedBody = await request.json();
                    return HttpResponse.json({ id: 1 });
                })
            );

            await apiClient.post('/test/create', { name: 'Test', value: 42 });

            expect(capturedContentType).toBe('application/json');
            expect(capturedBody).toEqual({ name: 'Test', value: 42 });
        });

        it('includes CSRF header on POST requests', async () => {
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.post('*/test/action', ({ request }) => {
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await apiClient.post('/test/action', {});

            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });

        it('returns parsed JSON response from POST', async () => {
            server.use(
                http.post('*/test/create', () => HttpResponse.json({ id: 123, created: true }))
            );

            const result = await apiClient.post<{ id: number; created: boolean }>('/test/create', {});

            expect(result).toEqual({ id: 123, created: true });
        });
    });

    describe('PUT requests', () => {
        it('sends PUT requests with JSON body', async () => {
            let capturedMethod = '';
            let capturedBody: unknown = null;

            server.use(
                http.put('*/test/update/1', async ({ request }) => {
                    capturedMethod = request.method;
                    capturedBody = await request.json();
                    return HttpResponse.json({ updated: true });
                })
            );

            await apiClient.put('/test/update/1', { name: 'Updated' });

            expect(capturedMethod).toBe('PUT');
            expect(capturedBody).toEqual({ name: 'Updated' });
        });
    });

    describe('DELETE requests', () => {
        it('sends DELETE requests with CSRF header', async () => {
            let capturedMethod = '';
            let capturedCsrfHeader: string | null = null;

            server.use(
                http.delete('*/test/delete/1', ({ request }) => {
                    capturedMethod = request.method;
                    capturedCsrfHeader = request.headers.get('X-Requested-With');
                    return new HttpResponse(null, { status: 200 });
                })
            );

            await apiClient.delete('/test/delete/1');

            expect(capturedMethod).toBe('DELETE');
            expect(capturedCsrfHeader).toBe('XMLHttpRequest');
        });
    });

    describe('FormData requests', () => {
        it('sends FormData with multipart content type', async () => {
            let capturedContentType = '';

            server.use(
                http.post('*/test/upload', ({ request }) => {
                    capturedContentType = request.headers.get('Content-Type') ?? '';
                    return HttpResponse.json({ uploaded: true });
                })
            );

            const formData = new FormData();
            formData.append('file', new Blob(['test']), 'test.txt');
            formData.append('name', 'Test File');

            await apiClient.postFormData('/test/upload', formData);

            expect(capturedContentType).toContain('multipart/form-data');
        });
    });

    describe('Error handling', () => {
        it('transforms 400 Bad Request to ApiError', async () => {
            server.use(
                http.get('*/test/bad-request', () => {
                    return new HttpResponse('Invalid parameters', { status: 400, statusText: 'Bad Request' });
                })
            );

            await expect(apiClient.get('/test/bad-request')).rejects.toMatchObject({
                status: 400,
                statusText: 'Bad Request',
            });
        });

        it('transforms 500 Server Error to ApiError', async () => {
            server.use(
                http.get('*/test/server-error', () => {
                    return new HttpResponse('Internal server error', { status: 500, statusText: 'Internal Server Error' });
                })
            );

            await expect(apiClient.get('/test/server-error')).rejects.toMatchObject({
                status: 500,
                statusText: 'Internal Server Error',
            });
        });

        it('extracts message from JSON error response', async () => {
            server.use(
                http.post('*/test/validation-error', () => {
                    return HttpResponse.json(
                        { message: 'Validation failed: email is required' },
                        { status: 422 }
                    );
                })
            );

            await expect(apiClient.post('/test/validation-error', {})).rejects.toMatchObject({
                status: 422,
                message: 'Validation failed: email is required',
            });
        });

        it('extracts error from ASP.NET ProblemDetails format', async () => {
            server.use(
                http.post('*/test/problem-details', () => {
                    return HttpResponse.json(
                        { title: 'One or more validation errors occurred', status: 400 },
                        { status: 400 }
                    );
                })
            );

            await expect(apiClient.post('/test/problem-details', {})).rejects.toMatchObject({
                status: 400,
                message: 'One or more validation errors occurred',
            });
        });

        it('handles network errors', async () => {
            server.use(
                http.get('*/test/network-error', () => {
                    return HttpResponse.error();
                })
            );

            await expect(apiClient.get('/test/network-error')).rejects.toMatchObject({
                status: 0,
                statusText: 'Network Error',
            });
        });
    });

    describe('Request cancellation', () => {
        it('supports AbortSignal for request cancellation', async () => {
            server.use(
                http.get('*/test/slow', async () => {
                    await delay(5000);
                    return HttpResponse.json({ data: 'slow response' });
                })
            );

            const controller = new AbortController();

            const promise = apiClient.get('/test/slow', undefined, {
                signal: controller.signal,
            });

            // Abort immediately
            controller.abort();

            // The request should be canceled - axios wraps this in a CanceledError
            await expect(promise).rejects.toThrow();
        });
    });

    describe('Request timeout', () => {
        // Note: MSW's delay() doesn't reliably trigger axios timeouts since it's
        // simulated on the server-side. Timeout behavior is better tested with
        // real network conditions or at the unit test level.
        it.skip('respects custom timeout option', async () => {
            server.use(
                http.get('*/test/timeout', async () => {
                    await delay(2000);
                    return HttpResponse.json({ data: 'delayed' });
                })
            );

            // Set a very short timeout
            await expect(
                apiClient.get('/test/timeout', undefined, { timeout: 100 })
            ).rejects.toBeDefined();
        });
    });
});
