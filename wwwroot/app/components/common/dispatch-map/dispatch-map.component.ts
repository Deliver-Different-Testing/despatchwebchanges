import ConfigService from "../../../services/config.service";
import {IJob} from "../../../interfaces/job.interface";
import {AvailableCourierPosition} from "../../../interfaces/courier.interface";
import "./dispatch-map.styles.less";
import BaseController from "../../base-controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {AppConfig} from "../../../interfaces/app-config.interface";

class DispatchMapController extends BaseController {
    static $inject = [
        "NgMap",
        "$timeout",
        "configService",
        "$window",
        "$rootScope",
        "DispatchData",
        "APP_CONFIG",
    ];

    private locationRefreshInterval: angular.IPromise<void> | null = null;
    private readonly LOCATION_REFRESH_INTERVAL = 15000;
    private refreshCouriersMarkerListener: Function | null = null;
    private boundsChangedListener: Function | null = null;
    private pendingChanges: {
        jobs?: IJob[];
        currentJob?: IJob;
        mapCenter?: google.maps.LatLng | google.maps.LatLngLiteral;
        mapZoom?: number;
        showAvailableCouriers?: boolean;
    } = {};

    mapInstance: google.maps.Map | null = null;
    isUpdating: boolean = false;
    PICKUP_ICON: google.maps.Symbol | null = null;
    DELIVERY_ICON: google.maps.Symbol | null = null;
    COURIER_ICON: google.maps.Symbol | null = null;
    PICKUP_ICON_HOVER: google.maps.Symbol | null = null;
    DELIVERY_ICON_HOVER: google.maps.Symbol | null = null;
    OTHER_PICKUP_ICON: google.maps.Symbol | null = null;
    OTHER_DELIVERY_ICON: google.maps.Symbol | null = null;
    OTHER_PICKUP_ICON_HOVER: google.maps.Symbol | null = null;
    OTHER_DELIVERY_ICON_HOVER: google.maps.Symbol | null = null;

    initialMapZoom?: number;
    jobs?: IJob[] = [];
    currentJob?: IJob;
    courierPositions?: AvailableCourierPosition[] = [];
    mapCenter?: google.maps.LatLng | google.maps.LatLngLiteral;
    mapZoom: number = 12;
    onMarkerClick?: (params: { job: IJob }) => void;
    showAvailableCouriers: boolean = false;
    autoZoomEnabled: boolean = true;
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

                this._setupEventListeners();
                this._startLocationRefreshInterval();

