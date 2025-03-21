import ConfigService from "../../../services/config.service";
import {IJob} from "../../../interfaces/job.interface";
import {AvailableCourierPosition} from "../../../interfaces/courier.interface";
import "./dispatch-map.styles.less";
import BaseController from "../../base-controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {AppConfig} from "../../../interfaces/app-config.interface";

class DispatchMapController extends BaseController {
    static $inject = ["NgMap", "$timeout", "configService", "$window", "$rootScope", "DispatchData", "APP_CONFIG"];

    private locationRefreshInterval: angular.IPromise<void> | null = null;
    private readonly LOCATION_REFRESH_INTERVAL = 15000;

    private mapInstance: google.maps.Map | null = null;
    private isUpdating: boolean = false;
    private PICKUP_ICON: google.maps.Symbol | null = null;
    private DELIVERY_ICON: google.maps.Symbol | null = null;
    private COURIER_ICON: google.maps.Symbol | null = null;
    private PICKUP_ICON_HOVER: google.maps.Symbol | null = null;
    private DELIVERY_ICON_HOVER: google.maps.Symbol | null = null;

    initialMapZoom?: number;
    jobs?: IJob[] = [];
    currentJob?: IJob;
    courierPositions?: AvailableCourierPosition[] = [];
    mapCenter?: google.maps.LatLng | google.maps.LatLngLiteral;
    mapZoom: number = 12;
    onMarkerClick?: (params: { job: IJob }) => void;
    showAvailableCouriers: boolean = false;
    autoZoomEnabled: boolean = true;

    polylines: any[] = [];
    markers: google.maps.Marker[] = [];
    flags: any[] = [];
    labels: google.maps.Marker[] = [];
    googleMapsUrl: string | null = null;
    map: google.maps.Map | null = null;
    tooltip: google.maps.InfoWindow | null = null;

    constructor(
        private NgMap: angular.map.INgMap,
        private $timeout: angular.ITimeoutService,
        private configService: ConfigService,
        private $window: angular.IWindowService,
        private $rootScope: angular.IRootScopeService,
        private DispatchData: DispatchCoreService,
        private AppConfig: AppConfig
    ) {
        super();
    }

    $onInit() {
        this._loadAutoZoomPreference();

        this.configService.getGoogleMapsKey()
            .then((apiKey: string) => {
                this.googleMapsUrl = `https://maps.google.com/maps/api/js?key=${apiKey}&libraries=places`;

                return this.$timeout(() => {
                    return this.NgMap.getMap({id: 'dispatchMap'});
                }, 1000);
            })
            .then((map) => {
                this._setupMarkerIcons();

                this.mapInstance = map;
                this.map = map;
                this.initialMapZoom = this.mapZoom;

                this.tooltip = new this.$window.google.maps.InfoWindow({
                    disableAutoPan: true
                });

                this._setupWatchers();
                this._startLocationRefreshInterval();

                if (this.jobs || this.currentJob) {
                    return this._updateDisplayedJobs();
                }
            })
            .catch((error) => {
                console.error("Error initializing map:", error);
            });
    }

    $onDestroy() {
        this._clearLocationRefreshInterval();
    }

    $onChanges(changes: angular.IOnChangesObject) {
        console.log('$onChanges called with changes:', changes);

        if (!this.mapInstance) return;

        if (changes.mapCenter && changes.mapCenter.currentValue) {
            this.mapInstance.setCenter(changes.mapCenter.currentValue);
        }

        if ('jobs' in changes || 'currentJob' in changes) {
            console.log('Updating displayed jobs due to changes in jobs or currentJob');
            return this._updateDisplayedJobs();
        }

        if (changes.showAvailableCouriers) {
            if (changes.showAvailableCouriers.currentValue) {
                return this.fetchCourierPositions();
            } else {
                this._clearCourierMarkers();
            }
        }

        if (changes.autoZoomEnabled &&
            changes.autoZoomEnabled.isFirstChange() &&
            changes.autoZoomEnabled.currentValue !== undefined) {
            this.autoZoomEnabled = changes.autoZoomEnabled.currentValue;
            this._saveAutoZoomPreference();

            if (this.autoZoomEnabled && this.markers.length > 0) {
                this._fitMapToMarkers();
            }
        }

        if (changes.mapZoom && changes.mapZoom.isFirstChange() && changes.mapZoom.currentValue) {
            this.initialMapZoom = changes.mapZoom.currentValue;
        }
    }

    private _createMarkerIcon(color: string, isHovered: boolean = false): google.maps.Symbol {
        return {
            path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
            fillColor: color,
            fillOpacity: 1,
            strokeWeight: isHovered ? 2 : 1,
            strokeColor: "#FFFFFF",
            scale: isHovered ? 1.8 : 1.5,
            anchor: new this.$window.google.maps.Point(12, 24)
        };
    }

