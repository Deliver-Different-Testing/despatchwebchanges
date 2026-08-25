/**
 * CourierMarkerManager
 *
 * Manages courier markers on the HERE map with efficient batch operations,
 * icon caching, position threshold checks, and status-based coloring.
 *
 * Markers are colored by driver status:
 *   - Red pill:  has overdue jobs (needs attention)
 *   - Blue pill: has active jobs (working normally)
 *   - Slate pill: no jobs (idle/available)
 */

import type {IAvailableCourierPosition} from '../../../interfaces/courier.interface';
import type {CourierMarker, DriverStatus, MarkerColor} from './CourierMapPage.types';
import {
    DRIVER_FOCUS_ZOOM,
    getDriverStatus,
    ICON_CACHE_LIMIT,
    MARKER_COLORS,
    MARKER_LABEL_MAX_LENGTH,
    POSITION_THRESHOLD,
} from './CourierMapPage.types';
import {removeStaleMarkers, safeRemoveObject} from '../../components/common/here-map/hereMapUtils';

declare const H: any;

export class CourierMarkerManager {
    private readonly map: any;
    private readonly markerGroup: any;
    private courierMarkers: Map<number, CourierMarker> = new Map();
    private iconCache: Map<string, any> = new Map();
    private readonly isUsCustomer: boolean;
    private readonly statusColors: Record<DriverStatus, MarkerColor>;

    constructor(
        map: any,
        isUsCustomer: boolean,
        statusColors: Record<DriverStatus, MarkerColor> = MARKER_COLORS
    ) {
        this.map = map;
        this.isUsCustomer = isUsCustomer;
        this.statusColors = statusColors;
        this.markerGroup = new H.map.Group();
        this.map.addObject(this.markerGroup);
    }

    /**
     * Update markers efficiently - add new, update existing, remove stale
     */
    updateMarkers(couriers: IAvailableCourierPosition[]): void {
        const currentIds = new Set(couriers.map((c) => c.courierId));
        removeStaleMarkers(this.courierMarkers, currentIds, this.markerGroup);

        // Update existing or add new markers
        const markersToAdd: any[] = [];

        couriers.forEach((courier) => {
            if (courier.latitude === null || courier.longitude === null) {
                return;
            }

            const existing = this.courierMarkers.get(courier.courierId);

            if (existing) {
                // Check if position changed significantly
                const posChanged = this.hasPositionChanged(
                    existing.lat,
                    existing.lng,
                    courier.latitude!,
                    courier.longitude!
                );

                if (posChanged) {
                    existing.marker.setGeometry({
                        lat: courier.latitude,
                        lng: courier.longitude,
                    });
                    existing.lat = courier.latitude!;
                    existing.lng = courier.longitude!;
                }

                // Update icon if label or status changed
                const newLabel = this.getMarkerLabel(courier);
                const newStatus = getDriverStatus(courier);
                if (existing.name !== newLabel || existing.status !== newStatus) {
                    const icon = this.getOrCreateIcon(newLabel, newStatus);
                    existing.marker.setIcon(icon);
                    existing.name = newLabel;
                    existing.status = newStatus;
                }
            } else {
                // Create new marker
                const marker = this.createCourierMarker(courier);
                const status = getDriverStatus(courier);
                markersToAdd.push(marker);

                this.courierMarkers.set(courier.courierId, {
                    courierId: courier.courierId,
                    marker: marker,
                    name: this.getMarkerLabel(courier),
                    status,
                    lat: courier.latitude!,
                    lng: courier.longitude!,
                });
            }
        });

        // Batch add new markers
        if (markersToAdd.length > 0) {
            this.markerGroup.addObjects(markersToAdd);
        }
    }

    /**
     * Center map on a specific courier
     */
    centerOnCourier(driver: IAvailableCourierPosition): void {
        if (!driver.latitude || !driver.longitude) return;

        this.map.setCenter({ lat: driver.latitude, lng: driver.longitude });
        const currentZoom = this.map.getZoom();
        if (currentZoom < DRIVER_FOCUS_ZOOM) {
            this.map.setZoom(DRIVER_FOCUS_ZOOM);
        }
    }

    /**
     * Fit all couriers in view
     */
    fitAllCouriers(): any {
        if (this.courierMarkers.size === 0) return null;

        const bounds = this.markerGroup.getBoundingBox();
        if (bounds) {
            this.map.getViewModel().setLookAtData({ bounds });
        }
        return bounds;
    }

    /**
     * Get the number of markers currently on the map
     */
    getMarkerCount(): number {
        return this.courierMarkers.size;
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        safeRemoveObject(this.map, this.markerGroup);
        this.courierMarkers.clear();
        this.iconCache.clear();
    }

    // ── Private ──────────────────────────────

    private hasPositionChanged(
        oldLat: number,
        oldLng: number,
        newLat: number,
        newLng: number
    ): boolean {
        return (
            Math.abs(oldLat - newLat) > POSITION_THRESHOLD ||
            Math.abs(oldLng - newLng) > POSITION_THRESHOLD
        );
    }

    private getMarkerLabel(driver: IAvailableCourierPosition): string {
        if (this.isUsCustomer) {
            return driver.courierName || '';
        } else {
            return driver.code || driver.courierName || '';
        }
    }

    private getOrCreateIcon(name: string, status: DriverStatus): any {
        const displayName =
            name.length > MARKER_LABEL_MAX_LENGTH
                ? name.substring(0, MARKER_LABEL_MAX_LENGTH - 2) + '..'
                : name;

        // Cache key includes status so color changes are reflected
        const cacheKey = `${displayName}_${status}`;

        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey);
        }

        const svgMarkup = this.createPillSvg(displayName, status);
        const icon = new H.map.Icon(svgMarkup, {
            anchor: { x: 14, y: 40 },
        });

        // Evict oldest entry if cache is full
        if (this.iconCache.size >= ICON_CACHE_LIMIT) {
            const firstKey = this.iconCache.keys().next().value;
            if (firstKey) {
                this.iconCache.delete(firstKey);
            }
        }
        this.iconCache.set(cacheKey, icon);

        return icon;
    }

    private createCourierMarker(driver: IAvailableCourierPosition): any {
        const point = new H.geo.Point(driver.latitude, driver.longitude);
        const label = this.getMarkerLabel(driver);
        const status = getDriverStatus(driver);
        const icon = this.getOrCreateIcon(label, status);
        return new H.map.Marker(point, {icon, data: driver});
    }

    /**
     * Creates a modern pill-shaped SVG marker with status-based coloring
     * and a subtle pin stem anchoring it to the map.
     */
    private createPillSvg(displayName: string, status: DriverStatus): string {
        const colors = this.statusColors[status];

        const escapedName = displayName
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        return `<svg xmlns="http://www.w3.org/2000/svg" width="108" height="42" viewBox="0 0 108 42">
            <defs>
                <filter id="pillShadow" x="-20%" y="-40%" width="140%" height="200%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.24"/>
                </filter>
            </defs>
            <line x1="14" y1="42" x2="14" y2="29" stroke="${colors.border}" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="0" y="0" width="104" height="26" rx="13" fill="${colors.bg}" filter="url(#pillShadow)"/>
            <rect x="0" y="0" width="104" height="26" rx="13" fill="none" stroke="${colors.border}" stroke-width="0.75" opacity="0.5"/>
            <text x="52" y="17" font-family="Roboto,Arial,sans-serif" font-size="11" font-weight="600" fill="${colors.text}" text-anchor="middle">${escapedName}</text>
        </svg>`;
    }
}
