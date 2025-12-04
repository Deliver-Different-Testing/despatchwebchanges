import "./dispatch-map.styles.less";
import ConfigService from "../../../services/config.service";
import {IDispatchMapItem} from "../../../interfaces/job.interface";
import {IAvailableCourierPosition} from "../../../interfaces/courier.interface";
import BaseController from "../../base-controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import {ClearListEnvelopeViewModel} from "../../../interfaces/dfrnt-page-view-model.interface";

// Declare Label class (bundled in vendor.js from lib/google-maps-label/label.js)
declare class Label extends google.maps.OverlayView {
    constructor(options: any);
    bindTo(key: string, target: any, targetKey?: string): void;
    setMap(map: google.maps.Map | null): void;
}

class DispatchMapController extends BaseController {
    static $inject = [
        "NgMap",
        "configService",
        "$window",
        "$rootScope",
        "DispatchData",
        "APP_CONFIG",
        "$timeout",
        "$interval",
        "$scope",
    ];

    private locationRefreshInterval?: angular.IPromise<void>;
    private readonly LOCATION_REFRESH_INTERVAL = 15000;
    private readonly MAX_JOBS_TO_DISPLAY = 1000; // Limit jobs to prevent performance issues
    private readonly BATCH_SIZE = 200; // Process 200 jobs at a time for faster rendering// No delay between batches for instant rendering
    private refreshCouriersMarkerListener?: Function;
    private boundsChangedListener?: Function;
    private pendingChanges: {
        jobs?: IDispatchMapItem[];
        currentJob?: IDispatchMapItem;
        mapCenter?: google.maps.LatLng | google.maps.LatLngLiteral;
        mapZoom?: number;
        showAvailableCouriers?: boolean;
    } = {};

    mapInstance?: google.maps.Map;
    isUpdating: boolean = false;
    PICKUP_ICON?: google.maps.Symbol;
    DELIVERY_ICON?: google.maps.Symbol;
    COURIER_ICON?: google.maps.Symbol;
    PICKUP_ICON_HOVER?: google.maps.Symbol;
    DELIVERY_ICON_HOVER?: google.maps.Symbol;
    OTHER_PICKUP_ICON?: google.maps.Symbol;
    OTHER_DELIVERY_ICON?: google.maps.Symbol;
    OTHER_PICKUP_ICON_HOVER?: google.maps.Symbol;
    OTHER_DELIVERY_ICON_HOVER?: google.maps.Symbol;
    initialMapZoom?: number;
    jobs?: IDispatchMapItem[] = [];
    currentJob?: IDispatchMapItem;
    courierPositions?: IAvailableCourierPosition[] = [];
    mapCenter?: google.maps.LatLng | google.maps.LatLngLiteral;
    mapZoom: number = 12;
    onMarkerClick?: (params: { job: IDispatchMapItem }) => void;
    showAvailableCouriers: boolean = false;
    autoZoomEnabled: boolean = true;
    couriersOnlyEnabled: boolean = false;
    urgentArmyOnlyEnabled: boolean = false; 
    markers: google.maps.Marker[] = [];
    flags: any[] = [];
    labels: google.maps.Marker[] = [];
    googleMapsUrl?: string;
    map?: google.maps.Map;
    tooltip?: google.maps.InfoWindow;
    clearListId?: number;

    constructor(
        private NgMap: angular.map.INgMap,
        private configService: ConfigService,
        private $window: angular.IWindowService,
        private $rootScope: angular.IRootScopeService,
        private DispatchData: DispatchCoreService,
        private AppConfig: IAppConfig,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
        $scope: angular.IScope,
    ) {
        super();
        this.initServices($timeout, $interval, $scope);

        this.bindFunctions();
    }

