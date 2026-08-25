/**
 * JobMarkerManager
 *
 * Manages job markers (pickup/delivery) on HERE Maps.
 */

import type {IDispatchMapItem, JobMarkerData} from './DispatchMap.types';
import {
    ICON_CACHE_LIMIT,
    MARKER_BATCH_SIZE,
    MARKER_COLORS,
    MARKER_PIN_PATH,
    MAX_AUTO_ZOOM,
    MAX_JOBS_TO_DISPLAY,
} from './DispatchMap.types';
import {AddressType} from '../../../../enums/address-type.enum';
import {createMapTooltipElement, safeRemoveObject} from '../here-map/hereMapUtils';

declare const H: any;

export class JobMarkerManager {
    private readonly map: any;
    private readonly markerGroup: any;
    private markers: JobMarkerData[] = [];
    private iconCache: Map<string, any> = new Map();
    private onMarkerClick?: (job: IDispatchMapItem) => void;
    private tooltipElement: HTMLDivElement | null = null;

    constructor(
        map: any,
        _ui?: any,
        onMarkerClick?: (job: IDispatchMapItem) => void
    ) {
        this.map = map;
        this.onMarkerClick = onMarkerClick;
        this.markerGroup = new H.map.Group();
        this.map.addObject(this.markerGroup);

        // Create tooltip element (Google Maps InfoWindow style)
        this.createTooltipElement();

        // Add group tap listener for marker clicks
        this.markerGroup.addEventListener('tap', (evt: any) => {
            const marker = evt.target;
            if (marker && marker.getData && this.onMarkerClick) {
                const data = marker.getData();
                if (data?.job) {
                    this.onMarkerClick(data.job);
                }
            }
        });

        // Add pointer enter/leave for tooltips and hover effect
        this.markerGroup.addEventListener('pointerenter', (evt: any) => {
            const marker = evt.target;
            if (marker && marker.getData) {
                const data = marker.getData();
                if (data?.job && data?.color) {
                    // Change to hover icon (larger) - matches Google Maps scale 1.5 → 1.8
                    const hoverIcon = this.getOrCreateIcon(data.color, true);
                    marker.setIcon(hoverIcon);

                    this.showTooltip(marker, data.job, data.locationType);
                }
            }
        }, true);

        this.markerGroup.addEventListener('pointerleave', (evt: any) => {
            const marker = evt.target;
            if (marker && marker.getData) {
                const data = marker.getData();
                if (data?.job && data?.color) {
                    // Restore normal icon
                    const normalIcon = this.getOrCreateIcon(data.color, false);
                    marker.setIcon(normalIcon);
                }
            }
            this.hideTooltip();
        }, true);
    }

    /**
     * Create the tooltip DOM element (matches Google Maps InfoWindow style)
     */
    private createTooltipElement(): void {
        this.tooltipElement = createMapTooltipElement(this.map);
    }

    /**
     * Set the marker click callback
     */
    setOnMarkerClick(callback: (job: IDispatchMapItem) => void): void {
        this.onMarkerClick = callback;
    }

    /**
     * Update markers with new jobs data
     */
    async updateMarkers(
        jobs: IDispatchMapItem[],
        currentJob?: IDispatchMapItem,
        useAlternateColors: boolean = false
    ): Promise<number> {
        this.clearMarkers();

        let markersAdded = 0;
        const currentJobId = currentJob?.jobId;
        const markersToAdd: any[] = [];

        // Add current job first (highlighted)
        if (currentJob) {
            markersAdded += this.addJobMarkers(currentJob, true, false, markersToAdd);
        }

        // Add other jobs in batches
        if (jobs?.length) {
            let jobsToAdd = jobs.filter(
                (job) => !currentJobId || job.jobId !== currentJobId
            );

            // Safety limit
            if (jobsToAdd.length > MAX_JOBS_TO_DISPLAY) {
                jobsToAdd = jobsToAdd.slice(0, MAX_JOBS_TO_DISPLAY);
            }

            // Process in batches
            for (let i = 0; i < jobsToAdd.length; i += MARKER_BATCH_SIZE) {
                const batch = jobsToAdd.slice(i, i + MARKER_BATCH_SIZE);
                batch.forEach((job) => {
                    markersAdded += this.addJobMarkers(job, false, useAlternateColors, markersToAdd);
                });
            }
        }

        // Batch add all markers
        if (markersToAdd.length > 0) {
            this.markerGroup.addObjects(markersToAdd);
        }

        console.log("Markers Added: ", markersAdded);

        return markersAdded;
    }