    private _createFlagMarkerIcon(color: string): google.maps.Symbol {
        return {
            path: 'M2,2 L2,24 L6,24 L6,20 L6,12 L20,12 L16,7 L20,2 Z',
            fillColor: color,
            fillOpacity: 0.9,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 1.8,
            anchor: new this.$window.google.maps.Point(2, 24)
        };
    }

    private _setupMarkerIcons() {
        this.PICKUP_ICON = this._createMarkerIcon("#4CAF50");
        this.DELIVERY_ICON = this._createMarkerIcon("#F44336");
        this.COURIER_ICON = this._createFlagMarkerIcon("#1E88E5");
        this.PICKUP_ICON_HOVER = this._createMarkerIcon("#4CAF50", true);
        this.DELIVERY_ICON_HOVER = this._createMarkerIcon("#F44336", true);
    }

    private _setupWatchers() {
        this.$timeout(() => {
            this.$rootScope.$on('refreshCourierMarkers', (_: angular.IAngularEvent, newPositions: any) => {
                if (newPositions && this.mapInstance) {
                    this._updateCourierMarkers(newPositions);
                }
            });

            if (this.mapInstance) {
                this.$window.google.maps.event.addListener(this.mapInstance, 'bounds_changed', this.onBoundsChanged);
            }
        });
    }

    private onBoundsChanged = this._debounce(() => {
        if (this.showAvailableCouriers) {
            return this.fetchCourierPositions();
        }
    }, 500);