    $onInit() {
        this.loadAutoZoomPreference();
        this.loadCouriersOnlyPreference();
        this.loadUrgentArmyOnlyPreference();

        this.configService.getGoogleMapsKey()
            .then((apiKey: string) => {
                this.googleMapsUrl = `https://maps.google.com/maps/api/js?key=${apiKey}&libraries=places`;

                return this.waitForMapElement();
            })
            .then((map) => {
                this.setupMarkerIcons();

                this.mapInstance = map;
                this.map = map;
                this.initialMapZoom = this.mapZoom;

                this.tooltip = new this.$window.google.maps.InfoWindow({
                    disableAutoPan: true
                });

                this.$window.google.maps.event.addListenerOnce(this.mapInstance, 'idle', () => {
                    this.addAutoZoomButton();
                });

                this.setupEventListeners();
                this.startLocationRefreshInterval();

                // Check if we have jobs data already
                if ((this.jobs && this.jobs.length > 0) || this.currentJob) {
                    return this.updateDisplayedJobs();
                }
            })
            .catch((error) => {
                console.error("[DispatchMapController] Error initializing map:", error);
            });
    }

    private bindFunctions() {
        this.onBoundsChanged = this.onBoundsChanged.bind(this);
        this.toggleAutoZoom = this.toggleAutoZoom.bind(this);
    }

    private waitForMapElement(): Promise<google.maps.Map> {
        const maxRetries = 10;
        let retryCount = 0;

        const tryGetMap = (): Promise<google.maps.Map> => {
            return new Promise((resolve, reject) => {
                // Check if an element exists first
                const mapElement = document.getElementById('dispatchMap');
                if (!mapElement) {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        this.registerTimeout(() => {
                            tryGetMap().then(resolve).catch(reject);
                        }, 500);
                    } else {
                        reject(new Error('Map element not found after maximum retries'));
                    }
                    return;
                }

                // Element exists, now try to get the map
                this.NgMap.getMap({id: 'dispatchMap'})
                    .then(resolve)
                    .catch((error) => {
                        if (retryCount < maxRetries) {
                            retryCount++;
                            this.registerTimeout(() => {
                                tryGetMap().then(resolve).catch(reject);
                            }, 500);
                        } else {
                            reject(error);
                        }
                    });
            });
        };

