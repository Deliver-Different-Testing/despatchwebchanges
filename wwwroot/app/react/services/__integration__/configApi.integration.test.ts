/** @jest-environment jest-fixed-jsdom */
/**
 * Config API Integration Tests
 *
 * Tests the configApi service using MSW to intercept real HTTP requests.
 * Uses the existing handler from addressHandlers (config/GetHereMapsKey).
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import { configApi } from '../configApi';

describe('configApi integration', () => {
    describe('getHereMapsKey', () => {
        it('fetches HERE Maps API key from config', async () => {
            const result = await configApi.getHereMapsKey();

            expect(result).toBe('test-api-key-12345');
        });

        it('handles config service errors', async () => {
            server.use(
                http.get('*/config/GetHereMapsKey', () => {
                    return new HttpResponse('Config service unavailable', { status: 500 });
                })
            );

            await expect(configApi.getHereMapsKey()).rejects.toMatchObject({
                status: 500,
            });
        });

        it('handles missing API key configuration', async () => {
            server.use(
                http.get('*/config/GetHereMapsKey', () => {
                    return HttpResponse.json(
                        { message: 'HERE Maps API key not configured' },
                        { status: 404 }
                    );
                })
            );

            await expect(configApi.getHereMapsKey()).rejects.toMatchObject({
                status: 404,
            });
        });
    });
});
