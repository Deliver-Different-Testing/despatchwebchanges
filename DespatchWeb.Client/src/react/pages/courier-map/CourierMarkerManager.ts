/**
 * CourierMarkerManager
 *
 * Manages courier markers on the HERE map with efficient batch operations,
 * icon caching, position threshold checks, and status-based coloring.
 *
 * Draws the same courier flag as the dispatch map — driver and job counts, plus a last-delivery
 * line once the courier is selected — from the shared builder in here-map/courierFlagSvg, but
 * colours it from the active Mantine theme so the markers follow dark mode and match the
 * driver-list rows:
 *   - Red flag:   has overdue jobs (needs attention)
 *   - Brand flag: has active jobs (working normally)
 *   - Green flag: no jobs (idle/available)
 */

import type {IAvailableCourierPosition} from '../../../interfaces/courier.interface';
import type {CourierMarker, DriverStatus, MarkerColor} from './CourierMapPage.types';
import {
    DRIVER_FOCUS_ZOOM,
    getDriverStatus,
    ICON_CACHE_LIMIT,
    MARKER_COLORS,
    POSITION_THRESHOLD,
} from './CourierMapPage.types';
import {
    createMapTooltipElement,
    removeStaleMarkers,
    safeRemoveObject,
} from '../../components/common/here-map/hereMapUtils';
import type {CourierFlagDisplaySettings, CourierFlagLines} from '../../components/common/here-map/courierFlagSvg';
import {
    courierFlagAnchor,
    courierFlagCacheKey,
    createCourierFlagSvg,
    createCourierTooltipHtml,
    DEFAULT_MARKER_SCALE,
    getCourierFlagLines,
    getCourierStatus,
} from '../../components/common/here-map/courierFlagSvg';

/** Matches today's existing flag content, used when no display settings are supplied. */
const DEFAULT_DISPLAY_SETTINGS: CourierFlagDisplaySettings = {markerLabel: 'name', showJobCount: true};

declare const H: any;

export class CourierMarkerManager {
    private readonly map: any;
    private readonly markerGroup: any;
    private courierMarkers: Map<number, CourierMarker> = new Map();
    private iconCache: Map<string, any> = new Map();
    private statusColors: Record<DriverStatus, MarkerColor>;
    private displaySettings: CourierFlagDisplaySettings;
    private tooltipElement: HTMLDivElement | null = null;

    private readonly handlePointerEnter: (evt: any) => void;
    private readonly handlePointerLeave: () => void;
    private readonly handleTap: (evt: any) => void;
    private selectedCourierId: number | null = null;

