import "./courier-map.styles.less";
import {ICourierMarker} from "./courier-map.interfaces";
import BaseController from "../base-controller";
import {HereMapConfig, HereMapCredentials} from "../../interfaces/hereMapCredentials.interfaces";
import ConfigService from "../../services/config.service";
import DispatchCoreService from "../../services/dispatch-core.service";
import {IAppConfig} from "../../interfaces/app-config.interface";
import {Coordinates} from "../overview/overview.interfaces";
import {IAvailableCourierPosition} from "../../interfaces/courier.interface";
import ToastrService from "../../services/toastr.service";
import GreetUser from "../../functions/greetUser";

declare const H: any;
declare const FirstName: string;

// Bounding box coordinates for country-wide courier queries
const US_BOUNDS = { minLng: -125, maxLng: -65, minLat: 24, maxLat: 50 };
const NZ_BOUNDS = { minLng: 165, maxLng: 180, minLat: -47, maxLat: -34 };

// Minimum distance change (in degrees) to trigger marker position update
const POSITION_THRESHOLD = 0.0001;

class CourierMapController extends BaseController {
    static $inject = [
        "toastrService",
        "DispatchData",
        "configService",
        "APP_CONFIG",
        "$scope",
        "$timeout",
        "$interval",
        "$mdSidenav",
    ];

    // Map references
    private map: any;
    private platform: any;
    private markerGroup: any;
    private courierMarkers: Map<number, ICourierMarker> = new Map();

    // Icon cache to avoid recreating SVG icons
    private iconCache: Map<string, any> = new Map();

    // Request management
    private pendingRequest: Promise<any> | null = null;
    private isRefreshing: boolean = false;

    // Configuration
    isUsCustomer: boolean;
    mapCenter: Coordinates;
    hereMapCredentials?: HereMapCredentials;
    hereMapConfig?: HereMapConfig;

    // Data
    drivers: IAvailableCourierPosition[] = [];
    totalActiveDrivers: number = 0;
    dataLoading: boolean = false;

    // Search
    searchTerm: string = '';

    // Panel state
    isPanelHidden: boolean = false;
    isPanelAnimating: boolean = false;

    // Debounced refresh
    private readonly debouncedRefresh: () => void;

    constructor(
        private toastrService: ToastrService,
        private dispatchService: DispatchCoreService,
        private configService: ConfigService,
        appConfig: IAppConfig,
        $scope: angular.IScope,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        private $mdSidenav: angular.material.ISidenavService,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.isUsCustomer = appConfig.US_Customer;
        this.mapCenter = this.isUsCustomer
            ? appConfig.US_Coordinates_Center
            : appConfig.NZ_Coordinates_Center;

        // Create debounced refresh (300ms)
        this.debouncedRefresh = this.debounce(async () => {
            await this.refreshDataInternal();
        }, 300, 'courierRefresh');

        this.initializeMap().then(() => console.log("Courier Map credentials loaded"));

        // Auto-refresh every 30 seconds
        this.registerInterval(() => {
            this.refreshData();
        }, 30000);
    }

    async initializeMap(): Promise<void> {
        try {
            const hereApiKey = await this.configService.getHereMapsKey();

            this.hereMapCredentials = {
                apiKey: hereApiKey
            };

            this.hereMapConfig = {
                center: this.mapCenter,
                zoom: this.isUsCustomer ? 4 : 10,
                disableAutoZoom: true,
                preserveView: true
            };

            this.applyScope();
        } catch (error) {
            console.error("Error initializing Courier Map:", error);
            this.toastrService.showErrorToast("Error initializing map");
        }
    }

    onMapReady(map: any, platform: any): void {
        console.log("Courier Map ready");
        this.map = map;
        this.platform = platform;

        // Create a group for all markers (batch operations are faster)
        this.markerGroup = new H.map.Group();
        this.map.addObject(this.markerGroup);

        // Load initial data
        this.refreshData();
    }

    // Public refresh method (debounced)
    refreshData(): void {
        if (!this.map) return;
        this.debouncedRefresh();
    }

