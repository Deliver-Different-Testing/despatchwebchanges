/**
 * Hook for loading and managing POD photos
 */

import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {queryKeys} from '../../../../query/queryClient';
import {getJobDeliveryPhotos, getJobPickupPhotos} from '../../../../services/jobDetailApi';
import {formatLongDateTime} from '../../../../utils/dateUtils';
import {isImageFile, podMediaJobId} from '../JobDetails.types';
import type {PodPhoto, IJob} from '../JobDetails.types';
import {JobStatus} from '../../../../../enums/job-status.enum';
import type {Dayjs} from 'dayjs';
import dayjs from 'dayjs';

interface UsePodPhotosOptions {
    job?: IJob;
    isRecurringJob: boolean;
}

/**
 * Statuses at which a job has been picked up or moved further along. 
 */
const PICKED_UP_OR_LATER = new Set<number>([
    JobStatus.PickedUp,
    JobStatus.InTransit,
    JobStatus.OutForDelivery,
    JobStatus.LateDelivery,
    JobStatus.AwaitingPod,
    JobStatus.Completed,
    JobStatus.AssumingCompleted,
    JobStatus.Undeliverable,
]);

function processPhotoData(
    photosData: Array<{ data?: string; contentType?: string; fileName?: string; s3Key?: string }>,
    job: IJob,
    isDelivery: boolean
): PodPhoto[] {
    if (!photosData?.length) return [];

    return photosData
        .map((photoData): PodPhoto | null => {
            try {
                const tsSource = isDelivery ? job.completedTime : (job.puTime ?? job.completedTime);
                return {
                    url: photoData.data ? `data:image/png;base64,${photoData.data}` : '',
                    timestamp: tsSource
                        ? formatLongDateTime(tsSource as Dayjs)
                        : undefined,
                    uploadedBy: job.courierData?.courierName ?? 'Unknown',
                    coordinates: {
                        lat: isDelivery
                            ? (job.deliveryAddress?.latitude ?? 0)
                            : (job.pickupAddress?.latitude ?? 0),
                        lng: isDelivery
                            ? (job.deliveryAddress?.longitude ?? 0)
                            : (job.pickupAddress?.longitude ?? 0),
                    },
                    contentType: photoData.contentType,
                    fileName: photoData.fileName,
                    s3Key: photoData.s3Key,
                };
            } catch {
                return null;
            }
        })
        .filter((photo): photo is PodPhoto => photo !== null);
}

export function usePodPhotos({job, isRecurringJob}: UsePodPhotosOptions) {
    const completedTime = job?.completedTime;
    // A bulk row's own id is a BulkJobId; S3 keys POD media by the live job id, so prefer the link.
    const jobId = job ? podMediaJobId(job) : 0;

    // Delivery photos are proof-of-delivery, so they only exist once the job is
    // completed. Pickup photos are uploaded at pickup, so they're available from
    // the PickedUp status onward.
    const hasCompleted = !!completedTime && !isRecurringJob;
    const hasBeenPickedUp = !isRecurringJob && PICKED_UP_OR_LATER.has(job?.statusId ?? -1);

    // S3 photos are keyed by their upload month, so fetch each set using the
    // timestamp that best approximates when it was uploaded: completion time for
    // delivery photos, pickup time for pickup photos.
    const deliveryDayjs = completedTime ? dayjs(completedTime as Dayjs) : null;
    const deliveryMonth = deliveryDayjs ? deliveryDayjs.month() + 1 : 0;
    const deliveryYear = deliveryDayjs ? deliveryDayjs.year() : 0;

    const pickupRef = job?.puTime ?? completedTime ?? job?.dispatchTime;
    const pickupDayjs = pickupRef ? dayjs(pickupRef as Dayjs) : null;
    const pickupMonth = pickupDayjs ? pickupDayjs.month() + 1 : 0;
    const pickupYear = pickupDayjs ? pickupDayjs.year() : 0;

    const deliveryQuery = useQuery({
        queryKey: queryKeys.jobs.photos(jobId, 'delivery'),
        queryFn: ({signal}) => getJobDeliveryPhotos(jobId, deliveryYear, deliveryMonth, {signal}),
        enabled: hasCompleted && jobId > 0,
        staleTime: 60 * 1000,
    });

    const pickupQuery = useQuery({
        queryKey: queryKeys.jobs.photos(jobId, 'pickup'),
        queryFn: ({signal}) => getJobPickupPhotos(jobId, pickupYear, pickupMonth, {signal}),
        enabled: hasBeenPickedUp && jobId > 0,
        staleTime: 60 * 1000,
    });

    // Depend on specific job fields used by processPhotoData, not the whole job object
    // (job reference changes on every React Query refetch even when data is identical)
    const completedTimeVal = job?.completedTime;
    const courierName = job?.courierData?.courierName;
    const deliveryLat = job?.deliveryAddress?.latitude;
    const deliveryLng = job?.deliveryAddress?.longitude;
    const pickupLat = job?.pickupAddress?.latitude;
    const pickupLng = job?.pickupAddress?.longitude;

    const deliveryPhotos = useMemo(() => {
        if (!deliveryQuery.data || !job) return [];
        return processPhotoData(deliveryQuery.data, job, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deliveryQuery.data, completedTimeVal, courierName, deliveryLat, deliveryLng]);

    const pickupPhotos = useMemo(() => {
        if (!pickupQuery.data || !job) return [];
        return processPhotoData(pickupQuery.data, job, false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pickupQuery.data, completedTimeVal, courierName, pickupLat, pickupLng]);

    const imageOnlyDeliveryPhotos = useMemo(
        () => deliveryPhotos.filter(isImageFile),
        [deliveryPhotos]
    );

    const imageOnlyPickupPhotos = useMemo(
        () => pickupPhotos.filter(isImageFile),
        [pickupPhotos]
    );

    return {
        deliveryPhotos,
        pickupPhotos,
        imageOnlyDeliveryPhotos,
        imageOnlyPickupPhotos,
        isLoading: deliveryQuery.isLoading || pickupQuery.isLoading,
    };
}
