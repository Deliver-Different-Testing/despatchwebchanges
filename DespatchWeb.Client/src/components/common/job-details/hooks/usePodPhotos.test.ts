/**
 * usePodPhotos Hook Tests
 */

import type {MockedFunction} from 'vitest';
import {renderHook, waitFor, act} from '@testing-library/react';
import {QueryClient} from '@tanstack/react-query';
import {usePodPhotos} from './usePodPhotos';
import {createTestQueryClient, createWrapper} from '../../../../test/utils';
import {JobStatus} from '../../../../types/enums/job-status.enum';
import dayjs from 'dayjs';

// Mock API services
vi.mock('../../../../api/jobDetailApi', () => ({
    getJobDeliveryPhotos: vi.fn(),
    getJobPickupPhotos: vi.fn(),
}));

vi.mock('../../../../utils/dateUtils', () => ({
    formatLongDateTime: vi.fn(() => '2024-06-15 10:30 AM'),
    isUsCustomer: vi.fn(() => false),
}));

import {getJobDeliveryPhotos, getJobPickupPhotos} from '../../../../api/jobDetailApi';

const mockGetDeliveryPhotos = getJobDeliveryPhotos as MockedFunction<typeof getJobDeliveryPhotos>;
const mockGetPickupPhotos = getJobPickupPhotos as MockedFunction<typeof getJobPickupPhotos>;

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockJob(overrides?: Record<string, unknown>) {
    return {
        id: 100,
        statusId: JobStatus.Completed,
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
        vi.clearAllMocks();
    });

    function renderUsePodPhotos(options: {job: any; isRecurringJob: boolean}) {
        const wrapper = createWrapper({withTheme: false, withQueryClient: true, queryClient});
        return renderHook(() => usePodPhotos(options), {wrapper});
    }

    it.each([
        ['job is undefined', () => ({job: undefined, isRecurringJob: false})],
        ['recurring jobs', () => ({job: createMockJob(), isRecurringJob: true})],
        ['a job that has not been picked up', () => ({
            job: createMockJob({statusId: JobStatus.New, completedTime: null}),
            isRecurringJob: false,
        })],
    ])('does not fetch photos for %s', async (_name, buildOptions) => {
        const {result} = renderUsePodPhotos(buildOptions());

        await act(async () => {});

        expect(mockGetDeliveryPhotos).not.toHaveBeenCalled();
        expect(mockGetPickupPhotos).not.toHaveBeenCalled();
        expect(result.current.deliveryPhotos).toEqual([]);
        expect(result.current.pickupPhotos).toEqual([]);
    });

    it('fetches pickup photos (but not delivery) once picked up, keyed off puTime', async () => {
        const job = createMockJob({
            statusId: JobStatus.PickedUp,
            completedTime: null,
            puTime: dayjs('2024-03-10T08:00:00Z'),
        });
        mockGetPickupPhotos.mockResolvedValueOnce([createMockPhotoData()] as any);

        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetDeliveryPhotos).not.toHaveBeenCalled();
        expect(mockGetPickupPhotos).toHaveBeenCalledWith(
            100,
            2024,
            3,
            expect.objectContaining({signal: expect.any(AbortSignal)})
        );
        expect(result.current.pickupPhotos).toHaveLength(1);
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

    it('uses linkedJobId for the S3 lookup when the panel is showing a bulk job', async () => {
        // A bulk row's `id` is a BulkJobId, which never matches the `{jobId}-` S3 key prefix. The
        // linked live job id is the only one the courier device wrote media against.
        const job = createMockJob({id: 5001, linkedJobId: 100});
        mockGetDeliveryPhotos.mockResolvedValueOnce([createMockPhotoData()] as any);
        mockGetPickupPhotos.mockResolvedValueOnce([] as any);

        const {result} = renderUsePodPhotos({job, isRecurringJob: false});

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockGetDeliveryPhotos).toHaveBeenCalledWith(100, 2024, 6, expect.anything());
        expect(mockGetPickupPhotos).toHaveBeenCalledWith(100, 2024, 6, expect.anything());
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
