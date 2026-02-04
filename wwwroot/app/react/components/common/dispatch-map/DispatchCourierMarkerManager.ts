/**
 * DispatchCourierMarkerManager
 *
 * Manages courier markers (flags with labels) on HERE Maps for the dispatch map.
 */

import type {CourierMarkerData, IAvailableCourierPosition} from './DispatchMap.types';
import {COURIER_LABEL_COLORS, ICON_CACHE_LIMIT, MARKER_COLORS, POSITION_THRESHOLD,} from './DispatchMap.types';

declare const H: any;

export class DispatchCourierMarkerManager {
    private readonly map: any;
    private ui: any;
    private readonly markerGroup: any;
    private courierMarkers: Map<number, CourierMarkerData> = new Map();
    private iconCache: Map<string, any> = new Map();
    private tooltipElement: HTMLDivElement | null = null;
    private autoZoomEnabled: boolean = true;
    private largeViewEnabled: boolean = false;

    constructor(map: any, ui?: any) {
        this.map = map;
        this.ui = ui;
        this.markerGroup = new H.map.Group();
        this.map.addObject(this.markerGroup);

        // Create tooltip element (Google Maps InfoWindow style)
        this.createTooltipElement();

        // Add tap listener for marker clicks
        this.markerGroup.addEventListener('tap', (evt: any) => {
            const marker = evt.target;
            if (marker && marker.getData) {
                const courier = marker.getData();
                if (courier?.latitude && courier?.longitude) {
                    this.centerOnCourier(courier);
                }
            }
        });

        // Add hover listeners for tooltips
        this.markerGroup.addEventListener('pointerenter', (evt: any) => {
            const marker = evt.target;
            if (marker && marker.getData && !this.largeViewEnabled) {
                const courier = marker.getData();
                if (courier) {
                    this.showTooltip(marker, courier);
                }
            }
        }, true);

        this.markerGroup.addEventListener('pointerleave', () => {
            this.hideTooltip();
        }, true);
    }

    /**
     * Create the tooltip DOM element (matches Google Maps InfoWindow style)
     */
    private createTooltipElement(): void {
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.className = 'gm-style-iw-wrapper';
        this.tooltipElement.style.cssText = `
            position: absolute;
            display: none;
            z-index: 1000;
            pointer-events: none;
            transform: translate(-50%, -100%);
        `;
        this.tooltipElement.innerHTML = `
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

        // Append to map container
        const mapContainer = this.map.getElement();
        if (mapContainer) {
            mapContainer.appendChild(this.tooltipElement);
        }
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
            if (markersToRemove.length > 0) {
                this.markerGroup.removeObjects(markersToRemove);
            }
        }

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

                // Update icon if status changed
                const newLabel = this.getDisplayText(courier);
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
                    name: this.getDisplayText(courier),
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
        const displayText = this.getDisplayText(courier);
        const status = this.getCourierStatus(courier);
        const cacheKey = `${displayText}_${status}_${largeView}`;

        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey);
        }

        const svgMarkup = largeView
            ? this.createLargeFlagSvg(courier.code)
            : this.createFlagSvg(displayText, courier);

        const icon = new H.map.Icon(svgMarkup, {
            anchor: largeView ? { x: 4, y: 40 } : { x: 4, y: 40 },
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
     * Get display text for courier
     */
    private getDisplayText(courier: IAvailableCourierPosition): string {
        if (courier.overDueJobs > 0) {
            return `${courier.code} ${courier.totalJobs}/${courier.overDueJobs}`;
        }
        return `${courier.code} ${courier.totalJobs}`;
    }

    /**
     * Get courier status for styling
     */
    private getCourierStatus(courier: IAvailableCourierPosition): string {
        if (courier.totalJobs === 0) return 'noJobs';
        if (courier.overDueJobs > 0) return 'overdue';
        return 'hasJobs';
    }

    /**
     * Create large flag SVG (simplified blue flag)
     */
    private createLargeFlagSvg(code: string): string {
        const escapedCode = this.escapeHtml(code);
        return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="44" viewBox="0 0 80 44">
            <rect x="0" y="0" width="8" height="44" fill="#1565C0"/>
            <path d="M8,4 L76,4 L68,16 L76,28 L8,28 Z" fill="${MARKER_COLORS.COURIER_FLAG_LARGE}" stroke="#FFFFFF" stroke-width="2"/>
            <text x="38" y="20" font-family="Arial,sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">${escapedCode}</text>
        </svg>`;
    }

    /**
     * Create flag SVG with colored background based on status
     * Improved sizing for better readability: 50px min width, 22px height flag, 12px font
     */
    private createFlagSvg(displayText: string, courier: IAvailableCourierPosition): string {
        const colors = this.getLabelColors(courier);
        const escapedText = this.escapeHtml(displayText);
        const textWidth = Math.max(50, Math.min(displayText.length * 7 + 16, 150));
        const totalWidth = textWidth + 6;

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="36" viewBox="0 0 ${totalWidth} 36">
            <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="1" dy="1" stdDeviation="1" flood-opacity="0.2"/>
                </filter>
            </defs>
            <rect x="0" y="0" width="4" height="36" fill="#424242"/>
            <rect x="4" y="2" width="${textWidth}" height="22" rx="3" ry="3" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1.5" filter="url(#shadow)"/>
            <text x="${4 + textWidth / 2}" y="17" font-family="Arial,sans-serif" font-size="12" font-weight="600" fill="${colors.text}" text-anchor="middle">${escapedText}</text>
        </svg>`;
    }

    /**
     * Get label colors based on courier status
     */
    private getLabelColors(courier: IAvailableCourierPosition): { bg: string; text: string; border: string } {
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
    /**
     * Show tooltip on hover (Google Maps InfoWindow style)
     */
    private showTooltip(marker: any, courier: IAvailableCourierPosition): void {
        if (!this.tooltipElement) return;

        const overdueText = courier.overDueJobs > 0
            ? `<span style="color: #E53935; font-weight: bold;">Overdue Jobs: ${courier.overDueJobs}</span><br>`
            : '';

        // Set content
        const contentEl = this.tooltipElement.querySelector('.gm-style-iw-content');
        if (contentEl) {
            contentEl.innerHTML = `
                <strong>${this.escapeHtml(courier.courierName)}</strong><br>
                ${courier.isUrgentArmyDriver ? 'Fleet: UA<br>' : ''}
                ${courier.vehicleType ? `Vehicle: ${this.escapeHtml(courier.vehicleType)}<br>` : ''}
                <strong>Total Jobs: ${courier.totalJobs}</strong><br>
                ${overdueText}
            `;
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
     * Escape HTML for tooltip content
     */
    private escapeHtml(text: string | null | undefined): string {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Clean up
     */
    dispose(): void {
        this.hideTooltip();
        this.clearMarkers();
        if (this.map && this.markerGroup) {
            this.map.removeObject(this.markerGroup);
        }
        // Remove tooltip element from DOM
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
            this.tooltipElement = null;
        }
        this.iconCache.clear();
    }
}
