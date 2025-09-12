import {CourierLocation, HereMapConfig, HereMapCredentials} from "../../app/interfaces/hereMapCredentials.interfaces";

declare const H: any;

interface Point {
    lat: number;
    lng: number;
}

interface Job {
    pickup?: Point;
    delivery?: Point;
    childJobs?: ChildJob[];
    index?: number;
}

interface ChildJob {
    pickup?: Point;
    delivery?: Point;
    index?: number;
}

interface MapInstance {
    map: any;
    behavior: any;
    ui: any;
}

interface RoutingParameters {
    routingMode: string;
    transportMode: string;
    origin: string;
    destination: string;
    return: string;
}

export class HereMapService {
    static $inject = [
        '$log',
        '$window',
    ]
    
    private static readonly DEFAULT_MAP_CONFIG: HereMapConfig = {
        zoom: 5,
        center: { lat: 39.8097343, lng: -98.5556199 }
    };

    private static readonly MARKER_ICONS = {
        FROM: "https://img.icons8.com/ios-filled/50/39e75f/marker.png",
        TO: "https://img.icons8.com/ios-filled/50/ff6863/marker.png",
        EXTRA: "https://img.icons8.com/ios-filled/50/000000/marker.png"
    };

    private static readonly SVG_TEMPLATES = {
        PLANE: '<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 24 24" {{TRANSFORM}} fill="lightblue" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-plane"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3z" /></svg>',
        CAR: '<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 24 24" {{TRANSFORM}} fill="lightblue" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-car"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5" /></svg>'
    };
    
    constructor(private $log: angular.ILogService,
                private $window: angular.IWindowService) {
        this.$log.debug('HereMapTrackingService initialized');
    }
    
    initPlatform(credentials: HereMapCredentials): any {
        return new H.service.Platform({
            apikey: credentials.apiKey
        });
    }
  
    resizeMap(map: any): void {
        if (map && map.getViewPort()) {
            // Force the map to recalculate its size based on container
            this.$window.setTimeout(() => {
                map.getViewPort().resize();
            }, 100); // Small delay to ensure DOM has settled
        }
    }
    
    resizeMapPreserveView(map: any): void {
        if (map && map.getViewPort()) {
            // Store current center and zoom
            const center: Point = map.getCenter();
            const zoom: number = map.getZoom();

            // Force the map to recalculate its size based on container
            this.$window.setTimeout(() => {
                map.getViewPort().resize();

                // Reset center and zoom
                map.setCenter(center);
                map.setZoom(zoom);
            }, 100); // Small delay to ensure DOM has settled
        }
    }
    
    createMap(elementId: string, platform: any, config?: HereMapConfig): MapInstance {
        const engineType = H.Map.EngineType['HARP'];
        const mapConfig: HereMapConfig = { ...HereMapService.DEFAULT_MAP_CONFIG, ...config };

        // Initialize the default map layers
        const defaultLayers = platform.createDefaultLayers({ engineType });

        // Create map instance
        const map = new H.Map(
            document.getElementById(elementId),
            defaultLayers.raster.normal.map,
            {
                zoom: mapConfig.zoom,
                center: mapConfig.center,
                engineType: engineType
            }
        );

        // Resize if window size changed
        this.$window.addEventListener('resize', () => map.getViewPort().resize());

        // Add map behavior (pan/zoom)
        const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

        // Add UI components
        const ui = H.ui.UI.createDefault(map, defaultLayers);

        ui.removeControl('zoom');

        // disable fractional zooming for Behavior
        behavior.disable(H.mapevents.Behavior.Feature.FRACTIONAL_ZOOM);

        // add H.ui.ZoomControl with the disabled fractional zooming
        const zoomControl = new H.ui.ZoomControl({ fractionalZoom: false });
        ui.addControl('zoom', zoomControl);

        return {
            map: map,
            behavior: behavior,
            ui: ui
        };
    }

    getHereFromMarker(fromLat: number, fromLong: number, fromMarker: any, map: any): any {
        return this.createOrUpdateMarker(
            fromLat,
            fromLong,
            fromMarker,
            map,
            HereMapService.MARKER_ICONS.FROM
        );
    }
    
    getHereToMarker(toLat: number, toLong: number, toMarker: any, map: any): any {
        return this.createOrUpdateMarker(
            toLat,
            toLong,
            toMarker,
            map,
            HereMapService.MARKER_ICONS.TO
        );
    }
    
