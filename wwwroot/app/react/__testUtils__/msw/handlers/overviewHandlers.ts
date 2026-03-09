/**
 * Overview API Handlers
 *
 * MSW handlers for overview page API endpoints.
 */

import {http, HttpResponse} from 'msw';
import type {
    OverviewStatsViewModel,
    PaginatedResponse,
    OverviewTableParentJob,
    ISuggestion,
    MapConfig,
    IOpenJobResponseDto,
} from '../../../pages/overview/OverviewPage.interfaces';

// ── Mock data ──

export const mockOverviewStats: OverviewStatsViewModel = {
    active: 12,
    inactive: 4,
    completed: 38,
};

export const mockOverviewRegions: ISuggestion[] = [
    {id: 1, text: 'Auckland'},
    {id: 2, text: 'Wellington'},
    {id: 3, text: 'Christchurch'},
];

export const mockOverviewSpeeds: ISuggestion[] = [
    {id: 1, text: 'Same Day'},
    {id: 2, text: 'Next Day'},
    {id: 3, text: '1 Hour'},
];

export const mockOverviewParentJobs: OverviewTableParentJob[] = [
    {
        jobId: 101,
        jobName: 'J-001',
        status: 'Despatched',
        completion: 50,
        pickup: '123 Main St, Auckland',
        delivery: '456 High St, Wellington',
        driver: 'John Smith',
        region: 'Auckland',
        childJobs: [
            {
                jobId: 201,
                jobName: 'J-001-A',
                status: 'Picked Up',
                completion: 75,
                pickup: '123 Main St, Auckland',
                delivery: '789 Meeting Point',
                driver: 'John Smith',
                region: 'Auckland',
            },
        ],
    },
    {
        jobId: 102,
        jobName: 'J-002',
        status: 'New',
        completion: 0,
        pickup: '10 Queen St, Auckland',
        delivery: '20 King St, Auckland',
        driver: 'Jane Doe',
        region: 'Auckland',
        childJobs: [],
    },
];

export const mockOverviewJobsResponse: PaginatedResponse<OverviewTableParentJob> = {
    items: mockOverviewParentJobs,
    total: 2,
    page: 1,
    pages: 1,
};

export const mockOpenJobDtos: IOpenJobResponseDto[] = [
    {
        jobId: 301,
        reference: 'OJ-001',
        status: 'In Transit',
        pickupTime: '2024-06-15T08:00:00',
        pickupName: 'Warehouse A',
        pickupAddress: '100 Depot Rd, Auckland',
        deliveryTime: '2024-06-15T12:00:00',
        deliveryName: 'Customer B',
        deliveryAddress: '200 Delivery Ave, Auckland',
        driverName: 'John Smith',
        completedToday: 3,
        lastCompleted: '11:30',
        quantity: 2,
        packageType: 'Parcel',
        mileage: 15,
    },
    {
        jobId: 302,
        reference: 'OJ-002',
        status: 'Picked Up',
        pickupName: 'Office C',
        pickupAddress: '50 Business Park, Wellington',
        deliveryName: 'Office D',
        deliveryAddress: '60 Commerce St, Wellington',
        driverName: 'Jane Doe',
        completedToday: 1,
        quantity: 1,
        packageType: 'Document',
        mileage: 8,
    },
];

export const mockMapConfig: MapConfig = {
    center: {lat: -36.8485, lng: 174.7633},
    zoom: 12,
    job: {
        id: 101,
        pickup: {lat: -36.8600, lng: 174.7600},
        delivery: {lat: -41.2865, lng: 174.7762},
        childJobs: [
            {
                id: 201,
                pickup: {lat: -36.8600, lng: 174.7600},
                delivery: {lat: -37.0000, lng: 174.8000},
                flight: false,
            },
        ],
    },
    selectedJobIndex: 0,
    courierLocation: {lat: -36.8500, lng: 174.7650},
};

// ── Handlers ──

export const overviewHandlers = [
    // Get paginated jobs
    http.get('*/overview', ({request}) => {
        const url = new URL(request.url);
        // Don't match sub-paths like /overview/GetStats
        if (url.pathname !== '/overview' && !url.pathname.endsWith('/overview')) {
            return;
        }
        return HttpResponse.json(mockOverviewJobsResponse);
    }),

    // Get all regions
    http.get('*/overview/GetAllRegions', () => {
        return HttpResponse.json(mockOverviewRegions);
    }),

    // Get all speeds
    http.get('*/overview/GetAllSpeeds', () => {
        return HttpResponse.json(mockOverviewSpeeds);
    }),

    // Get stats
    http.get('*/overview/GetStats', () => {
        return HttpResponse.json(mockOverviewStats);
    }),

    // Get open jobs
    http.get('*/overview/GetOpenJobs', () => {
        return HttpResponse.json(mockOpenJobDtos);
    }),

    // Get parent job map config
    http.get('*/overview/GetParentJobMap', ({request}) => {
        const url = new URL(request.url);
        const jobId = url.searchParams.get('jobId');

        if (!jobId) {
            return new HttpResponse('Missing jobId parameter', {status: 400});
        }

        return HttpResponse.json(mockMapConfig);
    }),
];