    /**
     * Add pickup and delivery markers for a job
     */
    private addJobMarkers(
        job: IDispatchMapItem,
        isCurrentJob: boolean,
        useAlternateColors: boolean,
        markersToAdd: any[]
    ): number {
        let count = 0;

        if (this.isValidCoordinates(job.pickupAddress?.latitude, job.pickupAddress?.longitude)) {
            this.addPickupMarker(job, isCurrentJob, useAlternateColors, markersToAdd);
            count++;
        }

        if (this.isValidCoordinates(job.deliveryAddress?.latitude, job.deliveryAddress?.longitude)) {
            this.addDeliveryMarker(job, isCurrentJob, useAlternateColors, markersToAdd);
            count++;
        }

        return count;
    }

    /**
     * Add a pickup marker
     */
    private addPickupMarker(
        job: IDispatchMapItem,
        isCurrentJob: boolean,
        useAlternateColors: boolean,
        markersToAdd: any[]
    ): void {
        const position = {
            lat: job.pickupAddress.latitude ?? 0,
            lng: job.pickupAddress.longitude ?? 0,
        };

        const color = isCurrentJob || !useAlternateColors
            ? MARKER_COLORS.PICKUP
            : MARKER_COLORS.OTHER_PICKUP;

        const marker = this.createMarker(position, color, job, 'Pickup', isCurrentJob);
        markersToAdd.push(marker);
        this.markers.push({
            marker,
            jobId: job.jobId,
            type: AddressType.Pickup,
            isCurrentJob,
        });
    }

    /**
     * Add a delivery marker
     */
    private addDeliveryMarker(
        job: IDispatchMapItem,
        isCurrentJob: boolean,
        useAlternateColors: boolean,
        markersToAdd: any[]
    ): void {
        const position = {
            lat: job.deliveryAddress.latitude ?? 0,
            lng: job.deliveryAddress.longitude ?? 0,
        };

        const color = isCurrentJob || !useAlternateColors
            ? MARKER_COLORS.DELIVERY
            : MARKER_COLORS.OTHER_DELIVERY;
        
        const marker = this.createMarker(position, color, job, 'Delivery', isCurrentJob);
        markersToAdd.push(marker);
        this.markers.push({
            marker,
            jobId: job.jobId,
            type: AddressType.Delivery,
            isCurrentJob,
        });
    }

    /**
     * Create a marker with icon
     */
    private createMarker(
        position: { lat: number; lng: number },
        color: string,
        job: IDispatchMapItem,
        locationType: string,
        isCurrentJob: boolean
    ): any {
        const icon = this.getOrCreateIcon(color);
        const point = new H.geo.Point(position.lat, position.lng);

        return new H.map.Marker(point, {
            icon,
            data: {
                job,
                locationType,
                isCurrentJob,
                color, // Store color for hover restore
            },
        });
    }

