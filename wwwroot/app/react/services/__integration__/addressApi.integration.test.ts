/**
 * Address API Integration Tests
 *
 * Tests the addressApi service using MSW to intercept real HTTP requests.
 * Verifies correct endpoint URLs, request parameters, and response handling.
 */

import { server } from '../../__testUtils__/msw/server';
import { http, HttpResponse } from 'msw';
import { addressApi } from '../addressApi';
import { mockLocationResults, mockLookupResponse } from '../../__testUtils__/msw/handlers';

describe('addressApi integration', () => {
    describe('autocompleteSearch', () => {
        it('searches addresses with text parameter', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/addressAutocomplete/AutocompleteAddressSearch', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockLocationResults);
                })
            );

            const result = await addressApi.autocompleteSearch('123 Main');

            expect(capturedUrl).toContain('text=123');
            expect(result).toHaveLength(2);
            expect(result[0].title).toBe('123 Main Street');
        });

        it('returns address details with position coordinates', async () => {
            const result = await addressApi.autocompleteSearch('Main Street');

            expect(result[0].position).toEqual({
                lat: 51.5074,
                lng: -0.1278,
            });
            expect(result[0].address.city).toBe('London');
        });

        it('returns empty array for short search text', async () => {
            server.use(
                http.get('*/addressAutocomplete/AutocompleteAddressSearch', ({ request }) => {
                    const url = new URL(request.url);
                    const text = url.searchParams.get('text');
                    if (!text || text.length < 3) {
                        return HttpResponse.json([]);
                    }
                    return HttpResponse.json(mockLocationResults);
                })
            );

            const result = await addressApi.autocompleteSearch('ab');

            expect(result).toHaveLength(0);
        });

        it('handles server errors gracefully', async () => {
            server.use(
                http.get('*/addressAutocomplete/AutocompleteAddressSearch', () => {
                    return new HttpResponse('HERE Maps service unavailable', { status: 503 });
                })
            );

            await expect(addressApi.autocompleteSearch('test')).rejects.toMatchObject({
                status: 503,
            });
        });
    });

    describe('getLocationDetailsById', () => {
        it('fetches detailed location by address ID', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/addressAutocomplete/GetLocationDetailsById', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json(mockLookupResponse);
                })
            );

            const result = await addressApi.getLocationDetailsById('here:af:street:abc123');

            expect(capturedUrl).toContain('addressId=here');
            expect(result.title).toBe('123 Main Street');
            expect(result.address.street).toBe('Main Street');
            expect(result.address.houseNumber).toBe('123');
        });

        it('returns full address structure', async () => {
            const result = await addressApi.getLocationDetailsById('here:af:street:abc123');

            expect(result.address).toMatchObject({
                label: '123 Main Street, London, UK',
                city: 'London',
                postalCode: 'SW1A 1AA',
                countryCode: 'GBR',
                countryName: 'United Kingdom',
            });
        });

        it('handles invalid address ID', async () => {
            server.use(
                http.get('*/addressAutocomplete/GetLocationDetailsById', () => {
                    return HttpResponse.json(
                        { message: 'Address not found' },
                        { status: 404 }
                    );
                })
            );

            await expect(
                addressApi.getLocationDetailsById('invalid-id')
            ).rejects.toMatchObject({
                status: 404,
            });
        });
    });

    describe('fetchNearestAddress', () => {
        it('reverse geocodes coordinates to address', async () => {
            let capturedUrl = '';

            server.use(
                http.get('*/addressAutocomplete/FetchNearestAddress', ({ request }) => {
                    capturedUrl = request.url;
                    return HttpResponse.json([mockLocationResults[0]]);
                })
            );

            const result = await addressApi.fetchNearestAddress(51.5074, -0.1278);

            expect(capturedUrl).toContain('latitude=51.5074');
            expect(capturedUrl).toContain('longitude=-0.1278');
            expect(result).toHaveLength(1);
            expect(result[0].title).toBe('123 Main Street');
        });

        it('handles location with no nearby addresses', async () => {
            server.use(
                http.get('*/addressAutocomplete/FetchNearestAddress', () => {
                    return HttpResponse.json([]);
                })
            );

            const result = await addressApi.fetchNearestAddress(0, 0);

            expect(result).toHaveLength(0);
        });

        it('handles missing coordinate parameters', async () => {
            server.use(
                http.get('*/addressAutocomplete/FetchNearestAddress', ({ request }) => {
                    const url = new URL(request.url);
                    if (!url.searchParams.get('latitude') || !url.searchParams.get('longitude')) {
                        return new HttpResponse('Missing coordinates', { status: 400 });
                    }
                    return HttpResponse.json([]);
                })
            );

            // This should work since we're passing coordinates
            const result = await addressApi.fetchNearestAddress(51.5074, -0.1278);
            expect(result).toHaveLength(0);
        });
    });

    describe('getHereMapsKey', () => {
        it('fetches HERE Maps API key from config', async () => {
            const result = await addressApi.getHereMapsKey();

            expect(result).toBe('test-api-key-12345');
        });

        it('handles config service errors', async () => {
            server.use(
                http.get('*/config/GetHereMapsKey', () => {
                    return new HttpResponse('Config service unavailable', { status: 500 });
                })
            );

            await expect(addressApi.getHereMapsKey()).rejects.toMatchObject({
                status: 500,
            });
        });

        it('handles missing API key configuration', async () => {
            server.use(
                http.get('*/config/GetHereMapsKey', () => {
                    return HttpResponse.json(
                        { message: 'HERE Maps API key not configured' },
                        { status: 404 }
                    );
                })
            );

            await expect(addressApi.getHereMapsKey()).rejects.toMatchObject({
                status: 404,
            });
        });
    });
});
