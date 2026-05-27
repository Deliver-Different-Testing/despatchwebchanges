/**
 * usePodPhotos Hook Tests
 */

import {renderHook, waitFor, act} from '@testing-library/react';
import {QueryClient} from '@tanstack/react-query';
import {usePodPhotos} from './usePodPhotos';
import {createTestQueryClient, createWrapper} from '../../../../__testUtils__';
import dayjs from 'dayjs';

// Mock API services
jest.mock('../../../../services/jobDetailApi', () => ({
    getJobDeliveryPhotos: jest.fn(),
    getJobPickupPhotos: jest.fn(),
}));

jest.mock('../../../../utils/dateUtils', () => ({
    formatLongDateTime: jest.fn(() => '2024-06-15 10:30 AM'),
    isUsCustomer: jest.fn(() => false),
}));

import {getJobDeliveryPhotos, getJobPickupPhotos} from '../../../../services/jobDetailApi';

const mockGetDeliveryPhotos = getJobDeliveryPhotos as jest.MockedFunction<typeof getJobDeliveryPhotos>;
const mockGetPickupPhotos = getJobPickupPhotos as jest.MockedFunction<typeof getJobPickupPhotos>;

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockJob(overrides?: Record<string, unknown>) {
    return {
        id: 100,
        completedTime: dayjs('2024-06-15T10:30:00Z'),
        courierData: {courierName: 'Test Driver'},
        deliveryAddress: {latitude: -33.8688, longitude: 151.2093},
        pickupAddress: {latitude: -33.8500, longitude: 151.2100},
        ...overrides,
    } as any;
}

function createMockPhotoData(overrides?: Record<string, unknown>) {
    return {
        data: 'aGVsbG8=',
        contentType: 'image/png',
        fileName: 'photo.png',
        s3Key: 'photos/photo.png',
        ...overrides,
    };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('usePodPhotos', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
        queryClient = createTestQueryClient();
        jest.clearAllMocks();
    });

    function renderUsePodPhotos(options: {job: any; isRecurringJob: boolean}) {
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        return renderHook(() => usePodPhotos(options), {wrapper});
    }

    it('does not fetch photos when job is undefined', async () => {
        const {result} = renderUsePodPhotos({job: undefined, isRecurringJob: false});

        await act(async () => {});

        expect(mockGetDeliveryPhotos).not.toHaveBeenCalled();
        expect(mockGetPickupPhotos).not.toHaveBeenCalled();
        expect(result.current.deliveryPhotos).toEqual([]);
        expect(result.current.pickupPhotos).toEqual([]);
    });

    it('does not fetch photos for recurring jobs', async () => {
        const job = createMockJob();
        const {result} = renderUsePodPhotos({job, isRecurringJob: true});

        await act(async () => {});

        expect(mockGetDeliveryPhotos).not.toHaveBeenCalled();
        expect(mockGetPickupPhotos).not.toHaveBeenCalled();
        expect(result.current.deliveryPhotos).toEqual([]);
    });

    it('does not fetch photos when job has no completedTime', async () => {
        const job = createMockJob({completedTime: null});
        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        await act(async () => {});

        expect(mockGetDeliveryPhotos).not.toHaveBeenCalled();
        expect(mockGetPickupPhotos).not.toHaveBeenCalled();
        expect(result.current.deliveryPhotos).toEqual([]);
    });

    it('fetches both delivery and pickup photos when job is completed', async () => {
        const job = createMockJob();
        mockGetDeliveryPhotos.mockResolvedValueOnce([createMockPhotoData()] as any);
        mockGetPickupPhotos.mockResolvedValueOnce([createMockPhotoData()] as any);

        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetDeliveryPhotos).toHaveBeenCalledWith(100, 2024, 6, expect.objectContaining({signal: expect.any(AbortSignal)}));
        expect(mockGetPickupPhotos).toHaveBeenCalledWith(100, 2024, 6, expect.objectContaining({signal: expect.any(AbortSignal)}));
        expect(result.current.deliveryPhotos).toHaveLength(1);
        expect(result.current.pickupPhotos).toHaveLength(1);
    });

    it('processes photo data correctly with base64 to data URL conversion', async () => {
        const job = createMockJob();
        mockGetDeliveryPhotos.mockResolvedValueOnce([createMockPhotoData({data: 'abc123'})] as any);
        mockGetPickupPhotos.mockResolvedValueOnce([] as any);

        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.deliveryPhotos[0].url).toBe('data:image/png;base64,abc123');
        expect(result.current.deliveryPhotos[0].uploadedBy).toBe('Test Driver');
        expect(result.current.deliveryPhotos[0].coordinates).toEqual({lat: -33.8688, lng: 151.2093});
        expect(result.current.deliveryPhotos[0].contentType).toBe('image/png');
        expect(result.current.deliveryPhotos[0].fileName).toBe('photo.png');
    });

    it('uses pickup coordinates for pickup photos', async () => {
        const job = createMockJob();
        mockGetDeliveryPhotos.mockResolvedValueOnce([] as any);
        mockGetPickupPhotos.mockResolvedValueOnce([createMockPhotoData()] as any);

        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.pickupPhotos[0].coordinates).toEqual({lat: -33.8500, lng: 151.2100});
    });

    it('filters image-only photos correctly, excluding non-image files', async () => {
        const job = createMockJob();
        const imagePhoto = createMockPhotoData({contentType: 'image/jpeg', fileName: 'photo.jpg'});
        const pdfPhoto = createMockPhotoData({contentType: 'application/pdf', fileName: 'doc.pdf'});
        mockGetDeliveryPhotos.mockResolvedValueOnce([imagePhoto, pdfPhoto] as any);
        mockGetPickupPhotos.mockResolvedValueOnce([] as any);

        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.deliveryPhotos).toHaveLength(2);
        expect(result.current.imageOnlyDeliveryPhotos).toHaveLength(1);
        expect(result.current.imageOnlyDeliveryPhotos[0].fileName).toBe('photo.jpg');
    });

    it('returns loading state while fetching', () => {
        const job = createMockJob();
        mockGetDeliveryPhotos.mockReturnValue(new Promise(() => {}));
        mockGetPickupPhotos.mockReturnValue(new Promise(() => {}));

        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        expect(result.current.isLoading).toBe(true);
        expect(result.current.deliveryPhotos).toEqual([]);
        expect(result.current.pickupPhotos).toEqual([]);
    });

    it('returns empty url when photo has no data', async () => {
        const job = createMockJob();
        mockGetDeliveryPhotos.mockResolvedValueOnce([createMockPhotoData({data: undefined})] as any);
        mockGetPickupPhotos.mockResolvedValueOnce([] as any);

        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.deliveryPhotos[0].url).toBe('');
    });
});
