import {IHereMapChildJob, CourierLocation, HereMapConfig, HereMapCredentials, IHereMapJob} from "../../app/interfaces/hereMapCredentials.interfaces";
import {HereMapService} from "./here-map-tracking.service";

interface HereMapScope extends angular.IScope {
    mapId: string;
    credentials: HereMapCredentials;
    config: HereMapConfig;
    onMapReady: (params: { map: any; platform: any }) => void;
    refreshMap: () => void;
    clearMap: () => void;
    showJobOnMap: (job: IHereMapJob, courierLocation?: CourierLocation) => void;
    centerMapOnIndex: (index: number) => void;
    getScopedJob: (index: number) => IHereMapChildJob | undefined;
    autoZoomMapToShowAllPoints: () => void;
}

class HereMapController {
    static $inject = [
        '$scope',
        'HereMapService',
        '$rootScope',
        '$log',
        '$timeout'
    ];
    
    
    private platform: any;
    private mapInstance: any;
    private fromMarker: any;
    private toMarker: any;
    private courierMarker: any;
    private extraMarkers: any[] = [];
    private routeLine: any;
    private extraRouteLines: any[] = [];

    // Constants
    private static readonly MAP_ZOOM_LEVEL = 15;
    private static readonly AUTO_ZOOM_DELAY = 2000;
    private static readonly RESIZE_DELAY = 100;
    private static readonly ZOOM_ADJUSTMENT_DELAY = 300;
    private static readonly DEFAULT_PADDING = 0.1;

    constructor(
        private $scope: HereMapScope,
        private mapService: HereMapService,
        private $rootScope: angular.IRootScopeService,
        private $log: angular.ILogService,
        private $timeout: angular.ITimeoutService
    ) {
        this.$log.debug('HereMapController initialized');
        this.initialize();
    }

    private initialize(): void {
        this.setupWatchers();
        this.setupEventListeners();
        this.setupPublicMethods();
    }
    
    private setupWatchers(): void {
        // Watch for config and credentials changes
        this.$scope.$watchGroup(['config', 'credentials'], (newValues: any, oldValues: any) => {
            this.handleConfigChange(newValues, oldValues);
        });

        // Watch for selected job index changes
        this.$scope.$watch('config.selectedJobIndex', (newValue: number, oldValue: number) => {
            this.handleSelectedJobIndexChange(newValue, oldValue);
        });

        // Watch for courier location changes
        this.$scope.$watch('config.courierLocation', (newValue: CourierLocation, oldValue: CourierLocation) => {
            this.handleCourierLocationChange(newValue, oldValue);
        });
    }
    
    private setupEventListeners(): void {
        this.$rootScope.$on('map-refresh-requested', () => {
            this.refreshMap();
        });
    }

    private setupPublicMethods(): void {
        this.$scope.refreshMap = () => this.refreshMap();
        this.$scope.clearMap = () => this.clearMap();
        this.$scope.showJobOnMap = (job, courierLocation) => this.showJobOnMap(job, courierLocation);
        this.$scope.centerMapOnIndex = (index) => this.centerMapOnIndex(index);
        this.$scope.getScopedJob = (index) => this.getScopedJob(index);
        this.$scope.autoZoomMapToShowAllPoints = () => this.autoZoomMapToShowAllPoints();
    }
    
    private initializeMap(): boolean {
        try {
            if (!this.$scope.credentials || !this.$scope.mapId) {
                this.$log.warn('Missing credentials or mapId', {
                    hasCredentials: !!this.$scope.credentials,
                    hasMapId: !!this.$scope.mapId
                });
                return false;
            }

            // Initialize HERE platform
            this.platform = this.mapService.initPlatform(this.$scope.credentials);
            if (!this.platform) {
                this.$log.error('Failed to initialize HERE platform');
                return false;
            }

            // Initialize map
            this.mapInstance = this.mapService.createMap(
                this.$scope.mapId,
                this.platform,
                this.$scope.config
            );

            if (!this.mapInstance?.map) {
                this.$log.error('Failed to create map instance');
                return false;
            }

            this.$log.debug('Map initialized successfully');

            // Notify a parent component that map is ready
            this.notifyMapReady();

            // Resize map after DOM settles
            this.scheduleMapResize();

            return true;
        } catch (error) {
            this.$log.error('Error in initializeMap:', error);
            return false;
        }
    }

    private notifyMapReady(): void {
        if (this.$scope.onMapReady) {
            this.$scope.onMapReady({
                map: this.mapInstance.map,
                platform: this.platform
            });
        }
    }
    
    private scheduleMapResize(): void {
        this.$timeout(() => {
            if (this.mapInstance?.map) {
                this.mapService.resizeMapPreserveView(this.mapInstance.map);
            }
        }, HereMapController.RESIZE_DELAY);
    }

