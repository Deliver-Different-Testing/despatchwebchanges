/** @jest-environment node */
/**
 * Nationwide API Service Tests
 */

import {NationwideApiService, nationwideApi} from './nationwideApi';
import { apiClient } from './apiClient';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type {FlightViewModelDto} from '../interfaces/nationwideJobs';

dayjs.extend(utc);

// Mock the apiClient
jest.mock('./apiClient', () => ({
    apiClient: {
        get: jest.fn(),
        post: jest.fn(),
    },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('NationwideApiService', () => {
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

        it('should throw error when API throws', async () => {
            mockApiClient.get.mockRejectedValueOnce(new Error('API Error'));

            await expect(
                nationwideApi.calculateCargoReadyTime(123, 'NZ', '2024-03-15T14:30:00')
            ).rejects.toThrow('API Error');
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

        it('should have getScheduledFlightOptions method', () => {
            expect(typeof nationwideApi.getScheduledFlightOptions).toBe('function');
        });
    });

    describe('getScheduledFlightOptions', () => {
        const createMockFlightDto = (overrides: Partial<FlightViewModelDto> = {}): FlightViewModelDto => ({
            airline: 'NZ',
            flightNumber: 'NZ123',
            departureTime: '2024-03-15T08:00:00',
            arrivalTime: '2024-03-15T11:30:00',
            departureAirport: 'AKL',
            arrivalAirport: 'SYD',
            duration: '3h 30m',
            stops: 0,
            aircraft: 'Boeing 787',
            serviceClasses: ['Economy', 'Business'],
            isCodeShare: false,
            serviceType: 'J',
            isCharter: false,
            serviceTypeDescription: 'Scheduled Passenger',
            amount: 150.0,
            codeShareAirline: '',
            airlineId: 1,
            departureTimeZone: 'Pacific/Auckland',
            arrivalTimeZone: 'Australia/Sydney',
            isMultiSegment: false,
            elapsedTime: 210,
            score: 95,
            connectionId: 'conn-123',
            flightSegments: [
                {
                    segmentOrder: 1,
                    carrierFsCode: 'NZ',
                    flightNumber: '123',
                    departureTime: '2024-03-15T08:00:00',
                    arrivalTime: '2024-03-15T11:30:00',
                    departureAirportFsCode: 'AKL',
                    arrivalAirportFsCode: 'SYD',
                    flightEquipmentIataCode: '787',
                    elapsedTime: 210,
                    stopsInSegment: 0,
                    departureAirportName: 'Auckland Airport',
                    departureAirportCity: 'Auckland',
                    departureAirportTimeZone: 'Pacific/Auckland',
                    arrivalAirportName: 'Sydney Airport',
                    arrivalAirportCity: 'Sydney',
                    arrivalAirportTimeZone: 'Australia/Sydney',
                },
            ],
            ...overrides,
        });

        it('should call apiClient.get with correct URL and params', async () => {
            mockApiClient.get.mockResolvedValueOnce({ flights: [createMockFlightDto()] });

            await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
                minimumLayoverMinutes: 60,
            });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'nationwideJob/GetScheduledFlightOptions',
                {
                    jobId: 16992,
                    departureDate: '2024-03-15T08:00:00+13:00',
                    airlineId: undefined,
                    departureAirportId: 150,
                    arrivalAirportId: 96,
                    minimumLayoverMinutes: 60,
                    includeNearbyAirports: false,
                }
            );
        });

        it('should pass airlineId when provided', async () => {
            mockApiClient.get.mockResolvedValueOnce({ flights: [createMockFlightDto()] });

            await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                airlineId: 3,
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'nationwideJob/GetScheduledFlightOptions',
                expect.objectContaining({
                    airlineId: 3,
                })
            );
        });

        it('should default minimumLayoverMinutes to 60 when not provided', async () => {
            mockApiClient.get.mockResolvedValueOnce({ flights: [createMockFlightDto()] });

            await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'nationwideJob/GetScheduledFlightOptions',
                expect.objectContaining({
                    minimumLayoverMinutes: 60,
                })
            );
        });

        it('should transform DTO to domain model with Dayjs objects', async () => {
            mockApiClient.get.mockResolvedValueOnce({ flights: [createMockFlightDto()] });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(result.flights).toHaveLength(1);
            expect(dayjs.isDayjs(result.flights[0].departureTime)).toBe(true);
            expect(dayjs.isDayjs(result.flights[0].arrivalTime)).toBe(true);
            expect(result.flights[0].flightSegments).toHaveLength(1);
            expect(dayjs.isDayjs(result.flights[0].flightSegments[0].departureTime)).toBe(true);
            expect(dayjs.isDayjs(result.flights[0].flightSegments[0].arrivalTime)).toBe(true);
        });

        it('should return empty flights with message when API returns no flights', async () => {
            mockApiClient.get.mockResolvedValueOnce({ flights: [], message: 'No flights found for the selected route and date.' });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(result.flights).toEqual([]);
            expect(result.message).toBe('No flights found for the selected route and date.');
        });

        it('should return empty flights when response has null flights array', async () => {
            mockApiClient.get.mockResolvedValueOnce({ flights: null, message: 'Departure airport not found.' });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(result.flights).toEqual([]);
            expect(result.message).toBe('Departure airport not found.');
        });

        it('should throw error when API throws', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockApiClient.get.mockRejectedValueOnce(new Error('API Error'));

            await expect(
                nationwideApi.getScheduledFlightOptions({
                    jobId: 16992,
                    departureDate: '2024-03-15T08:00:00+13:00',
                    departureAirportId: 150,
                    arrivalAirportId: 96,
                })
            ).rejects.toThrow('API Error');

            expect(consoleSpy).toHaveBeenCalledWith(
                'Error fetching scheduled flight options:',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });

        it('should handle multiple flights in response', async () => {
            mockApiClient.get.mockResolvedValueOnce({
                flights: [
                    createMockFlightDto({ flightNumber: 'NZ123', airline: 'NZ' }),
                    createMockFlightDto({ flightNumber: 'QF456', airline: 'QF' }),
                    createMockFlightDto({ flightNumber: 'AA789', airline: 'AA' }),
                ],
            });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(result.flights).toHaveLength(3);
            expect(result.flights[0].airline).toBe('NZ');
            expect(result.flights[1].airline).toBe('QF');
            expect(result.flights[2].airline).toBe('AA');
        });

        it('should handle multi-segment flights', async () => {
            const multiSegmentFlight = createMockFlightDto({
                isMultiSegment: true,
                flightSegments: [
                    {
                        segmentOrder: 1,
                        carrierFsCode: 'NZ',
                        flightNumber: '123',
                        departureTime: '2024-03-15T08:00:00',
                        arrivalTime: '2024-03-15T11:30:00',
                        departureAirportFsCode: 'AKL',
                        arrivalAirportFsCode: 'SYD',
                        flightEquipmentIataCode: '787',
                        elapsedTime: 210,
                        stopsInSegment: 0,
                        departureAirportTimeZone: 'Pacific/Auckland',
                        arrivalAirportTimeZone: 'Australia/Sydney',
                    },
                    {
                        segmentOrder: 2,
                        carrierFsCode: 'QF',
                        flightNumber: '456',
                        departureTime: '2024-03-15T13:00:00',
                        arrivalTime: '2024-03-15T15:00:00',
                        departureAirportFsCode: 'SYD',
                        arrivalAirportFsCode: 'MEL',
                        flightEquipmentIataCode: 'A320',
                        elapsedTime: 120,
                        stopsInSegment: 0,
                        departureAirportTimeZone: 'Australia/Sydney',
                        arrivalAirportTimeZone: 'Australia/Melbourne',
                    },
                ],
            });
            mockApiClient.get.mockResolvedValueOnce({ flights: [multiSegmentFlight] });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(result.flights).toHaveLength(1);
            expect(result.flights[0].isMultiSegment).toBe(true);
            expect(result.flights[0].flightSegments).toHaveLength(2);
            expect(dayjs.isDayjs(result.flights[0].flightSegments[0].departureTime)).toBe(true);
            expect(dayjs.isDayjs(result.flights[0].flightSegments[1].departureTime)).toBe(true);
        });

        it('should preserve all flight properties after transformation', async () => {
            mockApiClient.get.mockResolvedValueOnce({
                flights: [createMockFlightDto({
                    amount: 250.50,
                    score: 98,
                    duration: '4h 30m',
                })],
            });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(result.flights[0].amount).toBe(250.50);
            expect(result.flights[0].score).toBe(98);
            expect(result.flights[0].duration).toBe('4h 30m');
            expect(result.flights[0].airline).toBe('NZ');
            expect(result.flights[0].departureAirport).toBe('AKL');
            expect(result.flights[0].arrivalAirport).toBe('SYD');
        });
    });

    describe('timezone offset preservation', () => {
        const createMockFlightDto = (overrides: Partial<FlightViewModelDto> = {}): FlightViewModelDto => ({
            airline: 'NZ',
            flightNumber: 'NZ123',
            departureTime: '2024-03-15T08:00:00+13:00',
            arrivalTime: '2024-03-15T11:30:00+11:00',
            departureAirport: 'AKL',
            arrivalAirport: 'SYD',
            duration: '3h 30m',
            stops: 0,
            aircraft: 'Boeing 787',
            serviceClasses: ['Economy'],
            isCodeShare: false,
            serviceType: 'J',
            isCharter: false,
            serviceTypeDescription: 'Scheduled Passenger',
            amount: 150.0,
            codeShareAirline: '',
            airlineId: 1,
            departureTimeZone: 'Pacific/Auckland',
            arrivalTimeZone: 'Australia/Sydney',
            isMultiSegment: false,
            elapsedTime: 210,
            score: 95,
            connectionId: 'conn-123',
            flightSegments: [
                {
                    segmentOrder: 1,
                    carrierFsCode: 'NZ',
                    flightNumber: '123',
                    departureTime: '2024-03-15T08:00:00+13:00',
                    arrivalTime: '2024-03-15T11:30:00+11:00',
                    departureAirportFsCode: 'AKL',
                    arrivalAirportFsCode: 'SYD',
                    flightEquipmentIataCode: '787',
                    elapsedTime: 210,
                    stopsInSegment: 0,
                    departureAirportTimeZone: 'Pacific/Auckland',
                    arrivalAirportTimeZone: 'Australia/Sydney',
                },
            ],
            ...overrides,
        });

        it('should preserve departure time without converting to local timezone', async () => {
            // This tests that 08:00+13:00 stays as 08:00, not converted to user's local time
            mockApiClient.get.mockResolvedValueOnce({ flights: [createMockFlightDto()] });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            // The formatted time should be 08:00, not shifted by local timezone
            expect(result.flights[0].departureTime.format('HH:mm')).toBe('08:00');
        });

        it('should preserve arrival time without converting to local timezone', async () => {
            // This tests that 11:30+11:00 stays as 11:30
            mockApiClient.get.mockResolvedValueOnce({ flights: [createMockFlightDto()] });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            expect(result.flights[0].arrivalTime.format('HH:mm')).toBe('11:30');
        });

        it('should preserve timezone offset in parsed datetime', async () => {
            mockApiClient.get.mockResolvedValueOnce({ flights: [createMockFlightDto()] });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            // UTC offset should be preserved (+13:00 = 780 minutes)
            expect(result.flights[0].departureTime.utcOffset()).toBe(780);
            // Arrival offset (+11:00 = 660 minutes)
            expect(result.flights[0].arrivalTime.utcOffset()).toBe(660);
        });

        it('should preserve segment times without timezone conversion', async () => {
            mockApiClient.get.mockResolvedValueOnce({ flights: [createMockFlightDto()] });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-03-15T08:00:00+13:00',
                departureAirportId: 150,
                arrivalAirportId: 96,
            });

            const segment = result.flights[0].flightSegments[0];
            expect(segment.departureTime.format('HH:mm')).toBe('08:00');
            expect(segment.arrivalTime.format('HH:mm')).toBe('11:30');
            expect(segment.departureTime.utcOffset()).toBe(780); // +13:00
            expect(segment.arrivalTime.utcOffset()).toBe(660);   // +11:00
        });

        it('should preserve times for negative timezone offsets', async () => {
            // Flight in PST timezone (UTC-8)
            mockApiClient.get.mockResolvedValueOnce({
                flights: [createMockFlightDto({
                    departureTime: '2024-01-15T10:30:00-08:00',
                    arrivalTime: '2024-01-15T14:00:00-05:00',
                    flightSegments: [{
                        segmentOrder: 1,
                        carrierFsCode: 'AA',
                        flightNumber: '100',
                        departureTime: '2024-01-15T10:30:00-08:00',
                        arrivalTime: '2024-01-15T14:00:00-05:00',
                        departureAirportFsCode: 'LAX',
                        arrivalAirportFsCode: 'JFK',
                        flightEquipmentIataCode: '777',
                        elapsedTime: 330,
                        stopsInSegment: 0,
                        departureAirportTimeZone: 'America/Los_Angeles',
                        arrivalAirportTimeZone: 'America/New_York',
                    }],
                })],
            });

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 16992,
                departureDate: '2024-01-15T10:30:00-08:00',
                departureAirportId: 1,
                arrivalAirportId: 2,
            });

            expect(result.flights[0].departureTime.format('HH:mm')).toBe('10:30');
            expect(result.flights[0].arrivalTime.format('HH:mm')).toBe('14:00');
            expect(result.flights[0].departureTime.utcOffset()).toBe(-480); // -08:00
            expect(result.flights[0].arrivalTime.utcOffset()).toBe(-300);   // -05:00
        });

        it('should preserve cargo processing times with timezone offset', async () => {
            const mockResponse = {
                arrivalTime: '2024-03-15T14:30:00+11:00',
                processingTimeMins: 90,
                cargoOpeningTime: '2024-03-15T06:00:00+11:00',
                cargoClosingTime: '2024-03-15T22:00:00+11:00',
                deliverByTime: '2024-03-15T18:00:00+11:00',
            };
            mockApiClient.get.mockResolvedValueOnce(mockResponse);

            const result = await nationwideApi.calculateCargoReadyTime(123, 'NZ', '2024-03-15T14:30:00+11:00');

            expect(result).not.toBeNull();
            expect(result!.arrivalTime.format('HH:mm')).toBe('14:30');
            expect(result!.cargoOpeningTime.format('HH:mm')).toBe('06:00');
            expect(result!.cargoClosingTime.format('HH:mm')).toBe('22:00');
            expect(result!.arrivalTime.utcOffset()).toBe(660); // +11:00
        });
    });
});