    // Internal refresh implementation
    private async refreshDataInternal(): Promise<void> {
        if (!this.map || this.isRefreshing) return;

        try {
            this.isRefreshing = true;
            this.dataLoading = true;
            this.applyScope();

            const bounds = this.isUsCustomer ? US_BOUNDS : NZ_BOUNDS;

            // Store the promise so we can potentially cancel/ignore stale results
            this.pendingRequest = this.dispatchService.getAvailableCourierLocation(
                bounds.minLng,
                bounds.minLat,
                bounds.maxLng,
                bounds.maxLat
            );

            const couriers = await this.pendingRequest;
            this.pendingRequest = null;

            // Filter valid coordinates
            const validCouriers = couriers.filter((c: IAvailableCourierPosition) =>
                c.latitude !== null &&
                c.longitude !== null &&
                !isNaN(c.latitude!) &&
                !isNaN(c.longitude!)
            );

            this.drivers = validCouriers;
            this.totalActiveDrivers = validCouriers.length;

            // Smart marker update
            this.updateMarkersEfficiently(validCouriers);

        } catch (error) {
            if (this.pendingRequest !== null) {
                // Only show an error if this wasn't canceled
                this.toastrService.showErrorToast("Error refreshing courier data");
                console.error("Error:", error);
            }
        } finally {
            this.isRefreshing = false;
            this.dataLoading = false;
            this.applyScope();
        }
    }

