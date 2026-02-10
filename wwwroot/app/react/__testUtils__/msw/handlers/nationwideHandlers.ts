/**
 * Nationwide API Handlers
 *
 * MSW handlers for nationwide job API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { FlightViewModelDto } from '../../../services/nationwideApi';

// Mock data
export const mockFlightCargoProcessingDto = {
    arrivalTime: '2024-01-20T14:30:00+13:00',
    processingTimeMins: 120,
    cargoOpeningTime: '2024-01-20T06:00:00+13:00',
    cargoClosingTime: '2024-01-20T22:00:00+13:00',
    deliverByTime: '2024-01-20T16:30:00+13:00',
};

export const mockFlightViewModelDtos: FlightViewModelDto[] = [
    {
        airline: 'Air New Zealand',
        flightNumber: 'NZ123',
        departureTime: '2024-01-20T08:00:00+13:00',
        arrivalTime: '2024-01-20T10:30:00+11:00',
        departureAirport: 'AKL',
        arrivalAirport: 'SYD',
        duration: '2h 30m',
        stops: 0,
        aircraft: 'Boeing 787',
        serviceClasses: ['Economy', 'Business'],
        isCodeShare: false,
        amount: 350.0,
        codeShareAirline: '',
        airlineId: 1,
        departureTimeZone: 'Pacific/Auckland',
        arrivalTimeZone: 'Australia/Sydney',
        isMultiSegment: false,
        elapsedTime: 150,
        score: 95,
        connectionId: 'conn-1',
        flightSegments: [
            {
                segmentOrder: 1,
                carrierFsCode: 'NZ',
                flightNumber: '123',
                departureTime: '2024-01-20T08:00:00+13:00',
                arrivalTime: '2024-01-20T10:30:00+11:00',
                departureAirportFsCode: 'AKL',
                departureTerminal: 'International',
                arrivalAirportFsCode: 'SYD',
                arrivalTerminal: 'T1',
                flightEquipmentIataCode: '787',
                elapsedTime: 150,
                stopsInSegment: 0,
                departureAirportName: 'Auckland Airport',
                departureAirportCity: 'Auckland',
                departureAirportTimeZone: 'Pacific/Auckland',
                arrivalAirportName: 'Sydney Airport',
                arrivalAirportCity: 'Sydney',
                arrivalAirportTimeZone: 'Australia/Sydney',
                aircraftName: 'Boeing 787-9 Dreamliner',
                airlineName: 'Air New Zealand',
            },
        ],
    },
    {
        airline: 'Qantas',
        flightNumber: 'QF146',
        departureTime: '2024-01-20T12:00:00+13:00',
        arrivalTime: '2024-01-20T14:15:00+11:00',
        departureAirport: 'AKL',
        arrivalAirport: 'SYD',
        duration: '2h 15m',
        stops: 0,
        aircraft: 'Airbus A330',
        serviceClasses: ['Economy', 'Business', 'First'],
        isCodeShare: false,
        amount: 420.0,
        codeShareAirline: '',
        airlineId: 2,
        departureTimeZone: 'Pacific/Auckland',
        arrivalTimeZone: 'Australia/Sydney',
        isMultiSegment: false,
        elapsedTime: 135,
        score: 88,
        connectionId: 'conn-2',
        flightSegments: [
            {
                segmentOrder: 1,
                carrierFsCode: 'QF',
                flightNumber: '146',
                departureTime: '2024-01-20T12:00:00+13:00',
                arrivalTime: '2024-01-20T14:15:00+11:00',
                departureAirportFsCode: 'AKL',
                arrivalAirportFsCode: 'SYD',
                arrivalTerminal: 'T1',
                flightEquipmentIataCode: '330',
                elapsedTime: 135,
                stopsInSegment: 0,
                departureAirportName: 'Auckland Airport',
                departureAirportCity: 'Auckland',
                departureAirportTimeZone: 'Pacific/Auckland',
                arrivalAirportName: 'Sydney Airport',
                arrivalAirportCity: 'Sydney',
                arrivalAirportTimeZone: 'Australia/Sydney',
                aircraftName: 'Airbus A330-200',
                airlineName: 'Qantas',
            },
        ],
    },
];

export const nationwideHandlers = [
    // Calculate cargo ready time
    http.get('*/nationwideJob/CalculateCargoReadyTime', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');
        const carrierFsCode = url.searchParams.get('carrierFsCode');
        const arrivalTime = url.searchParams.get('arrivalTime');

        if (!jobId || !carrierFsCode || !arrivalTime) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(mockFlightCargoProcessingDto);
    }),

    // Get scheduled flight options
    http.get('*/nationwideJob/GetScheduledFlightOptions', ({ request }) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');
        const departureDate = url.searchParams.get('departureDate');

        if (!jobId || !departureDate) {
            return new HttpResponse('Missing required parameters', { status: 400 });
        }

        return HttpResponse.json(mockFlightViewModelDtos);
    }),
];
