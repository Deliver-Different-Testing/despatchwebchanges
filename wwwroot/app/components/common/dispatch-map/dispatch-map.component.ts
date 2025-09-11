import ConfigService from "../../../services/config.service";
import {IJob} from "../../../interfaces/job.interface";
import {IAvailableCourierPosition} from "../../../interfaces/courier.interface";
import "./dispatch-map.styles.less";
import BaseController from "../../base-controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import {ClearListEnvelopeViewModel} from "../../../interfaces/dfrnt-page-view-model.interface";

class DispatchMapController extends BaseController {
    static $inject = [
        "$log",
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
    courierPositions?: IAvailableCourierPosition[] = [];
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
        private $log: angular.ILogService,
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
        this.bindMethods();
    }

    private bindMethods() {
        this.onBoundsChanged = this.onBoundsChanged.bind(this);
        this.refreshCourierLocations = this.refreshCourierLocations.bind(this);
        this.toggleAutoZoom = this.toggleAutoZoom.bind(this);
    }

    $onInit() {
        this.loadAutoZoomPreference();

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
                    this.$log.debug('[DispatchMapController] Map initialized with existing jobs data, updating markers...');
                    return this.updateDisplayedJobs();
                } else {
                    this.$log.debug('[DispatchMapController] Map initialized without jobs data, will wait for changes');
                }
            })
            .catch((error) => {
                this.$log.error("[DispatchMapController] Error initializing map:", error);
            });
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
                        this.$log.debug(`[DispatchMapController] Map element not found, retry ${retryCount}/${maxRetries}`);
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
                            this.$log.debug(`[DispatchMapController] NgMap.getMap failed, retry ${retryCount}/${maxRetries}:`, error);
                            setTimeout(() => {
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
        this.$log.debug('[DispatchMapController] $onChanges called with changes:', changes);

        // If map isn't ready, store changes to apply later
        if (!this.mapInstance) {
            this.$log.debug('[DispatchMapController] Map instance not ready yet, storing changes for later');

            if ('jobs' in changes && changes.jobs.currentValue) {
                this.$log.debug(`[DispatchMapController] Storing jobs array with ${changes.jobs.currentValue.length} jobs`);
                this.pendingChanges.jobs = changes.jobs.currentValue;
            }

            if ('currentJob' in changes && changes.currentJob.currentValue) {
                this.$log.debug('[DispatchMapController] Storing current job for later');
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
            this.$log.debug('[DispatchMapController] Jobs or currentJob changed, updating markers...');

            if ('jobs' in changes) {
                this.$log.debug(`[DispatchMapController] Jobs array changed: ${changes.jobs.currentValue?.length || 0} jobs available`);
            }

            if ('currentJob' in changes) {
                this.$log.debug(`[DispatchMapController] Current job changed: ${changes.currentJob.currentValue?.jobNo || 'none'}`);
            }

            this.clearJobMarkers();
            return this.updateDisplayedJobs();
        }

        if (changes.showAvailableCouriers) {
            if (changes.showAvailableCouriers.currentValue) {
                return this.fetchCourierPositions();
            } else {
                this.clearCourierMarkers();
            }
        }

        if (changes.autoZoomEnabled &&
            changes.autoZoomEnabled.isFirstChange() &&
            changes.autoZoomEnabled.currentValue !== undefined) {
            this.autoZoomEnabled = changes.autoZoomEnabled.currentValue;
            this.saveAutoZoomPreference();

            if (this.autoZoomEnabled && this.markers.length > 0) {
                this.fitMapToMarkers();
            }
        }

        if (changes.mapZoom && changes.mapZoom.isFirstChange() && changes.mapZoom.currentValue) {
            this.initialMapZoom = changes.mapZoom.currentValue;
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
                this.onBoundsChanged
            );
        }
    }

    private removeEventListeners() {
        if (this.refreshCouriersMarkerListener) {
            (this.refreshCouriersMarkerListener as any)();
            this.refreshCouriersMarkerListener = null;
        }

        if (this.boundsChangedListener && this.mapInstance) {
            this.$window.google.maps.event.removeListener(this.boundsChangedListener);
            this.boundsChangedListener = null;
        }
    }

    private onBoundsChanged() {
        if (this.showAvailableCouriers) {
            return this.fetchCourierPositions();
        }
    }

    async fetchCourierPositions() {
        this.$log.debug('[DispatchMapController] Starting courier positions fetch');

        if (!this.showAvailableCouriers) {
            this.$log.debug('[DispatchMapController] Skipping fetch - couriers not enabled');
            return;
        }

        if (!this.mapInstance) {
            this.$log.debug('[DispatchMapController] Skipping fetch - map instance not available');
            return;
        }

        try {
            const coordinates = await this.getSearchCoordinates();
            const couriers = await this.fetchCourierData(coordinates);
            this.updateCourierMarkers(couriers);

            this.$log.debug('[DispatchMapController] Successfully updated courier positions', {
                courierCount: couriers?.length ?? 0
            });
        } catch (error) {
            this.$log.error('[DispatchMapController] Failed to fetch courier positions:', error);
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
            this.$log.debug('[DispatchMapController] Using map bounds for courier search');
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            return {
                west: sw.lng(),
                south: sw.lat(),
                east: ne.lng(),
                north: ne.lat()
            };
        }

        this.$log.debug('[DispatchMapController] Using default area for courier search');
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
        this.$log.debug('[DispatchMapController] Fetching courier locations', coordinates);

        return await this.DispatchData.getAvailableCourierLocation(
            coordinates.west,
            coordinates.south,
            coordinates.east,
            coordinates.north
        );
    }

    private async updateDisplayedJobs() {
        if (this.isUpdating) {
            if (this.markers.length === 0) {
                this.$log.debug('[DispatchMapController] Initial update, allowing even though update is in progress');
            } else {
                this.$log.debug('[DispatchMapController] Already updating displayed jobs, skipping this update');
                return;
            }
        }

        if (!this.mapInstance) {
            this.$log.debug('[DispatchMapController] Map instance not ready yet, cannot update jobs');
            return;
        }

        this.isUpdating = true;
        this.$log.debug('[DispatchMapController] Starting to update displayed jobs...');

        try {
            let markersAdded = 0;
            const currentJobId = this.currentJob?.id;

            const isShowingCourierJobs = Boolean(
                this.currentJob &&
                (this.currentJob.courier || this.currentJob.assignedCourier) &&
                this.jobs && this.jobs.length > 1
            );

            this.$log.debug(`[DispatchMapController] Map mode: ${isShowingCourierJobs ? 'Courier jobs view' : 'Normal view'}`);

            // Add current job first (if exists)
            if (this.currentJob) {
                this.$log.debug(`[DispatchMapController] Adding current job to map: ${this.currentJob.jobNo}`);

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
            if (this.jobs?.length) {
                this.$log.debug(`[DispatchMapController] Adding ${this.jobs.length} jobs to map in batches`);

                const jobsToAdd = this.jobs.filter(job =>
                    !currentJobId || job.id !== currentJobId
                );

                const batchMarkersAdded = await this.addMarkersInBatches(
                    jobsToAdd,
                    isShowingCourierJobs,
                    50 // batch size
                );
                markersAdded += batchMarkersAdded;
            }

            this.$log.debug(`Added ${markersAdded} markers to the map`);

            if (markersAdded > 0) {
                await this.registerTimeout(() => {
                    if (this.autoZoomEnabled) {
                        this.$log.debug('[DispatchMapController] Auto-zoom enabled, fitting map to markers');
                        this.fitMapToMarkers();
                    }
                }, 200);
            } else {
                this.$log.debug('[DispatchMapController] No markers added to map');
            }
        } catch (error) {
            this.$log.error('[DispatchMapController] Error updating displayed jobs:', error);
        } finally {
            this.isUpdating = false;
        }
    }

    private async addMarkersInBatches(
        jobs: IJob[],
        useAlternateColor: boolean = false,
        batchSize: number = 50
    ): Promise<number> {
        let totalMarkersAdded = 0;

        for (let i = 0; i < jobs.length; i += batchSize) {
            const batch = jobs.slice(i, i + batchSize);
            let batchMarkersAdded = 0;

            this.$log.debug(`[DispatchMapController] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(jobs.length/batchSize)} (${batch.length} jobs)`);

            this.isUpdating = true;

            batch.forEach((job: IJob) => {
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

            if (i + batchSize < jobs.length) {
                await new Promise<void>(resolve => {
                    this.registerTimeout(() => resolve(), 10);
                });
            }
        }

        this.$log.debug(`[DispatchMapController] Completed batched marker addition: ${totalMarkersAdded} markers from ${jobs.length} jobs`);

        await new Promise<void>(resolve => {
            this.registerTimeout(() => {
                this.isUpdating = false;
                resolve();
            }, 500);
        });

        return totalMarkersAdded;
    }

    private updateCourierMarkers(couriers: IAvailableCourierPosition[]) {
        if (!couriers || !this.showAvailableCouriers) return;

        this.clearCourierMarkers();
        this.courierPositions = couriers;

        couriers.forEach((courier: IAvailableCourierPosition) => {
            if (this.isValidCoordinates(courier.latitude ?? 0, courier.longitude ?? 0)) {
                this.addCourierMarker(courier);
            }
        });
    }

    private addPickupMarker(job: IJob, isCurrentJob: boolean = false, useAlternateColor: boolean = false) {
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

        this.registerTimeout(() => {
            this.fadeInMarker(marker);
        }, Math.random() * 200);

        this.setupMarkerListeners(marker, job, icon!, hoverIcon!, "Pickup");
        this.markers.push(marker);
    }

    private addDeliveryMarker(job: IJob, isCurrentJob: boolean = false, useAlternateColor: boolean = false) {
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

        this.registerTimeout(() => {
            this.fadeInMarker(marker);
        }, Math.random() * 200);

        this.setupMarkerListeners(marker, job, icon!, hoverIcon!, "Delivery");
        this.markers.push(marker);
    }

    private fadeInMarker(marker: google.maps.Marker) {
        let opacity = 0.4;
        const fadeInterval = setInterval(() => {
            opacity += 0.1;
            if (opacity >= 1) {
                opacity = 1;
                clearInterval(fadeInterval);
            }
            marker.setOpacity(opacity);
        }, 40); // 40 ms intervals for smooth fade
    }

    private setupMarkerListeners(marker: google.maps.Marker, job: any, normalIcon: google.maps.Symbol, hoverIcon: google.maps.Symbol, locationType: string) {
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
             if (this.isUpdating) {
                this.$log.debug('[DispatchMapController] Ignoring marker click during map update');
                return;
            }

            const currentZoom = this.mapInstance!.getZoom();

            if (locationType === "Delivery") {
                marker.setAnimation(this.$window.google.maps.Animation.BOUNCE);
                this.registerTimeout(() => {
                    marker.setAnimation(null);
                }, 750);
            }

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

    private getFlagColor(courier: IAvailableCourierPosition): string {
        if (courier.overDueJobs > 0) {
            return '#FF1493';
        } else if (courier.totalJobs === 0) {
            return '#00FFFF';
        } else {
            return '#000000';
        }
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

        const flagColor = this.getFlagColor(courier);
        const flagTextColor = this.getFlagTextColor(courier);

        const labelText = courier.overDueJobs > 0
            ? `${courier.totalJobs}/${courier.overDueJobs}`
            : `${courier.totalJobs}`;

        const courierFlagIcon = this.createFlagMarkerIcon(flagColor);

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
        this.registerTimeout(() => {
            this.fadeInMarker(marker);
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
        const isValid = Boolean(
            lat && lng && !isNaN(lat) && !isNaN(lng) &&
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        );

        if (!isValid && (lat || lng)) {
            this.$log.debug(`[DispatchMapController] Invalid coordinates detected: lat=${lat}, lng=${lng}`);
        }

        return isValid;
    }

    private startLocationRefreshInterval() {
        this.clearLocationRefreshInterval();

        // Start a new interval
        this.locationRefreshInterval = this.registerTimeout(() => {
            this.refreshCourierLocations();
        }, this.LOCATION_REFRESH_INTERVAL);
    }

    private refreshCourierLocations() {
        if (this.showAvailableCouriers) {
            this.debounce(() => {
                this.fetchCourierPositions().then(_ =>
                    this.$rootScope.$emit('courierLocationsNeedRefresh')
                );
            }, 500);
        }

        this.locationRefreshInterval = this.registerTimeout(() => {
            this.refreshCourierLocations();
        }, this.LOCATION_REFRESH_INTERVAL);
    }

    private clearLocationRefreshInterval() {
        if (this.locationRefreshInterval) {
            this.locationRefreshInterval = null;
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
                this.$log.error("Error saving auto zoom preference:", e);
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
                this.$log.error("Error loading auto zoom preference:", e);
                this.autoZoomEnabled = true; // Default to true if any error occurs
            }
        }
    }

    private addAutoZoomButton() {
        const mapControlsDiv = document.createElement('div');
        mapControlsDiv.className = 'map-controls';
        mapControlsDiv.style.margin = '10px'; // Add some margin instead
        mapControlsDiv.style.zIndex = '1';

        // Create the button HTML content to match your Angular Material design
        mapControlsDiv.innerHTML = `
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

        // Get the button element
        const button = mapControlsDiv.querySelector('button');

        // Add hover effect for tooltip
        if (button) {
            button.addEventListener('mouseenter', () => {
                const tooltip: any = button.querySelector('.md-tooltip');
                if (tooltip) {
                    tooltip.style.opacity = '1';
                }
            });

            button.addEventListener('mouseleave', () => {
                const tooltip: any = button.querySelector('.md-tooltip');
                if (tooltip) {
                    tooltip.style.opacity = '0';
                }
            });

            // Add click event listener
            button.addEventListener('click', () => {
                this.toggleAutoZoom();

                // Update button appearance
                button.style.backgroundColor = this.autoZoomEnabled ? '#3f51b5' : '#f44336';

                // Update the icon
                const iconSpan = button.querySelector('.material-symbols-outlined');
                if (iconSpan) {
                    iconSpan.textContent = this.autoZoomEnabled ? 'fit_screen' : 'zoom_out_map';
                }

                // Update the tooltip text
                const tooltip = button.querySelector('.md-tooltip');
                if (tooltip) {
                    tooltip.textContent = this.autoZoomEnabled ? 'Auto Zoom Enabled' : 'Auto Zoom Disabled';
                }
            });
        }

        // Add the Material Icons font if not already loaded
        if (!document.getElementById('material-icons-font')) {
            const link = document.createElement('link');
            link.id = 'material-icons-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined';
            document.head.appendChild(link);
        }

        // Add the control to the map
        this.mapInstance!.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(mapControlsDiv);
    }

    fitMapToEnvelope(envelopeData: ClearListEnvelopeViewModel, zoomLevel?: number): void {
        if (!this.mapInstance || !envelopeData) {
            this.$log.debug('[DispatchMapController] Cannot fit to envelope - map instance or data not available');
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

            this.$log.debug('[DispatchMapController] Map fitted to envelope bounds');
        } catch (error) {
            this.$log.error('[DispatchMapController] Error fitting map to envelope:', error);
        }
    }

    async updateMapWithClearListEnvelope(clearListId: number): Promise<any> {
        if (!clearListId) {
            this.$log.debug('[DispatchMapController] No clear list ID provided');
            return null;
        }

        try {
            this.$log.debug(`[DispatchMapController] Fetching envelope for clear list: ${clearListId}`);

            const envelopeData = await this.DispatchData.getDriverDestinationEnvelope(clearListId);

            if (envelopeData) {
                this.fitMapToEnvelope(envelopeData, 13);
                return envelopeData;
            } else {
                this.$log.debug('[DispatchMapController] No envelope data received');
                return null;
            }
        } catch (error) {
            this.$log.error('[DispatchMapController] Error fetching clear list envelope:', error);
            throw error;
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