describe('getScheduledFlightOptions paging cursor', () => {
    // The widget pages forward from the last flight returned. AngularJS's NWData
    // computed this; React dropped it, which would have left "load more" and
    // "next day" stuck on the first page.
    beforeEach(() => jest.clearAllMocks());

    const flightDto = (departureTime: string) => ({
        flightNumber: 'NZ1',
        departureTime,
        arrivalTime: departureTime,
        flightSegments: [],
    });

    it('returns the last flight departure time as the cursor', async () => {
        mockApiClient.get.mockResolvedValue({
            flights: [flightDto('2026-03-15T08:00:00'), flightDto('2026-03-15T17:30:00')],
        });

        const result = await nationwideApi.getScheduledFlightOptions({
            jobId: 1, departureDate: '2026-03-15T00:00:00',
        });

        expect(result.lastDepartureTime?.format('YYYY-MM-DD HH:mm')).toBe('2026-03-15 17:30');
    });

    it('has no cursor when the search came back empty', async () => {
        mockApiClient.get.mockResolvedValue({flights: []});

        const result = await nationwideApi.getScheduledFlightOptions({
            jobId: 1, departureDate: '2026-03-15T00:00:00',
        });

        expect(result.lastDepartureTime).toBeUndefined();
        expect(result.flights).toEqual([]);
    });

    it('leaves the recurring picker without a cursor -- it does not page by day', async () => {
        // Deliberate divergence: getRecurringFlightOptions feeds a saved-flight
        // dialog that only picks a flight number, so it has nothing to page.
        mockApiClient.get.mockResolvedValue({
            flights: [flightDto('2026-03-15T08:00:00')],
        });

        const result = await nationwideApi.getRecurringFlightOptions({
            bookingId: 1, departureDate: '2026-03-15T00:00:00',
        } as never);

        expect(result.flights).toHaveLength(1);
        expect(result.lastDepartureTime).toBeUndefined();
    });
});

