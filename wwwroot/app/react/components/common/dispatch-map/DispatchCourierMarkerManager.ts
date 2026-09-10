/**
 * DispatchCourierMarkerManager
 *
 * Manages courier markers (flags with labels) on HERE Maps for the dispatch map.
 */

import type {CourierMarkerData, IAvailableCourierPosition} from './DispatchMap.types';
import {COURIER_LABEL_COLORS, ICON_CACHE_LIMIT, MARKER_COLORS, POSITION_THRESHOLD,} from './DispatchMap.types';
import {createMapTooltipElement, removeStaleMarkers, safeRemoveObject} from '../here-map/hereMapUtils';
import type {CourierFlagColors, CourierFlagLines} from '../here-map/courierFlagSvg';
import {
    courierFlagAnchor,
    courierFlagCacheKey,
    createCourierFlagSvg,
    createCourierTooltipHtml,
    createLargeCourierFlagSvg,
    getCourierFlagLines,
    getCourierStatus,
} from '../here-map/courierFlagSvg';

declare const H: any;

export class DispatchCourierMarkerManager {
    private readonly map: any;
    private readonly markerGroup: any;
    private courierMarkers: Map<number, CourierMarkerData> = new Map();
    private iconCache: Map<string, any> = new Map();
    private tooltipElement: HTMLDivElement | null = null;
    private autoZoomEnabled: boolean = true;
    private largeViewEnabled: boolean = false;

    // Store bound handlers for cleanup
    private readonly handleTap: (evt: any) => void;
    private readonly handlePointerEnter: (evt: any) => void;
    private readonly handlePointerLeave: () => void;

    constructor(map: any, _?: any) {
        this.map = map;
        this.markerGroup = new H.map.Group();
        this.map.addObject(this.markerGroup);

        // Create tooltip element (Google Maps InfoWindow style)
        this.createTooltipElement();

        // Bind handlers for later removal
        this.handleTap = (evt: any) => {
            const marker = evt.target;
            if (marker && marker.getData) {
                const courier = marker.getData();
                if (courier?.latitude && courier?.longitude) {
                    this.centerOnCourier(courier);
                }
            }
        };

        this.handlePointerEnter = (evt: any) => {
            const marker = evt.target;
            if (marker && marker.getData && !this.largeViewEnabled) {
                const courier = marker.getData();
                if (courier) {
                    this.showTooltip(marker, courier);
                }
            }
        };

        this.handlePointerLeave = () => {
            this.hideTooltip();
        };

        // Add event listeners
        this.markerGroup.addEventListener('tap', this.handleTap);
        this.markerGroup.addEventListener('pointerenter', this.handlePointerEnter, true);
        this.markerGroup.addEventListener('pointerleave', this.handlePointerLeave, true);
    }

    /**
     * Create the tooltip DOM element (matches Google Maps InfoWindow style)
     */
    private createTooltipElement(): void {
        this.tooltipElement = createMapTooltipElement(this.map);
    }

    /**
     * Update courier markers
     */
    updateMarkers(
        couriers: IAvailableCourierPosition[],
        urgentArmyOnly: boolean = false,
        largeView: boolean = false
    ): void {
        this.largeViewEnabled = largeView;

        // Apply urgent army filter if enabled
        const filteredCouriers = urgentArmyOnly
            ? couriers.filter((c) => c.isUrgentArmyDriver)
            : couriers;

        const currentIds = new Set(filteredCouriers.map((c) => c.courierId));
        removeStaleMarkers(this.courierMarkers, currentIds, this.markerGroup);

        // Update existing or add new markers
        const markersToAdd: any[] = [];

        filteredCouriers.forEach((courier) => {
            if (!this.isValidCoordinates(courier.latitude, courier.longitude)) {
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

                // The tooltip reads straight off the marker, so refresh its payload or it keeps
                // reporting the job counts and last delivery from when the marker was created.
                existing.marker.setData(courier);

                // Repaint when anything the flag renders changes — including the last-delivery
                // minutes, which tick between polls.
                const newLabel = this.getFlagCacheKey(courier, largeView);
                if (existing.name !== newLabel) {
                    const icon = this.getOrCreateIcon(courier, largeView);
                    existing.marker.setIcon(icon);
                    existing.name = newLabel;
                }
            } else {
                // Create new marker
                const marker = this.createCourierMarker(courier, largeView);
                markersToAdd.push(marker);

                this.courierMarkers.set(courier.courierId, {
                    marker,
                    courierId: courier.courierId,
                    lat: courier.latitude!,
                    lng: courier.longitude!,
                    name: this.getFlagCacheKey(courier, largeView),
                });
            }
        });

        // Batch add new markers
        if (markersToAdd.length > 0) {
            this.markerGroup.addObjects(markersToAdd);
        }
    }

    /**
     * Set auto zoom preference
     */
    setAutoZoom(enabled: boolean): void {
        this.autoZoomEnabled = enabled;
    }