    getHereCourierMarker(
        courierLat: number,
        courierLong: number,
        courierMarker: any,
        map: any,
        flight: boolean = false,
        lngDiff: number | undefined
    ): any {
        if (!courierMarker) {
            if (lngDiff && flight) {
                const courierPoint = new H.geo.Point(courierLat, courierLong);

                let svgMarkup: string = flight ?
                    HereMapService.SVG_TEMPLATES.PLANE :
                    HereMapService.SVG_TEMPLATES.CAR;

                svgMarkup = svgMarkup.replace(
                    '{{TRANSFORM}}',
                    (lngDiff > 0 ? 'transform="scale(-1, 1)"' : '')
                );

                const courierIcon = new H.map.Icon(svgMarkup, { anchor: { x: 35, y: 35 } });
                courierMarker = new H.map.Marker(courierPoint, { icon: courierIcon });
                map.addObject(courierMarker);
            }
        } else {
            courierMarker.setGeometry(new H.geo.Point(courierLat, courierLong));
        }

        return courierMarker;
    }
    
    addExtraMarker(lat: number, long: number, extraMarkers: any[], map: any): any[] {
        const point = new H.geo.Point(lat, long);
        const icon = new H.map.Icon(HereMapService.MARKER_ICONS.EXTRA, {
            size: { w: 50, h: 50 }
        });
        const marker = new H.map.Marker(point, { icon: icon });
        extraMarkers.push(marker);
        map.addObject(marker);

        return extraMarkers;
    }
    
    removeExtraMarkers(extraMarkers: any[], map: any): any[] {
        extraMarkers.forEach(marker => {
            map.removeObject(marker);
        });
        return [];
    }
    
    centerHereMap(
        fromLat: number,
        fromLong: number,
        toLat: number,
        toLong: number,
        job: Job | ChildJob,
        routeLine: any,
        extraRouteLines: any[],
        map: any
    ): void {
        const totalLat: number = fromLat + toLat;
        const totalLong: number = fromLong + toLong;
        const centerLat: number = totalLat / 2;
        const centerLong: number = totalLong / 2;

        map.setCenter({ lat: centerLat, lng: centerLong });

        // Get the current bounding box
        const boundingBox: any = routeLine ?
            routeLine.getBoundingBox() :
            extraRouteLines[job.index!].getBoundingBox();

        const expandedBoundingBox = this.expandBoundingBox(boundingBox, 0.25);
        map.getViewModel().setLookAtData({ bounds: expandedBoundingBox });
    }
    
    drawRouteLine(
        fromLat: number,
        fromLong: number,
        toLat: number,
        toLong: number,
        routeLine: any,
        job: Job,
        map: any,
        platform: any,
        flight: boolean,
        preserveView?: boolean
    ): any {
        const routingParameters: RoutingParameters = {
            routingMode: 'fast',
            transportMode: 'car',
            origin: `${fromLat},${fromLong}`,
            destination: `${toLat},${toLong}`,
            return: 'polyline'
        };

        const onResult = (result: any): void => {
            if (result.routes.length) {
                result.routes[0].sections.forEach((section: any) => {
                    if (flight) {
                        this.drawFlightPath(fromLat, fromLong, toLat, toLong, map, 'route');
                    } else {
                        routeLine = this.drawDrivingRoute(section, map, 'route', 'black');
                    }
                });

                if (!preserveView) {
                    this.handleRouteViewport(result, fromLat, fromLong, toLat, toLong, job, routeLine, map);
                }
            }
        };

        const router = platform.getRoutingService(null, 8);
        return router.calculateRoute(routingParameters, onResult, this.handleRoutingError);
    }
    
