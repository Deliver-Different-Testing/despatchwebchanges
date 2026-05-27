/** @jest-environment node */
/**
 * DispatchMap Types and Constants Tests
 *
 * Tests for the type definitions and constants used by the DispatchMap component.
 */

import type {ClearListEnvelopeData, CourierMarkerData, JobMarkerData, MapControlState} from './DispatchMap.types';
import {
    COURIER_LABEL_COLORS,
    COURIER_REFRESH_INTERVAL_MS,
    DEFAULT_MAP_ZOOM,
    FLAG_MARKER_PATH,
    ICON_CACHE_LIMIT,
    MARKER_BATCH_SIZE,
    MARKER_COLORS,
    MARKER_PIN_PATH,
    MAX_AUTO_ZOOM,
    MAX_JOBS_TO_DISPLAY,
    POSITION_THRESHOLD,
    PREFERENCE_KEYS,
} from './DispatchMap.types';

describe('DispatchMap Constants', () => {
    describe('COURIER_REFRESH_INTERVAL_MS', () => {
        it('should be 15 seconds (15000ms)', () => {
            expect(COURIER_REFRESH_INTERVAL_MS).toBe(15000);
        });

        it('should be a positive number', () => {
            expect(COURIER_REFRESH_INTERVAL_MS).toBeGreaterThan(0);
        });
    });

    describe('MAX_JOBS_TO_DISPLAY', () => {
        it('should be 1000', () => {
            expect(MAX_JOBS_TO_DISPLAY).toBe(1000);
        });

        it('should be a reasonable limit for performance', () => {
            expect(MAX_JOBS_TO_DISPLAY).toBeGreaterThanOrEqual(100);
            expect(MAX_JOBS_TO_DISPLAY).toBeLessThanOrEqual(10000);
        });
    });

    describe('MARKER_BATCH_SIZE', () => {
        it('should be 200', () => {
            expect(MARKER_BATCH_SIZE).toBe(200);
        });

        it('should be less than MAX_JOBS_TO_DISPLAY', () => {
            expect(MARKER_BATCH_SIZE).toBeLessThan(MAX_JOBS_TO_DISPLAY);
        });
    });

    describe('DEFAULT_MAP_ZOOM', () => {
        it('should be 12', () => {
            expect(DEFAULT_MAP_ZOOM).toBe(12);
        });

        it('should be within valid zoom range (1-20)', () => {
            expect(DEFAULT_MAP_ZOOM).toBeGreaterThanOrEqual(1);
            expect(DEFAULT_MAP_ZOOM).toBeLessThanOrEqual(20);
        });
    });

    describe('MAX_AUTO_ZOOM', () => {
        it('should be 16', () => {
            expect(MAX_AUTO_ZOOM).toBe(16);
        });

        it('should be greater than or equal to DEFAULT_MAP_ZOOM', () => {
            expect(MAX_AUTO_ZOOM).toBeGreaterThanOrEqual(DEFAULT_MAP_ZOOM);
        });
    });

    describe('MARKER_COLORS', () => {
        it('should have PICKUP color', () => {
            expect(MARKER_COLORS.PICKUP).toBe('#4CAF50');
        });

        it('should have DELIVERY color', () => {
            expect(MARKER_COLORS.DELIVERY).toBe('#F44336');
        });

        it('should have OTHER_PICKUP color', () => {
            expect(MARKER_COLORS.OTHER_PICKUP).toBe('#3F51B5');
        });

        it('should have OTHER_DELIVERY color', () => {
            expect(MARKER_COLORS.OTHER_DELIVERY).toBe('#FF5722');
        });

        it('should have COURIER_FLAG color', () => {
            expect(MARKER_COLORS.COURIER_FLAG).toBe('#1E88E5');
        });

        it('should have COURIER_FLAG_LARGE color', () => {
            expect(MARKER_COLORS.COURIER_FLAG_LARGE).toBe('#1565C0');
        });

        it('should have all colors as valid hex codes', () => {
            const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
            Object.values(MARKER_COLORS).forEach((color) => {
                expect(color).toMatch(hexColorRegex);
            });
        });
    });

    describe('COURIER_LABEL_COLORS', () => {
        it('should have NO_JOBS colors', () => {
            expect(COURIER_LABEL_COLORS.NO_JOBS).toEqual({
                bg: '#E3F2FD',
                text: '#1565C0',
                border: '#1976D2',
            });
        });

        it('should have HAS_JOBS colors', () => {
            expect(COURIER_LABEL_COLORS.HAS_JOBS).toEqual({
                bg: '#E8F5E9',
                text: '#2E7D32',
                border: '#388E3C',
            });
        });

        it('should have OVERDUE colors', () => {
            expect(COURIER_LABEL_COLORS.OVERDUE).toEqual({
                bg: '#D32F2F',
                text: '#FFFFFF',
                border: '#B71C1C',
            });
        });

        it('should have contrasting text colors for readability', () => {
            // White text on red background
            expect(COURIER_LABEL_COLORS.OVERDUE.text).toBe('#FFFFFF');
            // Dark text on light backgrounds
            expect(COURIER_LABEL_COLORS.NO_JOBS.text).toBe('#1565C0');
            expect(COURIER_LABEL_COLORS.HAS_JOBS.text).toBe('#2E7D32');
        });
    });

    describe('PREFERENCE_KEYS', () => {
        it('should have AUTO_ZOOM key', () => {
            expect(PREFERENCE_KEYS.AUTO_ZOOM).toBe('mapZoom');
        });

        it('should have COURIERS_ONLY key', () => {
            expect(PREFERENCE_KEYS.COURIERS_ONLY).toBe('mapCouriersOnly');
        });

        it('should have URGENT_ARMY_ONLY key', () => {
            expect(PREFERENCE_KEYS.URGENT_ARMY_ONLY).toBe('mapUrgentArmyOnly');
        });

        it('should have COURIERS_LARGE_VIEW key', () => {
            expect(PREFERENCE_KEYS.COURIERS_LARGE_VIEW).toBe('mapCouriersLargeView');
        });

        it('should have unique keys', () => {
            const keys = Object.values(PREFERENCE_KEYS);
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keys.length);
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

    describe('POSITION_THRESHOLD', () => {
        it('should be 0.0001 degrees', () => {
            expect(POSITION_THRESHOLD).toBe(0.0001);
        });

        it('should be a small value for position comparison', () => {
            expect(POSITION_THRESHOLD).toBeGreaterThan(0);
            expect(POSITION_THRESHOLD).toBeLessThan(0.01);
        });
    });

    describe('MARKER_PIN_PATH', () => {
        it('should be a valid SVG path', () => {
            expect(MARKER_PIN_PATH).toContain('M');
            expect(MARKER_PIN_PATH).toContain('C');
        });

        it('should describe a pin shape', () => {
            expect(MARKER_PIN_PATH).toBe(
                'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'
            );
        });
    });

    describe('FLAG_MARKER_PATH', () => {
        it('should be a valid SVG path', () => {
            expect(FLAG_MARKER_PATH).toContain('M');
            expect(FLAG_MARKER_PATH).toContain('L');
        });

        it('should describe a flag shape', () => {
            expect(FLAG_MARKER_PATH).toBe('M2,2 L2,24 L6,24 L6,20 L6,12 L30,12 L26,7 L30,2 Z');
        });
    });
});

describe('DispatchMap Type Definitions', () => {
    describe('ClearListEnvelopeData', () => {
        it('should accept valid envelope data', () => {
            const envelope: ClearListEnvelopeData = {
                minimumLatitude: 33.5,
                maximumLatitude: 34.5,
                minimumLongitude: -118.5,
                maximumLongitude: -117.5,
            };

            expect(envelope.minimumLatitude).toBe(33.5);
            expect(envelope.maximumLatitude).toBe(34.5);
            expect(envelope.minimumLongitude).toBe(-118.5);
            expect(envelope.maximumLongitude).toBe(-117.5);
        });

        it('should require all four coordinate bounds', () => {
            const envelope: ClearListEnvelopeData = {
                minimumLatitude: 0,
                maximumLatitude: 0,
                minimumLongitude: 0,
                maximumLongitude: 0,
            };

            expect(envelope).toHaveProperty('minimumLatitude');
            expect(envelope).toHaveProperty('maximumLatitude');
            expect(envelope).toHaveProperty('minimumLongitude');
            expect(envelope).toHaveProperty('maximumLongitude');
        });
    });

    describe('MapControlState', () => {
        it('should accept valid control state', () => {
            const state: MapControlState = {
                autoZoomEnabled: true,
                couriersOnlyEnabled: false,
                urgentArmyOnlyEnabled: false,
                couriersLargeViewEnabled: false,
            };

            expect(state.autoZoomEnabled).toBe(true);
            expect(state.couriersOnlyEnabled).toBe(false);
            expect(state.urgentArmyOnlyEnabled).toBe(false);
            expect(state.couriersLargeViewEnabled).toBe(false);
        });

        it('should have all boolean properties', () => {
            const state: MapControlState = {
                autoZoomEnabled: true,
                couriersOnlyEnabled: true,
                urgentArmyOnlyEnabled: true,
                couriersLargeViewEnabled: true,
            };

            expect(typeof state.autoZoomEnabled).toBe('boolean');
            expect(typeof state.couriersOnlyEnabled).toBe('boolean');
            expect(typeof state.urgentArmyOnlyEnabled).toBe('boolean');
            expect(typeof state.couriersLargeViewEnabled).toBe('boolean');
        });
    });

    describe('JobMarkerData', () => {
        it('should accept valid job marker data', () => {
            const markerData: JobMarkerData = {
                marker: {},
                jobId: 123,
                type: 'pickup',
                isCurrentJob: true,
            };

            expect(markerData.jobId).toBe(123);
            expect(markerData.type).toBe('pickup');
            expect(markerData.isCurrentJob).toBe(true);
        });

        it('should accept delivery type', () => {
            const markerData: JobMarkerData = {
                marker: {},
                jobId: 456,
                type: 'delivery',
                isCurrentJob: false,
            };

            expect(markerData.type).toBe('delivery');
        });
    });

    describe('CourierMarkerData', () => {
        it('should accept valid courier marker data', () => {
            const markerData: CourierMarkerData = {
                marker: {},
                courierId: 789,
                lat: 40.7128,
                lng: -74.006,
                name: 'John Smith',
            };

            expect(markerData.courierId).toBe(789);
            expect(markerData.lat).toBe(40.7128);
            expect(markerData.lng).toBe(-74.006);
            expect(markerData.name).toBe('John Smith');
        });
    });
});
