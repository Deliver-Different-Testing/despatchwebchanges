/**
 * HereMap Component Tests
 *
 * Tests for utility functions and type definitions.
 * Component rendering tests are kept minimal to avoid memory issues with mocked H global.
 */

import React from 'react';
import {render} from '@testing-library/react';
import {createTheme, ThemeProvider} from '@mui/material';
import {HereMap} from './HereMap';
import type {
    CourierLocation,
    HereMapConfig,
    HereMapCredentials,
    HereMapProps,
    IHereMapChildJob,
    IHereMapJob,
} from './HereMap.types';
import {DEFAULT_MAP_CONFIG, MAP_CONSTANTS, MARKER_ICONS, SVG_TEMPLATES} from './HereMap.types';
import {createCurvedPath, getAllVisiblePoints,} from './hereMapUtils';

const theme = createTheme();

const renderWithProviders = (ui: React.ReactElement) => {
    return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
};

// Sample data factories
const createMockCredentials = (): HereMapCredentials => ({
    apiKey: 'test-api-key',
});

const createMockJobLocation = (lat: number, lng: number) => ({
    lat,
    lng,
});

const createMockJob = (overrides?: Partial<IHereMapJob>): IHereMapJob => ({
    id: 1,
    pickup: createMockJobLocation(40.7128, -74.006),
    delivery: createMockJobLocation(40.7589, -73.9851),
    ...overrides,
});

const createMockChildJob = (
    overrides?: Partial<IHereMapChildJob>
): IHereMapChildJob => ({
    id: 1,
    pickup: createMockJobLocation(40.7128, -74.006),
    delivery: createMockJobLocation(40.7589, -73.9851),
    flight: false,
    ...overrides,
});

const createMockCourierLocation = (
    overrides?: Partial<CourierLocation>
): CourierLocation => ({
    lat: 40.73,
    lng: -73.99,
    ...overrides,
});

const createMockConfig = (overrides?: Partial<HereMapConfig>): HereMapConfig => ({
    zoom: 10,
    center: {lat: 40.7128, lng: -74.006},
    job: createMockJob(),
    courierLocation: createMockCourierLocation(),
    ...overrides,
});

const createDefaultProps = (overrides?: Partial<HereMapProps>): HereMapProps => ({
    mapId: 'test-map',
    credentials: createMockCredentials(),
    config: createMockConfig(),
    ...overrides,
});

describe('HereMap Component', () => {
    describe('Rendering without HERE Maps SDK', () => {
        it('renders map container with correct ID', () => {
            // Render without H global - component should still render the container
            const props = createDefaultProps({
                mapId: 'my-custom-map',
                credentials: undefined // No credentials = no map initialization
            });
            renderWithProviders(<HereMap {...props} />);

            expect(document.getElementById('my-custom-map')).toBeInTheDocument();
        });

        it('renders with default styling', () => {
            const props = createDefaultProps({
                credentials: undefined
            });
            renderWithProviders(<HereMap {...props} />);

            const mapContainer = document.getElementById('test-map');
            expect(mapContainer).toHaveClass('here-map');
        });

        it('renders without credentials', () => {
            const props = createDefaultProps({credentials: undefined});
            renderWithProviders(<HereMap {...props} />);

            expect(document.getElementById('test-map')).toBeInTheDocument();
        });

        it('renders without config', () => {
            const props = createDefaultProps({config: undefined, credentials: undefined});
            renderWithProviders(<HereMap {...props} />);

            expect(document.getElementById('test-map')).toBeInTheDocument();
        });
    });
});