    private handleConfigChange(newValues: any[], oldValues: any[]): void {
        const [newConfig, newCredentials] = newValues;
        const [oldConfig] = oldValues || [null, null];

        if (!newConfig || !newCredentials) {
            return;
        }

        // Initialize a map if not already done
        if (!this.mapInstance) {
            const initialized = this.initializeMap();
            if (!initialized) {
                this.$log.warn('Map initialization failed');
                return;
            }

            // For initial setup with a job, show it immediately
            if (newConfig.job) {
                this.$log.debug('Initial map setup with job');
                this.showJobOnMap(newConfig.job, newConfig.courierLocation);
                return;
            }
        }

        // Check for updates that require map refresh
        const updateRequired = this.shouldUpdateMap(newConfig, oldConfig || {});

        if (updateRequired.shouldUpdate) {
            this.$log.debug('Map update triggered:', updateRequired.reason);
            this.showJobOnMap(newConfig.job, newConfig.courierLocation);
        } else if (!newConfig.job) {
            this.clearMap();
        }
    }

    private shouldUpdateMap(newConfig: HereMapConfig, oldConfig: HereMapConfig): { shouldUpdate: boolean; reason: string } {
        // If there's a job in the new config and no old config, always update
        if (newConfig.job && !oldConfig.job) {
            return { shouldUpdate: true, reason: 'Initial job setup' };
        }

        // Check for a new job
        const isNewJob = newConfig.job && oldConfig.job && newConfig.job.id !== oldConfig.job.id;
        if (isNewJob) {
            return { shouldUpdate: true, reason: 'New job' };
        }

        // Check for timestamp changes (this is critical for forcing updates)
        const hasNewTimestamp = newConfig.timestamp !== oldConfig.timestamp;
        if (hasNewTimestamp && newConfig.job) {
            return { shouldUpdate: true, reason: 'Timestamp update' };
        }

        // Check for coordinate changes
        if (!newConfig.job || !oldConfig.job) {
            return { shouldUpdate: false, reason: 'No job to compare' };
        }

        const hasCoordinateChanges = this.hasCoordinateChanges(newConfig.job, oldConfig.job);
        if (hasCoordinateChanges) {
            return { shouldUpdate: true, reason: 'Coordinate changes' };
        }

        // Check for courier location changes
        if (newConfig.courierLocation && oldConfig.courierLocation) {
            const hasCourierLocationChanges = this.hasCourierLocationChanges(
                newConfig.courierLocation,
                oldConfig.courierLocation
            );
            if (hasCourierLocationChanges) {
                return { shouldUpdate: true, reason: 'Courier location changes' };
            }
        }

        return { shouldUpdate: false, reason: '' };
    }
    
    private hasCoordinateChanges(newJob: IHereMapJob, oldJob: IHereMapJob): boolean {
        if (!newJob || !oldJob) return false;

        const pickupChanged = newJob.pickup && oldJob.pickup &&
            (newJob.pickup.lat !== oldJob.pickup.lat || newJob.pickup.lng !== oldJob.pickup.lng);

        const deliveryChanged = newJob.delivery && oldJob.delivery &&
            (newJob.delivery.lat !== oldJob.delivery.lat || newJob.delivery.lng !== oldJob.delivery.lng);

        return !!(pickupChanged || deliveryChanged);
    }
    
    private hasCourierLocationChanges(newLocation: CourierLocation, oldLocation: CourierLocation): boolean {
        if (!newLocation || !oldLocation) {
            return newLocation !== oldLocation;
        }

        return newLocation.lat !== oldLocation.lat || newLocation.lng !== oldLocation.lng;
    }
    
    private handleSelectedJobIndexChange(newValue: number, oldValue: number): void {
        if ((newValue || newValue === 0) &&
            oldValue !== null &&
            this.$scope.credentials &&
            this.mapInstance?.map) {
            this.centerMapOnIndex(newValue);
        }
    }

    private handleCourierLocationChange(newValue: CourierLocation, oldValue: CourierLocation): void {
        // Add null/undefined check for newValue
        if (!newValue || newValue.lat === null || newValue.lat === undefined ||
            newValue.lng === null || newValue.lng === undefined) {
            return;
        }

        // Check if the courier location actually changed
        if (!oldValue || (newValue.lat !== oldValue.lat || newValue.lng !== oldValue.lng)) {
            this.courierMarker = this.mapService.getHereCourierMarker(
                newValue.lat,
                newValue.lng,
                this.courierMarker,
                this.mapInstance.map,
                false,
                undefined
            );

            // Only auto-zoom if preserveView is not enabled
            if (!this.$scope.config?.preserveView) {
                this.autoZoomMapToShowAllPoints();
            }
        }
    }
    
