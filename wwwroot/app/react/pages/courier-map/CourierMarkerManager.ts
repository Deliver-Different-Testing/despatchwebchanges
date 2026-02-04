/**
 * CourierMarkerManager
 *
 * Manages courier markers on the HERE map with efficient batch operations,
 * icon caching, and position threshold checks.
 */

import type { IAvailableCourierPosition } from '../../../interfaces/courier.interface';
import type { CourierMarker } from './CourierMapPage.types';
import {
    ICON_CACHE_LIMIT,
    MARKER_LABEL_MAX_LENGTH,
    POSITION_THRESHOLD,
    DRIVER_FOCUS_ZOOM,
} from './CourierMapPage.types';

declare const H: any;

export class CourierMarkerManager {
    private map: any;
    private markerGroup: any;
    private courierMarkers: Map<number, CourierMarker> = new Map();
    private iconCache: Map<string, any> = new Map();
    private isUsCustomer: boolean;

    constructor(map: any, isUsCustomer: boolean) {
        this.map = map;
        this.isUsCustomer = isUsCustomer;
        this.markerGroup = new H.map.Group();
        this.map.addObject(this.markerGroup);
    }

    /**
     * Update markers efficiently - add new, update existing, remove stale
     */
    updateMarkers(couriers: IAvailableCourierPosition[]): void {
        const currentIds = new Set(couriers.map((c) => c.courierId));
        const existingIds = new Set(this.courierMarkers.keys());

        // Remove markers for couriers no longer present
        const toRemove: number[] = [];
        existingIds.forEach((id) => {
            if (!currentIds.has(id)) {
                toRemove.push(id);
            }
        });

        if (toRemove.length > 0) {
            const markersToRemove: any[] = [];
            toRemove.forEach((id) => {
                const cm = this.courierMarkers.get(id);
                if (cm?.marker) {
                    markersToRemove.push(cm.marker);
                }
                this.courierMarkers.delete(id);
            });
            // Batch remove
            if (markersToRemove.length > 0) {
                this.markerGroup.removeObjects(markersToRemove);
            }
        }

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
                    // Update position
                    existing.marker.setGeometry({
                        lat: courier.latitude,
                        lng: courier.longitude,
                    });
                    existing.lat = courier.latitude!;
                    existing.lng = courier.longitude!;
                }

                // Update label if changed
                const newLabel = this.getMarkerLabel(courier);
                if (existing.name !== newLabel) {
                    const icon = this.getOrCreateIcon(newLabel);
                    existing.marker.setIcon(icon);
                    existing.name = newLabel;
                }
            } else {
                // Create new marker
                const marker = this.createCourierMarker(courier);
                markersToAdd.push(marker);

                this.courierMarkers.set(courier.courierId, {
                    courierId: courier.courierId,
                    marker: marker,
                    name: this.getMarkerLabel(courier),
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
        // Only zoom in if current zoom is too far out
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
        if (this.map && this.markerGroup) {
            this.map.removeObject(this.markerGroup);
        }
        this.courierMarkers.clear();
        this.iconCache.clear();
    }

    // Private methods

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
            // NZ: prefer code, fallback to name
            return driver.code || driver.courierName || '';
        }
    }

    private getOrCreateIcon(name: string): any {
        const displayName =
            name.length > MARKER_LABEL_MAX_LENGTH
                ? name.substring(0, MARKER_LABEL_MAX_LENGTH - 2) + '..'
                : name;

        // Check cache first
        if (this.iconCache.has(displayName)) {
            return this.iconCache.get(displayName);
        }

        // Create new icon
        const svgMarkup = this.createFlagSvg(displayName);
        const icon = new H.map.Icon(svgMarkup, {
            anchor: { x: 12, y: 36 },
        });

        // Cache it (limit cache size to prevent memory issues)
        if (this.iconCache.size >= ICON_CACHE_LIMIT) {
            // Remove oldest entry
            const firstKey = this.iconCache.keys().next().value;
            if (firstKey) {
                this.iconCache.delete(firstKey);
            }
        }
        this.iconCache.set(displayName, icon);

        return icon;
    }

    private createCourierMarker(driver: IAvailableCourierPosition): any {
        const point = new H.geo.Point(driver.latitude, driver.longitude);
        const label = this.getMarkerLabel(driver);
        const icon = this.getOrCreateIcon(label);
        const marker = new H.map.Marker(point, { icon, data: driver });

        return marker;
    }

    private createFlagSvg(displayName: string): string {
        // Escape HTML entities in the name
        const escapedName = displayName
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="44" viewBox="0 0 100 44">
            <rect x="10" y="0" width="3" height="44" fill="#1565C0"/>
            <rect x="13" y="2" width="82" height="24" rx="3" ry="3" fill="#2196F3"/>
            <rect x="13" y="2" width="82" height="24" rx="3" ry="3" fill="none" stroke="#1565C0" stroke-width="1"/>
            <text x="54" y="18" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="white" text-anchor="middle">${escapedName}</text>
        </svg>`;
    }
}