    /**
     * Center map on a courier
     */
    private centerOnCourier(courier: IAvailableCourierPosition): void {
        if (!courier.latitude || !courier.longitude) return;

        this.map.setCenter({ lat: courier.latitude, lng: courier.longitude });

        if (this.autoZoomEnabled) {
            const currentZoom = this.map.getZoom();
            const newZoom = Math.min(currentZoom + 2, 16);
            this.map.setZoom(newZoom);
        }
    }

    /**
     * Create a courier marker
     */
    private createCourierMarker(courier: IAvailableCourierPosition, largeView: boolean): any {
        const point = new H.geo.Point(courier.latitude, courier.longitude);
        const icon = this.getOrCreateIcon(courier, largeView);

        return new H.map.Marker(point, {
            icon,
            data: courier,
        });
    }

    /**
     * Get or create cached icon
     */
    private getOrCreateIcon(courier: IAvailableCourierPosition, largeView: boolean): any {
        const lines = this.getFlagLines(courier, largeView);
        const status = getCourierStatus(courier);
        const cacheKey = courierFlagCacheKey(lines, status, largeView);

        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey);
        }

        const colors = this.getLabelColors(courier, largeView);
        const svgMarkup = largeView
            ? createLargeCourierFlagSvg(lines, colors)
            : createCourierFlagSvg(lines, colors);

        const icon = new H.map.Icon(svgMarkup, {
            anchor: courierFlagAnchor(lines, largeView),
        });

        // Cache with limit
        if (this.iconCache.size >= ICON_CACHE_LIMIT) {
            const firstKey = this.iconCache.keys().next().value;
            if (firstKey) {
                this.iconCache.delete(firstKey);
            }
        }
        this.iconCache.set(cacheKey, icon);

        return icon;
    }

    /**
     * Everything the flag renders, in one string — the marker's repaint trigger and its icon-cache
     * key, which must agree or a courier keeps a stale flag.
     */
    private getFlagCacheKey(courier: IAvailableCourierPosition, largeView: boolean): string {
        return courierFlagCacheKey(
            this.getFlagLines(courier, largeView), getCourierStatus(courier), largeView);
    }

    /**
     * Flag text. Large view drops the job counts from the first line — the pennant is for spotting a
     * driver at a glance, not for reading their workload — but keeps the last-delivery line.
     */
    private getFlagLines(courier: IAvailableCourierPosition, largeView: boolean): CourierFlagLines {
        const lines = getCourierFlagLines(courier);
        return largeView
            ? {...lines, primary: courier.courierName.split(' ')[0]}
            : lines;
    }

    /**
     * Get label colors based on courier status. Large view keeps its single brand fill so the
     * pennant stays legible against its white outline at any zoom.
     */
    private getLabelColors(
        courier: IAvailableCourierPosition, largeView = false
    ): CourierFlagColors {
        if (largeView) {
            return {bg: MARKER_COLORS.COURIER_FLAG_LARGE, text: '#FFFFFF', border: '#0D47A1'};
        }
        if (courier.totalJobs === 0) {
            return COURIER_LABEL_COLORS.NO_JOBS;
        }
        if (courier.overDueJobs > 0) {
            return COURIER_LABEL_COLORS.OVERDUE;
        }
        return COURIER_LABEL_COLORS.HAS_JOBS;
    }

    /**
     * Show tooltip on hover
     */
    private showTooltip(marker: any, courier: IAvailableCourierPosition): void {
        if (!this.tooltipElement) return;

        // Set content
        const contentEl = this.tooltipElement.querySelector('.gm-style-iw-content');
        if (contentEl) {
            contentEl.innerHTML = createCourierTooltipHtml(courier);
        }

        // Get screen position of marker
        const position = marker.getGeometry();
        const screenPos = this.map.geoToScreen(position);

        if (screenPos) {
            // Position tooltip above the marker
            this.tooltipElement.style.left = `${screenPos.x}px`;
            this.tooltipElement.style.top = `${screenPos.y - 40}px`; // Offset above flag marker
            this.tooltipElement.style.display = 'block';
        }
    }

    /**
     * Hide tooltip
     */
    private hideTooltip(): void {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
    }

    /**
     * Get marker group for bounds fitting
     */
    getMarkerGroup(): any {
        return this.markerGroup;
    }

    /**
     * Clear all courier markers
     */
    clearMarkers(): void {
        this.markerGroup.removeAll();
        this.courierMarkers.clear();
        this.hideTooltip();
    }

    /**
     * Check if position changed significantly
     */
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

    /**
     * Validate coordinates
     */
    private isValidCoordinates(lat?: number | null, lng?: number | null): boolean {
        return Boolean(
            lat && lng && !isNaN(lat) && !isNaN(lng) &&
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        );
    }

    /**
     * Clean up
     */
    dispose(): void {
        this.hideTooltip();
        this.clearMarkers();
        if (this.markerGroup) {
            this.markerGroup.removeEventListener('tap', this.handleTap);
            this.markerGroup.removeEventListener('pointerenter', this.handlePointerEnter, true);
            this.markerGroup.removeEventListener('pointerleave', this.handlePointerLeave, true);
        }
        safeRemoveObject(this.map, this.markerGroup);
        // Remove tooltip element from DOM
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
            this.tooltipElement = null;
        }
        this.iconCache.clear();
    }
}
