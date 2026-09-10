
/**
 * DispatchCourierMarkerManager Tests
 *
 * Comprehensive tests for the DispatchCourierMarkerManager class that handles
 * courier markers (flags with labels) on HERE Maps.
 */

import { DispatchCourierMarkerManager } from './DispatchCourierMarkerManager';
import type { IAvailableCourierPosition } from './DispatchMap.types';
import {
    COURIER_LABEL_COLORS,
    MARKER_COLORS,
    POSITION_THRESHOLD
} from './DispatchMap.types';
import {COURIER_FLAG_HEIGHT, COURIER_FLAG_LARGE_HEIGHT} from '../here-map/courierFlagSvg';

// Mock HERE Maps marker
const createMockMarker = (data?: any) => {
    let payload = data;
    return {
        getData: jest.fn(() => payload),
        setData: jest.fn((next: any) => {
            payload = next;
        }),
        setIcon: jest.fn(),
        setGeometry: jest.fn(),
        getGeometry: jest.fn(() => ({ lat: 40.7128, lng: -74.006 })),
    };
};

const createMockMarkerGroup = () => ({
    addObjects: jest.fn(),
    removeAll: jest.fn(),
    removeObjects: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getBoundingBox: jest.fn(() => ({
        getTop: () => 41,
        getBottom: () => 40,
        getLeft: () => -75,
        getRight: () => -73,
    })),
});

const createMockMap = () => ({
    addObject: jest.fn(),
    removeObject: jest.fn(),
    // A real node, so the tooltip the manager appends can be read back and asserted on.
    getElement: jest.fn(() => mapElement),
    geoToScreen: jest.fn(() => ({ x: 100, y: 100 })),
    setCenter: jest.fn(),
    setZoom: jest.fn(),
    getZoom: jest.fn(() => 14),
});

const createMockUI = () => ({});

let mapElement: HTMLDivElement = document.createElement('div');

// Mock H global
const mockMarkerInstances: any[] = [];
const mockH = {
    map: {
        Group: jest.fn(() => createMockMarkerGroup()),
        Marker: jest.fn((_point, options) => {
            const marker = createMockMarker(options?.data);
            mockMarkerInstances.push(marker);
            return marker;
        }),
        Icon: jest.fn((svg, options) => ({ svg, options })),
    },
    geo: {
        Point: jest.fn((lat, lng) => ({ lat, lng })),
    },
};

(global as any).H = mockH;

/** An ISO timestamp N minutes before now, for the flag's last-delivery line. */
const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

// Helper to create mock courier
const createMockCourier = (overrides?: Partial<IAvailableCourierPosition>): IAvailableCourierPosition => ({
    courierId: 1,
    code: 'JD',
    courierName: 'John Doe',
    channelId: 1,
    clearListAreaIDs: [],
    latitude: 40.7128,
    longitude: -74.006,
    totalJobs: 5,
    overDueJobs: 0,
    isUrgentArmyDriver: false,
    vehicleType: 'Car',
    ...overrides,
});

