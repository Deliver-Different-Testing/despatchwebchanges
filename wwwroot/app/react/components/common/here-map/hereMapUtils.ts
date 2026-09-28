/**
 * HereMap Utility Functions
 *
 * Stateless utility functions for HERE Maps operations.
 * Converted from HereMapService class methods.
 */

import type {
    Bounds,
    CourierLocation,
    HereMapConfig,
    HereMapCredentials,
    IHereMapChildJob,
    IHereMapJob,
    MapInstance,
    Point,
} from './HereMap.types';
import {DEFAULT_MAP_CONFIG, getDefaultMapCenter, MAP_CONSTANTS, MARKER_ICONS, SVG_TEMPLATES,} from './HereMap.types';

declare const H: any;

interface RoutingParameters {
    routingMode: string;
    transportMode: string;
    origin: string;
    destination: string;
    return: string;
}

/**
 * Remove a HERE Maps object from a Map or Group, swallowing the SDK's
 * IllegalOperationError if the object is no longer a child of the (root) group.
 * Use this whenever a removeObject call could race with disposal or with a
 * pending async callback that already cleared the object.
 */
export function safeRemoveObject(target: any, obj: any): void {
    if (!target || !obj) return;
    try {
        target.removeObject(obj);
    } catch (e) {
        console.warn('[HereMap] removeObject failed, ignoring:', e);
    }
}

/**
 * Batched variant of safeRemoveObject. Falls back to per-object removal if
 * the batch call throws (so one stale object doesn't drop the whole batch).
 */
export function safeRemoveObjects(target: any, objs: any[] | null | undefined): void {
    if (!target || !objs?.length) return;
    try {
        target.removeObjects(objs);
    } catch {
        // Fall back to per-object removal so a single stale entry doesn't
        // abort the batch — and so the wider error gets logged once per object
        objs.forEach((o) => safeRemoveObject(target, o));
    }
}

/**
 * Initialize HERE Maps platform with API key
 */
export function initPlatform(credentials: HereMapCredentials): any {
    return new H.service.Platform({
        apikey: credentials.apiKey,
    });
}

/**
 * Create a new map instance
 */
