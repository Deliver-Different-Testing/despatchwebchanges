/**
 * Config API Service Tests
 */

import {configApi, getHereMapsKey} from './configApi';
import {apiClient} from './apiClient';
import {createMockApiError} from '../__testUtils__';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('configApi', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getHereMapsKey', () => {
        it('should call apiClient.get with correct endpoint and extract apiKey', async () => {
            mockApiClient.get.mockResolvedValueOnce({apiKey: 'test-api-key-123'});

            const result = await getHereMapsKey();

            expect(mockApiClient.get).toHaveBeenCalledWith('config/GetHereMapsKey');
            expect(result).toBe('test-api-key-123');
        });

        it('should work with configApi object', async () => {
            mockApiClient.get.mockResolvedValueOnce({apiKey: 'another-key'});

            const result = await configApi.getHereMapsKey();

            expect(mockApiClient.get).toHaveBeenCalledWith('config/GetHereMapsKey');
            expect(result).toBe('another-key');
        });

        it.each([
            ['500 Server Error', createMockApiError({status: 500, statusText: 'Internal Server Error', message: 'Server error'})],
        ])('should propagate %s errors', async (_, error) => {
            mockApiClient.get.mockRejectedValueOnce(error);
            await expect(getHereMapsKey()).rejects.toEqual(error);
        });
    });
});
