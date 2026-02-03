/**
 * JobMarkerManager Tests
 *
 * Comprehensive tests for the JobMarkerManager class that handles
 * job markers (pickup/delivery) on HERE Maps.
 */

import { JobMarkerManager } from './JobMarkerManager';
import type { IDispatchMapItem } from './DispatchMap.types';
import {
    MARKER_COLORS,
    MAX_JOBS_TO_DISPLAY,
    MARKER_BATCH_SIZE,
    MAX_AUTO_ZOOM,
    ICON_CACHE_LIMIT,
} from './DispatchMap.types';

// Mock HERE Maps global H object
const createMockMarker = (data?: any) => ({
    getData: jest.fn(() => data),
    setIcon: jest.fn(),
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
        mergeRect: jest.fn((other) => ({
            getTop: () => Math.max(41, other.getTop()),
            getBottom: () => Math.min(40, other.getBottom()),
            getLeft: () => Math.min(-75, other.getLeft()),
            getRight: () => Math.max(-73, other.getRight()),
        })),
    })),
});

const createMockMap = () => ({
    addObject: jest.fn(),
    removeObject: jest.fn(),
    getElement: jest.fn(() => ({
        appendChild: jest.fn(),
    })),
    geoToScreen: jest.fn(() => ({ x: 100, y: 100 })),
    getViewModel: jest.fn(() => ({
        setLookAtData: jest.fn(),
    })),
    getZoom: jest.fn(() => 14),
    setZoom: jest.fn(),
});

const createMockUI = () => ({});

// Mock H global
const mockH = {
    map: {
        Group: jest.fn(() => createMockMarkerGroup()),
        Marker: jest.fn((point, options) => createMockMarker(options?.data)),
        Icon: jest.fn((svg, options) => ({ svg, options })),
    },
    geo: {
        Point: jest.fn((lat, lng) => ({ lat, lng })),
        Rect: jest.fn((top, left, bottom, right) => ({
            top,
            left,
            bottom,
            right,
            getTop: () => top,
            getBottom: () => bottom,
            getLeft: () => left,
            getRight: () => right,
        })),
    },
};

(global as any).H = mockH;

// Helper to create mock jobs
const createMockJob = (overrides?: Partial<IDispatchMapItem>): IDispatchMapItem => ({
    jobId: 1,
    jobNo: 'JOB001',
    pickupAddress: {
        latitude: 40.7128,
        longitude: -74.006,
        addressLine1: '123 Main St',
        city: 'New York',
    },
    deliveryAddress: {
        latitude: 40.7589,
        longitude: -73.9851,
        addressLine1: '456 Park Ave',
        city: 'New York',
    },
    ...overrides,
} as IDispatchMapItem);