    private refreshMap(): void {
        if (this.$scope.config?.job && this.$scope.config?.courierLocation) {
            this.showJobOnMap(this.$scope.config.job, this.$scope.config.courierLocation);
        }
    }

    private centerMapOnIndex(selectedJobIndex: number): void {
        const thisJob = this.getScopedJob(selectedJobIndex);
        if (!thisJob?.pickup || !thisJob?.delivery) {
            this.$log.warn('Invalid job for centering map');
            return;
        }

        this.mapService.centerHereMap(
            thisJob.pickup.lat,
            thisJob.pickup.lng,
            thisJob.delivery.lat,
            thisJob.delivery.lng,
            thisJob,
            this.routeLine,
            this.extraRouteLines,
            this.mapInstance.map
        );
    }

    private getScopedJob(selectedJobIndex: number): IHereMapChildJob | undefined {
        if (!this.$scope.config.job?.childJobs) {
            this.$log.warn('No child jobs available');
            return undefined;
        }

        let index = selectedJobIndex - 1;
        let thisJob: IHereMapChildJob | undefined;

        if (index !== -1) {
            // Scope map to the selected leg of a job
            thisJob = this.$scope.config.job.childJobs[index];
            if (thisJob) {
                thisJob.index = this.extraRouteLines.findIndex(x => x.id.slice(-1) === index.toString());
            }
        } else {
            // Scope map to the flight leg of a job
            index = this.$scope.config.job.childJobs.findIndex(x => x.flight) ?? 0;
            thisJob = this.$scope.config.job.childJobs[index];
            if (thisJob) {
                thisJob.index = this.extraRouteLines.findIndex(x => x.id.slice(-1) === index.toString());
            }
        }

        return thisJob;
    }
    
    private clearMap(): void {
        if (!this.mapInstance?.map) {
            this.$log.warn('Map instance is not initialized in clearMap');
            return;
        }

        // Remove all markers
        this.clearAllMarkers();

        // Remove all route lines
        this.clearAllRouteLines();
    }
    
    private clearAllMarkers(): void {
        // Clear extra markers
        if (this.extraMarkers.length > 0) {
            this.extraMarkers = this.mapService.removeExtraMarkers(
                this.extraMarkers,
                this.mapInstance.map
            );
        }

        // Clear from/to markers
        if (this.fromMarker && this.toMarker) {
            this.mapInstance.map.removeObjects([this.fromMarker, this.toMarker]);
            this.fromMarker = null;
            this.toMarker = null;
        }

        // Clear courier marker
        if (this.courierMarker) {
            this.mapInstance.map.removeObject(this.courierMarker);
            this.courierMarker = null;
        }
    }
    
    private clearAllRouteLines(): void {
        // Clear extra route lines
        if (this.extraRouteLines.length > 0) {
            this.extraRouteLines = this.mapService.removeExtraRouteLines(
                this.extraRouteLines,
                this.mapInstance.map
            );
        }

        // Clear main route line
        if (this.routeLine) {
            this.mapService.removeObjectById('route', this.mapInstance.map);
            this.routeLine = null;
        }
    }
    
    private showJobOnMap(job: IHereMapJob, courierLocation?: CourierLocation): void {
        if (!this.validateShowJobOnMapParams(job)) {
            return;
        }

        try {
            // Clear existing map elements
            this.clearMap();

            const preserveView = this.$scope.config?.preserveView ?? false;
            const isSingleAddress = this.isSingleAddressJob(job);

            // Add markers
            this.addJobMarkers(job, courierLocation, isSingleAddress);

            // Handle routing
            if (isSingleAddress) {
                this.handleSingleAddressJob(job, preserveView);
            } else {
                this.handleMultiAddressJob(job, preserveView);
            }

            // Auto-zoom if not preserving view
            if (!preserveView) {
                this.scheduleAutoZoom();
            }
        } catch (error) {
            this.$log.error('Error in showJobOnMap:', error);
        }
    }

    private validateShowJobOnMapParams(job: IHereMapJob): boolean {
        if (!job || !this.mapInstance?.map) {
            this.$log.warn('Missing required objects in showJobOnMap', {
                hasJob: !!job,
                hasMapInstance: !!this.mapInstance,
                hasMap: this.mapInstance ? !!this.mapInstance.map : false
            });
            return false;
        }

        if (!job.pickup) {
            console.warn('Job missing valid pickup coordinates', job);
            return false;
        }

        return true;
    }


    private isSingleAddressJob(job: IHereMapJob): boolean {
        return !job.delivery;
    }
    
