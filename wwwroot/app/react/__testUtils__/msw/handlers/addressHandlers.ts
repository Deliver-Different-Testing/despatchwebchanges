/**
 * Address API Handlers
 *
 * MSW handlers for address autocomplete API endpoints.
 */

import { http, HttpResponse } from 'msw';
import type { HereMapsLocationResult, HereMapsLookupResponse } from '../../../interfaces';

// Mock data
export const mockLocationResults: HereMapsLocationResult[] = [
    {
        id: 'here:af:street:abc123',
        title: '123 Main Street',
        resultType: 'houseNumber',
        address: {
            label: '123 Main Street, London, UK',
            city: 'London',
            postalCode: 'SW1A 1AA',
            countryCode: 'GBR',
            countryName: 'United Kingdom',
            county: 'Greater London',
            district: 'Westminster',
            street: 'Main Street',
            houseNumber: '123',
        },
        position: {
            lat: 51.5074,
            lng: -0.1278,
        },
        access: [{ lat: 51.5074, lng: -0.1278 }],
    },
    {
        id: 'here:af:street:def456',
        title: '456 High Street',
        resultType: 'houseNumber',
        address: {
            label: '456 High Street, Manchester, UK',
            city: 'Manchester',
            postalCode: 'M1 1AA',
            countryCode: 'GBR',
            countryName: 'United Kingdom',
            county: 'Greater Manchester',
            district: 'Manchester',
            street: 'High Street',
            houseNumber: '456',
        },
        position: {
            lat: 53.4808,
            lng: -2.2426,
        },
        access: [{ lat: 53.4808, lng: -2.2426 }],
    },
];

export const mockLookupResponse: HereMapsLookupResponse = {
    id: 'here:af:street:abc123',
    title: '123 Main Street',
    resultType: 'houseNumber',
    address: {
        label: '123 Main Street, London, UK',
        city: 'London',
        postalCode: 'SW1A 1AA',
        countryCode: 'GBR',
        countryName: 'United Kingdom',
        county: 'Greater London',
        district: 'Westminster',
        street: 'Main Street',
        houseNumber: '123',
    },
    position: {
        lat: 51.5074,
        lng: -0.1278,
    },
};

export const addressHandlers = [
    // Autocomplete address search
    http.get('*/addressAutocomplete/AutocompleteAddressSearch', ({ request }) => {
        const url = new URL(request.url);
        const text = url.searchParams.get('text');

        if (!text || text.length < 3) {
            return HttpResponse.json([]);
        }

        // Filter results based on search text
        const filtered = mockLocationResults.filter(r =>
            r.title.toLowerCase().includes(text.toLowerCase()) ||
            r.address.label.toLowerCase().includes(text.toLowerCase())
        );

        return HttpResponse.json(filtered.length > 0 ? filtered : mockLocationResults);
    }),

    // Get location details by ID
    http.get('*/addressAutocomplete/GetLocationDetailsById', ({ request }) => {
        const url = new URL(request.url);
        const addressId = url.searchParams.get('addressId');

        if (!addressId) {
            return new HttpResponse('Missing addressId parameter', { status: 400 });
        }

        return HttpResponse.json(mockLookupResponse);
    }),

    // Reverse geocode - fetch nearest address
    http.get('*/addressAutocomplete/FetchNearestAddress', ({ request }) => {
        const url = new URL(request.url);
        const latitude = url.searchParams.get('latitude');
        const longitude = url.searchParams.get('longitude');

        if (!latitude || !longitude) {
            return new HttpResponse('Missing latitude or longitude parameter', { status: 400 });
        }

        return HttpResponse.json(mockLocationResults.slice(0, 1));
    }),

    // Get HERE Maps API key
    http.get('*/config/GetHereMapsKey', () => {
        return HttpResponse.json({ apiKey: 'test-api-key-12345' });
    }),
];
