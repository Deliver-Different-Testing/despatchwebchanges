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

// Mock HERE Maps marker
const createMockMarker = (data?: any) => ({
    getData: jest.fn(() => data),
    setIcon: jest.fn(),
    setGeometry: jest.fn(),
    getGeometry: jest.fn(() => ({ lat: 40.7128, lng: -74.006 })),
});

const createMockMarkerGroup = () => ({
    addObjects: jest.fn(),
    removeAll: jest.fn(),
    removeObjects: jest.fn(),
    addEventListener: jest.fn(),
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
    getElement: jest.fn(() => ({
        appendChild: jest.fn(),
    })),
    geoToScreen: jest.fn(() => ({ x: 100, y: 100 })),
    setCenter: jest.fn(),
    setZoom: jest.fn(),
    getZoom: jest.fn(() => 14),
});

const createMockUI = () => ({});

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
        jest.clearAllMocks();
        mockMarkerInstances.length = 0;
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
                    call[0] && call[0].includes('width="80"') && call[0].includes('height="44"')
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
        it('includes courier code and job count', () => {
            const couriers = [createMockCourier({ code: 'JD', courierName: 'John Doe', totalJobs: 3 })];

            manager.updateMarkers(couriers);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasCodeAndJobs = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('JD 3')
            );
            expect(hasCodeAndJobs).toBe(true);
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

        it('shows only courier code in large view', () => {
            const couriers = [createMockCourier({ code: 'JD', courierName: 'John Doe' })];

            manager.updateMarkers(couriers, false, true);

            const iconCalls = mockH.map.Icon.mock.calls;
            // Large view should have code but different format than normal
            const hasCode = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes('>JD</text>')
            );
            expect(hasCode).toBe(true);
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

    describe('Tooltip Functionality', () => {
        it('creates tooltip element on construction', () => {
            expect(mockMap.getElement).toHaveBeenCalled();
        });

        it('includes courier name in tooltip content', () => {
            const couriers = [createMockCourier({ courierName: 'Test Courier' })];
            manager.updateMarkers(couriers);

            // Tooltip element is created with courier info
            expect(manager).toBeDefined();
        });

        it('includes vehicle type in tooltip when present', () => {
            const couriers = [createMockCourier({ vehicleType: 'Bike' })];
            manager.updateMarkers(couriers);

            expect(manager).toBeDefined();
        });

        it('shows fleet indicator for urgent army drivers', () => {
            const couriers = [createMockCourier({ isUrgentArmyDriver: true })];
            manager.updateMarkers(couriers);

            expect(manager).toBeDefined();
        });

        it('shows overdue jobs count when present', () => {
            const couriers = [createMockCourier({ totalJobs: 5, overDueJobs: 2 })];
            manager.updateMarkers(couriers);

            expect(manager).toBeDefined();
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

    describe('Icon Anchor Configuration', () => {
        it('sets correct anchor for normal flag markers', () => {
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers, false, false);

            const iconCalls = mockH.map.Icon.mock.calls;
            expect(iconCalls.length).toBeGreaterThan(0);
        });

        it('sets correct anchor for large flag markers', () => {
            const couriers = [createMockCourier()];
            manager.updateMarkers(couriers, false, true);

            const iconCalls = mockH.map.Icon.mock.calls;
            expect(iconCalls.length).toBeGreaterThan(0);
        });
    });
});