    constructor(
        map: any,
        statusColors: Record<DriverStatus, MarkerColor> = MARKER_COLORS,
        displaySettings: CourierFlagDisplaySettings = DEFAULT_DISPLAY_SETTINGS,
        onMarkerTap?: (courier: IAvailableCourierPosition) => void,
    ) {
        this.map = map;
        this.statusColors = statusColors;
        this.displaySettings = displaySettings;
        this.markerGroup = new H.map.Group();
        this.map.addObject(this.markerGroup);

        this.tooltipElement = createMapTooltipElement(this.map);

        this.handlePointerEnter = (evt: any) => {
            const courier = evt?.target?.getData?.();
            if (courier) {
                this.showTooltip(evt.target, courier);
            }
        };
        this.handlePointerLeave = () => this.hideTooltip();
        this.handleTap = (evt: any) => {
            const courier = evt?.target?.getData?.();
            if (courier) {
                onMarkerTap?.(courier);
            }
        };

        this.markerGroup.addEventListener('pointerenter', this.handlePointerEnter, true);
        this.markerGroup.addEventListener('pointerleave', this.handlePointerLeave, true);
        this.markerGroup.addEventListener('tap', this.handleTap, true);
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
            const isSelected = courier.courierId === this.selectedCourierId;

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
                // minutes, which tick between polls, and a selection flip, which doesn't touch
                // the label/status at all.
                const newLabel = this.getFlagCacheKey(courier, isSelected);
                const newStatus = getDriverStatus(courier);
                if (existing.name !== newLabel || existing.status !== newStatus || existing.isSelected !== isSelected) {
                    existing.marker.setIcon(this.getOrCreateIcon(courier, isSelected));
                    existing.name = newLabel;
                    existing.status = newStatus;
                    existing.isSelected = isSelected;
                }
            } else {
                // Create new marker
                const marker = this.createCourierMarker(courier, isSelected);
                const status = getDriverStatus(courier);
                markersToAdd.push(marker);

                this.courierMarkers.set(courier.courierId, {
                    courierId: courier.courierId,
                    marker: marker,
                    name: this.getFlagCacheKey(courier, isSelected),
                    status,
                    lat: courier.latitude!,
                    lng: courier.longitude!,
                    isSelected,
                });
            }
        });

        // Batch add new markers
        if (markersToAdd.length > 0) {
            this.markerGroup.addObjects(markersToAdd);
        }
    }

    /**
     * Swaps the palette and flag content settings, then repaints every existing marker
     * immediately — a settings change should be visible right away, not on the next poll.
     */
    updateSettings(
        statusColors: Record<DriverStatus, MarkerColor>,
        displaySettings: CourierFlagDisplaySettings,
    ): void {
        this.statusColors = statusColors;
        this.displaySettings = displaySettings;
        this.iconCache.clear();

        this.courierMarkers.forEach((entry) => {
            const courier = entry.marker.getData?.() as IAvailableCourierPosition | undefined;
            if (!courier) return;

            entry.marker.setIcon(this.getOrCreateIcon(courier, entry.isSelected));
            entry.name = this.getFlagCacheKey(courier, entry.isSelected);
            entry.status = getDriverStatus(courier);
        });
    }

    /**
     * Marks a courier as the selected driver, repainting its flag with a highlight ring, and
     * clears the highlight from whichever courier was previously selected. Persists across
     * `updateMarkers` poll refreshes since `selectedCourierId` is plain instance state.
     */
    setSelectedCourier(courierId: number | null): void {
        if (this.selectedCourierId === courierId) return;
        this.selectedCourierId = courierId;

        this.courierMarkers.forEach((entry) => {
            const shouldBeSelected = entry.courierId === courierId;
            if (entry.isSelected === shouldBeSelected) return;

            const courier = entry.marker.getData?.() as IAvailableCourierPosition | undefined;
            if (!courier) return;

            entry.marker.setIcon(this.getOrCreateIcon(courier, shouldBeSelected));
            entry.isSelected = shouldBeSelected;
        });
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
        this.hideTooltip();
        if (this.markerGroup) {
            this.markerGroup.removeEventListener('pointerenter', this.handlePointerEnter, true);
            this.markerGroup.removeEventListener('pointerleave', this.handlePointerLeave, true);
            this.markerGroup.removeEventListener('tap', this.handleTap, true);
        }
        safeRemoveObject(this.map, this.markerGroup);
        if (this.tooltipElement?.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
        }
        this.tooltipElement = null;
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

    /**
     * The last-delivery line is only ever shown for the currently-selected courier — an
     * unselected marker stays a compact single line with just the driver's label and job
     * count. Hovering still surfaces the last-delivery detail via the tooltip regardless of
     * selection (see showTooltip/createCourierTooltipHtml).
     */
    private getFlagLines(courier: IAvailableCourierPosition, isSelected: boolean): CourierFlagLines {
        const lines = getCourierFlagLines(courier, this.displaySettings);
        return isSelected ? lines : {...lines, secondary: null};
    }

    private getFlagCacheKey(courier: IAvailableCourierPosition, isSelected: boolean): string {
        return courierFlagCacheKey(
            this.getFlagLines(courier, isSelected), getCourierStatus(courier), false, this.markerScale, isSelected
        );
    }

    private get markerScale(): number {
        return this.displaySettings.markerScale ?? DEFAULT_MARKER_SCALE;
    }

    private getOrCreateIcon(courier: IAvailableCourierPosition, isSelected: boolean): any {
        const lines = this.getFlagLines(courier, isSelected);
        const cacheKey = this.getFlagCacheKey(courier, isSelected);

        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey);
        }

        const icon = new H.map.Icon(
            createCourierFlagSvg(lines, this.statusColors[getDriverStatus(courier)], this.markerScale, isSelected),
            {anchor: courierFlagAnchor(lines, false, this.markerScale)}
        );

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

    private createCourierMarker(driver: IAvailableCourierPosition, isSelected: boolean): any {
        const point = new H.geo.Point(driver.latitude, driver.longitude);
        return new H.map.Marker(point, {icon: this.getOrCreateIcon(driver, isSelected), data: driver});
    }

    private showTooltip(marker: any, courier: IAvailableCourierPosition): void {
        if (!this.tooltipElement) return;

        const contentEl = this.tooltipElement.querySelector('.gm-style-iw-content');
        if (contentEl) {
            contentEl.innerHTML = createCourierTooltipHtml(courier);
        }

        const screenPos = this.map.geoToScreen(marker.getGeometry());
        if (screenPos) {
            this.tooltipElement.style.left = `${screenPos.x}px`;
            this.tooltipElement.style.top = `${screenPos.y - 40}px`;
            this.tooltipElement.style.display = 'block';
        }
    }

    private hideTooltip(): void {
        if (this.tooltipElement) {
            this.tooltipElement.style.display = 'none';
        }
    }
}
