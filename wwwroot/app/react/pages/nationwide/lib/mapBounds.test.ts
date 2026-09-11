/** @jest-environment node */
/**
 * The zoom ladder is the kind of tuned behaviour that vanishes in a rewrite, so
 * it gets pinned here before the React page consumes it. Extracted from
 * `NationwideControl.calculateMapBounds` (1145).
 */

import {FLIGHT_SPEED_ID, calculateMapBounds} from './mapBounds';

const NZ_CENTRE = {lat: -41, lng: 174};
const US_CENTRE = {lat: 39, lng: -98};

const centres = {usCentre: US_CENTRE, nzCentre: NZ_CENTRE};

function jobAt(pickup: {lat: number; lng: number}, delivery: {lat: number; lng: number}, extra: object = {}) {
    return {
        id: 1,
        speedId: 1,
        pickupAddress: {latitude: pickup.lat, longitude: pickup.lng},
        deliveryAddress: {latitude: delivery.lat, longitude: delivery.lng},
        ...extra,
    } as never;
}

describe('calculateMapBounds', () => {
    describe('fallback when the job has no usable addresses', () => {
        it('falls back to the tenant centre at zoom 7', () => {
            expect(calculateMapBounds(undefined as never, {...centres, isUsCustomer: false}))
                .toEqual({center: NZ_CENTRE, zoom: 7, selectedJobIndex: 0});
        });

        it('uses the US centre for a US tenant', () => {
            expect(calculateMapBounds(undefined as never, {...centres, isUsCustomer: true}))
                .toEqual({center: US_CENTRE, zoom: 7, selectedJobIndex: 0});
        });

        it('falls back when either address is missing', () => {
            const noDelivery = {id: 1, pickupAddress: {latitude: 1, longitude: 1}} as never;
            const noPickup = {id: 1, deliveryAddress: {latitude: 1, longitude: 1}} as never;

            expect(calculateMapBounds(noDelivery, {...centres, isUsCustomer: false}).zoom).toBe(7);
            expect(calculateMapBounds(noPickup, {...centres, isUsCustomer: false}).zoom).toBe(7);
        });
    });

    it('centres on the midpoint of pickup and delivery', () => {
        const result = calculateMapBounds(
            jobAt({lat: -36, lng: 174}, {lat: -42, lng: 172}),
            {...centres, isUsCustomer: false},
        );

        expect(result.center).toEqual({lat: -39, lng: 173});
    });

    describe('zoom ladder, keyed on the larger of the lat/lng spans', () => {
        // Boundaries are exclusive in V1 (`maxDiff > 40`), so a span of exactly
        // 40 takes the next step down the ladder.
        it.each([
            [50, 3],
            [40, 4],
            [30, 4],
            [20, 5],
            [15, 5],
            [10, 6],
            [7, 6],
            [5, 7],
            [3, 7],
            [2, 8],
            [1.5, 8],
            [1, 9],
            [0.7, 9],
            [0.5, 10],
            [0.2, 10],
            [0.1, 12],
            [0, 12],
        ])('a span of %s degrees gives zoom %i', (span, expected) => {
            const result = calculateMapBounds(
                jobAt({lat: 0, lng: 0}, {lat: span, lng: 0}),
                {...centres, isUsCustomer: false},
            );
            expect(result.zoom).toBe(expected);
        });

        it('uses the longitude span when it is the larger one', () => {
            const result = calculateMapBounds(
                jobAt({lat: 0, lng: 0}, {lat: 0.2, lng: 30}),
                {...centres, isUsCustomer: false},
            );
            expect(result.zoom).toBe(4);
        });
    });

    describe('job payload', () => {
        it('carries the pickup and delivery coordinates and the job id', () => {
            const result = calculateMapBounds(
                jobAt({lat: -36, lng: 174}, {lat: -42, lng: 172}, {id: 99}),
                {...centres, isUsCustomer: false},
            );

            expect(result.job).toEqual({
                id: 99,
                pickup: {lat: -36, lng: 174},
                delivery: {lat: -42, lng: 172},
                childJobs: [],
                flight: false,
            });
        });

        it('flags a flight job by the nationwide speed id', () => {
            const result = calculateMapBounds(
                jobAt({lat: -36, lng: 174}, {lat: -42, lng: 172}, {speedId: FLIGHT_SPEED_ID}),
                {...centres, isUsCustomer: false},
            );

            expect(result.job?.flight).toBe(true);
        });

        it('treats absent coordinates as zero, as V1 did', () => {
            const job = {
                id: 1,
                pickupAddress: {},
                deliveryAddress: {},
            } as never;

            const result = calculateMapBounds(job, {...centres, isUsCustomer: false});

            expect(result.job?.pickup).toEqual({lat: 0, lng: 0});
            expect(result.center).toEqual({lat: 0, lng: 0});
        });
    });
});
