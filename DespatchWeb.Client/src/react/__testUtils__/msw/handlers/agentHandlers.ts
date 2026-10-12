/**
 * Agent API Handlers
 *
 * MSW handlers for agent-related API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { AgentInfo } from '../../../interfaces';

// Mock data
export const mockAgentInfo: AgentInfo = {
    agentId: 1,
    agentName: 'Express Couriers NZ',
    agentRate: 45.5,
    agentRanking: 'Gold',
    agentNotes: 'Reliable agent for Auckland region',
    agentPhone: '+64 21 555 1234',
    agentEmail: 'agent@expresscouriers.co.nz',
    airports: [
        {
            code: 'AKL',
            name: 'Auckland Airport',
            city: 'Auckland',
            country: 'New Zealand',
            timezone: 'Pacific/Auckland',
            elevation: 7,
            latitude: -37.0082,
            longitude: 174.7917,
        },
    ],
    address: {
        addressLine1: 'Express Couriers',
        addressLine2: '',
        addressLine3: '100',
        addressLine4: 'Queen Street',
        addressLine5: 'Auckland CBD',
        addressLine6: 'Auckland',
        addressLine7: '1010',
        addressLine8: '',
        fullAddress: '100 Queen Street, Auckland CBD',
    },
};

export const agentHandlers = [
    // Get agent info
    http.get('*/nationwideJob/GetAgentInfo', ({ request }) => {
        const url = new URL(request.url);
        const agentId = url.searchParams.get('agentId');

        if (!agentId) {
            return new HttpResponse('Missing agentId parameter', { status: 400 });
        }

        return HttpResponse.json(mockAgentInfo);
    }),
];
