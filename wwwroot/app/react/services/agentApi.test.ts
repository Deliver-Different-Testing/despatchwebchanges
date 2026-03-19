/**
 * Agent API Service Tests
 */

import {AgentApiService, agentApi} from './agentApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('AgentApiService', () => {
    let service: AgentApiService;

    beforeEach(() => {
        service = new AgentApiService();
    });

    describe('getAgentInfo', () => {
        it('should call apiClient.get with correct endpoint and agentId', async () => {
            const mockAgentInfo = {
                agentId: 123,
                agentName: 'Test Agent',
                agentRate: 50.00,
                agentRanking: '5',
                agentNotes: 'Reliable agent',
                agentPhone: '1234567890',
                agentEmail: 'agent@test.com',
                airports: [
                    {
                        code: 'LAX',
                        name: 'Los Angeles International',
                        city: 'Los Angeles',
                        country: 'USA',
                        timezone: 'America/Los_Angeles',
                        elevation: 125,
                        latitude: 33.9425,
                        longitude: -118.4081,
                    },
                ],
                address: {
                    addressLine1: '123 Test St',
                    fullAddress: '123 Test St, Los Angeles, CA',
                },
            };
            mockApiClient.get.mockResolvedValueOnce(mockAgentInfo);

            const result = await service.getAgentInfo(123);

            expect(mockApiClient.get).toHaveBeenCalledWith('nationwideJob/GetAgentInfo', {agentId: 123});
            expect(result).toEqual(mockAgentInfo);
        });

        it('should return agent info with multiple airports', async () => {
            const mockAgentInfo = {
                agentId: 456,
                agentName: 'Multi-Airport Agent',
                agentRate: 75.00,
                agentRanking: '4',
                agentNotes: '',
                airports: [
                    {code: 'JFK', name: 'John F. Kennedy', city: 'New York', country: 'USA', timezone: 'America/New_York', elevation: 13, latitude: 40.6413, longitude: -73.7781},
                    {code: 'LGA', name: 'LaGuardia', city: 'New York', country: 'USA', timezone: 'America/New_York', elevation: 21, latitude: 40.7769, longitude: -73.8740},
                    {code: 'EWR', name: 'Newark Liberty', city: 'Newark', country: 'USA', timezone: 'America/New_York', elevation: 9, latitude: 40.6895, longitude: -74.1745},
                ],
            };
            mockApiClient.get.mockResolvedValueOnce(mockAgentInfo);

            const result = await service.getAgentInfo(456);

            expect(result.airports).toHaveLength(3);
            expect(result.airports?.[0].code).toBe('JFK');
            expect(result.airports?.[1].code).toBe('LGA');
            expect(result.airports?.[2].code).toBe('EWR');
        });

        it('should handle agent without airports', async () => {
            const mockAgentInfo = {
                agentId: 789,
                agentName: 'No Airport Agent',
                agentRate: 40.00,
                agentRanking: '3',
                agentNotes: 'Local delivery only',
                airports: [],
            };
            mockApiClient.get.mockResolvedValueOnce(mockAgentInfo);

            const result = await service.getAgentInfo(789);

            expect(result.airports).toEqual([]);
        });

        it('should handle agent without optional fields', async () => {
            const mockAgentInfo = {
                agentId: 101,
                agentName: 'Minimal Agent',
                agentRate: 30.00,
                agentRanking: '2',
                agentNotes: '',
            };
            mockApiClient.get.mockResolvedValueOnce(mockAgentInfo);

            const result = await service.getAgentInfo(101);

            expect(result.agentPhone).toBeUndefined();
            expect(result.agentEmail).toBeUndefined();
            expect(result.airports).toBeUndefined();
            expect(result.address).toBeUndefined();
        });

        it.each([
            ['404 Not Found', createMockApiError({status: 404, statusText: 'Not Found', message: 'Agent not found'})],
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Database error'})],
        ])('should propagate %s errors from apiClient', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(service.getAgentInfo(123)).rejects.toEqual(error);
        });
    });

    describe('agentApi singleton', () => {
        it('should export a default instance of AgentApiService', () => {
            expect(agentApi).toBeInstanceOf(AgentApiService);
        });

        it('should have getAgentInfo method available on the singleton', () => {
            expect(typeof agentApi.getAgentInfo).toBe('function');
        });
    });
});