    /**
     * Get or create a cached icon
     */
    private getOrCreateIcon(color: string, isHovered: boolean = false): any {
        const cacheKey = `${color}_${isHovered ? 'hover' : 'normal'}`;

        if (this.iconCache.has(cacheKey)) {
            return this.iconCache.get(cacheKey);
        }

        const svgMarkup = this.createMarkerSvg(color, isHovered);
        // Scale: normal = 1.5 (36px), hover = 1.8 (43px) - matches Google Maps
        const anchorX = isHovered ? 21.5 : 18;
        const anchorY = isHovered ? 40 : 33;

        const icon = new H.map.Icon(svgMarkup, {
            anchor: { x: anchorX, y: anchorY },
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
     * Create marker SVG (matches Google Maps scale: 1.5 normal, 1.8 hover)
     */
    private createMarkerSvg(color: string, isHovered: boolean = false): string {
        // Normal: 36x36 (scale 1.5), Hover: 43x43 (scale 1.8)
        const size = isHovered ? 43 : 36;
        const strokeWidth = isHovered ? 0.56 : 0.67; // Adjusted for scale

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
            <path d="${MARKER_PIN_PATH}" fill="${color}" stroke="#FFFFFF" stroke-width="${strokeWidth}"/>
        </svg>`;
    }

    /**
     * Show tooltip on marker hover (Google Maps InfoWindow style)
     */
    private showTooltip(
        marker: any,
        job: IDispatchMapItem,
        locationType: string
    ): void {
        if (!this.tooltipElement) return;

        // Set content (matches old Google Maps style exactly)
        const contentEl = this.tooltipElement.querySelector('.gm-style-iw-content');
        if (contentEl) {
            contentEl.innerHTML = `
                <strong>Job ${this.escapeHtml(job.jobNo)}</strong><br>
                ${locationType} Location<br>
                <small style="color: #666;">Click to open job details</small>
            `;
        }

        // Get screen position of marker
        const position = marker.getGeometry();
        const screenPos = this.map.geoToScreen(position);

        if (screenPos) {
            // Position tooltip above the marker
            this.tooltipElement.style.left = `${screenPos.x}px`;
            this.tooltipElement.style.top = `${screenPos.y - 30}px`; // Offset above marker
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
     * Fit map to show all markers with padding (matches Google Maps fitBounds behavior)
     */
    fitMapToMarkers(courierMarkerGroup?: any): void {
        const bounds = this.markerGroup.getBoundingBox();

        if (!bounds && !courierMarkerGroup) return;

        let combinedBounds = bounds;

        // Combine with courier markers if provided
        if (courierMarkerGroup) {
            const courierBounds = courierMarkerGroup.getBoundingBox();
            if (courierBounds) {
                if (combinedBounds) {
                    combinedBounds = combinedBounds.mergeRect(courierBounds);
                } else {
                    combinedBounds = courierBounds;
                }
            }
        }

        if (!combinedBounds) return;

        // Add padding to bounds (similar to Google Maps fitBounds padding)
        const paddedBounds = this.addPaddingToBounds(combinedBounds, 0.15);

        this.map.getViewModel().setLookAtData({ bounds: paddedBounds });

        // Limit max zoom
        const zoom = this.map.getZoom();
        if (zoom > MAX_AUTO_ZOOM) {
            this.map.setZoom(MAX_AUTO_ZOOM);
        }
    }

    /**
     * Add padding to bounds (expands bounds by a percentage)
     */
    private addPaddingToBounds(bounds: any, paddingFactor: number): any {
        const top = bounds.getTop();
        const bottom = bounds.getBottom();
        const left = bounds.getLeft();
        const right = bounds.getRight();

        const latDiff = Math.abs(top - bottom) * paddingFactor;
        const lngDiff = Math.abs(right - left) * paddingFactor;

        // Ensure minimum padding for single point or very close points
        const minPadding = 0.002; // ~200m at equator
        const latPad = Math.max(latDiff, minPadding);
        const lngPad = Math.max(lngDiff, minPadding);

        return new H.geo.Rect(
            top + latPad,
            left - lngPad,
            bottom - latPad,
            right + lngPad
        );
    }

    /**
     * Clear all job markers
     */
    clearMarkers(): void {
        this.markerGroup.removeAll();
        this.markers = [];
        this.hideTooltip();
    }

    /**
     * Get marker count
     */
    getMarkerCount(): number {
        return this.markers.length;
    }
    
    /**
     * Validate coordinates
     */
    private isValidCoordinates(lat?: number, lng?: number): boolean {
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
        safeRemoveObject(this.map, this.markerGroup);
        // Remove tooltip element from DOM
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
            this.tooltipElement = null;
        }
        this.iconCache.clear();
    }
}
