/**
 * Map framing for the Nationwide page.
 *
 * Framework-free so the AngularJS controller and the React page share one
 * implementation. Extracted from `NationwideControl.calculateMapBounds` (1145).
 */

import {IDispatchJob} from '../../../../interfaces/job.interface';

/** Speed id that marks a job as air freight; drives the map's `flight` flag. */
export const FLIGHT_SPEED_ID = 415;

/** Zoom used when a job has no usable pickup/delivery pair. */
export const DEFAULT_ZOOM = 7;

export interface Coordinates {
    lat: number;
    lng: number;
}

export interface MapBoundsOptions {
    isUsCustomer: boolean;
    usCentre: Coordinates;
    nzCentre: Coordinates;
}

export interface MapBoundsResult {
    center: Coordinates;
    zoom: number;
    selectedJobIndex: number;
    job?: {
        id: number;
        pickup: Coordinates;
        delivery: Coordinates;
        childJobs: never[];
        flight: boolean;
    };
}

/**
 * Zoom for a bounding span in degrees.
 *
 * Thresholds are exclusive, matching V1 — a span of exactly 40 degrees takes
 * the next step down (4, not 3).
 */
export function zoomForSpan(maxDiff: number): number {
    if (maxDiff > 40) return 3;
    if (maxDiff > 20) return 4;
    if (maxDiff > 10) return 5;
    if (maxDiff > 5) return 6;
    if (maxDiff > 2) return 7;
    if (maxDiff > 1) return 8;
    if (maxDiff > 0.5) return 9;
    if (maxDiff > 0.1) return 10;
    return 12;
}

/**
 * Centre and zoom to frame a job's pickup and delivery.
 *
 * Falls back to the tenant's country centre when either address is missing.
 * `childJobs` is always empty — V1 never populated it, and child-job markers
 * were never rendered on this page.
 */
export function calculateMapBounds(
    job: IDispatchJob,
    options: MapBoundsOptions,
): MapBoundsResult {
    const fallbackCentre = options.isUsCustomer ? options.usCentre : options.nzCentre;

    if (!job || !job.pickupAddress || !job.deliveryAddress) {
        return {
            center: fallbackCentre,
            zoom: DEFAULT_ZOOM,
            selectedJobIndex: 0,
        };
    }

    const pickup: Coordinates = {
        lat: job.pickupAddress?.latitude ?? 0,
        lng: job.pickupAddress?.longitude ?? 0,
    };
    const delivery: Coordinates = {
        lat: job.deliveryAddress?.latitude ?? 0,
        lng: job.deliveryAddress?.longitude ?? 0,
    };

    const latDiff = Math.abs(pickup.lat - delivery.lat);
    const lngDiff = Math.abs(pickup.lng - delivery.lng);

    return {
        center: {
            lat: (pickup.lat + delivery.lat) / 2,
            lng: (pickup.lng + delivery.lng) / 2,
        },
        zoom: zoomForSpan(Math.max(latDiff, lngDiff)),
        job: {
            id: job.id,
            pickup,
            delivery,
            childJobs: [],
            flight: job.speedId === FLIGHT_SPEED_ID,
        },
        selectedJobIndex: 0,
    };
}
