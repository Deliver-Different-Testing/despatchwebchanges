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
    npCenter?: {lat: number; lng: number} | null,
): MapView {
    if (views.length === 1) {
        const v = views[0];
        if (Number.isFinite(v.centerLatitude) && Number.isFinite(v.centerLongitude)) {
            return {center: {lat: v.centerLatitude, lng: v.centerLongitude}, zoom: 7};
        }
    }
    // A network partner opens on their own address rather than the country centre,
    // and at the same zoom a single view gets — zoom 4 on one address is useless.
    if (npCenter) {
        return {center: npCenter, zoom: 7};
    }
    return {center: defaultCenter, zoom: 4};
}