export function createMap(
    elementId: string,
    platform: any,
    config?: HereMapConfig
): MapInstance | null {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Map container element not found: ${elementId}`);
        return null;
    }

    const engineType = H.Map.EngineType['HARP'];
    const mapConfig: HereMapConfig = {...DEFAULT_MAP_CONFIG, center: getDefaultMapCenter(), ...config};

    // Initialize the default map layers
    const defaultLayers = platform.createDefaultLayers({engineType});

    // Create map instance
    const map = new H.Map(element, defaultLayers.raster.normal.map, {
        zoom: mapConfig.zoom,
        center: mapConfig.center,
        engineType: engineType,
    });

    // Add map behavior (pan/zoom)
    const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

    // Add UI components
    const ui = H.ui.UI.createDefault(map, defaultLayers);

    ui.removeControl('zoom');

    // Disable fractional zooming for Behavior
    behavior.disable(H.mapevents.Behavior.Feature.FRACTIONAL_ZOOM);

    // Add H.ui.ZoomControl with the disabled fractional zooming
    const zoomControl = new H.ui.ZoomControl({fractionalZoom: false});
    ui.addControl('zoom', zoomControl);

    return {
        map,
        behavior,
        ui,
        defaultLayers,
    };
}

/**
 * Resize map while preserving current view
 */
export function resizeMapPreserveView(map: any): void {
    if (map && map.getViewPort()) {
        // Store current center and zoom
        const center: Point = map.getCenter();
        const zoom: number = map.getZoom();

        // Force the map to recalculate its size based on container
        setTimeout(() => {
            map.getViewPort().resize();

            // Reset center and zoom
            map.setCenter(center);
            map.setZoom(zoom);
        }, 100);
    }
}

/**
 * Create or update a marker at the given position
 */
function createOrUpdateMarker(
    lat: number,
    lng: number,
    marker: any,
    map: any,
    iconUrl: string
): any {
    if (!marker) {
        const point = new H.geo.Point(lat, lng);
        const icon = new H.map.Icon(iconUrl, {size: {w: 50, h: 50}});
        marker = new H.map.Marker(point, {icon: icon});
        map.addObject(marker);
    } else {
        marker.setGeometry(new H.geo.Point(lat, lng));
    }
    return marker;
}

/**
 * Create or update the "from" (pickup) marker
 */
export function createFromMarker(
    lat: number,
    lng: number,
    fromMarker: any,
    map: any
): any {
    return createOrUpdateMarker(lat, lng, fromMarker, map, MARKER_ICONS.FROM);
}

/**
 * Create or update the "to" (delivery) marker
 */
export function createToMarker(
    lat: number,
    lng: number,
    toMarker: any,
    map: any
): any {
    return createOrUpdateMarker(lat, lng, toMarker, map, MARKER_ICONS.TO);
}

/**
 * Create or update the courier marker
 */
export function createCourierMarker(
    lat: number,
    lng: number,
    courierMarker: any,
    map: any,
    flight: boolean = false,
    lngDiff: number | undefined
): any {
    if (!courierMarker) {
        if (lngDiff !== undefined && flight) {
            const courierPoint = new H.geo.Point(lat, lng);

            let svgMarkup: string = flight
                ? SVG_TEMPLATES.PLANE
                : SVG_TEMPLATES.CAR;

            svgMarkup = svgMarkup.replace(
                '{{TRANSFORM}}',
                lngDiff > 0 ? 'transform="scale(-1, 1)"' : ''
            );

            const courierIcon = new H.map.Icon(svgMarkup, {
                anchor: {x: 35, y: 35},
            });
            courierMarker = new H.map.Marker(courierPoint, {icon: courierIcon});
            map.addObject(courierMarker);
        }
    } else {
        courierMarker.setGeometry(new H.geo.Point(lat, lng));
    }

    return courierMarker;
}

/**
 * Add an extra marker to the map
 */
export function addExtraMarker(
    lat: number,
    lng: number,
    extraMarkers: any[],
    map: any
): any[] {
    const point = new H.geo.Point(lat, lng);
    const icon = new H.map.Icon(MARKER_ICONS.EXTRA, {
        size: {w: 50, h: 50},
    });
    const marker = new H.map.Marker(point, {icon: icon});
    extraMarkers.push(marker);
    map.addObject(marker);

    return extraMarkers;
}

/**
 * Remove all extra markers from the map
 */
export function removeExtraMarkers(extraMarkers: any[], map: any): any[] {
    extraMarkers.forEach((marker) => {
        safeRemoveObject(map, marker);
    });
    return [];
}

/**
 * Remove an object from the map by its ID
 */
export function removeObjectById(id: string, map: any): void {
    if (!map) {
        console.warn('Map is undefined in removeObjectById');
        return;
    }

    map.getObjects().forEach((object: any) => {
        if (object.id === id) {
            safeRemoveObject(map, object);
        }
    });
}

/**
 * Remove all extra route lines from the map
 */
export function removeExtraRouteLines(extraRouteLines: any[], map: any): any[] {
    extraRouteLines.forEach((_, index) => {
        removeObjectById('route' + index, map);
    });
    return [];
}

/**
 * Expand a bounding box by a factor
 */
function expandBoundingBox(boundingBox: any, factor: number): any {
    const topLeft = boundingBox.getTopLeft();
    const bottomRight = boundingBox.getBottomRight();

    const latDiff: number = Math.abs(topLeft.lat - bottomRight.lat) * factor;
    const lngDiff: number = Math.abs(topLeft.lng - bottomRight.lng) * factor;

    return new H.geo.Rect(
        topLeft.lat + latDiff,
        topLeft.lng - lngDiff,
        bottomRight.lat - latDiff,
        bottomRight.lng + lngDiff
    );
}

/**
 * Center the map on a route
 */
export function centerMap(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    job: IHereMapJob | IHereMapChildJob,
    routeLine: any,
    extraRouteLines: any[],
    map: any
): void {
    const totalLat: number = fromLat + toLat;
    const totalLng: number = fromLng + toLng;
    const centerLat: number = totalLat / 2;
    const centerLng: number = totalLng / 2;

    map.setCenter({lat: centerLat, lng: centerLng});

    // Get the current bounding box
    const boundingBox: any = routeLine
        ? routeLine.getBoundingBox()
        : extraRouteLines[(job as any).index!]?.getBoundingBox();

    if (boundingBox) {
        const expandedBoundingBox = expandBoundingBox(
            boundingBox,
            MAP_CONSTANTS.BOUNDING_BOX_EXPAND_FACTOR
        );
        map.getViewModel().setLookAtData({bounds: expandedBoundingBox});
    }
}

/**
 * Create a curved path between two points (for flight paths)
 */
export function createCurvedPath(
    startPoint: Point,
    endPoint: Point,
    curvature: number = MAP_CONSTANTS.DEFAULT_CURVATURE
): Point[] {
    const dx: number = endPoint.lng - startPoint.lng;
    const dy: number = endPoint.lat - startPoint.lat;

    // Midpoint
    const midPoint: Point = {
        lat: startPoint.lat + dy * 0.5,
        lng: startPoint.lng + dx * 0.5,
    };

    // Calculate perpendicular offset for control point
    const offset = {
        lat: -dx * curvature,
        lng: dy * curvature,
    };

    // Control point
    const controlPoint: Point = {
        lat: midPoint.lat + Math.abs(offset.lat),
        lng: midPoint.lng + Math.abs(offset.lng),
    };

    // Generate points along the quadratic Bezier curve
    const curvePoints: Point[] = [];
    const steps: number = MAP_CONSTANTS.CURVE_STEPS;

    for (let t = 0; t <= 1; t += 1 / steps) {
        // Quadratic Bezier formula: B(t) = (1-t)^2*P0 + 2(1-t)tP1 + t^2*P2
        const lat: number =
            Math.pow(1 - t, 2) * startPoint.lat +
            2 * (1 - t) * t * controlPoint.lat +
            Math.pow(t, 2) * endPoint.lat;

        const lng: number =
            Math.pow(1 - t, 2) * startPoint.lng +
            2 * (1 - t) * t * controlPoint.lng +
            Math.pow(t, 2) * endPoint.lng;

        curvePoints.push({lat, lng});
    }

    return curvePoints;
}

/**
 * Draw a flight path (curved line) on the map
 */
export function drawFlightPath(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    map: any,
    id: string
): any {
    const lineString = new H.geo.LineString();
    const startPoint: Point = {lat: fromLat, lng: fromLng};
    const endPoint: Point = {lat: toLat, lng: toLng};

    const curvePoints: Point[] = createCurvedPath(startPoint, endPoint, 0.1);
    curvePoints.forEach((point) => lineString.pushPoint(point));

    const curvedLine = new H.map.Polyline(lineString, {
        style: {lineWidth: 4},
    });

    curvedLine.id = id;
    map.addObject(curvedLine);
    return curvedLine;
}

/**
 * Draw a driving route on the map
 */
function drawDrivingRoute(
    section: any,
    map: any,
    id: string,
    color: string
): any {
    const linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);
    const routeLine = new H.map.Polyline(linestring, {
        style: {strokeColor: color, lineWidth: 3},
    });

    routeLine.id = id;
    map.addObject(routeLine);
    return routeLine;
}

/**
 * Handle route viewport adjustment
 */
function handleRouteViewport(
    result: any,
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    job: IHereMapJob,
    routeLine: any,
    map: any
): void {
    if (result.routes[0].sections.length > 1) {
        const group = new H.map.Group();
        const group1 = new H.map.Marker({lat: fromLat, lng: fromLng});
        const group2 = new H.map.Marker({lat: toLat, lng: toLng});
        group.addObjects([group1, group2]);

        map.getViewModel().setLookAtData({bounds: group.getBoundingBox()});
        safeRemoveObjects(group, [group1, group2]);
    } else {
        map.getViewModel().setLookAtData({bounds: routeLine.getBoundingBox()});
    }

    centerMap(fromLat, fromLng, toLat, toLng, job, routeLine, [], map);
}

/**
 * Handle routing errors
 */
function handleRoutingError(error: any): void {
    console.error('Routing error:', error.message);
}

/**
 * Draw a route line between two points
 *
 * `signal` lets the caller cancel a still-in-flight routing request so the
 * async result callback doesn't add polylines/markers onto a map that's
 * already been cleared for a different job. Without it, switching jobs
 * faster than HERE can resolve a route leaves stale polylines on the map
 * that subsequent clearMap calls fail to remove (IllegalOperationError).
 */
export function drawRouteLine(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    routeLine: any,
    job: IHereMapJob,
    map: any,
    platform: any,
    flight: boolean,
    preserveView?: boolean,
    onRouteDrawn?: (routeLine: any) => void,
    signal?: AbortSignal
): void {
    const routingParameters: RoutingParameters = {
        routingMode: 'fast',
        transportMode: 'car',
        origin: `${fromLat},${fromLng}`,
        destination: `${toLat},${toLng}`,
        return: 'polyline',
    };

    const onResult = (result: any): void => {
        if (signal?.aborted) return;
        if (result.routes.length) {
            result.routes[0].sections.forEach((section: any) => {
                if (flight) {
                    routeLine = drawFlightPath(
                        fromLat,
                        fromLng,
                        toLat,
                        toLng,
                        map,
                        'route'
                    );
                } else {
                    routeLine = drawDrivingRoute(section, map, 'route', 'black');
                }
            });

            if (!preserveView) {
                handleRouteViewport(
                    result,
                    fromLat,
                    fromLng,
                    toLat,
                    toLng,
                    job,
                    routeLine,
                    map
                );
            }

            if (onRouteDrawn) {
                onRouteDrawn(routeLine);
            }
        }
    };

    const router = platform.getRoutingService(null, 8);
    router.calculateRoute(routingParameters, onResult, handleRoutingError);
}

/**
 * Add an extra route line for child jobs
 *
 * `signal` cancels the async result callback if the caller has moved on to
 * a different job — same rationale as drawRouteLine above.
 */
export function addExtraRouteLine(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    index: number,
    flight: boolean,
    extraRouteLines: any[],
    job: IHereMapJob,
    map: any,
    platform: any,
    isScopedJob?: boolean,
    preserveView?: boolean,
    onRouteAdded?: (routeLine: any, index: number) => void,
    signal?: AbortSignal
): void {
    const routingParameters: RoutingParameters = {
        routingMode: 'fast',
        transportMode: 'car',
        origin: `${fromLat},${fromLng}`,
        destination: `${toLat},${toLng}`,
        return: 'polyline',
    };

    const onResult = (result: any): void => {
        if (signal?.aborted) return;
        if (result.routes.length) {
            result.routes[0].sections.forEach((section: any) => {
                const routeId = 'route' + index;
                let routeLine: any;

                if (flight) {
                    routeLine = drawFlightPath(
                        fromLat,
                        fromLng,
                        toLat,
                        toLng,
                        map,
                        routeId
                    );
                } else {
                    routeLine = drawDrivingRoute(section, map, routeId, 'purple');
                }

                extraRouteLines.push(routeLine);
                if (job.childJobs && job.childJobs[index]) {
                    job.childJobs[index].index = extraRouteLines.length - 1;
                }

                if (onRouteAdded) {
                    onRouteAdded(routeLine, extraRouteLines.length - 1);
                }
            });

            if (
                !preserveView &&
                ((flight && isScopedJob == null) || isScopedJob)
            ) {
                if (job.childJobs && job.childJobs[index]) {
                    centerMap(
                        fromLat,
                        fromLng,
                        toLat,
                        toLng,
                        job.childJobs[index],
                        null,
                        extraRouteLines,
                        map
                    );
                    (job as any).index = job.childJobs[index].index;
                }
            }
        }
    };

    const router = platform.getRoutingService(null, 8);
    router.calculateRoute(routingParameters, onResult, handleRoutingError);
}

/**
 * Filter valid points (non-NaN coordinates)
 */
function filterValidPoints(points: Point[]): Point[] {
    return points.filter(
        (point) => point && !isNaN(point.lat) && !isNaN(point.lng)
    );
}

/**
 * Calculate bounds from an array of points
 */
function calculateBounds(points: Point[]): Bounds {
    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;

    points.forEach((point) => {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLng = Math.min(minLng, point.lng);
        maxLng = Math.max(maxLng, point.lng);
    });

    return {minLat, maxLat, minLng, maxLng};
}

/**
 * Create a padded bounding box from bounds
 */
function createPaddedBoundingBox(bounds: Bounds, padding: number): any {
    const latDiff: number = (bounds.maxLat - bounds.minLat) * padding;
    const lngDiff: number = (bounds.maxLng - bounds.minLng) * padding;

    return new H.geo.Rect(
        bounds.maxLat + latDiff, // top
        bounds.minLng - lngDiff, // left
        bounds.minLat - latDiff, // bottom
        bounds.maxLng + lngDiff // right
    );
}

/**
 * Auto-zoom the map to show all visible points
 */
export function autoZoomToShowAllPoints(
    map: any,
    points: Point[],
    padding: number = MAP_CONSTANTS.DEFAULT_PADDING
): void {
    if (!map || !points || points.length === 0) {
        console.warn('Invalid parameters for autoZoomToShowAllPoints');
        return;
    }

    const validPoints: Point[] = filterValidPoints(points);

    if (validPoints.length === 0) {
        console.warn('No valid points found for auto zoom');
        return;
    }

    if (validPoints.length === 1) {
        map.setCenter(validPoints[0]);
        map.setZoom(MAP_CONSTANTS.SINGLE_POINT_ZOOM);
        return;
    }

    const bounds = calculateBounds(validPoints);
    const boundingBox = createPaddedBoundingBox(bounds, padding);
    map.getViewModel().setLookAtData({bounds: boundingBox});
}

/**
 * Add job points to an array
 */
function addJobPoints(job: IHereMapJob, points: Point[]): void {
    // Add the main pickup point
    if (job?.pickup?.lat && job.pickup.lng) {
        points.push({lat: job.pickup.lat, lng: job.pickup.lng});
    }

    // Add the main delivery point
    if (job?.delivery?.lat && job.delivery.lng) {
        points.push({lat: job.delivery.lat, lng: job.delivery.lng});
    }

    // Add child job points
    if (job?.childJobs && Array.isArray(job.childJobs)) {
        job.childJobs.forEach((childJob) => {
            if (childJob?.pickup?.lat && childJob.pickup.lng) {
                points.push({
                    lat: childJob.pickup.lat,
                    lng: childJob.pickup.lng,
                });
            }
            if (childJob?.delivery?.lat && childJob.delivery.lng) {
                points.push({
                    lat: childJob.delivery.lat,
                    lng: childJob.delivery.lng,
                });
            }
        });
    }
}

/**
 * Add extra marker points to an array
 */
function addExtraMarkerPoints(extraMarkers: any[], points: Point[]): void {
    extraMarkers.forEach((marker) => {
        if (marker?.getGeometry) {
            const geometry = marker.getGeometry();
            if (geometry) {
                points.push({lat: geometry.lat, lng: geometry.lng});
            }
        }
    });
}

/**
 * Get all visible points on the map
 */
export function getAllVisiblePoints(
    job: IHereMapJob,
    courierLocation?: CourierLocation,
    extraMarkers: any[] = []
): Point[] {
    const points: Point[] = [];

    // Add job points
    addJobPoints(job, points);

    // Add courier location
    if (courierLocation?.lat && courierLocation?.lng) {
        points.push({lat: courierLocation.lat, lng: courierLocation.lng});
    }

    // Add extra marker points
    addExtraMarkerPoints(extraMarkers, points);

    return points;
}

/**
 * Build the marker tooltip element and attach it to the map container.
 *
 * Every marker manager needs the same bubble — the styling deliberately mimics the Google
 * Maps InfoWindow the maps were migrated from, so it must stay identical between them.
 * Hidden until a marker is hovered; the caller fills `.gm-style-iw-content`.
 */
export function createMapTooltipElement(map: {getElement(): HTMLElement | null}): HTMLDivElement {
    const tooltip = document.createElement('div');
    tooltip.className = 'gm-style-iw-wrapper';
    tooltip.style.cssText = `
        position: absolute;
        display: none;
        z-index: 1000;
        pointer-events: none;
        transform: translate(-50%, -100%);
    `;
    tooltip.innerHTML = `
        <div class="gm-style-iw" style="
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 7px 1px rgba(0,0,0,0.3);
            padding: 12px;
            font-family: Roboto, Arial, sans-serif;
            font-size: 13px;
            min-width: 120px;
        ">
            <div class="gm-style-iw-content"></div>
        </div>
        <div class="gm-style-iw-tail" style="
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 11px solid transparent;
            border-right: 11px solid transparent;
            border-top: 11px solid white;
            filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
        "></div>
    `;

    map.getElement()?.appendChild(tooltip);

    return tooltip;
}

/**
 * Drop the markers whose ids are no longer in the incoming set, in one batched removal.
 *
 * Removing them one at a time makes HERE re-render per marker, which is what the managers
 * were each avoiding with their own copy of this loop.
 */
export function removeStaleMarkers<K>(
    markers: Map<K, {marker?: unknown} | undefined>,
    currentIds: Set<K>,
    markerGroup: any,
): void {
    const stale: unknown[] = [];

    for (const id of [...markers.keys()]) {
        if (currentIds.has(id)) continue;

        const marker = markers.get(id)?.marker;
        if (marker) stale.push(marker);
        markers.delete(id);
    }

    if (stale.length > 0) {
        safeRemoveObjects(markerGroup, stale);
    }
}