    private _debounce(func: Function, wait: number) {
        let timeout: any;
        return (...args: any[]) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    async fetchCourierPositions() {
        console.log('[DispatchMapController] Starting courier positions fetch');

        if (!this.showAvailableCouriers) {
            console.log('[DispatchMapController] Skipping fetch - couriers not enabled');
            return;
        }

        if (!this.mapInstance) {
            console.log('[DispatchMapController] Skipping fetch - map instance not available');
            return;
        }

        try {
            const coordinates = await this.getSearchCoordinates();
            const couriers: AvailableCourierPosition[]  = await this.fetchCourierData(coordinates);
            this._updateCourierMarkers(couriers);

            console.log('[DispatchMapController] Successfully updated courier positions', {
                courierCount: couriers?.length ?? 0
            });
        } catch (error) {
            console.error('[DispatchMapController] Failed to fetch courier positions:', error);
            this._clearCourierMarkers();
        }
    }

    private async getSearchCoordinates(): Promise<{
        west: number;
        south: number;
        east: number;
        north: number;
    }> {
        const bounds = this.mapInstance?.getBounds();

        if (bounds) {
            console.log('[DispatchMapController] Using map bounds for courier search');
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            return {
                west: sw.lng(),
                south: sw.lat(),
                east: ne.lng(),
                north: ne.lat()
            };
        }

        console.log('[DispatchMapController] Using default area for courier search');
        const center = this.mapCenter || this.AppConfig.US_Coordinates_Center;
        const offset = 0.5; // Approximate 50km radius bounds

        return {
            west: Number(center.lng) - offset,
            south: Number(center.lat) - offset,
            east: Number(center.lng) + offset,
            north: Number(center.lat) + offset
        };
    }

    private async fetchCourierData(coordinates: {
        west: number;
        south: number;
        east: number;
        north: number;
    }) {
        console.log('[DispatchMapController] Fetching courier locations', coordinates);

        return await this.DispatchData.getAvailableCourierLocation(
            coordinates.west,
            coordinates.south,
            coordinates.east,
            coordinates.north
        );
    }

    private async _updateDisplayedJobs() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            this._clearJobMarkers();

            if (this.currentJob) {
                // If a current job is selected, just show that job
                if (this._isValidCoordinates(
                    this.currentJob.pickupAddress?.latitude,
                    this.currentJob.pickupAddress?.longitude
                )) {
                    this._addPickupMarker(this.currentJob);
                }
                if (this._isValidCoordinates(
                    this.currentJob.deliveryAddress?.latitude,
                    this.currentJob.deliveryAddress?.longitude
                )) {
                    this._addDeliveryMarker(this.currentJob);
                }
            } else if (this.jobs?.length) {
                // Show all jobs if no current job is selected
                this.jobs.forEach((job: IJob) => {
                    if (this._isValidCoordinates(
                        job.pickupAddress?.latitude,
                        job.pickupAddress?.longitude
                    )) {
                        this._addPickupMarker(job);
                    }
                    if (this._isValidCoordinates(
                        job.deliveryAddress?.latitude,
                        job.deliveryAddress?.longitude
                    )) {
                        this._addDeliveryMarker(job);
                    }
                });
            }

            await this.$timeout(() => {
                if (this.autoZoomEnabled && this.markers.length > 0) {
                    this._fitMapToMarkers();
                } else if (this.markers.length > 0) {
                    this._centerMapOnMarkers();
                }
            }, 100);
        } finally {
            this.isUpdating = false;
        }
    }

    private _centerMapOnMarkers() {
        if (this.markers.length === 0) return;

        const bounds = new this.$window.google.maps.LatLngBounds();

        this.markers.forEach((marker: google.maps.Marker) => {
            bounds.extend(marker.getPosition() as google.maps.LatLng);
        });

        const center = bounds.getCenter();
        this.mapInstance!.setCenter(center);
    }

    private _updateCourierMarkers(couriers: AvailableCourierPosition[]) {
        if (!couriers || !this.showAvailableCouriers) return;

        this._clearCourierMarkers();
        this.courierPositions = couriers;

        couriers.forEach((courier: AvailableCourierPosition) => {
            if (this._isValidCoordinates(courier.latitude ?? 0, courier.longitude ?? 0)) {
                this._addCourierMarker(courier);
            }
        });
    }

    private _addPickupMarker(job: IJob) {
        if (!job.pickupAddress) return;

        const position = new this.$window.google.maps.LatLng(
            job.pickupAddress.latitude,
            job.pickupAddress.longitude
        );

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.PICKUP_ICON,
            title: `Click to open job ${job.jobNo}`,
            animation: this.$window.google.maps.Animation.DROP
        });

        this._setupMarkerListeners(marker, job, this.PICKUP_ICON!, this.PICKUP_ICON_HOVER!, "Pickup");
        this.markers.push(marker);
    }

    private _addDeliveryMarker(job: IJob) {
        if (!job.deliveryAddress) return;

        const position = new this.$window.google.maps.LatLng(
            job.deliveryAddress.latitude,
            job.deliveryAddress.longitude
        );

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.DELIVERY_ICON,
            title: `Click to open job ${job.jobNo}`,
            animation: this.$window.google.maps.Animation.DROP
        });

        this._setupMarkerListeners(marker, job, this.DELIVERY_ICON!, this.DELIVERY_ICON_HOVER!, "Delivery");
        this.markers.push(marker);
    }

    private _setupMarkerListeners(marker: google.maps.Marker, job: any, normalIcon: google.maps.Symbol, hoverIcon: google.maps.Symbol, locationType: string) {
        marker.addListener("mouseover", () => {
            marker.setIcon(hoverIcon);
            const content = `
                <div style="padding: 8px;">
                    <strong>Job ${job.jobNo}</strong><br>
                    ${locationType} Location<br>
                    <small style="color: #666;">Click to open job details</small>
                </div>
            `;
            this.tooltip!.setContent(content);
            this.tooltip!.open(this.mapInstance, marker);
        });

        marker.addListener("mouseout", () => {
            marker.setIcon(normalIcon);
            this.tooltip!.close();
        });

        marker.addListener("click", () => {
            const currentZoom = this.mapInstance!.getZoom();

            if (locationType === "Delivery") {
                marker.setAnimation(this.$window.google.maps.Animation.BOUNCE);
                setTimeout(() => {
                    marker.setAnimation(null);
                }, 750);
            }

            this.mapInstance!.setCenter(marker.getPosition() as google.maps.LatLng);

            if (!this.autoZoomEnabled && currentZoom) {
                this.mapInstance!.setZoom(currentZoom);
            }

            if (this.onMarkerClick) {
                this.onMarkerClick({job: job});
            }
        });
    }

    private _addCourierMarker(courier: AvailableCourierPosition) {
        const position = new this.$window.google.maps.LatLng(courier.latitude, courier.longitude);

        // Determine flag color based on overdue jobs - using Material Design colors
        const flagColor = courier.overDueJobs > 0 ? '#E53935' : '#43A047'; // Material Red 600 for alert, Material Green 600 for normal
        const flagIcon = this._createFlagMarkerIcon(flagColor);

        // Create the courier marker
        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: flagIcon,
            title: `Courier ${courier.code}`,
            label: {
                text: courier.totalJobs.toString(),
                color: '#FFFFFF',
                fontWeight: 'bold',
                fontSize: '12px'
            }
        });

        const courierName = courier.code || "Courier";

        marker.addListener("mouseover", () => {
            const overdueJobsText = courier.overDueJobs > 0
                ? `<span style="color: #E53935; font-weight: bold;">Overdue Jobs: ${courier.overDueJobs}</span><br>`
                : '';

            const content = `
            <div style="padding: 8px;">
                <strong>Courier: ${courierName}</strong><br>
                ${courier.fleetCode ? `Fleet: ${courier.fleetCode}<br>` : ''}
                ${courier.vehicleType ? `Vehicle: ${courier.vehicleType}<br>` : ''}
                <strong>Total Jobs: ${courier.totalJobs}</strong><br>
                ${overdueJobsText}
            </div>
        `;
            this.tooltip!.setContent(content);
            this.tooltip!.open(this.mapInstance, marker);
        });

        marker.addListener("mouseout", () => {
            this.tooltip!.close();
        });

        marker.addListener("click", () => {
            this.mapInstance!.setCenter(position);

            // Zoom in if autoZoom is enabled
            if (this.autoZoomEnabled) {
                const newZoom = Math.min((this.mapInstance!.getZoom() || 12) + 2, 16);
                this.mapInstance!.setZoom(newZoom);
            }
        });

        this.flags.push(marker);
    }

    private _clearJobMarkers() {
        this.markers.forEach((marker: google.maps.Marker) => marker.setMap(null));
        this.markers = [];
    }

    private _clearCourierMarkers() {
        this.flags.forEach((flag: any) => flag.setMap(null));
        this.flags = [];
        this.labels.forEach((label: any) => label.setMap(null));
        this.labels = [];
    }

    private _fitMapToMarkers() {
        if (this.markers.length === 0 && this.flags.length === 0) return;

        const bounds = new this.$window.google.maps.LatLngBounds();

        this.markers.forEach((marker: google.maps.Marker) => {
            bounds.extend(marker.getPosition() as google.maps.LatLng);
        });

        if (this.showAvailableCouriers) {
            this.flags.forEach((marker: google.maps.Marker) => {
                bounds.extend(marker.getPosition() as google.maps.LatLng);
            });
        }

        if (bounds.isEmpty()) return;
        this.mapInstance!.fitBounds(bounds);

        const zoom = this.mapInstance!.getZoom();
        if (zoom && zoom > 16) {
            this.mapInstance!.setZoom(16);
        }
    }

    private _isValidCoordinates(lat?: number, lng?: number): boolean {
        return Boolean(
            lat && lng && !isNaN(lat) && !isNaN(lng) &&
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        );
    }

    private _startLocationRefreshInterval() {
        this._clearLocationRefreshInterval();

        // Start a new interval
        this.locationRefreshInterval = this.$timeout(() => {
            this._refreshCourierLocations();
        }, this.LOCATION_REFRESH_INTERVAL);
    }

    private _refreshCourierLocations() {
        if (this.showAvailableCouriers) {
            this.fetchCourierPositions().then(r =>
                this.$rootScope.$emit('courierLocationsNeedRefresh')
            );
        }

        this.locationRefreshInterval = this.$timeout(() => {
            this._refreshCourierLocations();
        }, this.LOCATION_REFRESH_INTERVAL);
    }

    private _clearLocationRefreshInterval() {
        if (this.locationRefreshInterval) {
            this.$timeout.cancel(this.locationRefreshInterval);
            this.locationRefreshInterval = null;
        }
    }

    toggleAutoZoom(): void {
        this.autoZoomEnabled = !this.autoZoomEnabled;
        this._saveAutoZoomPreference();

        if (this.autoZoomEnabled && this.markers.length > 0) {
            this._fitMapToMarkers();
        } else if (!this.autoZoomEnabled && this.markers.length > 0) {
            this._centerMapOnMarkers();
        }
    }

    private _saveAutoZoomPreference(): void {
        const contactId = ContactID;
        if (contactId && typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(`mapZoom-${contactId}`, JSON.stringify({display: this.autoZoomEnabled}));
            } catch (e) {
                console.error("Error saving auto zoom preference:", e);
            }
        }
    }

    private _loadAutoZoomPreference(): void {
        const contactId = ContactID;
        if (contactId && typeof window !== 'undefined' && window.localStorage) {
            try {
                const savedPreference = window.localStorage.getItem(`mapZoom-${contactId}`);
                if (savedPreference) {
                    const parsed = JSON.parse(savedPreference);
                    this.autoZoomEnabled = parsed.display;
                }
            } catch (e) {
                console.error("Error loading auto zoom preference:", e);
                this.autoZoomEnabled = true; // Default to true if any error occurs
            }
        }
    }
}

const DispatchMapComponent: angular.IComponentOptions = {
    template: require("./dispatch-map.template.html"),
    controller: DispatchMapController,
    controllerAs: 'ctrl',
    bindings: {
        jobs: '<',
        currentJob: '<',
        mapCenter: '<',
        mapZoom: '<',
        onMarkerClick: '&',
        showAvailableCouriers: '<'
    }
};

export default DispatchMapComponent;