                // Check if we have jobs data already
                if ((this.jobs && this.jobs.length > 0) || this.currentJob) {
                    console.log('[DispatchMapController] Map initialized with existing jobs data, updating markers...');
                    return this._updateDisplayedJobs();
                } else {
                    console.log('[DispatchMapController] Map initialized without jobs data, will wait for changes');
                }
            })
            .catch((error) => {
                console.error("[DispatchMapController] Error initializing map:", error);
            });
    }

    $onDestroy() {
        this._clearLocationRefreshInterval();
        this._removeEventListeners();
    }

    $onChanges(changes: angular.IOnChangesObject) {
        console.log('[DispatchMapController] $onChanges called with changes:', changes);

        // If map isn't ready, store changes to apply later
        if (!this.mapInstance) {
            console.log('[DispatchMapController] Map instance not ready yet, storing changes for later');

            if ('jobs' in changes && changes.jobs.currentValue) {
                console.log(`[DispatchMapController] Storing jobs array with ${changes.jobs.currentValue.length} jobs`);
                this.pendingChanges.jobs = changes.jobs.currentValue;
            }

            if ('currentJob' in changes && changes.currentJob.currentValue) {
                console.log('[DispatchMapController] Storing current job for later');
                this.pendingChanges.currentJob = changes.currentJob.currentValue;
            }

            if ('mapCenter' in changes && changes.mapCenter.currentValue) {
                this.pendingChanges.mapCenter = changes.mapCenter.currentValue;
            }

            if ('mapZoom' in changes && changes.mapZoom.currentValue) {
                this.pendingChanges.mapZoom = changes.mapZoom.currentValue;
            }

            if ('showAvailableCouriers' in changes) {
                this.pendingChanges.showAvailableCouriers = changes.showAvailableCouriers.currentValue;
            }

            return;
        }

        // Apply changes normally when map is ready
        if (changes.mapCenter && changes.mapCenter.currentValue) {
            this.mapInstance.setCenter(changes.mapCenter.currentValue);
        }

        // Handle jobs and currentJob changes
        if ('jobs' in changes || 'currentJob' in changes) {
            console.log('[DispatchMapController] Jobs or currentJob changed, updating markers...');

            if ('jobs' in changes) {
                console.log(`[DispatchMapController] Jobs array changed: ${changes.jobs.currentValue?.length || 0} jobs available`);
            }

            if ('currentJob' in changes) {
                console.log(`[DispatchMapController] Current job changed: ${changes.currentJob.currentValue?.jobNo || 'none'}`);
            }

            this._clearJobMarkers();
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
            path: 'M2,2 L2,24 L6,24 L6,20 L6,12 L30,12 L26,7 L30,2 Z',
            fillColor: color,
            fillOpacity: 0.9,
            strokeWeight: 2,
            strokeColor: '#FFFFFF',
            scale: 1.8,
            anchor: new this.$window.google.maps.Point(2, 24),
            labelOrigin: new this.$window.google.maps.Point(18, 7)
        };
    }

    private _setupMarkerIcons() {
        this.PICKUP_ICON = this._createMarkerIcon("#4CAF50");
        this.DELIVERY_ICON = this._createMarkerIcon("#F44336");
        this.COURIER_ICON = this._createFlagMarkerIcon("#1E88E5");
        this.PICKUP_ICON_HOVER = this._createMarkerIcon("#4CAF50", true);
        this.DELIVERY_ICON_HOVER = this._createMarkerIcon("#F44336", true);

        this.OTHER_PICKUP_ICON = this._createMarkerIcon("#3F51B5");
        this.OTHER_DELIVERY_ICON = this._createMarkerIcon("#FF5722");
        this.OTHER_PICKUP_ICON_HOVER = this._createMarkerIcon("#3F51B5", true);
        this.OTHER_DELIVERY_ICON_HOVER = this._createMarkerIcon("#FF5722", true);
    }

    private _setupEventListeners() {
        this.refreshCouriersMarkerListener = this.$rootScope.$on('refreshCourierMarkers',
            (_: angular.IAngularEvent, newPositions: any) => {
                if (newPositions && this.mapInstance) {
                    this._updateCourierMarkers(newPositions);
                }
            }
        );

        if (this.mapInstance) {
            this.boundsChangedListener = this.$window.google.maps.event.addListener(
                this.mapInstance,
                'bounds_changed',
                this.onBoundsChanged
            );
        }
    }

    private _removeEventListeners() {
        if (this.refreshCouriersMarkerListener) {
            (this.refreshCouriersMarkerListener as any)();
            this.refreshCouriersMarkerListener = null;
        }

        if (this.boundsChangedListener && this.mapInstance) {
            this.$window.google.maps.event.removeListener(this.boundsChangedListener);
            this.boundsChangedListener = null;
        }
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
            const couriers = await this.fetchCourierData(coordinates);
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
        if (this.isUpdating) {
            if (this.markers.length === 0) {
                console.log('[DispatchMapController] Initial update, allowing even though update is in progress');
            } else {
                console.log('[DispatchMapController] Already updating displayed jobs, skipping this update');
                return;
            }
        }

        if (!this.mapInstance) {
            console.log('[DispatchMapController] Map instance not ready yet, cannot update jobs');
            return;
        }

        this.isUpdating = true;
        console.log('[DispatchMapController] Starting to update displayed jobs...');

        try {
            let markersAdded = 0;
            const currentJobId = this.currentJob?.id;

            const isShowingCourierJobs = Boolean(
                this.currentJob &&
                (this.currentJob.courier || this.currentJob.assignedCourier) &&
                this.jobs && this.jobs.length > 1
            );

            console.log(`[DispatchMapController] Map mode: ${isShowingCourierJobs ? 'Courier jobs view' : 'Normal view'}`);

            if (this.currentJob) {
                console.log(`[DispatchMapController] Adding current job to map: ${this.currentJob.jobNo}`);

                if (this._isValidCoordinates(
                    this.currentJob.pickupAddress?.latitude,
                    this.currentJob.pickupAddress?.longitude
                )) {
                    this._addPickupMarker(this.currentJob, true);
                    markersAdded++;
                }

                if (this._isValidCoordinates(
                    this.currentJob.deliveryAddress?.latitude,
                    this.currentJob.deliveryAddress?.longitude
                )) {
                    this._addDeliveryMarker(this.currentJob, true);
                    markersAdded++;
                }
            }

            if (this.jobs?.length) {
                console.log(`[DispatchMapController] Adding ${this.jobs.length} jobs to map`);

                this.jobs.forEach((job: IJob) => {
                    if (currentJobId && job.id === currentJobId) {
                        return;
                    }

                    const useAlternateColor = isShowingCourierJobs;

                    if (this._isValidCoordinates(
                        job.pickupAddress?.latitude,
                        job.pickupAddress?.longitude
                    )) {
                        this._addPickupMarker(job, false, useAlternateColor);
                        markersAdded++;
                    }

                    if (this._isValidCoordinates(
                        job.deliveryAddress?.latitude,
                        job.deliveryAddress?.longitude
                    )) {
                        this._addDeliveryMarker(job, false, useAlternateColor);
                        markersAdded++;
                    }
                });
            }

            console.log(`Added ${markersAdded} markers to the map`);

            if (markersAdded > 0) {
                await this.$timeout(() => {
                    if (this.autoZoomEnabled) {
                        console.log('[DispatchMapController] Auto-zoom enabled, fitting map to markers');
                        this._fitMapToMarkers();
                    } else {
                        console.log('[DispatchMapController] Auto-zoom disabled, centering map on markers');
                        this._centerMapOnMarkers();
                    }
                }, 200);
            } else {
                console.log('[DispatchMapController] No markers added to map');
            }
        } catch (error) {
            console.error('[DispatchMapController] Error updating displayed jobs:', error);
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

    private _addPickupMarker(job: IJob, isCurrentJob: boolean = false, useAlternateColor: boolean = false) {
        if (!job.pickupAddress) return;

        const position = new this.$window.google.maps.LatLng(
            job.pickupAddress.latitude,
            job.pickupAddress.longitude
        );

        let icon, hoverIcon;

        if (isCurrentJob) {
            icon = this.PICKUP_ICON;
            hoverIcon = this.PICKUP_ICON_HOVER;
        } else if (useAlternateColor) {
            icon = this.OTHER_PICKUP_ICON;
            hoverIcon = this.OTHER_PICKUP_ICON_HOVER;
        } else {
            icon = this.PICKUP_ICON;
            hoverIcon = this.PICKUP_ICON_HOVER;
        }

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: icon,
            title: `Click to open job ${job.jobNo}${isCurrentJob ? ' (Current Job)' : ''}`,
            opacity: 0.4
        });

        this.$timeout(() => {
            this._fadeInMarker(marker);
        }, Math.random() * 200);

        this._setupMarkerListeners(marker, job, icon!, hoverIcon!, "Pickup");
        this.markers.push(marker);
    }

    private _addDeliveryMarker(job: IJob, isCurrentJob: boolean = false, useAlternateColor: boolean = false) {
        if (!job.deliveryAddress) return;

        const position = new this.$window.google.maps.LatLng(
            job.deliveryAddress.latitude,
            job.deliveryAddress.longitude
        );

        let icon, hoverIcon;

        if (isCurrentJob) {
            icon = this.DELIVERY_ICON;
            hoverIcon = this.DELIVERY_ICON_HOVER;
        } else if (useAlternateColor) {
            icon = this.OTHER_DELIVERY_ICON;
            hoverIcon = this.OTHER_DELIVERY_ICON_HOVER;
        } else {
            icon = this.DELIVERY_ICON;
            hoverIcon = this.DELIVERY_ICON_HOVER;
        }

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: icon,
            title: `Click to open job ${job.jobNo}${isCurrentJob ? ' (Current Job)' : ''}`,
            opacity: 0.4
        });

        this.$timeout(() => {
            this._fadeInMarker(marker);
        }, Math.random() * 200);

        this._setupMarkerListeners(marker, job, icon!, hoverIcon!, "Delivery");
        this.markers.push(marker);
    }

    private _fadeInMarker(marker: google.maps.Marker) {
        let opacity = 0.4;
        const fadeInterval = setInterval(() => {
            opacity += 0.1;
            if (opacity >= 1) {
                opacity = 1;
                clearInterval(fadeInterval);
            }
            marker.setOpacity(opacity);
        }, 40); // 40ms intervals for smooth fade
    }

    private _setupMarkerListeners(marker: google.maps.Marker, job: any, normalIcon: google.maps.Symbol, hoverIcon: google.maps.Symbol, locationType: string) {
        const isCurrentJob = job.id === this.currentJob?.id;

        marker.addListener("mouseover", () => {
            marker.setIcon(hoverIcon);
            const content = `
            <div style="padding: 8px;">
                <strong>Job ${job.jobNo}</strong>${isCurrentJob ? ' <span style="color: #1976D2;">(Current Job)</span>' : ''}<br>
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

    private _getFlagColor(courier: AvailableCourierPosition): string {
        if (courier.overDueJobs > 0) {
            return '#FF1493';
        } else if (courier.totalJobs === 0) {
            return '#00FFFF';
        } else {
            return '#000000';
        }
    }

    private _getFlagTextColor(courier: AvailableCourierPosition): string {
        if (courier.totalJobs === 0) {
            return '#000000';
        }

        // All others white
        return '#FFFFFF';
    }

    private _addCourierMarker(courier: AvailableCourierPosition) {
        const position = new this.$window.google.maps.LatLng(courier.latitude, courier.longitude);

        const flagColor = this._getFlagColor(courier);
        const flagTextColor = this._getFlagTextColor(courier);

        const labelText = courier.overDueJobs > 0
            ? `${courier.totalJobs}/${courier.overDueJobs}`
            : `${courier.totalJobs}`;

        const courierFlagIcon = this._createFlagMarkerIcon(flagColor);

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: courierFlagIcon,
            title: `Courier ${courier.code}`,
            label: {
                text: labelText,
                color: flagTextColor,
                fontWeight: 'bold',
                fontSize: '10px'
            },
            opacity: 0.4
        });

        // Add fade-in effect to courier markers
        this.$timeout(() => {
            this._fadeInMarker(marker);
        }, Math.random() * 200);

        marker.addListener("mouseover", () => {
            const overdueJobsText = courier.overDueJobs > 0
                ? `<span style="color: #E53935; font-weight: bold;">Overdue Jobs: ${courier.overDueJobs}</span><br>`
                : '';

            const content = `
        <div style="padding: 8px;">
            <strong>${courier.courierName}</strong><br>
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
        const isValid = Boolean(
            lat && lng && !isNaN(lat) && !isNaN(lng) &&
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        );

        if (!isValid && (lat || lng)) {
            console.log(`[DispatchMapController] Invalid coordinates detected: lat=${lat}, lng=${lng}`);
        }

        return isValid;
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
            this.fetchCourierPositions().then(_ =>
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
