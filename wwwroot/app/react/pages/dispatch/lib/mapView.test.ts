import type {DfrntPageViewModel} from '../../../../interfaces/dfrnt-page-view-model.interface';
import {computeMapView} from './mapView';

const view = (over: Partial<DfrntPageViewModel> = {}): DfrntPageViewModel => ({
    id: 1,
    name: 'View',
    centerLatitude: 40,
    centerLongitude: -100,
    selected: true,
    ...over,
});

const DEFAULT = {lat: 39.8, lng: -98.5};

describe('computeMapView', () => {
    it('uses the tenant default centre at zoom 4 when no view is selected', () => {
        expect(computeMapView([], DEFAULT)).toEqual({center: DEFAULT, zoom: 4});
    });

    it('centres on a single selected view at zoom 7', () => {
        expect(computeMapView([view({centerLatitude: -41.3, centerLongitude: 174.8})], DEFAULT))
            .toEqual({center: {lat: -41.3, lng: 174.8}, zoom: 7});
    });

    it('falls back to the default when the single view has non-finite coords', () => {
        expect(computeMapView([view({centerLatitude: NaN, centerLongitude: 174.8})], DEFAULT))
            .toEqual({center: DEFAULT, zoom: 4});
    });

    it('uses the tenant default centre at zoom 4 for multiple views', () => {
        expect(computeMapView([view({id: 1}), view({id: 2})], DEFAULT))
            .toEqual({center: DEFAULT, zoom: 4});
    });

    describe('network partner centre', () => {
        const NP = {lat: -36.85, lng: 174.76};

        it('centres on the partner address at zoom 7 instead of the country centre', () => {
            // A country centre at zoom 4 is useless to a partner working one
            // address; the view-level centre still wins when there is one.
            expect(computeMapView([], DEFAULT, NP)).toEqual({center: NP, zoom: 7});
            expect(computeMapView([view({id: 1}), view({id: 2})], DEFAULT, NP))
                .toEqual({center: NP, zoom: 7});
        });

        it('keeps a single view\'s own centre ahead of the partner address', () => {
            expect(computeMapView([view({centerLatitude: -41.3, centerLongitude: 174.8})], DEFAULT, NP))
                .toEqual({center: {lat: -41.3, lng: 174.8}, zoom: 7});
        });

        it('falls back to the country centre when there is no partner address', () => {
            expect(computeMapView([], DEFAULT, null)).toEqual({center: DEFAULT, zoom: 4});
        });
    });
});