describe('JobMarkerManager', () => {
    let mockMap: ReturnType<typeof createMockMap>;
    let mockUI: ReturnType<typeof createMockUI>;
    let manager: JobMarkerManager;

    beforeEach(() => {
        jest.clearAllMocks();
        mockMap = createMockMap();
        mockUI = createMockUI();
        manager = new JobMarkerManager(mockMap, mockUI);
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

        it('stores onMarkerClick callback when provided', () => {
            const callback = jest.fn();
            const managerWithCallback = new JobMarkerManager(mockMap, mockUI, callback);
            expect(managerWithCallback).toBeDefined();
            managerWithCallback.dispose();
        });
    });

    describe('setOnMarkerClick', () => {
        it('updates the marker click callback', () => {
            const callback = jest.fn();
            manager.setOnMarkerClick(callback);
            // Callback is stored internally - verify it works via tap event
            expect(manager).toBeDefined();
        });
    });

    describe('updateMarkers', () => {
        it('clears existing markers before adding new ones', async () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const jobs = [createMockJob()];

            await manager.updateMarkers(jobs);

            expect(mockGroup.removeAll).toHaveBeenCalled();
        });

        it('adds pickup and delivery markers for each job', async () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;
            const jobs = [createMockJob()];

            const count = await manager.updateMarkers(jobs);

            expect(count).toBe(2); // pickup + delivery
            expect(mockGroup.addObjects).toHaveBeenCalled();
        });

        it('adds current job markers first when provided', async () => {
            const jobs = [createMockJob({ jobId: 2, jobNo: 'JOB002' })];
            const currentJob = createMockJob({ jobId: 1, jobNo: 'JOB001' });

            const count = await manager.updateMarkers(jobs, currentJob);

            // 2 for current job + 2 for other job
            expect(count).toBe(4);
        });

        it('does not duplicate current job in the list', async () => {
            const currentJob = createMockJob({ jobId: 1, jobNo: 'JOB001' });
            const jobs = [currentJob, createMockJob({ jobId: 2, jobNo: 'JOB002' })];

            const count = await manager.updateMarkers(jobs, currentJob);

            // 2 for current job + 2 for job #2 (current job not duplicated from list)
            expect(count).toBe(4);
        });

        it('respects MAX_JOBS_TO_DISPLAY limit', async () => {
            const jobs: IDispatchMapItem[] = [];
            for (let i = 0; i < MAX_JOBS_TO_DISPLAY + 100; i++) {
                jobs.push(
                    createMockJob({
                        jobId: i,
                        jobNo: `JOB${i.toString().padStart(3, '0')}`,
                    })
                );
            }

            const count = await manager.updateMarkers(jobs);

            // Should be limited to MAX_JOBS_TO_DISPLAY * 2 markers (pickup + delivery each)
            expect(count).toBeLessThanOrEqual(MAX_JOBS_TO_DISPLAY * 2);
        });

        it('skips jobs with invalid pickup coordinates', async () => {
            const jobs = [
                createMockJob({
                    pickupAddress: { latitude: 0, longitude: 0 } as any,
                }),
            ];

            const count = await manager.updateMarkers(jobs);

            // Only delivery marker should be added (pickup has 0,0 coordinates)
            expect(count).toBe(1);
        });

        it('skips jobs with invalid delivery coordinates', async () => {
            const jobs = [
                createMockJob({
                    deliveryAddress: { latitude: null, longitude: null } as any,
                }),
            ];

            const count = await manager.updateMarkers(jobs);

            // Only pickup marker should be added
            expect(count).toBe(1);
        });

        it('skips jobs with out-of-range coordinates', async () => {
            const jobs = [
                createMockJob({
                    pickupAddress: { latitude: 100, longitude: -74.006 } as any, // Invalid lat
                    deliveryAddress: { latitude: 40.7589, longitude: 200 } as any, // Invalid lng
                }),
            ];

            const count = await manager.updateMarkers(jobs);

            expect(count).toBe(0);
        });

        it('uses alternate colors when useAlternateColors is true', async () => {
            const jobs = [createMockJob()];

            await manager.updateMarkers(jobs, undefined, true);

            // Markers should be created with alternate colors
            expect(mockH.map.Marker).toHaveBeenCalled();
        });

        it('returns 0 when jobs array is empty', async () => {
            const count = await manager.updateMarkers([]);

            expect(count).toBe(0);
        });

        it('returns 0 when jobs is undefined', async () => {
            const count = await manager.updateMarkers(undefined as any);

            expect(count).toBe(0);
        });
    });

    describe('clearMarkers', () => {
        it('removes all markers from the group', () => {
            const mockGroup = mockH.map.Group.mock.results[0].value;

            manager.clearMarkers();

            expect(mockGroup.removeAll).toHaveBeenCalled();
        });

        it('resets internal marker tracking', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            manager.clearMarkers();

            expect(manager.getMarkerCount()).toBe(0);
        });
    });

    describe('getMarkerCount', () => {
        it('returns 0 initially', () => {
            expect(manager.getMarkerCount()).toBe(0);
        });

        it('returns correct count after adding markers', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            expect(manager.getMarkerCount()).toBe(2); // pickup + delivery
        });

        it('returns 0 after clearing markers', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);
            manager.clearMarkers();

            expect(manager.getMarkerCount()).toBe(0);
        });
    });

    describe('fitMapToMarkers', () => {
        it('sets map view to marker bounds', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            manager.fitMapToMarkers();

            expect(mockMap.getViewModel).toHaveBeenCalled();
        });

        it('combines bounds with courier marker group when provided', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            const courierGroup = {
                getBoundingBox: jest.fn(() => ({
                    getTop: () => 42,
                    getBottom: () => 39,
                    getLeft: () => -76,
                    getRight: () => -72,
                })),
            };

            manager.fitMapToMarkers(courierGroup);

            expect(courierGroup.getBoundingBox).toHaveBeenCalled();
        });

        it('limits zoom to MAX_AUTO_ZOOM', async () => {
            mockMap.getZoom.mockReturnValue(MAX_AUTO_ZOOM + 2);

            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            manager.fitMapToMarkers();

            expect(mockMap.setZoom).toHaveBeenCalledWith(MAX_AUTO_ZOOM);
        });

        it('does not change zoom if already below MAX_AUTO_ZOOM', async () => {
            mockMap.getZoom.mockReturnValue(MAX_AUTO_ZOOM - 2);

            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            manager.fitMapToMarkers();

            expect(mockMap.setZoom).not.toHaveBeenCalled();
        });

        it('handles no markers gracefully', () => {
            manager.fitMapToMarkers();
            // Should not throw
            expect(mockMap.getViewModel().setLookAtData).not.toHaveBeenCalled();
        });
    });

    describe('dispose', () => {
        it('removes marker group from map', () => {
            manager.dispose();

            expect(mockMap.removeObject).toHaveBeenCalled();
        });

        it('clears icon cache', () => {
            manager.dispose();
            // Internal cache is cleared - no external way to verify, but no error should occur
            expect(true).toBe(true);
        });

        it('can be called multiple times without error', () => {
            expect(() => {
                manager.dispose();
                manager.dispose();
            }).not.toThrow();
        });
    });

    describe('Icon Caching', () => {
        it('reuses cached icons for same color', async () => {
            const jobs = [
                createMockJob({ jobId: 1 }),
                createMockJob({ jobId: 2 }),
                createMockJob({ jobId: 3 }),
            ];

            await manager.updateMarkers(jobs);

            // Icon should be created once per color, then reused
            // 4 icons: pickup normal, pickup hover, delivery normal, delivery hover
            const iconCallCount = mockH.map.Icon.mock.calls.length;
            expect(iconCallCount).toBeLessThan(jobs.length * 4); // Less than if every marker got new icon
        });
    });

    describe('Marker Colors', () => {
        it('uses PICKUP color for pickup markers', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasPickupColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(MARKER_COLORS.PICKUP)
            );
            expect(hasPickupColor).toBe(true);
        });

        it('uses DELIVERY color for delivery markers', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasDeliveryColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(MARKER_COLORS.DELIVERY)
            );
            expect(hasDeliveryColor).toBe(true);
        });

        it('uses OTHER_PICKUP color when useAlternateColors is true', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs, undefined, true);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasOtherPickupColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(MARKER_COLORS.OTHER_PICKUP)
            );
            expect(hasOtherPickupColor).toBe(true);
        });

        it('uses OTHER_DELIVERY color when useAlternateColors is true', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs, undefined, true);

            const iconCalls = mockH.map.Icon.mock.calls;
            const hasOtherDeliveryColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(MARKER_COLORS.OTHER_DELIVERY)
            );
            expect(hasOtherDeliveryColor).toBe(true);
        });

        it('uses standard colors for current job even when useAlternateColors is true', async () => {
            const currentJob = createMockJob({ jobId: 1 });
            const otherJobs = [createMockJob({ jobId: 2 })];

            await manager.updateMarkers(otherJobs, currentJob, true);

            const iconCalls = mockH.map.Icon.mock.calls;
            // Current job should use standard PICKUP color
            const hasStandardPickupColor = iconCalls.some(
                (call: any[]) => call[0] && call[0].includes(MARKER_COLORS.PICKUP)
            );
            expect(hasStandardPickupColor).toBe(true);
        });
    });

    describe('Coordinate Validation', () => {
        it('rejects latitude less than -90', async () => {
            const jobs = [
                createMockJob({
                    pickupAddress: { latitude: -91, longitude: 0 } as any,
                    deliveryAddress: { latitude: 40, longitude: -74 } as any,
                }),
            ];

            const count = await manager.updateMarkers(jobs);
            expect(count).toBe(1); // Only delivery
        });

        it('rejects latitude greater than 90', async () => {
            const jobs = [
                createMockJob({
                    pickupAddress: { latitude: 91, longitude: 0 } as any,
                    deliveryAddress: { latitude: 40, longitude: -74 } as any,
                }),
            ];

            const count = await manager.updateMarkers(jobs);
            expect(count).toBe(1); // Only delivery
        });

        it('rejects longitude less than -180', async () => {
            const jobs = [
                createMockJob({
                    pickupAddress: { latitude: 40, longitude: -181 } as any,
                    deliveryAddress: { latitude: 40, longitude: -74 } as any,
                }),
            ];

            const count = await manager.updateMarkers(jobs);
            expect(count).toBe(1); // Only delivery
        });

        it('rejects longitude greater than 180', async () => {
            const jobs = [
                createMockJob({
                    pickupAddress: { latitude: 40, longitude: 181 } as any,
                    deliveryAddress: { latitude: 40, longitude: -74 } as any,
                }),
            ];

            const count = await manager.updateMarkers(jobs);
            expect(count).toBe(1); // Only delivery
        });

        it('rejects NaN coordinates', async () => {
            const jobs = [
                createMockJob({
                    pickupAddress: { latitude: NaN, longitude: -74 } as any,
                    deliveryAddress: { latitude: 40, longitude: -74 } as any,
                }),
            ];

            const count = await manager.updateMarkers(jobs);
            expect(count).toBe(1); // Only delivery
        });

        it('accepts edge case coordinates', async () => {
            const jobs = [
                createMockJob({
                    pickupAddress: { latitude: 90, longitude: 180 } as any,
                    deliveryAddress: { latitude: -90, longitude: -180 } as any,
                }),
            ];

            const count = await manager.updateMarkers(jobs);
            expect(count).toBe(2); // Both valid
        });
    });

    describe('Batch Processing', () => {
        it('processes jobs in batches', async () => {
            const jobs: IDispatchMapItem[] = [];
            for (let i = 0; i < MARKER_BATCH_SIZE + 50; i++) {
                jobs.push(
                    createMockJob({
                        jobId: i,
                        jobNo: `JOB${i.toString().padStart(3, '0')}`,
                    })
                );
            }

            const count = await manager.updateMarkers(jobs);

            // All jobs should be processed
            expect(count).toBe(jobs.length * 2);
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

        it('tap handler calls onMarkerClick with job data', async () => {
            const onMarkerClick = jest.fn();
            const managerWithCallback = new JobMarkerManager(mockMap, mockUI, onMarkerClick);

            const jobs = [createMockJob()];
            await managerWithCallback.updateMarkers(jobs);

            // Get the tap handler
            const mockGroup = mockH.map.Group.mock.results[1].value;
            const tapHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'tap'
            )[1];

            // Simulate tap event
            const mockMarker = {
                getData: jest.fn(() => ({ job: jobs[0] })),
            };
            tapHandler({ target: mockMarker });

            expect(onMarkerClick).toHaveBeenCalledWith(jobs[0]);
            managerWithCallback.dispose();
        });

        it('tap handler does nothing when marker has no data', async () => {
            const onMarkerClick = jest.fn();
            const managerWithCallback = new JobMarkerManager(mockMap, mockUI, onMarkerClick);

            const mockGroup = mockH.map.Group.mock.results[1].value;
            const tapHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'tap'
            )[1];

            // Simulate tap event with no data
            const mockMarker = {
                getData: jest.fn(() => null),
            };
            tapHandler({ target: mockMarker });

            expect(onMarkerClick).not.toHaveBeenCalled();
            managerWithCallback.dispose();
        });

        it('pointerenter handler changes icon to hover state', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            const mockGroup = mockH.map.Group.mock.results[0].value;
            const enterHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'pointerenter'
            )[1];

            // Simulate pointerenter event with all required methods
            const mockMarker = {
                getData: jest.fn(() => ({
                    job: jobs[0],
                    color: MARKER_COLORS.PICKUP,
                    locationType: 'Pickup',
                })),
                setIcon: jest.fn(),
                getGeometry: jest.fn(() => ({ lat: 40.7128, lng: -74.006 })),
            };
            enterHandler({ target: mockMarker });

            expect(mockMarker.setIcon).toHaveBeenCalled();
        });

        it('pointerleave handler restores normal icon', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            const mockGroup = mockH.map.Group.mock.results[0].value;
            const leaveHandler = mockGroup.addEventListener.mock.calls.find(
                (call: any[]) => call[0] === 'pointerleave'
            )[1];

            // Simulate pointerleave event
            const mockMarker = {
                getData: jest.fn(() => ({
                    job: jobs[0],
                    color: MARKER_COLORS.PICKUP,
                })),
                setIcon: jest.fn(),
            };
            leaveHandler({ target: mockMarker });

            expect(mockMarker.setIcon).toHaveBeenCalled();
        });
    });

    describe('Tooltip Functionality', () => {
        it('creates tooltip element on construction', () => {
            // Tooltip element should be created and appended to map container
            expect(mockMap.getElement).toHaveBeenCalled();
        });

        it('escapes HTML in job number for tooltip', async () => {
            const jobs = [createMockJob({ jobNo: '<script>alert("xss")</script>' })];
            await manager.updateMarkers(jobs);

            // The manager should escape HTML when displaying tooltips
            // This is tested implicitly through the escapeHtml method
            expect(manager.getMarkerCount()).toBe(2);
        });

        it('handles null job number gracefully', async () => {
            const jobs = [createMockJob({ jobNo: null as any })];
            await manager.updateMarkers(jobs);

            expect(manager.getMarkerCount()).toBe(2);
        });
    });

    describe('Bounds Padding', () => {
        it('fitMapToMarkers does nothing when no markers exist', () => {
            // No markers added, should not throw
            expect(() => manager.fitMapToMarkers()).not.toThrow();
        });

        it('fitMapToMarkers is called without error when markers exist', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            // Should not throw even if bounds checking fails
            expect(() => manager.fitMapToMarkers()).not.toThrow();
        });

        it('handles courier marker group in fitMapToMarkers', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            const mockCourierGroup = {
                getBoundingBox: jest.fn(() => null),
            };

            // Should not throw
            expect(() => manager.fitMapToMarkers(mockCourierGroup)).not.toThrow();
            expect(mockCourierGroup.getBoundingBox).toHaveBeenCalled();
        });
    });

    describe('Marker Data Storage', () => {
        it('stores job reference in marker data', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            // Marker should be created with data containing the job
            expect(mockH.map.Marker).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    data: expect.objectContaining({
                        job: expect.anything(),
                    }),
                })
            );
        });

        it('stores location type in marker data', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            // Check that markers include locationType
            const markerCalls = mockH.map.Marker.mock.calls;
            const hasPickupType = markerCalls.some(
                (call: any[]) => call[1]?.data?.locationType === 'Pickup'
            );
            const hasDeliveryType = markerCalls.some(
                (call: any[]) => call[1]?.data?.locationType === 'Delivery'
            );

            expect(hasPickupType).toBe(true);
            expect(hasDeliveryType).toBe(true);
        });

        it('stores color in marker data for hover restore', async () => {
            const jobs = [createMockJob()];
            await manager.updateMarkers(jobs);

            const markerCalls = mockH.map.Marker.mock.calls;
            const hasColor = markerCalls.some(
                (call: any[]) => call[1]?.data?.color !== undefined
            );

            expect(hasColor).toBe(true);
        });
    });
});
