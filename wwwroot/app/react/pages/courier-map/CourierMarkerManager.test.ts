/**
 * CourierMarkerManager Tests
 *
 * The Courier Map draws the same courier flag as the dispatch map — driver, job counts and the
 * last-delivery line — but colours it from the Mantine theme so it follows dark mode. These tests
 * pin that parity, since the two managers are separate classes over one shared flag builder.
 */

import {CourierMarkerManager} from './CourierMarkerManager';
import type {IAvailableCourierPosition} from '../../../interfaces/courier.interface';
import {MARKER_COLORS} from './CourierMapPage.types';
import {COURIER_FLAG_HEIGHT} from '../../components/common/here-map/courierFlagSvg';

const createMockMarker = (data?: any) => {
    let payload = data;
    return {
        getData: jest.fn(() => payload),
        setData: jest.fn((next: any) => {
            payload = next;
        }),
        setIcon: jest.fn(),
        setGeometry: jest.fn(),
        getGeometry: jest.fn(() => ({lat: -36.85, lng: 174.76})),
    };
};

const createMockMarkerGroup = () => ({
    addObjects: jest.fn(),
    removeAll: jest.fn(),
    removeObjects: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getBoundingBox: jest.fn(() => ({})),
});

let mapElement: HTMLDivElement;

const createMockMap = () => ({
    addObject: jest.fn(),
    removeObject: jest.fn(),
    getElement: jest.fn(() => mapElement),
    geoToScreen: jest.fn(() => ({x: 100, y: 100})),
    setCenter: jest.fn(),
    setZoom: jest.fn(),
    getZoom: jest.fn(() => 8),
    getViewModel: jest.fn(() => ({setLookAtData: jest.fn()})),
});

const mockMarkerInstances: any[] = [];
const mockH = {
    map: {
        Group: jest.fn(() => createMockMarkerGroup()),
        Marker: jest.fn((_point: any, options: any) => {
            const marker = createMockMarker(options?.data);
            mockMarkerInstances.push(marker);
            return marker;
        }),
        Icon: jest.fn((svg: string, options: any) => ({svg, options})),
    },
    geo: {
        Point: jest.fn((lat: number, lng: number) => ({lat, lng})),
    },
};

(global as any).H = mockH;

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

const driver = (overrides: Partial<IAvailableCourierPosition> = {}): IAvailableCourierPosition => ({
    courierId: 1,
    courierName: 'Dave Smith',
    channelId: 1,
    vehicleType: 'Van',
    code: 'DT14',
    isUrgentArmyDriver: false,
    clearListAreaIDs: [],
    latitude: -36.85,
    longitude: 174.76,
    totalJobs: 4,
    overDueJobs: 0,
    ...overrides,
});