    private addJobMarkers(job: IHereMapJob, courierLocation?: CourierLocation, isSingleAddress: boolean = false): void {
        // Add pickup marker
        if (job.pickup?.lat && job.pickup?.lng) {
            this.fromMarker = this.mapService.getHereFromMarker(
                job.pickup.lat,
                job.pickup.lng,
                this.fromMarker,
                this.mapInstance.map
            );
        }

        // Add a delivery marker (if not a single address)
        if (!isSingleAddress && job.delivery?.lat && job.delivery?.lng) {
            this.toMarker = this.mapService.getHereToMarker(
                job.delivery.lat,
                job.delivery.lng,
                this.toMarker,
                this.mapInstance.map
            );
        }

        // Add courier marker
        if (courierLocation?.lat && courierLocation?.lng) {
            this.courierMarker = this.mapService.getHereCourierMarker(
                courierLocation.lat,
                courierLocation.lng,
                this.courierMarker,
                this.mapInstance.map,
                job.childJobs?.some(x => x?.flight === true) || false,
                isSingleAddress ? 0 : (job.pickup.lng - (job.delivery?.lng ?? 0))
            );
        }
    }
    
    private handleSingleAddressJob(job: IHereMapJob, preserveView: boolean): void {
        if (!preserveView && job.pickup?.lat && job.pickup?.lng) {
            this.mapInstance.map.setCenter({ lat: job.pickup.lat, lng: job.pickup.lng });
            this.mapInstance.map.setZoom(HereMapController.MAP_ZOOM_LEVEL);
        }
    }
    
    private handleMultiAddressJob(job: IHereMapJob, preserveView: boolean): void {
        const scopedJob = this.getScopedJobIfSelected();
        if(!job.childJobs) return;

        if (job.childJobs?.length > 0) {
            this.handleChildJobs(job, scopedJob, preserveView);
        } else {
            this.handleSimpleJob(job, preserveView);
        }
    }

    private getScopedJobIfSelected(): IHereMapChildJob | null | undefined {
        if (this.$scope.config.selectedJobIndex && this.$scope.config.selectedJobIndex !== 0) {
            return this.getScopedJob(this.$scope.config.selectedJobIndex);
        }
        return null;
    }

    private handleChildJobs(job: IHereMapJob, scopedJob: IHereMapChildJob | null | undefined, preserveView: boolean): void {
        job.childJobs?.forEach((childJob: IHereMapChildJob, index: number) => {
            // Add extra marker for non-first child jobs
            if (index !== 0 && childJob.pickup) {
                this.extraMarkers = this.mapService.addExtraMarker(
                    childJob.pickup.lat,
                    childJob.pickup.lng,
                    this.extraMarkers,
                    this.mapInstance.map
                );
            }

            // Add an extra route line
            if (childJob.pickup && childJob.delivery) {
                this.extraRouteLines = this.mapService.addExtraRouteLine(
                    childJob.pickup.lat,
                    childJob.pickup.lng,
                    childJob.delivery.lat,
                    childJob.delivery.lng,
                    index,
                    childJob.flight,
                    this.extraRouteLines,
                    job,
                    this.mapInstance.map,
                    this.platform,
                    (scopedJob ? childJob.id === scopedJob.id : null) ?? false,
                    preserveView
                );
            }
        });
    }
    
    private handleSimpleJob(job: IHereMapJob, preserveView: boolean): void {
        this.routeLine = this.mapService.drawRouteLine(
            job.pickup.lat,
            job.pickup.lng,
            job.delivery?.lat ?? 0,
            job.delivery?.lng ?? 0,
            this.routeLine,
            job,
            this.mapInstance.map,
            this.platform,
            job.flight ?? false,
            preserveView
        );
    }


    private scheduleAutoZoom(): void {
        this.$timeout(() => {
            this.autoZoomMapToShowAllPoints();
        }, HereMapController.AUTO_ZOOM_DELAY);
    }
    
    private autoZoomMapToShowAllPoints(): void {
        if (!this.mapInstance?.map || !this.$scope.config?.job) {
            return;
        }

        // Respect preserveView setting - don't auto-zoom if preserveView is enabled
        if (this.$scope.config.preserveView) {
            return;
        }

        if(!this.$scope.config.courierLocation) return;
        const allPoints = this.mapService.getAllVisiblePoints(
            this.$scope.config.job,
            this.$scope.config.courierLocation,
            this.extraMarkers
        );

        if (allPoints.length > 0) {
            this.$timeout(() => {
                this.mapService.autoZoomToShowAllPoints(
                    this.mapInstance.map,
                    allPoints,
                    HereMapController.DEFAULT_PADDING
                );
            }, HereMapController.ZOOM_ADJUSTMENT_DELAY);
        }
    }
}

// AngularJS directive registration
angular.module('hereMapTracking.components', [])
    .directive('hereMapTracking', [() => ({
        restrict: 'E',
        scope: {
            mapId: '@',
            credentials: '=',
            config: '=',
            onMapReady: '&'
        },
        template: '<div class="here-map" id="{{mapId}}"></div>',
        controller: HereMapController
    })]);

export { HereMapController, HereMapConfig, HereMapScope };