/**
 * Courier API Handlers
 *
 * MSW handlers for courier-related API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { CourierSuggestion, TimeZoneOption } from '../../../interfaces';

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
    },
    {
        courierId: 2,
        courierName: 'Jane Doe',
        latitude: 51.5080,
        longitude: -0.1290,
        lastUpdate: '2024-01-15T10:05:00Z',
    },
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

        return HttpResponse.json(mockCourierLocations);
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

    // Get timezone options
    http.get('*/job/GetTimeZoneOptions', () => {
        return HttpResponse.json(mockTimeZoneOptions);
    }),
];