describe('CourierMarkerManager', () => {
    let map: ReturnType<typeof createMockMap>;
    let manager: CourierMarkerManager;

    const lastSvg = () => mockH.map.Icon.mock.calls.at(-1)![0] as string;

    /** Fires the group's pointerenter handler for a marker and returns the tooltip HTML. */
    function hoverMarker(index = 0): string {
        const group = mockH.map.Group.mock.results[0].value;
        const enter = group.addEventListener.mock.calls
            .find((call: any[]) => call[0] === 'pointerenter')![1];
        enter({target: mockMarkerInstances[index]});

        return mapElement.querySelector('.gm-style-iw-content')!.innerHTML;
    }

    beforeEach(() => {
        jest.clearAllMocks();
        mockMarkerInstances.length = 0;
        mapElement = document.createElement('div');
        map = createMockMap();
        manager = new CourierMarkerManager(map);
    });

    afterEach(() => manager.dispose());

    describe('marker lifecycle', () => {
        it('adds a marker per courier and skips ones with no coordinates', () => {
            const group = mockH.map.Group.mock.results[0].value;

            manager.updateMarkers([
                driver({courierId: 1}),
                driver({courierId: 2, latitude: null, longitude: null}),
            ]);

            expect(manager.getMarkerCount()).toBe(1);
            expect(group.addObjects).toHaveBeenCalledWith([expect.anything()]);
        });

        it('moves an existing marker rather than recreating it', () => {
            manager.updateMarkers([driver()]);
            const marker = mockMarkerInstances[0];

            manager.updateMarkers([driver({latitude: -41.29, longitude: 174.78})]);

            expect(marker.setGeometry).toHaveBeenCalledWith({lat: -41.29, lng: 174.78});
            expect(mockMarkerInstances).toHaveLength(1);
        });

        it('removes markers for couriers that dropped out of the payload', () => {
            manager.updateMarkers([driver({courierId: 1}), driver({courierId: 2})]);
            manager.updateMarkers([driver({courierId: 1})]);

            expect(manager.getMarkerCount()).toBe(1);
        });
    });

    describe('flag content', () => {
        it('reads like the dispatch flag: first name, job counts and last delivery', () => {
            manager.updateMarkers([driver({
                overDueJobs: 1,
                lastDeliveryCity: 'Ponsonby',
                lastDeliveryTime: minutesAgo(12),
            })]);

            expect(lastSvg()).toContain('>Dave 4/1<');
            expect(lastSvg()).toContain('Ponsonby · 12m');
            expect(lastSvg()).toContain(`height="${COURIER_FLAG_HEIGHT.twoLine}"`);
        });

        it('shows the driver first name, never the code', () => {
            // The map used to label NZ drivers by code; parity with the dispatch flag means both
            // tenants now read the same.
            manager.updateMarkers([driver()]);

            expect(lastSvg()).toContain('>Dave 4<');
            expect(lastSvg()).not.toContain('DT14');
        });

        it('stays one line for a courier with no completed delivery', () => {
            manager.updateMarkers([driver()]);
            expect(lastSvg()).toContain(`height="${COURIER_FLAG_HEIGHT.oneLine}"`);
        });

        it('colours the flag by status from the supplied palette', () => {
            manager.updateMarkers([driver({courierId: 1, totalJobs: 0, overDueJobs: 0})]);
            expect(lastSvg()).toContain(MARKER_COLORS.idle.bg);

            manager.updateMarkers([driver({courierId: 1, totalJobs: 3, overDueJobs: 0})]);
            expect(lastSvg()).toContain(MARKER_COLORS.active.bg);

            manager.updateMarkers([driver({courierId: 1, totalJobs: 3, overDueJobs: 1})]);
            expect(lastSvg()).toContain(MARKER_COLORS.overdue.bg);
        });

        it('honours a theme-derived palette so the flags follow dark mode', () => {
            const themed = new CourierMarkerManager(map, {
                overdue: {bg: '#111111', border: '#222222', text: '#ffffff'},
                active: {bg: '#333333', border: '#444444', text: '#ffffff'},
                idle: {bg: '#555555', border: '#666666', text: '#ffffff'},
            });

            themed.updateMarkers([driver()]);

            expect(lastSvg()).toContain('#333333');
            themed.dispose();
        });

        it('anchors the flag at its own height so the stem tip sits on the GPS point', () => {
            manager.updateMarkers([driver()]);
            expect(mockH.map.Icon.mock.calls.at(-1)![1].anchor)
                .toEqual({x: 4, y: COURIER_FLAG_HEIGHT.oneLine});

            manager.updateMarkers([driver({
                courierId: 2, lastDeliveryCity: 'Ponsonby', lastDeliveryTime: minutesAgo(3),
            })]);
            expect(mockH.map.Icon.mock.calls.at(-1)![1].anchor)
                .toEqual({x: 4, y: COURIER_FLAG_HEIGHT.twoLine});
        });

        it('repaints and refreshes the payload as the minutes tick', () => {
            manager.updateMarkers([driver({
                lastDeliveryCity: 'Ponsonby', lastDeliveryTime: minutesAgo(12),
            })]);
            const marker = mockMarkerInstances[0];
            marker.setIcon.mockClear();

            const later = driver({lastDeliveryCity: 'Ponsonby', lastDeliveryTime: minutesAgo(13)});
            manager.updateMarkers([later]);

            expect(marker.setIcon).toHaveBeenCalled();
            expect(marker.getData().lastDeliveryTime).toBe(later.lastDeliveryTime);
        });
    });

    describe('tooltip', () => {
        it('reports the same detail as the dispatch map on hover', () => {
            manager.updateMarkers([driver({
                courierName: 'Dave Smith',
                vehicleType: 'Van',
                isUrgentArmyDriver: true,
                totalJobs: 4,
                overDueJobs: 1,
                lastDeliveryCity: 'Ponsonby',
                lastDeliveryTime: minutesAgo(12),
            })]);

            const content = hoverMarker();

            expect(content).toContain('Dave Smith');
            expect(content).toContain('Fleet: UA');
            expect(content).toContain('Vehicle: Van');
            expect(content).toContain('Total Jobs: 4');
            expect(content).toContain('Overdue Jobs: 1');
            expect(content).toContain('Last delivery: Ponsonby');
            expect(content).toContain('12 mins ago');
        });

        it('omits the last-delivery rows for a courier who has not delivered', () => {
            manager.updateMarkers([driver()]);

            expect(hoverMarker()).not.toContain('Last delivery');
        });

        it('hides on pointer leave and is removed on dispose', () => {
            const group = mockH.map.Group.mock.results[0].value;
            manager.updateMarkers([driver()]);
            hoverMarker();

            const tooltip = mapElement.querySelector('.gm-style-iw-wrapper') as HTMLElement;
            expect(tooltip.style.display).toBe('block');

            const leave = group.addEventListener.mock.calls
                .find((call: any[]) => call[0] === 'pointerleave')![1];
            leave();
            expect(tooltip.style.display).toBe('none');

            manager.dispose();
            expect(mapElement.querySelector('.gm-style-iw-wrapper')).toBeNull();
        });
    });

    describe('updateSettings', () => {
        it('repaints existing markers immediately with the new label/job-count settings', () => {
            manager.updateMarkers([driver()]);
            expect(lastSvg()).toContain('>Dave 4<');

            manager.updateSettings(MARKER_COLORS, {markerLabel: 'number', showJobCount: false});

            expect(lastSvg()).toContain('>DT14<');
            expect(mockMarkerInstances[0].setIcon).toHaveBeenCalled();
        });

        it('repaints existing markers immediately when only the color palette changes', () => {
            manager.updateMarkers([driver({totalJobs: 3, overDueJobs: 1})]);
            expect(lastSvg()).toContain(MARKER_COLORS.overdue.bg);

            const singleColor = {bg: '#123456', border: '#654321', text: '#ffffff'};
            manager.updateSettings(
                {overdue: singleColor, active: singleColor, idle: singleColor},
                {markerLabel: 'name', showJobCount: true},
            );

            expect(lastSvg()).toContain('#123456');
        });

        it('applies the new settings to markers added afterward too', () => {
            manager.updateSettings(MARKER_COLORS, {markerLabel: 'number', showJobCount: false});
            manager.updateMarkers([driver()]);

            expect(lastSvg()).toContain('>DT14<');
        });
    });

    describe('centerOnCourier', () => {
        it('centres and zooms in, but never zooms out', () => {
            manager.centerOnCourier(driver());
            expect(map.setCenter).toHaveBeenCalledWith({lat: -36.85, lng: 174.76});
            expect(map.setZoom).toHaveBeenCalled();

            map.setZoom.mockClear();
            map.getZoom.mockReturnValue(18);
            manager.centerOnCourier(driver());
            expect(map.setZoom).not.toHaveBeenCalled();
        });

        it('does nothing for a courier with no position', () => {
            manager.centerOnCourier(driver({latitude: null, longitude: null}));
            expect(map.setCenter).not.toHaveBeenCalled();
        });
    });
});
