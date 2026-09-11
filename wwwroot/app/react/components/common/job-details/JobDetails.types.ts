/**
 * Shared types for the React Job Details component
 */

// Re-export core types from the AngularJS interfaces for React usage
// These are the same interfaces - React components consume the transformed IJob/IJobGroup
export type {
    IJob,
    IJobGroup,
    IJobGroupDto,
    ISuggestion,
    InternalStatus,
    IAddressViewModel,
    ICourierData,
    IAgent,
    IPalletInfo,
    IParcelDimensions,
    IReadTrackerInfo,
    IAssignedFlight,
} from '../../../../interfaces/job.interface';

export type {IFlightSegment} from '../../../../interfaces/nationwideFlight.interfaces';
export type {PodPhoto} from '../pod-photo-viewer/pod-photo-viewer.types';
export type {UpdatePodDetailsRequest} from '../../../../interfaces/requests.interfaces';
export type {Is3PhotoInfo} from '../../../../interfaces/aws.interfaces';

/** Configuration passed from AngularJS bridge to mount the React component */
export interface MountJobDetailsConfig {
    jobId?: number;
    isRecurringJob: boolean;
    isBulkJob: boolean;
    isUsCustomer: boolean;
    showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
    onJobUpdate?: () => void;
    onStatusChange?: (statusId: number) => void;
    onJobReadChanged?: (jobId: number, isRead: boolean) => void;
    onRelatedJobChange?: (jobId: number) => void;
    /** Incremented by refreshJobDetails() to signal the component to force-refetch */
    _refreshNonce?: number;
}

/** Field visibility map stored in localStorage */
export interface FieldVisibility {
    [key: string]: boolean;
}

/** Default field visibility settings */
export const DEFAULT_FIELD_VISIBILITY: FieldVisibility = {
    // Main section visibility toggles
    additionalInfo: true,
    deliveryDetails: true,
    clientInformation: true,
    bookedBy: true,
    jobDetails: true,
    packageDetails: true,

    // Delivery Details section fields
    dispatcherName: true,
    courierName: true,
    courierNumber: true,
    courierMobile: true,
    scheduleName: true,

    // Job Details section fields
    speedName: true,
    notifiedSpeed: true,
    jobTypeDescription: true,
    sizeText: true,
    refA: true,
    refB: true,
    ourRef: true,
    conNote: true,

    // Client Information section fields
    client: true,

    // Booked By section fields
    loggedInContactName: true,
    fromContactName: true,
    fromContactNumber: true,
    bookingSource: true,

    // Inter-tenant change-request history (partner jobs only)
    partnerChangeRequests: true,

    // Additional fields
    pricing: true,
    booked: true,
    startTime: true,
    puTime: true,
    deliverBy: true,
    dispatch: true,
    podName: true,
    podTime: true,
    followUp: true,
    clientName: true,
    pickupLocation: true,
    deliveryLocation: true,
    totalMiles: true,
    dimensions: true,
    weight: true,
    dgDocs: true,
    leaveParcel: true,
    tracking: true,
    mobile: true,
    email: true,
    checkboxes: true,
    truckOptions: true,
};

/** Job type options used in the select dialog */
export const JOB_TYPE_OPTIONS = [
    {id: 1, text: 'Pickup'},
    {id: 2, text: 'Delivery'},
    {id: 3, text: '3rd-Party'},
];

/** Notification type options */
export const NOTIFY_OPTIONS = [
    {id: 0, text: 'Not Set'},
    {id: 1, text: 'Pickup'},
    {id: 2, text: 'Delivery'},
    {id: 3, text: '3rd-Party'},
];

/** Accepted type options */
export const ACCEPTED_OPTIONS = [
    {id: 0, text: 'Not Set'},
    {id: 1, text: 'Pickup'},
    {id: 2, text: 'Delivery'},
    {id: 3, text: '3rd-Party'},
];

/** Tracking method options */
export const TRACKING_OPTIONS = [
    {id: 1, text: 'Email'},
    {id: 2, text: 'Mobile'},
    {id: 3, text: 'Email & Mobile'},
];

/** Get tracking method display text */
export function getTrackingMethodText(method?: number): string {
    switch (method || 0) {
        case 1: return 'Email';
        case 2: return 'Mobile';
        case 3: return 'Email & Mobile';
        default: return '';
    }
}

/**
 * The job id POD media, documents and uploads are keyed by. A bulk (scheduled) row's own id is a
 * BulkJobId; everything POD-related lives against the live job it materialised into.
 */
export function podMediaJobId(job: {id: number; linkedJobId?: number}): number {
    return job.linkedJobId ?? job.id;
}

/** Check if a photo file is an image */
export function isImageFile(photo: {contentType?: string; fileName?: string; s3Key?: string}): boolean {
    if (!photo) return false;
    if (photo.contentType?.startsWith('image/')) return true;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const name = photo.fileName || photo.s3Key || '';
    return imageExtensions.some(ext => name.toLowerCase().endsWith(ext));
}

/** Check if a photo file is a PDF */
export function isPdfFile(photo: {contentType?: string; fileName?: string; s3Key?: string}): boolean {
    if (!photo) return false;
    if (photo.contentType === 'application/pdf') return true;
    const name = photo.fileName || photo.s3Key || '';
    return name.toLowerCase().endsWith('.pdf');
}