    private updateMarkersEfficiently(couriers: IAvailableCourierPosition[]): void {
        if (!this.map || !this.markerGroup) return;

        const currentIds = new Set(couriers.map(c => c.courierId));
        const existingIds = new Set(this.courierMarkers.keys());

        // Remove markers for couriers no longer present
        const toRemove: number[] = [];
        existingIds.forEach(id => {
            if (!currentIds.has(id)) {
                toRemove.push(id);
            }
        });

        if (toRemove.length > 0) {
            const markersToRemove: any[] = [];
            toRemove.forEach(id => {
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

        couriers.forEach(courier => {
            const existing = this.courierMarkers.get(courier.courierId);

            if (existing) {
                // Check if the position changed significantly
                const posChanged = this.hasPositionChanged(
                    existing.lat!, existing.lng!,
                    courier.latitude!, courier.longitude!
                );

                if (posChanged) {
                    // Update position
                    existing.marker.setGeometry({
                        lat: courier.latitude,
                        lng: courier.longitude
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
                    lng: courier.longitude!
                });
            }
        });

        // Batch add new markers
        if (markersToAdd.length > 0) {
            this.markerGroup.addObjects(markersToAdd);
        }
    }

    private hasPositionChanged(
        oldLat: number, oldLng: number,
        newLat: number, newLng: number
    ): boolean {
        return Math.abs(oldLat - newLat) > POSITION_THRESHOLD ||
               Math.abs(oldLng - newLng) > POSITION_THRESHOLD;
    }

    private getOrCreateIcon(name: string): any {
        const displayName = name.length > 12 ? name.substring(0, 10) + '..' : name;

        // Check cache first
        if (this.iconCache.has(displayName)) {
            return this.iconCache.get(displayName);
        }

        // Create a new icon
        const svgMarkup = this.createFlagSvg(displayName);
        const icon = new H.map.Icon(svgMarkup, {
            anchor: { x: 12, y: 36 }
        });

        // Cache it (limit cache size to prevent memory issues)
        if (this.iconCache.size > 200) {
            // Remove oldest entries
            const firstKey = this.iconCache.keys().next().value;
            if(!firstKey) {
                return;
            }
            
            this.iconCache.delete(firstKey);
        }
        this.iconCache.set(displayName, icon);

        return icon;
    }

    private createCourierMarker(driver: IAvailableCourierPosition): any {
        const point = new H.geo.Point(driver.latitude, driver.longitude);
        const label = this.getMarkerLabel(driver);
        const icon = this.getOrCreateIcon(label);
        const marker = new H.map.Marker(point, { icon, data: driver });

        // Use event delegation pattern - store driver data on marker
        marker.addEventListener('tap', (evt: any) => {
            const driverData = evt.target.getData();
            if (driverData) {
                this.centerOnDriver(driverData);
                this.applyScope();
            }
        });

        return marker;
    }

    private createFlagSvg(displayName: string): string {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="44" viewBox="0 0 100 44">
            <rect x="10" y="0" width="3" height="44" fill="#1565C0"/>
            <rect x="13" y="2" width="82" height="24" rx="3" ry="3" fill="#2196F3"/>
            <rect x="13" y="2" width="82" height="24" rx="3" ry="3" fill="none" stroke="#1565C0" stroke-width="1"/>
            <text x="54" y="18" font-family="Arial,sans-serif" font-size="11" font-weight="bold" fill="white" text-anchor="middle">${displayName}</text>
        </svg>`;
    }

    centerOnDriver(driver: IAvailableCourierPosition): void {
        if (!this.map || !driver.latitude || !driver.longitude) return;

        this.map.setCenter({ lat: driver.latitude, lng: driver.longitude });
        // Only zoom in if current zoom is too far out to see the driver clearly
        const currentZoom = this.map.getZoom();
        if (currentZoom < 12) {
            this.map.setZoom(12);
        }
    }

    // Filtered drivers for search
    get filteredDrivers(): IAvailableCourierPosition[] {
        if (!this.searchTerm || this.searchTerm.trim() === '') {
            return this.drivers;
        }

        const term = this.searchTerm.toLowerCase().trim();
        return this.drivers.filter(driver => {
            const name = (driver.courierName || '').toLowerCase();
            const code = (driver.code || '').toLowerCase();
            return name.includes(term) || code.includes(term);
        });
    }

    clearSearch(): void {
        this.searchTerm = '';
    }

    // Generate a consistent color based on courier ID
    getDriverColor(courierId: number): string {
        const colors = [
            '#3b82f6', // blue
            '#10b981', // emerald
            '#8b5cf6', // violet
            '#f59e0b', // amber
            '#ef4444', // red
            '#06b6d4', // cyan
            '#ec4899', // pink
            '#84cc16', // lime
            '#6366f1', // indigo
            '#14b8a6', // teal
        ];
        return colors[courierId % colors.length];
    }

    // Get initials from driver name
    getDriverInitials(name: string): string {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    // Get marker label based on region
    private getMarkerLabel(driver: IAvailableCourierPosition): string {
        if (this.isUsCustomer) {
            return driver.courierName || '';
        } else {
            // NZ: prefer code, fallback to name
            return driver.code || driver.courierName || '';
        }
    }

    returnToOverview(): void {
        if (!this.map) return;

        const countryZoom = this.isUsCustomer ? 4 : 7;
        this.map.setCenter(this.mapCenter);
        this.map.setZoom(countryZoom);
    }

    greetUser(): string {
        return GreetUser(FirstName);
    }

    toggleSidenav(): void {
        try {
            this.$mdSidenav("right").toggle();
        } catch (error) {
            console.error("Error toggling sidenav:", error);
        }
    }

    togglePanel(): void {
        if (this.isPanelAnimating) return;

        this.isPanelAnimating = true;
        this.isPanelHidden = !this.isPanelHidden;

        this.registerTimeout(() => {
            this.isPanelAnimating = false;
        }, 300);
    }

    $onDestroy(): void {
        // Clear pending request
        this.pendingRequest = null;

        // Clean up marker group (more efficient than individual removal)
        if (this.map && this.markerGroup) {
            this.map.removeObject(this.markerGroup);
        }

        // Clear caches
        this.courierMarkers.clear();
        this.iconCache.clear();

        super.$onDestroy();
    }
}

const CourierMapComponent: angular.IComponentOptions = {
    template: require("./courier-map.template.html"),
    controller: CourierMapController,
    controllerAs: "ctrl"
};

export default CourierMapComponent;
