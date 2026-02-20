/**
 * Agent API Integration Tests
 *
 * Tests the agentApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { agentApi } from '../agentApi';
import { mockAgentInfo } from '../../__testUtils__/msw/handlers';

describe('agentApi integration', () => {
    describe('getAgentInfo', () => {
        it('fetches agent info with correct parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwideJob/GetAgentInfo', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockAgentInfo);
                })
            );

            const result = await agentApi.getAgentInfo(1);

            expect(capturedUrl).toContain('agentId=1');
            expect(result.agentName).toBe('Express Couriers NZ');
        });

        it('returns full agent details', async () => {
            const result = await agentApi.getAgentInfo(1);

            expect(result).toMatchObject({
                agentId: 1,
                agentRate: 45.5,
                agentRanking: 'Gold',
                agentPhone: '+64 21 555 1234',
                agentEmail: 'agent@expresscouriers.co.nz',
            });
        });

        it('includes airport information', async () => {
            const result = await agentApi.getAgentInfo(1);

            expect(result.airports).toHaveLength(1);
            expect(result.airports![0]).toMatchObject({
                code: 'AKL',
                name: 'Auckland Airport',
                city: 'Auckland',
            });
        });

        it('handles agent not found', async () => {
            server.use(
                http.get('*/nationwideJob/GetAgentInfo', () => {
                    return HttpResponse.json(
                        { message: 'Agent not found' },
                        { status: 404 }
                    );
                })
            );

            await expect(agentApi.getAgentInfo(999)).rejects.toMatchObject({
                status: 404,
            });
        });

        it('handles server errors', async () => {
            server.use(
                http.get('*/nationwideJob/GetAgentInfo', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(agentApi.getAgentInfo(1)).rejects.toMatchObject({
                status: 500,
            });
        });
    });
});
