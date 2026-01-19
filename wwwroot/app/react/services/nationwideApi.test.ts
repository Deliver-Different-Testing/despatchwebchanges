/**
 * Nationwide API Service Tests
 */

import { nationwideApi, NationwideApiService } from './nationwideApi';
import { apiClient } from './apiClient';
import dayjs from 'dayjs';

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('NationwideApiService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateCargoReadyTime', () => {
        it('should call apiClient.get with correct URL and params', async () => {
            const mockResponse = {
                arrivalTime: '2024-03-15T14:30:00',
                processingTimeMins: 90,
                cargoOpeningTime: '2024-03-15T06:00:00',
                cargoClosingTime: '2024-03-15T22:00:00',
                deliverByTime: '2024-03-15T18:00:00',
            };
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await nationwideApi.calculateCargoReadyTime(
                123,
                'NZ',
                '2024-03-15T14:30:00+13:00'
            );

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'nationwideJob/CalculateCargoReadyTime',
                {
                    jobId: 123,
                    carrierFsCode: 'NZ',
                    arrivalTime: '2024-03-15T14:30:00+13:00',
                }
            );
            expect(result).not.toBeNull();
        });

        it('should transform DTO to domain model with Dayjs objects', async () => {
            const mockResponse = {
                arrivalTime: '2024-03-15T14:30:00',
                processingTimeMins: 90,
                cargoOpeningTime: '2024-03-15T06:00:00',
                cargoClosingTime: '2024-03-15T22:00:00',
                deliverByTime: '2024-03-15T18:00:00',
            };
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await nationwideApi.calculateCargoReadyTime(123, 'NZ', '2024-03-15T14:30:00');

            expect(result).not.toBeNull();
            expect(dayjs.isDayjs(result!.arrivalTime)).toBe(true);
            expect(dayjs.isDayjs(result!.cargoOpeningTime)).toBe(true);
            expect(dayjs.isDayjs(result!.cargoClosingTime)).toBe(true);
            expect(dayjs.isDayjs(result!.deliverByTime)).toBe(true);
            expect(result!.processingTimeMins).toBe(90);
        });

        it('should handle missing deliverByTime in response', async () => {
            const mockResponse = {
                arrivalTime: '2024-03-15T14:30:00',
                processingTimeMins: 90,
                cargoOpeningTime: '2024-03-15T06:00:00',
                cargoClosingTime: '2024-03-15T22:00:00',
                deliverByTime: null,
            };
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await nationwideApi.calculateCargoReadyTime(123, 'NZ', '2024-03-15T14:30:00');

            expect(result).not.toBeNull();
            expect(result!.deliverByTime).toBeUndefined();
        });

        it('should return null when API returns null response', async () => {
            mockApiClient.get.mockResolvedValueOnce(null);

            const result = await nationwideApi.calculateCargoReadyTime(123, 'NZ', '2024-03-15T14:30:00');

            expect(result).toBeNull();
        });

        it('should return null and log error when API throws', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockApiClient.get.mockRejectedValueOnce(new Error('API Error'));

            const result = await nationwideApi.calculateCargoReadyTime(123, 'NZ', '2024-03-15T14:30:00');

            expect(result).toBeNull();
            expect(consoleSpy).toHaveBeenCalledWith(
                'Error fetching cargo ready time:',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });

        it('should work with different airline codes', async () => {
            const mockResponse = {
                arrivalTime: '2024-03-15T14:30:00',
                processingTimeMins: 120,
                cargoOpeningTime: '2024-03-15T05:00:00',
                cargoClosingTime: '2024-03-15T23:00:00',
            };
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            await nationwideApi.calculateCargoReadyTime(456, 'QF', '2024-03-16T08:00:00');

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'nationwideJob/CalculateCargoReadyTime',
                {
                    jobId: 456,
                    carrierFsCode: 'QF',
                    arrivalTime: '2024-03-16T08:00:00',
                }
            );
        });
    });

    describe('nationwideApi export', () => {
        it('should be an instance of NationwideApiService', () => {
            expect(nationwideApi).toBeInstanceOf(NationwideApiService);
        });

        it('should have calculateCargoReadyTime method', () => {
            expect(typeof nationwideApi.calculateCargoReadyTime).toBe('function');
        });
    });
});
