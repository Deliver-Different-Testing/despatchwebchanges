/**
 * Courier API Handlers
 *
 * MSW handlers for courier-related API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { CourierSuggestion, TimeZoneOption } from '../../../interfaces';
import type { IClearListDebugViewModel } from '../../../../interfaces/job.interface';

// Mock data
export const mockCourierSuggestions: CourierSuggestion[] = [
    {
        id: 1,
        text: 'John Smith (JS001)',
    },
    {
        id: 2,
        text: 'Jane Doe (JD002)',
    },
    {
        id: 3,
        text: 'Bob Wilson (BW003)',
    },
];

export const mockCourierLocations = [
    {
        courierId: 1,
        courierName: 'John Smith',
        latitude: 51.5074,
        longitude: -0.1278,
        lastUpdate: '2024-01-15T10:00:00Z',
        courierFleetId: 32,
        courierFleetName: 'UA Auckland',
        lastDeliveryCity: 'Ponsonby',
        lastDeliveryTime: '2024-01-15T09:48:00Z',
    },
    {
        courierId: 2,
        courierName: 'Jane Doe',
        latitude: 51.5080,
        longitude: -0.1290,
        lastUpdate: '2024-01-15T10:05:00Z',
        courierFleetId: 34,
        courierFleetName: 'UA Wellington',
        // No completed delivery yet — the flag stays a single line for this one.
        lastDeliveryCity: null,
        lastDeliveryTime: null,
    },
];

export const mockCourierFleetOptions = [
    {id: 32, text: 'UA Auckland'},
    {id: 34, text: 'UA Wellington'},
    {id: 39, text: 'Regional'},
    {id: 66, text: 'Auckland Cool'},
];

export const mockClearListEnvelope = {
    minLat: 51.4,
    maxLat: 51.6,
    minLng: -0.3,
    maxLng: 0.1,
};

export const mockTimeZoneOptions: TimeZoneOption[] = [
    { id: 1, text: 'New Zealand Standard Time', timeZoneIana: 'Pacific/Auckland' },
    { id: 2, text: 'Eastern Standard Time', timeZoneIana: 'America/New_York' },
    { id: 3, text: 'Pacific Standard Time', timeZoneIana: 'America/Los_Angeles' },
];

export const mockClearListDebug: IClearListDebugViewModel = {
    courierId: 42,
    courierCode: 'C042',
    courierName: 'Test Driver',
    channelId: 10,
    fleetName: 'Fleet Alpha',
    gpsPolygonId: 5,
    gpsPolygonName: 'Zone A',
    gpsPolygonSuburbs: ['Suburb1', 'Suburb2'],
    gpsLatitude: -33.8688,
    gpsLongitude: 151.2093,
    gpsTimestamp: '2026-03-30T10:00:00Z',
    gpsAgeMinutes: 1,
    assignedClearListAreaId: 1,
    assignedClearListAreaName: 'North Area',
    assignedStatus: 1,
    assignedStatusLabel: 'Active',
    polygonAreaMappings: [
        { clearListAreaId: 1, clearListAreaName: 'North Area', areaChannelId: 10, channelMatches: true },
        { clearListAreaId: 2, clearListAreaName: 'South Area', areaChannelId: 20, channelMatches: false },
    ],
    isLoggedIn: true,
    loginTime: '2026-03-30T08:00:00Z',
    explanation: 'Driver is in Zone A, assigned to North Area.',
};

export const courierHandlers = [
    // Search active couriers
    http.get('*/courier/AllActiveSearch', ({ request }) => {
        const url = new URL(request.url);
        const searchText = url.searchParams.get('searchText');

        if (!searchText) {
            return HttpResponse.json(mockCourierSuggestions);
        }

        const filtered = mockCourierSuggestions.filter(c =>
            c.text.toLowerCase().includes(searchText.toLowerCase())
        );

        return HttpResponse.json(filtered);
    }),

    // Exact courier code lookup (returns null when no active courier has that code)
    http.get('*/courier/GetExactCourierByCode', ({ request }) => {
        const courierCode = new URL(request.url).searchParams.get('courierCode');
        const match = mockCourierSuggestions.find(c => c.text.split(/[\s(]/)[0] === courierCode);
        return HttpResponse.json(match ?? null);
    }),

    // Get available courier locations
    http.get('*/courier/AvailableCourierLocation', ({ request }) => {
        const url = new URL(request.url);
        const minLng = url.searchParams.get('minLng');
        const minLat = url.searchParams.get('minLat');
        const maxLng = url.searchParams.get('maxLng');
        const maxLat = url.searchParams.get('maxLat');

        if (!minLng || !minLat || !maxLng || !maxLat) {
            return new HttpResponse('Missing bounding box parameters', { status: 400 });
        }

        const fleetIds = url.searchParams.getAll('courierFleetIds').map((id) => Number(id));
        if (fleetIds.length > 0) {
            return HttpResponse.json(
                mockCourierLocations.filter((c) => fleetIds.includes(c.courierFleetId)),
            );
        }

        return HttpResponse.json(mockCourierLocations);
    }),

    // Get all fleet options
    http.get('*/courier/GetAllFleetOptions', () => {
        return HttpResponse.json(mockCourierFleetOptions);
    }),

    // Get clear list envelope
    http.get('*/courier/ClearListEnvelope', ({ request }) => {
        const url = new URL(request.url);
        const clearListId = url.searchParams.get('clearListId');

        if (!clearListId) {
            return new HttpResponse('Missing clearListId parameter', { status: 400 });
        }

        return HttpResponse.json(mockClearListEnvelope);
    }),

    // Get clear list debug info
    http.get('*/courier/ClearListDebug', ({ request }) => {
        const url = new URL(request.url);
        const courierId = url.searchParams.get('courierId');

        if (!courierId) {
            return new HttpResponse('Missing courierId parameter', { status: 400 });
        }

        return HttpResponse.json({ ...mockClearListDebug, courierId: Number(courierId) });
    }),

    // Get timezone options
    http.get('*/job/GetTimeZoneOptions', () => {
        return HttpResponse.json(mockTimeZoneOptions);
    }),
];