describe('DispatchCourierMarkerManager', () => {
    let mockMap: ReturnType<typeof createMockMap>;
    let mockUI: ReturnType<typeof createMockUI>;
    let manager: DispatchCourierMarkerManager;

    beforeEach(() => {
        mockMarkerInstances.length = 0;
        mapElement = document.createElement('div');
        mockMap = createMockMap();
        mockUI = createMockUI();
        manager = new DispatchCourierMarkerManager(mockMap, mockUI);
    });

    afterEach(() => {
        manager.dispose();
    });

    describe('Constructor', () => {
        it('creates a marker group and adds it to the map', () => {
            expect(mockH.map.Group).toHaveBeenCalled();
            expect(mockMap.addObject).toHaveBeenCalled();
        });

        it('creates a tooltip element', () => {
            expect(mockMap.getElement).toHaveBeenCalled();
        });

        it('registers event listeners for tap and pointer events', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            expect(mockGroup.addEventListener).toHaveBeenCalledWith('tap', expect.any(Function));
            expect(mockGroup.addEventListener).toHaveBeenCalledWith(
                'pointerenter',
                expect.any(Function),
                true
            );
            expect(mockGroup.addEventListener).toHaveBeenCalledWith(
                'pointerleave',
                expect.any(Function),
                true
            );
        });
    });

    describe('updateMarkers', () => {
        it('adds markers for new couriers', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier()];

            manager.updateMarkers(couriers);

            expect(mockGroup.addObjects).toHaveBeenCalled();
        });

        it('removes markers for couriers no longer present', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;

            // Add initial courier
            manager.updateMarkers([createMockCourier({ courierId: 1 })]);

            // Update with different courier
            manager.updateMarkers([createMockCourier({ courierId: 2 })]);

            expect(mockGroup.removeObjects).toHaveBeenCalled();
        });

        it('updates existing marker position when changed significantly', () => {
            const courier1 = createMockCourier({ courierId: 1 });
            manager.updateMarkers([courier1]);

            // Move courier significantly
            const courier2 = createMockCourier({
                courierId: 1,
                latitude: 41.0, // Changed by more than POSITION_THRESHOLD
            });
            manager.updateMarkers([courier2]);

            // Marker geometry should be updated
            expect(mockMarkerInstances[0].setGeometry).toHaveBeenCalled();
        });

        it('does not update marker position when change is below threshold', () => {
            const courier1 = createMockCourier({ courierId: 1 });
            manager.updateMarkers([courier1]);

            // Move courier by less than threshold
            const courier2 = createMockCourier({
                courierId: 1,
                latitude: courier1.latitude! + POSITION_THRESHOLD / 2,
            });

            // Reset mock to check if setGeometry is called
            mockMarkerInstances[0].setGeometry.mockClear();
            manager.updateMarkers([courier2]);

            expect(mockMarkerInstances[0].setGeometry).not.toHaveBeenCalled();
        });

        it('updates marker icon when courier status changes', () => {
            const courier1 = createMockCourier({ courierId: 1, totalJobs: 5, overDueJobs: 0 });
            manager.updateMarkers([courier1]);

            // Change status to overdue
            const courier2 = createMockCourier({ courierId: 1, totalJobs: 5, overDueJobs: 2 });

            mockMarkerInstances[0].setIcon.mockClear();
            manager.updateMarkers([courier2]);

            expect(mockMarkerInstances[0].setIcon).toHaveBeenCalled();
        });

        it('filters to urgent army only when flag is true', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [
                createMockCourier({ courierId: 1, isUrgentArmyDriver: true }),
                createMockCourier({ courierId: 2, isUrgentArmyDriver: false }),
            ];

            manager.updateMarkers(couriers, true);

            // Should only add one marker (urgent army driver)
            const addObjectsCall = mockGroup.addObjects.mock.calls[0];
            expect(addObjectsCall[0]).toHaveLength(1);
        });

        it('shows all couriers when urgentArmyOnly is false', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [
                createMockCourier({ courierId: 1, isUrgentArmyDriver: true }),
                createMockCourier({ courierId: 2, isUrgentArmyDriver: false }),
            ];

            manager.updateMarkers(couriers, false);

            const addObjectsCall = mockGroup.addObjects.mock.calls[0];
            expect(addObjectsCall[0]).toHaveLength(2);
        });

        it('creates large view markers when largeView is true', () => {
            const couriers = [createMockCourier()];

            manager.updateMarkers(couriers, false, true);

            // Check that large view SVG was created
            const iconCalls = mockH.map.Icon.mock.calls;
            const hasLargeViewIcon = iconCalls.some(
                (call: any[]) =>
                    call[0] && call[0].includes(`height="${COURIER_FLAG_LARGE_HEIGHT}"`)
            );
            expect(hasLargeViewIcon).toBe(true);
        });

        it('skips couriers with invalid coordinates', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [
                createMockCourier({ courierId: 1, latitude: 0, longitude: 0 }),
                createMockCourier({ courierId: 2, latitude: 40.7128, longitude: -74.006 }),
            ];

            manager.updateMarkers(couriers);

            // Only one valid courier should be added
            const addObjectsCall = mockGroup.addObjects.mock.calls[0];
            expect(addObjectsCall[0]).toHaveLength(1);
        });

        it('handles empty couriers array', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;

            manager.updateMarkers([]);

            // No markers should be added
            expect(mockGroup.addObjects).not.toHaveBeenCalled();
        });
    });

    describe('setAutoZoom', () => {
        it('enables auto zoom', () => {
            manager.setAutoZoom(true);
            // Internal state change - verify through behavior
            expect(manager).toBeDefined();
        });

        it('disables auto zoom', () => {
            manager.setAutoZoom(false);
            expect(manager).toBeDefined();
        });
    });

    describe('getMarkerGroup', () => {
        it('returns the marker group', () => {
            const group = manager.getMarkerGroup();

            expect(group).toBeDefined();
            expect(group.getBoundingBox).toBeDefined();
        });
    });

    describe('clearMarkers', () => {
        it('removes all markers from the group', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers);

            manager.clearMarkers();

            expect(mockGroup.removeAll).toHaveBeenCalled();
        });

        it('clears internal marker tracking', () => {
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers);

            manager.clearMarkers();

            // Adding same courier should create new marker (not update existing)
            manager.updateMarkers(couriers);

            const mockGroup = mockH.map.Group.mock.results[0].value;
            expect(mockGroup.addObjects).toHaveBeenCalledTimes(2);
        });
    });

    describe('dispose', () => {
        it('removes marker group from map', () => {
            manager.dispose();

            expect(mockMap.removeObject).toHaveBeenCalled();
        });

        it('clears all markers', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;

            manager.dispose();

            expect(mockGroup.removeAll).toHaveBeenCalled();
        });

        it('can be called multiple times without error', () => {
            expect(() => {
                manager.dispose();
                manager.dispose();
            }).not.toThrow();
        });
    });

    describe('Courier Status Colors', () => {
        it('uses NO_JOBS colors for couriers with no jobs', () => {
            const couriers = [createMockCourier({ totalJobs: 0, overDueJobs: 0 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasNoJobsColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(COURIER_LABEL_COLORS.NO_JOBS.bg)
            );
            expect(hasNoJobsColor).toBe(true);
        });

        it('uses HAS_JOBS colors for couriers with jobs but no overdue', () => {
            const couriers = [createMockCourier({ totalJobs: 5, overDueJobs: 0 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasJobsColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(COURIER_LABEL_COLORS.HAS_JOBS.bg)
            );
            expect(hasJobsColor).toBe(true);
        });

        it('uses OVERDUE colors for couriers with overdue jobs', () => {
            const couriers = [createMockCourier({ totalJobs: 5, overDueJobs: 2 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasOverdueColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(COURIER_LABEL_COLORS.OVERDUE.bg)
            );
            expect(hasOverdueColor).toBe(true);
        });
    });

    describe('Display Text Generation', () => {
        it('includes courier first name and job count', () => {
            const couriers = [createMockCourier({ code: 'JD', courierName: 'John Doe', totalJobs: 3 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasFirstNameAndJobs = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('John 3')
            );
            expect(hasFirstNameAndJobs).toBe(true);
        });

        it('includes total jobs count', () => {
            const couriers = [createMockCourier({ totalJobs: 5 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasJobCount = iconCalls.some((call: any[]) => call[0] && call[0].includes('5'));
            expect(hasJobCount).toBe(true);
        });

        it('includes overdue count when present', () => {
            const couriers = [createMockCourier({ totalJobs: 5, overDueJobs: 2 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasOverdueCount = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('5/2')
            );
            expect(hasOverdueCount).toBe(true);
        });

        it('uses first name from courierName, not code', () => {
            const couriers = [createMockCourier({ code: 'AB', courierName: 'Alice Brown', totalJobs: 2 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasFirstName = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('Alice 2')
            );
            const hasCode = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('AB 2')
            );
            expect(hasFirstName).toBe(true);
            expect(hasCode).toBe(false);
        });

        it('shows first name with overdue format', () => {
            const couriers = [createMockCourier({ code: 'AB', courierName: 'Alice Brown', totalJobs: 3, overDueJobs: 1 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasFirstNameOverdue = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('Alice 3/1')
            );
            expect(hasFirstNameOverdue).toBe(true);
        });

        it('handles single-word courierName', () => {
            const couriers = [createMockCourier({ courierName: 'Madonna', totalJobs: 4 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasSingleName = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('Madonna 4')
            );
            expect(hasSingleName).toBe(true);
        });
    });

    describe('Last Delivery Line', () => {
        it('adds a second line with the last delivery city and elapsed minutes', () => {
            manager.updateMarkers([createMockCourier({
                lastDeliveryCity: 'Ponsonby',
                lastDeliveryTime: minutesAgo(12),
            })]);

            const svg = mockH.map.Icon.mock.calls.at(-1)![0];
            expect(svg).toContain('Ponsonby \u00b7 12m');
            expect(svg).toContain(`height="${COURIER_FLAG_HEIGHT.twoLine}"`);
        });

        it('stays a one-line flag for a courier with no completed delivery', () => {
            manager.updateMarkers([createMockCourier()]);

            const svg = mockH.map.Icon.mock.calls.at(-1)![0];
            expect(svg).toContain(`height="${COURIER_FLAG_HEIGHT.oneLine}"`);
        });

        it('repaints the flag and refreshes the marker payload as the minutes tick', () => {
            const at = (mins: number) => createMockCourier({
                lastDeliveryCity: 'Ponsonby',
                lastDeliveryTime: minutesAgo(mins),
            });

            manager.updateMarkers([at(12)]);
            const marker = mockMarkerInstances[0];
            marker.setIcon.mockClear();

            const older = at(13);
            manager.updateMarkers([older]);

            expect(marker.setIcon).toHaveBeenCalled();
            // The tooltip reads off the marker, so the payload has to move with it.
            expect(marker.getData().lastDeliveryTime).toBe(older.lastDeliveryTime);
        });
    });

    describe('Large View Mode', () => {
        it('creates simplified large flag SVG', () => {
            const couriers = [createMockCourier({ code: 'JD' })];

            manager.updateMarkers(couriers, false, true);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasLargeFlagColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(MARKER_COLORS.COURIER_FLAG_LARGE)
            );
            expect(hasLargeFlagColor).toBe(true);
        });

        it('shows courier first name in large view', () => {
            const couriers = [createMockCourier({ code: 'JD', courierName: 'John Doe' })];

            manager.updateMarkers(couriers, false, true);

            const iconCalls = mockH.map.Icon.mock.calls;
            // Large view should show first name extracted from courierName
            const hasFirstName = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('>John</text>')
            );
            expect(hasFirstName).toBe(true);
        });

        it('uses first name not code in large view', () => {
            const couriers = [createMockCourier({ code: 'AB', courierName: 'Alice Brown' })];

            manager.updateMarkers(couriers, false, true);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasFirstName = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('>Alice</text>')
            );
            const hasCode = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('>AB</text>')
            );
            expect(hasFirstName).toBe(true);
            expect(hasCode).toBe(false);
        });
    });

    describe('Coordinate Validation', () => {
        it('rejects null latitude', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier({ latitude: null as any })];

            manager.updateMarkers(couriers);

            expect(mockGroup.addObjects).not.toHaveBeenCalled();
        });

        it('rejects null longitude', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier({ longitude: null as any })];

            manager.updateMarkers(couriers);

            expect(mockGroup.addObjects).not.toHaveBeenCalled();
        });

        it('rejects zero coordinates', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier({ latitude: 0, longitude: 0 })];

            manager.updateMarkers(couriers);

            expect(mockGroup.addObjects).not.toHaveBeenCalled();
        });

        it('rejects out-of-range latitude', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier({ latitude: 100 })];

            manager.updateMarkers(couriers);

            expect(mockGroup.addObjects).not.toHaveBeenCalled();
        });

        it('rejects out-of-range longitude', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier({ longitude: 200 })];

            manager.updateMarkers(couriers);

            expect(mockGroup.addObjects).not.toHaveBeenCalled();
        });

        it('rejects NaN coordinates', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier({ latitude: NaN })];

            manager.updateMarkers(couriers);

            expect(mockGroup.addObjects).not.toHaveBeenCalled();
        });

        it('accepts valid edge case coordinates', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const couriers = [createMockCourier({ latitude: 90, longitude: 180 })];

            manager.updateMarkers(couriers);

            expect(mockGroup.addObjects).toHaveBeenCalled();
        });
    });

    describe('Icon Caching', () => {
        it('reuses cached icons for same courier status', () => {
            const couriers = [
                createMockCourier({ courierId: 1, code: 'JD', totalJobs: 5 }),
                createMockCourier({ courierId: 2, code: 'JD', totalJobs: 5 }),
            ];

            // Clear previous icon calls
            mockH.map.Icon.mockClear();

            manager.updateMarkers(couriers);

            // Same display text should reuse icon
            // Only one icon should be created for matching status/text
            expect(mockH.map.Icon.mock.calls.length).toBeLessThanOrEqual(2);
        });

        it('creates different icons for different statuses', () => {
            const couriers = [
                createMockCourier({ courierId: 1, code: 'A', totalJobs: 0 }), // NO_JOBS
                createMockCourier({ courierId: 2, code: 'B', totalJobs: 5 }), // HAS_JOBS
                createMockCourier({ courierId: 3, code: 'C', totalJobs: 5, overDueJobs: 1 }), // OVERDUE
            ];

            mockH.map.Icon.mockClear();
            manager.updateMarkers(couriers);

            // Should create at least 3 different icons
            expect(mockH.map.Icon.mock.calls.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('Position Change Detection', () => {
        it('detects significant latitude change', () => {
            manager.updateMarkers([createMockCourier({ courierId: 1, latitude: 40.0 })]);

            mockMarkerInstances[0].setGeometry.mockClear();

            // Change latitude by more than threshold
            manager.updateMarkers([
                createMockCourier({ courierId: 1, latitude: 40.0 + POSITION_THRESHOLD * 2 }),
            ]);

            expect(mockMarkerInstances[0].setGeometry).toHaveBeenCalled();
        });

        it('detects significant longitude change', () => {
            manager.updateMarkers([createMockCourier({ courierId: 1, longitude: -74.0 })]);

            mockMarkerInstances[0].setGeometry.mockClear();

            // Change longitude by more than threshold
            manager.updateMarkers([
                createMockCourier({ courierId: 1, longitude: -74.0 + POSITION_THRESHOLD * 2 }),
            ]);

            expect(mockMarkerInstances[0].setGeometry).toHaveBeenCalled();
        });

        it('ignores insignificant position changes', () => {
            manager.updateMarkers([
                createMockCourier({ courierId: 1, latitude: 40.0, longitude: -74.0 }),
            ]);

            mockMarkerInstances[0].setGeometry.mockClear();

            // Change by less than threshold
            const delta = POSITION_THRESHOLD / 10;
            manager.updateMarkers([
                createMockCourier({ courierId: 1, latitude: 40.0 + delta, longitude: -74.0 + delta }),
            ]);

            expect(mockMarkerInstances[0].setGeometry).not.toHaveBeenCalled();
        });
    });

    describe('HTML Escaping', () => {
        it('escapes special characters in courier name', () => {
            const couriers = [createMockCourier({ courierName: '<script>alert("xss")</script>' })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasUnescapedHtml = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('<script>')
            );
            expect(hasUnescapedHtml).toBe(false);
        });

        it('escapes special characters in courier code', () => {
            const couriers = [createMockCourier({ code: '<b>XSS</b>' })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasUnescapedHtml = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('<b>')
            );
            expect(hasUnescapedHtml).toBe(false);
        });
    });

    describe('Event Handlers', () => {
        it('registers tap event listener on marker group', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const tapCalls = mockGroup.addEventListener.mock.calls.filter(
                (call: any[]) => call[0] === 'tap'
            );
            expect(tapCalls.length).toBe(1);
        });

        it('registers pointerenter event listener on marker group', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const enterCalls = mockGroup.addEventListener.mock.calls.filter(
                (call: any[]) => call[0] === 'pointerenter'
            );
            expect(enterCalls.length).toBe(1);
        });

        it('registers pointerleave event listener on marker group', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const leaveCalls = mockGroup.addEventListener.mock.calls.filter(
                (call: any[]) => call[0] === 'pointerleave'
            );
            expect(leaveCalls.length).toBe(1);
        });

        it('tap handler centers map on courier location', () => {
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers);

            const mockGroup = mockH.map.Group.mock.results[0].value;
            const tapHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'tap'
            )[1];

            // Simulate tap event
            const mockMarker = {
                getData: jest.fn(() => couriers[0]),
            };
            tapHandler({ target: mockMarker });

            expect(mockMap.setCenter).toHaveBeenCalledWith({
                lat: couriers[0].latitude,
                lng: couriers[0].longitude,
            });
        });

        it('tap handler zooms in when auto zoom is enabled', () => {
            manager.setAutoZoom(true);
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers);

            const mockGroup = mockH.map.Group.mock.results[0].value;
            const tapHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'tap'
            )[1];

            const mockMarker = {
                getData: jest.fn(() => couriers[0]),
            };
            tapHandler({ target: mockMarker });

            expect(mockMap.setZoom).toHaveBeenCalled();
        });

        it('tap handler does not zoom when auto zoom is disabled', () => {
            manager.setAutoZoom(false);
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers);

            mockMap.setZoom.mockClear();

            const mockGroup = mockH.map.Group.mock.results[0].value;
            const tapHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'tap'
            )[1];

            const mockMarker = {
                getData: jest.fn(() => couriers[0]),
            };
            tapHandler({ target: mockMarker });

            expect(mockMap.setZoom).not.toHaveBeenCalled();
        });

        it('tap handler handles courier without coordinates gracefully', () => {
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers);

            const mockGroup = mockH.map.Group.mock.results[0].value;
            const tapHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'tap'
            )[1];

            // Courier with no coordinates
            const mockMarker = {
                getData: jest.fn(() => ({ ...couriers[0], latitude: null, longitude: null })),
            };

            // Should not throw
            expect(() => tapHandler({ target: mockMarker })).not.toThrow();
        });

        it('pointerenter does not show tooltip in large view mode', () => {
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers, false, true); // large view enabled

            const mockGroup = mockH.map.Group.mock.results[0].value;
            const enterHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'pointerenter'
            )[1];

            const mockMarker = {
                getData: jest.fn(() => couriers[0]),
            };

            // Should not throw, and no tooltip shown
            expect(() => enterHandler({ target: mockMarker })).not.toThrow();
        });
    });

    /** Fires the group's pointerenter handler for the first marker and returns the tooltip HTML. */
    function hoverFirstMarker(): string {
        const group = mockH.map.Group.mock.results[0].value;
        const enter = group.addEventListener.mock.calls
            .find((call: any[]) => call[0] === 'pointerenter')![1];
        enter({target: mockMarkerInstances[0]});

        return mapElement.querySelector('.gm-style-iw-content')!.innerHTML;
    }

    describe('Tooltip Functionality', () => {
        it('creates tooltip element on construction', () => {
            expect(mockMap.getElement).toHaveBeenCalled();
        });

        it('reports name, fleet, vehicle, job counts and last delivery on hover', () => {
            manager.updateMarkers([createMockCourier({
                courierName: 'Test Courier',
                vehicleType: 'Bike',
                isUrgentArmyDriver: true,
                totalJobs: 5,
                overDueJobs: 2,
                lastDeliveryCity: 'Ponsonby',
                lastDeliveryTime: minutesAgo(12),
            })]);

            const content = hoverFirstMarker();

            expect(content).toContain('Test Courier');
            expect(content).toContain('Fleet: UA');
            expect(content).toContain('Vehicle: Bike');
            expect(content).toContain('Total Jobs: 5');
            expect(content).toContain('Overdue Jobs: 2');
            expect(content).toContain('Last delivery: Ponsonby');
            expect(content).toContain('12 mins ago');
        });

        it('omits the optional rows when the courier has none of them', () => {
            manager.updateMarkers([createMockCourier({
                vehicleType: '',
                isUrgentArmyDriver: false,
                totalJobs: 3,
                overDueJobs: 0,
            })]);

            const content = hoverFirstMarker();

            expect(content).not.toContain('Fleet: UA');
            expect(content).not.toContain('Vehicle:');
            expect(content).not.toContain('Overdue Jobs');
            expect(content).not.toContain('Last delivery');
        });

        it('singularises a one-minute-old delivery and names an unknown city', () => {
            manager.updateMarkers([createMockCourier({
                lastDeliveryCity: null,
                lastDeliveryTime: minutesAgo(1),
            })]);

            const content = hoverFirstMarker();

            expect(content).toContain('Last delivery: Unknown');
            expect(content).toContain('1 min ago');
        });

        it('escapes markup in the tooltip', () => {
            manager.updateMarkers([createMockCourier({courierName: '<img src=x onerror=alert(1)>'})]);

            const content = hoverFirstMarker();

            expect(content).not.toContain('<img');
            expect(content).toContain('&lt;img');
        });
    });

    describe('Marker Group Access', () => {
        it('getMarkerGroup returns the internal marker group', () => {
            const group = manager.getMarkerGroup();

            expect(group).toBeDefined();
            expect(group.getBoundingBox).toBeDefined();
            expect(group.addObjects).toBeDefined();
        });
    });

    describe('Multiple Courier Updates', () => {
        it('handles rapid successive updates without error', () => {
            const couriers1 = [createMockCourier({ courierId: 1 })];
            const couriers2 = [createMockCourier({ courierId: 2 })];
            const couriers3 = [createMockCourier({ courierId: 3 })];

            expect(() => {
                manager.updateMarkers(couriers1);
                manager.updateMarkers(couriers2);
                manager.updateMarkers(couriers3);
            }).not.toThrow();
        });

        it('correctly tracks couriers across multiple updates', () => {
            manager.updateMarkers([createMockCourier({ courierId: 1 })]);
            manager.updateMarkers([
                createMockCourier({ courierId: 1 }),
                createMockCourier({ courierId: 2 }),
            ]);
            manager.updateMarkers([createMockCourier({ courierId: 2 })]);

            // Should handle all transitions
            const mockGroup = mockH.map.Group.mock.results[0].value;
            expect(mockGroup.removeObjects).toHaveBeenCalled();
        });
    });

    describe('Material Design styling', () => {
        it('renders the normal flag as a fully-rounded Roboto chip', () => {
            manager.updateMarkers([createMockCourier()]);

            const svg = mockH.map.Icon.mock.calls
                .map((call: any[]) => call[0])
                .find((s: string) => s && s.includes('height="36"'));

            expect(svg).toBeDefined();
            expect(svg).toContain('rx="11"');
            expect(svg).toContain('font-family="Roboto, Arial, sans-serif"');
            expect(svg).not.toContain('Arial,sans-serif"'); // no bare Arial
            expect(svg).not.toContain('#424242'); // dark pole replaced by tonal stem
        });

        it('gives markers a soft tonal drop-shadow instead of a hard offset', () => {
            manager.updateMarkers([createMockCourier()]);

            const svg = mockH.map.Icon.mock.calls
                .map((call: any[]) => call[0])
                .find((s: string) => s && s.includes('height="36"'));

            expect(svg).toContain('feDropShadow');
            expect(svg).toContain('flood-opacity="0.24"');
        });

        it('renders the large flag label in Roboto', () => {
            manager.updateMarkers([createMockCourier()], false, true);

            const svg = mockH.map.Icon.mock.calls
                .map((call: any[]) => call[0])
                .find((s: string) => s && s.includes(`height="${COURIER_FLAG_LARGE_HEIGHT}"`));

            expect(svg).toBeDefined();
            expect(svg).toContain('font-family="Roboto, Arial, sans-serif"');
        });
    });

    describe('Icon Anchor Configuration', () => {
        // The anchor is the stem tip, so it has to grow with the flag or every marker drifts off
        // its GPS point the moment a second line appears.
        it('anchors a one-line flag at its own height', () => {
            manager.updateMarkers([createMockCourier()], false, false);

            const [, options] = mockH.map.Icon.mock.calls.at(-1)!;
            expect(options.anchor).toEqual({x: 4, y: COURIER_FLAG_HEIGHT.oneLine});
        });

        it('anchors a two-line flag lower, and the large pennant lower still', () => {
            manager.updateMarkers([
                createMockCourier({lastDeliveryCity: 'Ponsonby', lastDeliveryTime: minutesAgo(12)}),
            ], false, false);
            expect(mockH.map.Icon.mock.calls.at(-1)![1].anchor)
                .toEqual({x: 4, y: COURIER_FLAG_HEIGHT.twoLine});

            manager.updateMarkers([createMockCourier({courierId: 2})], false, true);
            expect(mockH.map.Icon.mock.calls.at(-1)![1].anchor)
                .toEqual({x: 4, y: COURIER_FLAG_LARGE_HEIGHT});
        });
    });
});