    addExtraRouteLine(
        fromLat: number,
        fromLong: number,
        toLat: number,
        toLong: number,
        index: number,
        flight: boolean,
        extraRouteLines: any[],
        job: Job,
        map: any,
        platform: any,
        isScopedJob?: boolean,
        preserveView?: boolean
    ): any[] {
        const routingParameters: RoutingParameters = {
            routingMode: 'fast',
            transportMode: 'car',
            origin: `${fromLat},${fromLong}`,
            destination: `${toLat},${toLong}`,
            return: 'polyline'
        };

        const onResult = (result: any): void => {
            if (result.routes.length) {
                result.routes[0].sections.forEach((section: any) => {
                    const routeId = 'route' + index;
                    let routeLine: any;

                    if (flight) {
                        routeLine = this.drawFlightPath(fromLat, fromLong, toLat, toLong, map, routeId);
                    } else {
                        routeLine = this.drawDrivingRoute(section, map, routeId, 'purple');
                    }

                    extraRouteLines.push(routeLine);
                    job.childJobs![index].index = extraRouteLines.length - 1;
                });

                if (!preserveView && ((flight && isScopedJob == null) || isScopedJob)) {
                    this.centerHereMap(fromLat, fromLong, toLat, toLong, job.childJobs![index], null, extraRouteLines, map);
                    job.index = job.childJobs![index].index;
                }
            }
        };

        const router = platform.getRoutingService(null, 8);
        router.calculateRoute(routingParameters, onResult, this.handleRoutingError);

        return extraRouteLines;
    }
    
    removeExtraRouteLines(extraRouteLines: any[], map: any): any[] {
        extraRouteLines.forEach((_, index) => {
            this.removeObjectById('route' + index, map);
        });
        return [];
    }
    
    removeObjectById(id: string, map: any): void {
        if (!map) {
            this.$log.warn('Map is undefined in removeObjectById');
            return;
        }

        map.getObjects().forEach((object: any) => {
            if (object.id === id) {
                map.removeObject(object);
            }
        });
    }
    
    createCurvedPath(startPoint: Point, endPoint: Point, curvature: number = 0.5): Point[] {
        const dx: number = endPoint.lng - startPoint.lng;
        const dy: number = endPoint.lat - startPoint.lat;

        // Midpoint
        const midPoint: Point = {
            lat: startPoint.lat + dy * 0.5,
            lng: startPoint.lng + dx * 0.5
        };

        // Calculate perpendicular offset for control point
        const offset = {
            lat: -dx * curvature,
            lng: dy * curvature
        };

        // Control point
        const controlPoint: Point = {
            lat: midPoint.lat + Math.abs(offset.lat),
            lng: midPoint.lng + Math.abs(offset.lng)
        };

        // Generate points along the quadratic Bézier curve
        const curvePoints: Point[] = [];
        const steps: number = 30;

        for (let t = 0; t <= 1; t += 1 / steps) {
            // Quadratic Bézier formula: B(t) = (1-t)^2*P0 + 2(1-t)tP1 + t^2*P2
            const lat: number = Math.pow(1 - t, 2) * startPoint.lat +
                2 * (1 - t) * t * controlPoint.lat +
                Math.pow(t, 2) * endPoint.lat;

            const lng: number = Math.pow(1 - t, 2) * startPoint.lng +
                2 * (1 - t) * t * controlPoint.lng +
                Math.pow(t, 2) * endPoint.lng;

            curvePoints.push({ lat: lat, lng: lng });
        }

        return curvePoints;
    }
    
    autoZoomToShowAllPoints(map: any, points: Point[], padding: number = 0.1): void {
        if (!map || !points || points.length === 0) {
            this.$log.warn('Invalid parameters for autoZoomToShowAllPoints');
            return;
        }

        const validPoints: Point[] = this.filterValidPoints(points);

        if (validPoints.length === 0) {
            this.$log.warn('No valid points found for auto zoom');
            return;
        }

        if (validPoints.length === 1) {
            map.setCenter(validPoints[0]);
            map.setZoom(12);
            return;
        }

        const bounds = this.calculateBounds(validPoints);
        const boundingBox = this.createPaddedBoundingBox(bounds, padding);
        map.getViewModel().setLookAtData({ bounds: boundingBox });
    }
    
    getAllVisiblePoints(job: Job, courierLocation: CourierLocation, extraMarkers: any[] = []): Point[] {
        const points: Point[] = [];

        // Add job points
        this.addJobPoints(job, points);

        // Add courier location
        if (courierLocation?.lat && courierLocation?.lng) {
            points.push({ lat: courierLocation.lat, lng: courierLocation.lng });
        }

        // Add extra marker points
        this.addExtraMarkerPoints(extraMarkers, points);

        return points;
    }

    // Private helper methods
    private createOrUpdateMarker(lat: number, long: number, marker: any, map: any, iconUrl: string): any {
        if (!marker) {
            const point = new H.geo.Point(lat, long);
            const icon = new H.map.Icon(iconUrl, { size: { w: 50, h: 50 } });
            marker = new H.map.Marker(point, { icon: icon });
            map.addObject(marker);
        } else {
            marker.setGeometry(new H.geo.Point(lat, long));
        }
        return marker;
    }