        return tryGetMap();
    }

    $onDestroy() {
        super.$onDestroy();
        this.clearLocationRefreshInterval();
        this.removeEventListeners();
    }

    $onChanges(changes: angular.IOnChangesObject) {
        // If a map isn't ready, store changes to apply later
        if (!this.mapInstance) {
            if (changes['jobs'] && changes['jobs'].currentValue) {
                this.pendingChanges.jobs = changes['jobs'].currentValue;
            }

            if (changes['currentJob'] && changes['currentJob'].currentValue) {
                this.pendingChanges.currentJob = changes['currentJob'].currentValue;
            }

            if (changes['mapCenter'] && changes['mapCenter'].currentValue) {
                this.pendingChanges.mapCenter = changes['mapCenter'].currentValue;
            }

            if (changes['mapZoom'] && changes['mapZoom'].currentValue) {
                this.pendingChanges.mapZoom = changes['mapZoom'].currentValue;
            }

            if (changes['showAvailableCouriers'] && changes['showAvailableCouriers'].currentValue) {
                this.pendingChanges.showAvailableCouriers = changes['showAvailableCouriers'].currentValue;
            }

            return;
        }

        // Apply changes normally when a map is ready
        if (changes['mapCenter'] && changes['mapCenter'].currentValue) {
            this.mapInstance.setCenter(changes.mapCenter.currentValue);
        }

        // Handle jobs and currentJob changes
        if (changes['jobs'] || changes['currentJob']) {
            this.clearJobMarkers();
            return this.updateDisplayedJobs();
        }

        if (changes['showAvailableCouriers']) {
            if (changes['showAvailableCouriers'].currentValue) {
                this.fetchCourierPositions()
                    .catch(error => console.error('[DispatchMapController] Error fetching couriers:', error));
            } else {
                this.clearCourierMarkers();
            }
        }

        if (changes['autoZoomEnabled'] &&
            changes['autoZoomEnabled'].isFirstChange() &&
            changes['autoZoomEnabled'].currentValue !== undefined) {
            this.autoZoomEnabled = changes['autoZoomEnabled'].currentValue;
            this.saveAutoZoomPreference();

            if (this.autoZoomEnabled && this.markers.length > 0) {
                this.fitMapToMarkers();
            }
        }

        if (changes['mapZoom'] && changes['mapZoom'].isFirstChange()
            && changes['mapZoom'].currentValue) {
            this.initialMapZoom = changes['mapZoom'].currentValue;
        }

        if (changes['clearListId'] && changes['clearListId'].currentValue) {
            this.clearListId = changes['clearListId'].currentValue;

            if (!this.clearListId) return;
            this.updateMapWithClearListEnvelope(this.clearListId);
        }
    }

    private createMarkerIcon(color: string, isHovered: boolean = false): google.maps.Symbol {
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

    private createFlagMarkerIcon(color: string): google.maps.Symbol {
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

    private setupMarkerIcons() {
        this.PICKUP_ICON = this.createMarkerIcon("#4CAF50");
        this.DELIVERY_ICON = this.createMarkerIcon("#F44336");
        this.COURIER_ICON = this.createFlagMarkerIcon("#1E88E5");
        this.PICKUP_ICON_HOVER = this.createMarkerIcon("#4CAF50", true);
        this.DELIVERY_ICON_HOVER = this.createMarkerIcon("#F44336", true);

        this.OTHER_PICKUP_ICON = this.createMarkerIcon("#3F51B5");
        this.OTHER_DELIVERY_ICON = this.createMarkerIcon("#FF5722");
        this.OTHER_PICKUP_ICON_HOVER = this.createMarkerIcon("#3F51B5", true);
        this.OTHER_DELIVERY_ICON_HOVER = this.createMarkerIcon("#FF5722", true);
    }

    private setupEventListeners() {
        this.refreshCouriersMarkerListener = this.watchScope('refreshCourierMarkers',
            (_: angular.IAngularEvent, newPositions: any) => {
                if (newPositions && this.mapInstance) {
                    this.updateCourierMarkers(newPositions);
                }
            }
        );

        if (this.mapInstance) {
            this.boundsChangedListener = this.$window.google.maps.event.addListener(
                this.mapInstance,
                'bounds_changed',
                () => this.onBoundsChanged()
            );
        }
    }

    private removeEventListeners() {
        if (this.refreshCouriersMarkerListener) {
            (this.refreshCouriersMarkerListener as any)();
            this.refreshCouriersMarkerListener = undefined;
        }

        if (this.boundsChangedListener && this.mapInstance) {
            this.$window.google.maps.event.removeListener(this.boundsChangedListener);
            this.boundsChangedListener = undefined;
        }
    }

    private onBoundsChanged() {
        if (this.showAvailableCouriers && !this.isUpdating) {
            return this.fetchCourierPositions();
        }
    }

    async fetchCourierPositions() {
        if (!this.showAvailableCouriers) {
            return;
        }

        if (!this.mapInstance) {
            return;
        }

        try {
            const coordinates = await this.getSearchCoordinates();
            const couriers = await this.DispatchData.getAvailableCourierLocation(
                coordinates.west,
                coordinates.south,
                coordinates.east,
                coordinates.north
            );
            this.updateCourierMarkers(couriers);
        } catch (error) {
            console.error('[DispatchMapController] Failed to fetch courier positions:', error);
            this.clearCourierMarkers();
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
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            return {
                west: sw.lng(),
                south: sw.lat(),
                east: ne.lng(),
                north: ne.lat()
            };
        }

        const center = this.mapCenter || this.AppConfig.US_Coordinates_Center;
        const offset = 0.5; // Approximate 50 km radius bounds

        return {
            west: Number(center.lng) - offset,
            south: Number(center.lat) - offset,
            east: Number(center.lng) + offset,
            north: Number(center.lat) + offset
        };
    }

    private async updateDisplayedJobs() {
        if (this.couriersOnlyEnabled) {
            // Don't add job markers when couriers-only mode is active
            return;
        }

        if (this.isUpdating) {
            if (this.markers.length === 0) {
            } else {
                return;
            }
        }

        if (!this.mapInstance) {
            return;
        }

        this.isUpdating = true;

        try {
            let markersAdded = 0;
            const currentJobId = this.currentJob?.jobId;

            const isShowingCourierJobs = Boolean(
                this.currentJob && this.currentJob.assignedCourier &&
                this.jobs && this.jobs.length > 1
            );

            // Add the current job first (if exists)
            if (this.currentJob) {

                if (this.isValidCoordinates(
                    this.currentJob.pickupAddress?.latitude,
                    this.currentJob.pickupAddress?.longitude
                )) {
                    this.addPickupMarker(this.currentJob, true);
                    markersAdded++;
                }

                if (this.isValidCoordinates(
                    this.currentJob.deliveryAddress?.latitude,
                    this.currentJob.deliveryAddress?.longitude
                )) {
                    this.addDeliveryMarker(this.currentJob, true);
                    markersAdded++;
                }
            }

            // Add other jobs in batches
            // Jobs are loaded when:
            // 1. A specific job is selected (via currentJob)
            // 2. A courier is selected (jobs loaded by home controller)
            // 3. An area is clicked (jobs loaded by home controller)
            // Note: Jobs are already filtered to undispatched (statusId=0) in home controller
            if (this.jobs?.length) {
                let jobsToAdd = this.jobs.filter(job =>
                    !currentJobId || job.jobId !== currentJobId
                );

                // Safety limit to prevent performance issues if there are still too many jobs
                if (jobsToAdd.length > this.MAX_JOBS_TO_DISPLAY) {
                    jobsToAdd = jobsToAdd.slice(0, this.MAX_JOBS_TO_DISPLAY);
                }

                const batchMarkersAdded = await this.addMarkersInBatches(
                    jobsToAdd,
                    isShowingCourierJobs,
                    this.BATCH_SIZE
                );
                markersAdded += batchMarkersAdded;
            }

            if (markersAdded > 0) {
                // Removed delay - auto-zoom can happen immediately
                if (this.autoZoomEnabled) {
                    this.fitMapToMarkers();
                }
            }
        } catch (error) {
            console.error('[DispatchMapController] Error updating displayed jobs:', error);
        } finally {
            this.isUpdating = false;
        }
    }

    private async addMarkersInBatches(
        jobs: IDispatchMapItem[],
        useAlternateColor: boolean = false,
        batchSize: number = 50
    ): Promise<number> {
        let totalMarkersAdded = 0;

        for (let i = 0; i < jobs.length; i += batchSize) {
            const batch = jobs.slice(i, i + batchSize);
            let batchMarkersAdded = 0;

            this.isUpdating = true;

            batch.forEach((job: IDispatchMapItem) => {
                if (this.isValidCoordinates(
                    job.pickupAddress?.latitude,
                    job.pickupAddress?.longitude
                )) {
                    this.addPickupMarker(job, false, useAlternateColor);
                    batchMarkersAdded++;
                }

                if (this.isValidCoordinates(
                    job.deliveryAddress?.latitude,
                    job.deliveryAddress?.longitude
                )) {
                    this.addDeliveryMarker(job, false, useAlternateColor);
                    batchMarkersAdded++;
                }
            });

            totalMarkersAdded += batchMarkersAdded;
        }

        this.isUpdating = false;
        return totalMarkersAdded;
    }

    private updateCourierMarkers(couriers: IAvailableCourierPosition[]) {
        if (!couriers || !this.showAvailableCouriers) return;

        this.clearCourierMarkers();
        this.courierPositions = couriers;

        // Apply urgent army filter if enabled
        const filteredCouriers = this.urgentArmyOnlyEnabled
            ? couriers.filter(c => c.isUrgentArmyDriver)
            : couriers;

        filteredCouriers.forEach((courier: IAvailableCourierPosition) => {
            if (this.isValidCoordinates(courier.latitude ?? 0, courier.longitude ?? 0)) {
                this.addCourierMarker(courier);
            }
        });
    }

    private addPickupMarker(job: IDispatchMapItem, isCurrentJob: boolean = false, useAlternateColor: boolean = false) {
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
            opacity: 1 // Disabled fade-in animation for performance
        });

        this.setupMarkerListeners(marker, job, icon!, hoverIcon!, "Pickup");
        this.markers.push(marker);
    }

    private addDeliveryMarker(job: IDispatchMapItem, isCurrentJob: boolean = false, useAlternateColor: boolean = false) {
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
            opacity: 1 // Disabled fade-in animation for performance
        });

        this.setupMarkerListeners(marker, job, icon!, hoverIcon!, "Delivery");
        this.markers.push(marker);
    }


    private setupMarkerListeners(marker: google.maps.Marker,
                                 job: IDispatchMapItem,
                                 normalIcon: google.maps.Symbol,
                                 hoverIcon: google.maps.Symbol,
                                 locationType: string) {
        const isCurrentJob = job.jobId === this.currentJob?.jobId;

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
            if (this.isUpdating) {
                return;
            }

            const currentZoom = this.mapInstance!.getZoom();
            this.mapInstance!.setCenter(marker.getPosition() as google.maps.LatLng);

            if (!this.autoZoomEnabled && currentZoom) {
                this.mapInstance!.setZoom(currentZoom);
            }

            this.registerTimeout(() => {
                if (this.onMarkerClick && !this.isUpdating) {
                    this.onMarkerClick({job: job});
                }
            }, 100);
        });
    }

    private getFlagTextColor(courier: IAvailableCourierPosition): string {
        if (courier.totalJobs === 0) {
            return '#000000';
        }

        // All others white
        return '#FFFFFF';
    }

    private addCourierMarker(courier: IAvailableCourierPosition) {
        const position = new this.$window.google.maps.LatLng(courier.latitude, courier.longitude);

        const flagTextColor = this.getFlagTextColor(courier);

        // Determine a CSS class based on courier status
        let className = "courier courierMarker";
        if (courier.totalJobs === 0) {
            className = "courier courierCream courierMarker";
        } else if (courier.overDueJobs > 0) {
            className = "courier courierRed courierMarker";
        }

        // Create the label overlay
        const label = new Label({
            map: this.mapInstance,
            color: flagTextColor,
            isVisible: true,
            cssClass: className
        });

        // Create the display text - backend returns an abbreviated vehicle type
        const displayText = courier.overDueJobs > 0
            ? `${courier.code}-${courier.vehicleType}${courier.totalJobs}/${courier.overDueJobs}`
            : `${courier.code}-${courier.vehicleType}${courier.totalJobs}`;

        // Create marker with flagpole icon - scale down for thinner appearance
        const iconFile = {
            url: '/images/flagpole.png',
            scaledSize: new this.$window.google.maps.Size(8, 40), // Make it thinner
            anchor: new this.$window.google.maps.Point(4, 40)
        };
        const marker = new this.$window.google.maps.Marker({
            position: position,
            draggable: false,
            map: this.mapInstance,
            icon: iconFile,
            title: `Courier ${courier.code}`,
            visible: true
        });

        // Bind label to marker
        label.bindTo('position', marker, 'position');
        label.bindTo('text', marker);
        (marker as any).set('display', displayText);
        label.bindTo('text', marker, 'display');
        label.bindTo('zIndex', marker);

        // Disabled fade-in animation for performance
        marker.setOpacity(1);

        marker.addListener("mouseover", () => {
            const overdueJobsText = courier.overDueJobs > 0
                ? `<span style="color: #E53935; font-weight: bold;">Overdue Jobs: ${courier.overDueJobs}</span><br>`
                : '';

            const content = `
        <div style="padding: 8px;">
            <strong>${courier.courierName}</strong><br>
            ${courier.isUrgentArmyDriver ? `Fleet: UA'}<br>` : ''}
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
        this.labels.push(label as any);
    }

    private clearJobMarkers() {
        this.markers.forEach((marker: google.maps.Marker) => marker.setMap(null));
        this.markers = [];
    }

    private clearCourierMarkers() {
        this.flags.forEach((flag: any) => flag.setMap(null));
        this.flags = [];
        this.labels.forEach((label: any) => label.setMap(null));
        this.labels = [];
    }

    private fitMapToMarkers() {
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

    private isValidCoordinates(lat?: number, lng?: number): boolean {
        return Boolean(
            lat && lng && !isNaN(lat) && !isNaN(lng) &&
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        );
    }

    private startLocationRefreshInterval() {
        this.clearLocationRefreshInterval();

        this.locationRefreshInterval = this.registerInterval(() => {
            if (this.showAvailableCouriers) {
                this.fetchCourierPositions()
                    .then(() => {
                        this.$rootScope.$emit('courierLocationsNeedRefresh');
                    })
                    .catch(error => console.error('[DispatchMapController] Error refreshing couriers:', error));
            }
        }, this.LOCATION_REFRESH_INTERVAL);
    }

    private clearLocationRefreshInterval() {
        if (this.locationRefreshInterval) {
            this.locationRefreshInterval = undefined;
        }
    }

    toggleAutoZoom(): void {
        this.autoZoomEnabled = !this.autoZoomEnabled;
        this.saveAutoZoomPreference();

        if (this.autoZoomEnabled && this.markers.length > 0) {
            this.fitMapToMarkers();
        }
    }

    private saveAutoZoomPreference(): void {
        const contactId = ContactID;
        if (contactId && typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(`mapZoom-${contactId}`, JSON.stringify({display: this.autoZoomEnabled}));
            } catch (e) {
                console.error("Error saving auto zoom preference:", e);
            }
        }
    }

    private loadAutoZoomPreference(): void {
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

    private addAutoZoomButton() {
        const mapControlsDiv = document.createElement('div');
        mapControlsDiv.className = 'map-controls';
        mapControlsDiv.style.margin = '10px';
        mapControlsDiv.style.zIndex = '1';
        mapControlsDiv.style.display = 'flex';
        mapControlsDiv.style.flexDirection = 'column';
        mapControlsDiv.style.gap = '10px';

        // Auto Zoom button
        const autoZoomButton = this.createAutoZoomButton();
        mapControlsDiv.appendChild(autoZoomButton);

        // Couriers-Only button
        const couriersOnlyButton = this.createCouriersOnlyButton();
        mapControlsDiv.appendChild(couriersOnlyButton);

        // Urgent Army button
        const urgentArmyButton = this.createUrgentArmyButton();
        mapControlsDiv.appendChild(urgentArmyButton);

        // Add the Material Icons font if not already loaded
        if (!document.getElementById('material-icons-font')) {
            const link = document.createElement('link');
            link.id = 'material-icons-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined';
            document.head.appendChild(link);
        }

        this.mapInstance!.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(mapControlsDiv);
    }
    
    private createAutoZoomButton(): HTMLElement {
        const buttonDiv = document.createElement('div');
        buttonDiv.innerHTML = `
        <button class="md-fab md-mini ${this.autoZoomEnabled ? 'md-primary' : 'md-warn'}" 
                aria-label="Toggle Auto Zoom"
                style="width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; 
                       box-shadow: 0 2px 5px rgba(0,0,0,0.3); outline: none; display: flex; 
                       justify-content: center; align-items: center;
                       background-color: ${this.autoZoomEnabled ? '#3f51b5' : '#f44336'};">
            <span class="material-symbols-outlined" 
                  style="color: white; font-size: 20px;">
                ${this.autoZoomEnabled ? 'fit_screen' : 'zoom_out_map'}
            </span>
            <div class="md-tooltip" 
                 style="position: absolute; left: 45px; 
                        background-color: rgba(97,97,97,0.9); color: white;
                        padding: 4px 8px; border-radius: 2px; font-size: 10px;
                        white-space: nowrap; opacity: 0; transition: opacity 0.3s;
                        pointer-events: none;">
                ${this.autoZoomEnabled ? 'Auto Zoom Enabled' : 'Auto Zoom Disabled'}
            </div>
        </button>
    `;

        const button = buttonDiv.querySelector('button')!;
        this.setupButtonHoverEffect(button);

        button.addEventListener('click', () => {
            this.toggleAutoZoom();
            button.style.backgroundColor = this.autoZoomEnabled ? '#3f51b5' : '#f44336';
            const iconSpan = button.querySelector('.material-symbols-outlined')!;
            iconSpan.textContent = this.autoZoomEnabled ? 'fit_screen' : 'zoom_out_map';
            const tooltip = button.querySelector('.md-tooltip')!;
            tooltip.textContent = this.autoZoomEnabled ? 'Auto Zoom Enabled' : 'Auto Zoom Disabled';
        });

        return buttonDiv;
    }

    private createCouriersOnlyButton(): HTMLElement {
        const buttonDiv = document.createElement('div');
        buttonDiv.innerHTML = `
        <button class="md-fab md-mini ${this.couriersOnlyEnabled ? 'md-primary' : 'md-warn'}" 
                aria-label="Toggle Couriers Only"
                style="width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; 
                       box-shadow: 0 2px 5px rgba(0,0,0,0.3); outline: none; display: flex; 
                       justify-content: center; align-items: center;
                       background-color: ${this.couriersOnlyEnabled ? '#3f51b5' : '#f44336'};">
            <span class="material-symbols-outlined" 
                  style="color: white; font-size: 20px;">
                ${this.couriersOnlyEnabled ? 'local_shipping' : 'map'}
            </span>
            <div class="md-tooltip" 
                 style="position: absolute; left: 45px; 
                        background-color: rgba(97,97,97,0.9); color: white;
                        padding: 4px 8px; border-radius: 2px; font-size: 10px;
                        white-space: nowrap; opacity: 0; transition: opacity 0.3s;
                        pointer-events: none;">
                ${this.couriersOnlyEnabled ? 'Couriers Only' : 'Pins and Couriers'}
            </div>
        </button>
    `;

        const button = buttonDiv.querySelector('button')!;
        this.setupButtonHoverEffect(button);

        button.addEventListener('click', async () => {
            await this.toggleCouriersOnly();
            button.style.backgroundColor = this.couriersOnlyEnabled ? '#3f51b5' : '#f44336';
            const iconSpan = button.querySelector('.material-symbols-outlined')!;
            iconSpan.textContent = this.couriersOnlyEnabled ? 'local_shipping' : 'map';
            const tooltip = button.querySelector('.md-tooltip')!;
            tooltip.textContent = this.couriersOnlyEnabled ? 'Couriers Only' : 'Show All';
        });

        return buttonDiv;
    }

    private createUrgentArmyButton(): HTMLElement {
        const buttonDiv = document.createElement('div');
        buttonDiv.innerHTML = `
        <button class="md-fab md-mini ${this.urgentArmyOnlyEnabled ? 'md-primary' : 'md-warn'}" 
                aria-label="Toggle Urgent Army Filter"
                style="width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer; 
                       box-shadow: 0 2px 5px rgba(0,0,0,0.3); outline: none; display: flex; 
                       justify-content: center; align-items: center;
                       background-color: ${this.urgentArmyOnlyEnabled ? '#3f51b5' : '#f44336'};">
            <span class="material-symbols-outlined" 
                  style="color: white; font-size: 20px;">
                ${this.urgentArmyOnlyEnabled ? 'emergency' : 'visibility_off'}
            </span>
            <div class="md-tooltip" 
                 style="position: absolute; left: 45px; 
                        background-color: rgba(97,97,97,0.9); color: white;
                        padding: 4px 8px; border-radius: 2px; font-size: 10px;
                        white-space: nowrap; opacity: 0; transition: opacity 0.3s;
                        pointer-events: none;">
                ${this.urgentArmyOnlyEnabled ? 'Show Fleet Only' : 'Show All Couriers'}
            </div>
        </button>
    `;

        const button = buttonDiv.querySelector('button')!;
        this.setupButtonHoverEffect(button);

        button.addEventListener('click', async () => {
            await this.toggleUrgentArmyOnly();
            button.style.backgroundColor = this.urgentArmyOnlyEnabled ? '#3f51b5' : '#f44336';
            const iconSpan = button.querySelector('.material-symbols-outlined')!;
            iconSpan.textContent = this.urgentArmyOnlyEnabled ? 'emergency' : 'visibility_off';
            const tooltip = button.querySelector('.md-tooltip')!;
            tooltip.textContent = this.urgentArmyOnlyEnabled ? 'Show Fleet Only' : 'Show All Couriers';
        });

        return buttonDiv;
    }

    private setupButtonHoverEffect(button: HTMLButtonElement): void {
        button.addEventListener('mouseenter', () => {
            const tooltip = button.querySelector('.md-tooltip') as HTMLElement;
            if (tooltip) {
                tooltip.style.opacity = '1';
            }
        });

        button.addEventListener('mouseleave', () => {
            const tooltip = button.querySelector('.md-tooltip') as HTMLElement;
            if (tooltip) {
                tooltip.style.opacity = '0';
            }
        });
    }

    async updateMapWithClearListEnvelope(clearListId: number): Promise<any> {
        if (!clearListId) {
            return null;
        }

        try {
            const envelopeData = await this.DispatchData.getDriverDestinationEnvelope(clearListId);

            if (envelopeData) {
                this.fitMapToEnvelope(envelopeData, 13);
                return envelopeData;
            } else {
                return null;
            }
        } catch (error) {
            console.error('[DispatchMapController] Error fetching clear list envelope:', error);
            throw error;
        }
    }

    fitMapToEnvelope(envelopeData: ClearListEnvelopeViewModel, zoomLevel?: number): void {
        if (!this.mapInstance || !envelopeData) {
            return;
        }

        try {
            const swll = new this.$window.google.maps.LatLng(
                envelopeData.minimumLatitude,
                envelopeData.minimumLongitude
            );
            const nell = new this.$window.google.maps.LatLng(
                envelopeData.maximumLatitude,
                envelopeData.maximumLongitude
            );

            const bounds = new this.$window.google.maps.LatLngBounds(swll, nell);
            this.mapInstance.fitBounds(bounds);

            if (zoomLevel) {
                this.registerTimeout(() => {
                    this.mapInstance!.setZoom(zoomLevel);
                }, 100);
            }
        } catch (error) {
            console.error('[DispatchMapController] Error fitting map to envelope:', error);
        }
    }

    async toggleCouriersOnly(): Promise<void> {
        this.couriersOnlyEnabled = !this.couriersOnlyEnabled;
        this.saveCouriersOnlyPreference();

        if (this.couriersOnlyEnabled) {
            // Hide all job markers
            this.clearJobMarkers();
            // Show only couriers
            if (this.showAvailableCouriers) {
                this.fetchCourierPositions()
                    .catch(error => console.error('[DispatchMapController] Error fetching couriers:', error));
            }
        } else {
            // Restore job markers
            await this.updateDisplayedJobs();
        }
    }

    private saveCouriersOnlyPreference(): void {
        const contactId = ContactID;
        if (contactId && typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(`mapCouriersOnly-${contactId}`, JSON.stringify({display: this.couriersOnlyEnabled}));
            } catch (e) {
                console.error("Error saving couriers only preference:", e);
            }
        }
    }

    private loadCouriersOnlyPreference(): void {
        const contactId = ContactID;
        if (contactId && typeof window !== 'undefined' && window.localStorage) {
            try {
                const savedPreference = window.localStorage.getItem(`mapCouriersOnly-${contactId}`);
                if (savedPreference) {
                    const parsed = JSON.parse(savedPreference);
                    this.couriersOnlyEnabled = parsed.display;
                }
            } catch (e) {
                console.error("Error loading couriers only preference:", e);
                this.couriersOnlyEnabled = false;
            }
        }
    }

    async toggleUrgentArmyOnly(): Promise<void> {
        this.urgentArmyOnlyEnabled = !this.urgentArmyOnlyEnabled;
        this.saveUrgentArmyOnlyPreference();

        // Refresh courier markers to apply the filter
        if (this.showAvailableCouriers) {
            await this.fetchCourierPositions();
        }
    }

    private saveUrgentArmyOnlyPreference(): void {
        const contactId = ContactID;
        if (contactId && typeof window !== 'undefined' && window.localStorage) {
            try {
                window.localStorage.setItem(`mapUrgentArmyOnly-${contactId}`, JSON.stringify({display: this.urgentArmyOnlyEnabled}));
            } catch (e) {
                console.error("Error saving urgent army only preference:", e);
            }
        }
    }

    private loadUrgentArmyOnlyPreference(): void {
        const contactId = ContactID;
        if (contactId && typeof window !== 'undefined' && window.localStorage) {
            try {
                const savedPreference = window.localStorage.getItem(`mapUrgentArmyOnly-${contactId}`);
                if (savedPreference) {
                    const parsed = JSON.parse(savedPreference);
                    this.urgentArmyOnlyEnabled = parsed.display;
                }
            } catch (e) {
                console.error("Error loading urgent army only preference:", e);
                this.urgentArmyOnlyEnabled = false;
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
        showAvailableCouriers: '<',
        clearListId: '<',
        onEnvelopeUpdate: '&'
    }
};

export default DispatchMapComponent;