describe('hereMapUtils', () => {
    describe('createCurvedPath', () => {
        it('creates a curved path between two points', () => {
            const startPoint = {lat: 40.7128, lng: -74.006};
            const endPoint = {lat: 40.7589, lng: -73.9851};

            const curvePoints = createCurvedPath(startPoint, endPoint);

            expect(curvePoints.length).toBeGreaterThan(0);
            expect(curvePoints[0].lat).toBeCloseTo(startPoint.lat, 1);
            expect(curvePoints[0].lng).toBeCloseTo(startPoint.lng, 1);
        });

        it('respects curvature parameter', () => {
            const startPoint = {lat: 40.7128, lng: -74.006};
            const endPoint = {lat: 40.7589, lng: -73.9851};

            const lowCurvature = createCurvedPath(startPoint, endPoint, 0.1);
            const highCurvature = createCurvedPath(startPoint, endPoint, 0.9);

            // Different curvatures should produce different paths
            const lowMid = lowCurvature[Math.floor(lowCurvature.length / 2)];
            const highMid = highCurvature[Math.floor(highCurvature.length / 2)];

            expect(lowMid.lat).not.toEqual(highMid.lat);
        });

        it('generates correct number of points', () => {
            const startPoint = {lat: 0, lng: 0};
            const endPoint = {lat: 1, lng: 1};

            const curvePoints = createCurvedPath(startPoint, endPoint);

            // Should have approximately CURVE_STEPS + 1 points
            expect(curvePoints.length).toBeGreaterThanOrEqual(MAP_CONSTANTS.CURVE_STEPS);
        });

        it('starts at start point and ends near end point', () => {
            const startPoint = {lat: 0, lng: 0};
            const endPoint = {lat: 10, lng: 10};

            const curvePoints = createCurvedPath(startPoint, endPoint);

            // First point should be at start
            expect(curvePoints[0].lat).toBeCloseTo(startPoint.lat, 5);
            expect(curvePoints[0].lng).toBeCloseTo(startPoint.lng, 5);

            // Last point should be near end
            const lastPoint = curvePoints[curvePoints.length - 1];
            expect(lastPoint.lat).toBeCloseTo(endPoint.lat, 0);
            expect(lastPoint.lng).toBeCloseTo(endPoint.lng, 0);
        });
    });

    describe('getAllVisiblePoints', () => {
        it('collects all job points', () => {
            const job = createMockJob();
            const courierLocation = createMockCourierLocation();

            const points = getAllVisiblePoints(job, courierLocation);

            expect(points.length).toBe(3); // pickup + delivery + courier
        });

        it('includes child job points', () => {
            const childJobs: IHereMapChildJob[] = [
                createMockChildJob({
                    pickup: {lat: 1, lng: 1},
                    delivery: {lat: 2, lng: 2},
                }),
                createMockChildJob({
                    pickup: {lat: 3, lng: 3},
                    delivery: {lat: 4, lng: 4},
                }),
            ];
            const job = createMockJob({childJobs});
            const courierLocation = createMockCourierLocation();

            const points = getAllVisiblePoints(job, courierLocation);

            // pickup + delivery + 2 child pickups + 2 child deliveries + courier
            expect(points.length).toBe(7);
        });

        it('handles job without delivery', () => {
            const job = createMockJob({delivery: undefined});
            const courierLocation = createMockCourierLocation();

            const points = getAllVisiblePoints(job, courierLocation);

            expect(points.length).toBe(2); // pickup + courier only
        });

        it('includes extra marker points', () => {
            const job = createMockJob();
            const courierLocation = createMockCourierLocation();
            const extraMarkers = [
                {
                    getGeometry: () => ({lat: 5, lng: 5}),
                },
                {
                    getGeometry: () => ({lat: 6, lng: 6}),
                },
            ];

            const points = getAllVisiblePoints(job, courierLocation, extraMarkers);

            expect(points.length).toBe(5); // pickup + delivery + courier + 2 extra
        });

        it('handles job with no pickup', () => {
            const job = {id: 1, pickup: undefined as any};
            const courierLocation = createMockCourierLocation();

            const points = getAllVisiblePoints(job, courierLocation);

            expect(points.length).toBe(1); // courier only
        });

        it('handles job with undefined childJobs', () => {
            const job = createMockJob({childJobs: undefined});
            const courierLocation = createMockCourierLocation();

            const points = getAllVisiblePoints(job, courierLocation);

            expect(points.length).toBe(3); // pickup + delivery + courier
        });

        it('handles empty extra markers array', () => {
            const job = createMockJob();
            const courierLocation = createMockCourierLocation();

            const points = getAllVisiblePoints(job, courierLocation, []);

            expect(points.length).toBe(3);
        });
    });
});

describe('MAP_CONSTANTS', () => {
    it('has expected constant values', () => {
        expect(MAP_CONSTANTS.MAP_ZOOM_LEVEL).toBe(15);
        expect(MAP_CONSTANTS.AUTO_ZOOM_DELAY).toBe(2000);
        expect(MAP_CONSTANTS.RESIZE_DELAY).toBe(100);
        expect(MAP_CONSTANTS.ZOOM_ADJUSTMENT_DELAY).toBe(300);
        expect(MAP_CONSTANTS.DEFAULT_PADDING).toBe(0.1);
        expect(MAP_CONSTANTS.SINGLE_POINT_ZOOM).toBe(12);
        expect(MAP_CONSTANTS.CURVE_STEPS).toBe(30);
        expect(MAP_CONSTANTS.DEFAULT_CURVATURE).toBe(0.5);
        expect(MAP_CONSTANTS.BOUNDING_BOX_EXPAND_FACTOR).toBe(0.25);
    });
});

describe('MARKER_ICONS', () => {
    it('has expected icon URLs', () => {
        expect(MARKER_ICONS.FROM).toContain('39e75f'); // Green for pickup
        expect(MARKER_ICONS.TO).toContain('ff6863'); // Red for delivery
        expect(MARKER_ICONS.EXTRA).toContain('000000'); // Black for extra markers
    });
});

describe('SVG_TEMPLATES', () => {
    it('has plane SVG template', () => {
        expect(SVG_TEMPLATES.PLANE).toContain('icon-tabler-plane');
        expect(SVG_TEMPLATES.PLANE).toContain('{{TRANSFORM}}');
    });

    it('has car SVG template', () => {
        expect(SVG_TEMPLATES.CAR).toContain('icon-tabler-car');
        expect(SVG_TEMPLATES.CAR).toContain('{{TRANSFORM}}');
    });
});

describe('DEFAULT_MAP_CONFIG', () => {
    it('has expected default values', () => {
        expect(DEFAULT_MAP_CONFIG.zoom).toBe(5);
        expect(DEFAULT_MAP_CONFIG.center).toEqual({
            lat: 39.8097343,
            lng: -98.5556199,
        });
    });
});

describe('Type definitions', () => {
    it('creates valid credentials', () => {
        const credentials = createMockCredentials();
        expect(credentials.apiKey).toBe('test-api-key');
    });

    it('creates valid job', () => {
        const job = createMockJob();
        expect(job.id).toBe(1);
        expect(job.pickup.lat).toBe(40.7128);
        expect(job.delivery?.lat).toBe(40.7589);
    });

    it('creates valid child job', () => {
        const childJob = createMockChildJob({flight: true});
        expect(childJob.flight).toBe(true);
    });

    it('creates valid courier location', () => {
        const location = createMockCourierLocation();
        expect(location.lat).toBe(40.73);
        expect(location.lng).toBe(-73.99);
    });

    it('creates valid config', () => {
        const config = createMockConfig();
        expect(config.zoom).toBe(10);
        expect(config.job).toBeDefined();
        expect(config.courierLocation).toBeDefined();
    });

    it('creates valid props', () => {
        const props = createDefaultProps();
        expect(props.mapId).toBe('test-map');
        expect(props.credentials).toBeDefined();
        expect(props.config).toBeDefined();
    });
});