    private expandBoundingBox(boundingBox: any, factor: number): any {
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
    
    private drawFlightPath(fromLat: number, fromLong: number, toLat: number, toLong: number, map: any, id: string): any {
        const lineString = new H.geo.LineString();
        const startPoint: Point = { lat: fromLat, lng: fromLong };
        const endPoint: Point = { lat: toLat, lng: toLong };

        const curvePoints: Point[] = this.createCurvedPath(startPoint, endPoint, 0.1);
        curvePoints.forEach(point => lineString.pushPoint(point));

        const curvedLine = new H.map.Polyline(lineString, {
            style: { lineWidth: 4 }
        });

        curvedLine.id = id;
        map.addObject(curvedLine);
        return curvedLine;
    }
    
    private drawDrivingRoute(section: any, map: any, id: string, color: string): any {
        const linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);
        const routeLine = new H.map.Polyline(linestring, {
            style: { strokeColor: color, lineWidth: 3 }
        });

        routeLine.id = id;
        map.addObject(routeLine);
        return routeLine;
    }
    
    private handleRouteViewport(result: any, fromLat: number, fromLong: number, toLat: number, toLong: number, job: Job, routeLine: any, map: any): void {
        if (result.routes[0].sections.length > 1) {
            const group = new H.map.Group();
            const group1 = new H.map.Marker({ lat: fromLat, lng: fromLong });
            const group2 = new H.map.Marker({ lat: toLat, lng: toLong });
            group.addObjects([group1, group2]);

            map.getViewModel().setLookAtData({ bounds: group.getBoundingBox() });
            group.removeObjects([group1, group2]);
        } else {
            map.getViewModel().setLookAtData({ bounds: routeLine.getBoundingBox() });
        }

        this.centerHereMap(fromLat, fromLong, toLat, toLong, job, routeLine, [], map);
    }
    
    private handleRoutingError(error: any): void {
        alert(error.message);
    }
    
    private filterValidPoints(points: Point[]): Point[] {
        return points.filter(point =>
            point &&
            !isNaN(point.lat) &&
            !isNaN(point.lng)
        );
    }
    
    private calculateBounds(points: Point[]): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
        let minLat = points[0].lat;
        let maxLat = points[0].lat;
        let minLng = points[0].lng;
        let maxLng = points[0].lng;

        points.forEach(point => {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLng = Math.min(minLng, point.lng);
            maxLng = Math.max(maxLng, point.lng);
        });

        return { minLat, maxLat, minLng, maxLng };
    }
    
    private createPaddedBoundingBox(bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }, padding: number): any {
        const latDiff: number = (bounds.maxLat - bounds.minLat) * padding;
        const lngDiff: number = (bounds.maxLng - bounds.minLng) * padding;

        return new H.geo.Rect(
            bounds.maxLat + latDiff,    // top
            bounds.minLng - lngDiff,    // left
            bounds.minLat - latDiff,    // bottom
            bounds.maxLng + lngDiff     // right
        );
    }
    
    private addJobPoints(job: Job, points: Point[]): void {
        // Add the main pickup point
        if (job?.pickup?.lat && job.pickup.lng) {
            points.push({ lat: job.pickup.lat, lng: job.pickup.lng });
        }

        // Add the main delivery point
        if (job?.delivery?.lat && job.delivery.lng) {
            points.push({ lat: job.delivery.lat, lng: job.delivery.lng });
        }

        // Add child job points
        if (job?.childJobs && Array.isArray(job.childJobs)) {
            job.childJobs.forEach(childJob => {
                if (childJob?.pickup?.lat && childJob.pickup.lng) {
                    points.push({ lat: childJob.pickup.lat, lng: childJob.pickup.lng });
                }
                if (childJob?.delivery?.lat && childJob.delivery.lng) {
                    points.push({ lat: childJob.delivery.lat, lng: childJob.delivery.lng });
                }
            });
        }
    }

    private addExtraMarkerPoints(extraMarkers: any[], points: Point[]): void {
        extraMarkers.forEach(marker => {
            if (marker?.getGeometry) {
                const geometry = marker.getGeometry();
                if (geometry) {
                    points.push({ lat: geometry.lat, lng: geometry.lng });
                }
            }
        });
    }
}

angular.module("hereMapTracking.services").factory('HereMapService', HereMapService);