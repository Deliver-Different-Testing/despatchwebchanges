/** @jest-environment jest-fixed-jsdom */
/**
 * Nationwide API Integration Tests
 *
 * Tests the nationwideApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, response handling,
 * and date transformations including nested flight segments.
 */

import { server } from '../../__testUtils__/msw/setupIntegration';
import { http, HttpResponse } from 'msw';
import { nationwideApi } from '../nationwideApi';
import { mockFlightCargoProcessingDto, mockFlightViewModelDtos } from '../../__testUtils__/msw/handlers';
import dayjs from 'dayjs';

describe('nationwideApi integration', () => {
    describe('calculateCargoReadyTime', () => {
        it('fetches cargo processing with correct parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwideJob/CalculateCargoReadyTime', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockFlightCargoProcessingDto);
                })
            );

            const result = await nationwideApi.calculateCargoReadyTime(
                100, 'NZ', '2024-01-20T14:30:00+13:00'
            );

            expect(capturedUrl).toContain('jobId=100');
            expect(capturedUrl).toContain('carrierFsCode=NZ');
            expect(capturedUrl).toContain('arrivalTime=');
            expect(result).not.toBeNull();
        });

        it('transforms dates to Dayjs objects', async () => {
            const result = await nationwideApi.calculateCargoReadyTime(
                100, 'NZ', '2024-01-20T14:30:00+13:00'
            );

            expect(result).not.toBeNull();
            expect(dayjs.isDayjs(result!.arrivalTime)).toBe(true);
            expect(dayjs.isDayjs(result!.cargoOpeningTime)).toBe(true);
            expect(dayjs.isDayjs(result!.cargoClosingTime)).toBe(true);
            expect(result!.processingTimeMins).toBe(120);
        });

        it('transforms optional deliverByTime', async () => {
            const result = await nationwideApi.calculateCargoReadyTime(
                100, 'NZ', '2024-01-20T14:30:00+13:00'
            );

            expect(result).not.toBeNull();
            expect(dayjs.isDayjs(result!.deliverByTime)).toBe(true);
        });

        it('throws on server error', async () => {
            server.use(
                http.get('*/nationwideJob/CalculateCargoReadyTime', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                nationwideApi.calculateCargoReadyTime(100, 'NZ', '2024-01-20T14:30:00+13:00')
            ).rejects.toBeDefined();
        });

        it('returns null when response is null', async () => {
            server.use(
                http.get('*/nationwideJob/CalculateCargoReadyTime', () => {
                    return HttpResponse.json(null);
                })
            );

            const result = await nationwideApi.calculateCargoReadyTime(
                100, 'NZ', '2024-01-20T14:30:00+13:00'
            );

            expect(result).toBeNull();
        });
    });

    describe('getScheduledFlightOptions', () => {
        it('fetches flights with required parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwideJob/GetScheduledFlightOptions', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json({ flights: mockFlightViewModelDtos });
                })
            );

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 100,
                departureDate: '2024-01-20',
            });

            expect(capturedUrl).toContain('jobId=100');
            expect(capturedUrl).toContain('departureDate=2024-01-20');
            expect(result.flights).toHaveLength(2);
        });

        it('passes optional filter parameters', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwideJob/GetScheduledFlightOptions', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json({ flights: mockFlightViewModelDtos });
                })
            );

            await nationwideApi.getScheduledFlightOptions({
                jobId: 100,
                departureDate: '2024-01-20',
                airlineId: 1,
                departureAirportId: 10,
                arrivalAirportId: 20,
                minimumLayoverMinutes: 90,
            });

            expect(capturedUrl).toContain('airlineId=1');
            expect(capturedUrl).toContain('departureAirportId=10');
            expect(capturedUrl).toContain('arrivalAirportId=20');
            expect(capturedUrl).toContain('minimumLayoverMinutes=90');
        });

        it('defaults minimumLayoverMinutes to 60', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/nationwideJob/GetScheduledFlightOptions', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json({ flights: [] });
                })
            );

            await nationwideApi.getScheduledFlightOptions({
                jobId: 100,
                departureDate: '2024-01-20',
            });

            expect(capturedUrl).toContain('minimumLayoverMinutes=60');
        });

        it('transforms flight dates to Dayjs', async () => {
            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 100,
                departureDate: '2024-01-20',
            });

            expect(dayjs.isDayjs(result.flights[0].departureTime)).toBe(true);
            expect(dayjs.isDayjs(result.flights[0].arrivalTime)).toBe(true);
        });

        it('transforms nested segment dates to Dayjs', async () => {
            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 100,
                departureDate: '2024-01-20',
            });

            expect(result.flights[0].flightSegments).toHaveLength(1);
            expect(dayjs.isDayjs(result.flights[0].flightSegments[0].departureTime)).toBe(true);
            expect(dayjs.isDayjs(result.flights[0].flightSegments[0].arrivalTime)).toBe(true);
        });

        it('returns empty flights with message when no flights found', async () => {
            server.use(
                http.get('*/nationwideJob/GetScheduledFlightOptions', () => {
                    return HttpResponse.json({ flights: [], message: 'No flights found for the selected route and date.' });
                })
            );

            const result = await nationwideApi.getScheduledFlightOptions({
                jobId: 100,
                departureDate: '2024-01-20',
            });

            expect(result.flights).toHaveLength(0);
            expect(result.message).toBe('No flights found for the selected route and date.');
        });

        it('re-throws errors on server error', async () => {
            server.use(
                http.get('*/nationwideJob/GetScheduledFlightOptions', () => {
                    return new HttpResponse('Server error', { status: 500 });
                })
            );

            await expect(
                nationwideApi.getScheduledFlightOptions({
                    jobId: 100,
                    departureDate: '2024-01-20',
                })
            ).rejects.toBeDefined();
        });
    });
});
