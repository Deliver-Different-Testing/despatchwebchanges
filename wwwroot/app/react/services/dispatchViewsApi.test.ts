/** @jest-environment node */
/**
 * Dispatch Views API Service Tests
 */

import {dispatchViewsApi, fetchPageViews} from './dispatchViewsApi';
import {apiClient} from './apiClient';

jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const serverView = {id: 11, name: 'North', centerLatitude: -36.8, centerLongitude: 174.7};

describe('dispatchViewsApi', () => {
    beforeEach(() => jest.clearAllMocks());

    it('requests the page views for the given page and marks them unselected', async () => {
        mockApiClient.get.mockResolvedValueOnce([serverView]);

        const result = await fetchPageViews(1);

        expect(mockApiClient.get).toHaveBeenCalledWith('home/GetPageViews', {pageId: 1});
        expect(result).toEqual([{...serverView, selected: false}]);
    });

    it('returns [] when the server sends no views', async () => {
        mockApiClient.get.mockResolvedValueOnce(null as never);

        await expect(dispatchViewsApi.fetchPageViews(1)).resolves.toEqual([]);
    });

    it('propagates request failures so React Query can retry', async () => {
        mockApiClient.get.mockRejectedValueOnce(new Error('Server error'));

        await expect(fetchPageViews(1)).rejects.toThrow('Server error');
    });
});
