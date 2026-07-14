import type {DfrntPageViewModel} from '../../../../interfaces/dfrnt-page-view-model.interface';

export interface MapView {
    center: {lat: number; lng: number};
    zoom: number;
}

/**
 * The map's centre/zoom for the current despatch-view selection, mirroring V1
 * `home.controller.updateMapForSelectedViews` plus the constructor default:
 *   - a single selected view → that view's centre at zoom 7;
 *   - no view or multiple views → the tenant default centre at zoom 4.
 */
export function computeMapView(
    views: DfrntPageViewModel[],
    defaultCenter: {lat: number; lng: number},
): MapView {
    if (views.length === 1) {
        const v = views[0];
        if (Number.isFinite(v.centerLatitude) && Number.isFinite(v.centerLongitude)) {
            return {center: {lat: v.centerLatitude, lng: v.centerLongitude}, zoom: 7};
        }
    }
    return {center: defaultCenter, zoom: 4};
}