describe('NationwideApiService flight and agent operations', () => {
    // Ported from the AngularJS `NWData` service for the React Nationwide page.
    // Contracts were checked against NationwideJobController: AssignFlightToJob
    // and SendAgentQuote are [HttpPost] [FromBody]; GetActiveAirlines and
    // GetNearbyAirports are GETs with query params.
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('assignFlightToJob', () => {
        it('posts the request body to nationwideJob/AssignFlightToJob', async () => {
            mockApiClient.post.mockResolvedValue(undefined);
            const request = {
                jobId: 42,
                fromAirportId: 1,
                toAirportId: 2,
                flightNumber: 'NZ123',
                departureDate: '2026-03-15T08:00:00',
                flightSegments: [],
                packageDeliveryNotes: 'Leave at dock',
            };

            await nationwideApi.assignFlightToJob(request);

            expect(mockApiClient.post).toHaveBeenCalledWith('nationwideJob/AssignFlightToJob', request);
        });
    });

    describe('getActiveAirlines', () => {
        it('gets nationwideJob/GetActiveAirlines and returns the list', async () => {
            const airlines = [{id: 1, name: 'NZ', fullAirlineName: 'Air New Zealand'}];
            mockApiClient.get.mockResolvedValue(airlines);

            const result = await nationwideApi.getActiveAirlines();

            expect(mockApiClient.get).toHaveBeenCalledWith('nationwideJob/GetActiveAirlines');
            expect(result).toEqual(airlines);
        });
    });

    describe('getNearbyAirports', () => {
        it('gets nationwideJob/GetNearbyAirports with jobId and usePickup', async () => {
            const airports = [{id: 9, name: 'AKL', timezone: 'New Zealand Standard Time'}];
            mockApiClient.get.mockResolvedValue(airports);

            const result = await nationwideApi.getNearbyAirports(7, false);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'nationwideJob/GetNearbyAirports',
                {jobId: 7, usePickup: false},
            );
            expect(result).toEqual(airports);
        });

        it('defaults usePickup to true, matching the AngularJS signature', async () => {
            mockApiClient.get.mockResolvedValue([]);

            await nationwideApi.getNearbyAirports(7);

            expect(mockApiClient.get).toHaveBeenCalledWith(
                'nationwideJob/GetNearbyAirports',
                {jobId: 7, usePickup: true},
            );
        });
    });

    describe('getAgentsForJob', () => {
        it('gets nationwideJob/GetAgentsForJob and returns the agents', async () => {
            const agents = [{agentId: 3, agentName: 'Acme Air', agentRate: 120, agentRanking: 'A', agentNotes: ''}];
            mockApiClient.get.mockResolvedValue(agents);

            const result = await nationwideApi.getAgentsForJob(55);

            expect(mockApiClient.get).toHaveBeenCalledWith('nationwideJob/GetAgentsForJob', {jobId: 55});
            expect(result).toEqual(agents);
        });

        it('returns an empty array when the server sends nothing', async () => {
            // The AngularJS wrapper turned an empty list into a user-facing message;
            // that copy belongs in the UI, so the service just normalises to [].
            mockApiClient.get.mockResolvedValue(undefined as never);

            await expect(nationwideApi.getAgentsForJob(55)).resolves.toEqual([]);
        });
    });

    describe('sendAgentQuote', () => {
        it('posts jobId and agentId to nationwideJob/SendAgentQuote', async () => {
            mockApiClient.post.mockResolvedValue(undefined);

            await nationwideApi.sendAgentQuote(11, 22);

            expect(mockApiClient.post).toHaveBeenCalledWith(
                'nationwideJob/SendAgentQuote',
                {jobId: 11, agentId: 22},
            );
        });
    });
});
