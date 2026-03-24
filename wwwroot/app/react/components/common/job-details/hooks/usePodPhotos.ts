/**
 * Hook for loading and managing POD photos
 */

import {useQuery} from '@tanstack/react-query';
import {useMemo} from 'react';
import {queryKeys} from '../../../../query/queryClient';
import {getJobDeliveryPhotos, getJobPickupPhotos} from '../../../../services/jobDetailApi';
import {formatLongDateTime} from '../../../../utils/dateUtils';
import {isImageFile} from '../JobDetails.types';
import type {PodPhoto, IJob} from '../JobDetails.types';
import type {Dayjs} from 'dayjs';
import dayjs from 'dayjs';

interface UsePodPhotosOptions {
    job: IJob | undefined;
    isRecurringJob: boolean;
}

function processPhotoData(
    photosData: Array<{ data?: string; contentType?: string; fileName?: string; s3Key?: string }>,
    job: IJob,
    isDelivery: boolean
): PodPhoto[] {
    if (!photosData?.length) return [];

    return photosData
        .map((photoData): PodPhoto | null => {
            try {
                return {
                    url: photoData.data ? `data:image/png;base64,${photoData.data}` : '',
                    timestamp: job.completedTime
                        ? formatLongDateTime(job.completedTime as Dayjs)
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
    const jobId = job?.id ?? 0;
    const hasCompleted = !!completedTime && !isRecurringJob;

    const completedDayjs = hasCompleted ? dayjs(completedTime as Dayjs) : null;
    const month = completedDayjs ? completedDayjs.month() + 1 : 0;
    const year = completedDayjs ? completedDayjs.year() : 0;

    const deliveryQuery = useQuery({
        queryKey: queryKeys.jobs.photos(jobId, 'delivery'),
        queryFn: ({signal}) => getJobDeliveryPhotos(jobId, year, month, {signal}),
        enabled: hasCompleted && jobId > 0,
        staleTime: 60 * 1000,
    });

    const pickupQuery = useQuery({
        queryKey: queryKeys.jobs.photos(jobId, 'pickup'),
        queryFn: ({signal}) => getJobPickupPhotos(jobId, year, month, {signal}),
        enabled: hasCompleted && jobId > 0,
        staleTime: 60 * 1000,
    });

    const deliveryPhotos = useMemo(() => {
        if (!deliveryQuery.data || !job) return [];
        return processPhotoData(deliveryQuery.data, job, true);
    }, [deliveryQuery.data, job]);

    const pickupPhotos = useMemo(() => {
        if (!pickupQuery.data || !job) return [];
        return processPhotoData(pickupQuery.data, job, false);
    }, [pickupQuery.data, job]);

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
