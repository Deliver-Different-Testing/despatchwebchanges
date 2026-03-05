/**
 * CourierMapPage Types and Constants Tests
 *
 * Tests for the type definitions and constants used by the CourierMapPage component.
 */

import {
    US_BOUNDS,
    NZ_BOUNDS,
    POSITION_THRESHOLD,
    ICON_CACHE_LIMIT,
    MARKER_LABEL_MAX_LENGTH,
    REFRESH_INTERVAL_MS,
    SEARCH_DEBOUNCE_MS,
    DEFAULT_ZOOM,
    DRIVER_FOCUS_ZOOM,
    OVERVIEW_ZOOM,
    AVATAR_COLORS,
} from './CourierMapPage.types';
import type {
    CourierMarker,
    RegionalBounds,
    CourierMapPageProps,
    DriversPanelProps,
    DriverListItemProps,
    MapControlsProps,
    UseCourierMapReturn,
} from './CourierMapPage.types';

describe('CourierMapPage Constants', () => {
    describe('US_BOUNDS', () => {
        it('should have correct US regional bounds', () => {
            expect(US_BOUNDS).toEqual({
                minLng: -125,
                maxLng: -65,
                minLat: 24,
                maxLat: 50,
            });
        });

        it('should cover continental United States', () => {
            // West coast to east coast
            expect(US_BOUNDS.minLng).toBeLessThan(-120);
            expect(US_BOUNDS.maxLng).toBeGreaterThan(-70);
            // Southern border to Canadian border
            expect(US_BOUNDS.minLat).toBeLessThan(30);
            expect(US_BOUNDS.maxLat).toBeGreaterThan(45);
        });

        it('should have valid longitude range', () => {
            expect(US_BOUNDS.minLng).toBeGreaterThanOrEqual(-180);
            expect(US_BOUNDS.maxLng).toBeLessThanOrEqual(180);
            expect(US_BOUNDS.minLng).toBeLessThan(US_BOUNDS.maxLng);
        });

        it('should have valid latitude range', () => {
            expect(US_BOUNDS.minLat).toBeGreaterThanOrEqual(-90);
            expect(US_BOUNDS.maxLat).toBeLessThanOrEqual(90);
            expect(US_BOUNDS.minLat).toBeLessThan(US_BOUNDS.maxLat);
        });
    });

    describe('NZ_BOUNDS', () => {
        it('should have correct NZ regional bounds', () => {
            expect(NZ_BOUNDS).toEqual({
                minLng: 165,
                maxLng: 180,
                minLat: -47,
                maxLat: -34,
            });
        });

        it('should cover New Zealand', () => {
            // NZ is in the Southern Hemisphere
            expect(NZ_BOUNDS.minLat).toBeLessThan(0);
            expect(NZ_BOUNDS.maxLat).toBeLessThan(0);
            // NZ is near the date line
            expect(NZ_BOUNDS.minLng).toBeGreaterThan(160);
        });

        it('should have valid longitude range', () => {
            expect(NZ_BOUNDS.minLng).toBeGreaterThanOrEqual(-180);
            expect(NZ_BOUNDS.maxLng).toBeLessThanOrEqual(180);
            expect(NZ_BOUNDS.minLng).toBeLessThan(NZ_BOUNDS.maxLng);
        });

        it('should have valid latitude range', () => {
            expect(NZ_BOUNDS.minLat).toBeGreaterThanOrEqual(-90);
            expect(NZ_BOUNDS.maxLat).toBeLessThanOrEqual(90);
            expect(NZ_BOUNDS.minLat).toBeLessThan(NZ_BOUNDS.maxLat);
        });
    });

    describe('POSITION_THRESHOLD', () => {
        it('should be 0.0001 degrees', () => {
            expect(POSITION_THRESHOLD).toBe(0.0001);
        });

        it('should be approximately 11 meters at the equator', () => {
            // 1 degree ≈ 111km at equator
            // 0.0001 degrees ≈ 11.1 meters
            const metersPerDegree = 111000;
            const thresholdMeters = POSITION_THRESHOLD * metersPerDegree;
            expect(thresholdMeters).toBeCloseTo(11.1, 0);
        });
    });

    describe('ICON_CACHE_LIMIT', () => {
        it('should be 200', () => {
            expect(ICON_CACHE_LIMIT).toBe(200);
        });

        it('should be a reasonable cache size', () => {
            expect(ICON_CACHE_LIMIT).toBeGreaterThanOrEqual(50);
            expect(ICON_CACHE_LIMIT).toBeLessThanOrEqual(1000);
        });
    });

    describe('MARKER_LABEL_MAX_LENGTH', () => {
        it('should be 12 characters', () => {
            expect(MARKER_LABEL_MAX_LENGTH).toBe(12);
        });

        it('should allow reasonable driver names', () => {
            expect(MARKER_LABEL_MAX_LENGTH).toBeGreaterThanOrEqual(8);
        });
    });

    describe('REFRESH_INTERVAL_MS', () => {
        it('should be 30 seconds (30000ms)', () => {
            expect(REFRESH_INTERVAL_MS).toBe(30000);
        });

        it('should be a reasonable refresh interval', () => {
            expect(REFRESH_INTERVAL_MS).toBeGreaterThanOrEqual(10000);
            expect(REFRESH_INTERVAL_MS).toBeLessThanOrEqual(120000);
        });
    });

    describe('SEARCH_DEBOUNCE_MS', () => {
        it('should be 150ms', () => {
            expect(SEARCH_DEBOUNCE_MS).toBe(150);
        });

        it('should provide responsive search without excessive API calls', () => {
            expect(SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(100);
            expect(SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(500);
        });
    });

    describe('DEFAULT_ZOOM', () => {
        it('should have US zoom level of 4', () => {
            expect(DEFAULT_ZOOM.US).toBe(4);
        });

        it('should have NZ zoom level of 10', () => {
            expect(DEFAULT_ZOOM.NZ).toBe(10);
        });

        it('should have higher zoom for NZ (smaller country)', () => {
            expect(DEFAULT_ZOOM.NZ).toBeGreaterThan(DEFAULT_ZOOM.US);
        });
    });

    describe('DRIVER_FOCUS_ZOOM', () => {
        it('should be 12', () => {
            expect(DRIVER_FOCUS_ZOOM).toBe(12);
        });

        it('should be higher than default overview zooms', () => {
            expect(DRIVER_FOCUS_ZOOM).toBeGreaterThan(DEFAULT_ZOOM.US);
            expect(DRIVER_FOCUS_ZOOM).toBeGreaterThan(DEFAULT_ZOOM.NZ);
        });
    });

    describe('OVERVIEW_ZOOM', () => {
        it('should have US overview zoom of 4', () => {
            expect(OVERVIEW_ZOOM.US).toBe(4);
        });

        it('should have NZ overview zoom of 7', () => {
            expect(OVERVIEW_ZOOM.NZ).toBe(7);
        });
    });

    describe('AVATAR_COLORS', () => {
        it('should have 10 colors', () => {
            expect(AVATAR_COLORS).toHaveLength(10);
        });

        it('should have all valid hex colors', () => {
            const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
            AVATAR_COLORS.forEach((color) => {
                expect(color).toMatch(hexColorRegex);
            });
        });

        it('should have unique colors', () => {
            const uniqueColors = new Set(AVATAR_COLORS);
            expect(uniqueColors.size).toBe(AVATAR_COLORS.length);
        });

        it('should include expected colors', () => {
            expect(AVATAR_COLORS).toContain('#3b82f6'); // blue
            expect(AVATAR_COLORS).toContain('#10b981'); // emerald
            expect(AVATAR_COLORS).toContain('#ef4444'); // red
        });
    });
});

describe('CourierMapPage Type Definitions', () => {
    describe('CourierMarker', () => {
        it('should accept valid courier marker data', () => {
            const marker: CourierMarker = {
                courierId: 123,
                marker: {},
                name: 'John Smith',
                lat: 40.7128,
                lng: -74.006,
            };

            expect(marker.courierId).toBe(123);
            expect(marker.name).toBe('John Smith');
            expect(marker.lat).toBe(40.7128);
            expect(marker.lng).toBe(-74.006);
        });
    });

    describe('RegionalBounds', () => {
        it('should accept valid bounds', () => {
            const bounds: RegionalBounds = {
                minLng: -125,
                maxLng: -65,
                minLat: 24,
                maxLat: 50,
            };

            expect(bounds.minLng).toBe(-125);
            expect(bounds.maxLng).toBe(-65);
            expect(bounds.minLat).toBe(24);
            expect(bounds.maxLat).toBe(50);
        });

        it('should require all four bounds', () => {
            const bounds: RegionalBounds = {
                minLng: 0,
                maxLng: 0,
                minLat: 0,
                maxLat: 0,
            };

            expect(bounds).toHaveProperty('minLng');
            expect(bounds).toHaveProperty('maxLng');
            expect(bounds).toHaveProperty('minLat');
            expect(bounds).toHaveProperty('maxLat');
        });
    });

    describe('CourierMapPageProps', () => {
        it('should accept valid props', () => {
            const props: CourierMapPageProps = {
                isUsCustomer: true,
                mapCenter: {lat: 39.8097343, lng: -98.5556199},
            };

            expect(props.isUsCustomer).toBe(true);
            expect(props.mapCenter.lat).toBe(39.8097343);
            expect(props.mapCenter.lng).toBe(-98.5556199);
        });

        it('should work with NZ customer', () => {
            const props: CourierMapPageProps = {
                isUsCustomer: false,
                mapCenter: {lat: -41.2865, lng: 174.7762},
            };

            expect(props.isUsCustomer).toBe(false);
        });
    });

    describe('MapControlsProps', () => {
        it('should accept valid props', () => {
            const props: MapControlsProps = {
                onFitAll: jest.fn(),
                onRefresh: jest.fn(),
                isLoading: false,
            };

            expect(props.onFitAll).toBeDefined();
            expect(props.onRefresh).toBeDefined();
            expect(props.isLoading).toBe(false);
        });

        it('should accept loading state', () => {
            const props: MapControlsProps = {
                onFitAll: jest.fn(),
                onRefresh: jest.fn(),
                isLoading: true,
            };

            expect(props.isLoading).toBe(true);
        });
    });

    describe('UseCourierMapReturn', () => {
        it('should have correct structure', () => {
            const returnValue: UseCourierMapReturn = {
                mapContainerRef: {current: null as HTMLDivElement | null},
                isInitialized: true,
                updateCouriers: jest.fn(),
                centerOnCourier: jest.fn(),
                returnToOverview: jest.fn(),
            };

            expect(returnValue).toHaveProperty('mapContainerRef');
            expect(returnValue).toHaveProperty('isInitialized');
            expect(returnValue).toHaveProperty('updateCouriers');
            expect(returnValue).toHaveProperty('centerOnCourier');
            expect(returnValue).toHaveProperty('returnToOverview');
        });
    });
});
