import ToastrService from "../../../services/toastr.service";
import OverviewService from "../overview.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import ConfigService from "../../../services/config.service";
import {Coordinates, MegaMapResponse} from "../overview.interfaces";
import {MapPoint} from "./mega-map.interfaces";
import {AssignedFlight} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import {HereMapConfig, HereMapCredentials} from "../../../interfaces/hereMapCredentials.interfaces";
import dayjs from "dayjs";

class MegaMapController extends BaseController {
    static $inject = [
        "toastrService",
        "overviewService",
        "configService",
        "$rootScope",
        "APP_CONFIG",
        "$timeout",
        "$interval",
    ];

    isUsCustomer: boolean;
    jobs: any[];
    drivers: any[];
    pickupPoints: any[];
    deliveryPoints: any[];
    flightRoutes: any[];
    selectedJob: any;
    mapCenter: Coordinates;
    hereMapCredentials?: HereMapCredentials;
    hereMapConfig?: HereMapConfig;
    map: any;
    platform: any;

    constructor(
        private toastrService: ToastrService,
        private overviewService: OverviewService,
        private configService: ConfigService,
        private $rootScope: angular.IRootScopeService,
        appConfig: AppConfig,
        $timeout: angular.ITimeoutService,
        $interval: angular.IIntervalService,
    ) {
        super();
        this.initServices($timeout, $interval);

        this.isUsCustomer = appConfig.US_Customer;

        this.jobs = [];
        this.drivers = [];
        this.pickupPoints = [];
        this.deliveryPoints = [];
        this.flightRoutes = [];
        this.selectedJob = null;

        this.mapCenter = this.isUsCustomer
            ? appConfig.US_Coordinates_Center
            : appConfig.NZ_Coordinates_Center;

        this.initializeMap().then(_ => console.debug("HERE Map initialized"));

        // Set up auto-refresh every 30 seconds
        this.registerInterval(async () => {
            await this.refreshData();
        }, 30000);
    }

    async initializeMap(): Promise<void> {
        try {
            // Get HERE Maps API key from config service
            const hereApiKey = await this.configService.getHereMapsKey();

            this.hereMapCredentials = {
                apiKey: hereApiKey
            };

            // Initial map configuration
            this.hereMapConfig = {
                center: this.mapCenter,
                zoom: this.isUsCustomer ? 4 : 6,
                job: null, // Will be set when we have job data
                courierLocation: null
            };

            await this.refreshData();
        } catch (error) {
            console.error("Error initializing HERE Maps:", error);
            this.toastrService.showErrorToast("Error initializing map");
        }
    }

    onMapReady(mapData: { map: any, platform: any }) {
        console.debug("HERE Map is ready", mapData);
        this.map = mapData.map;
        this.platform = mapData.platform;
    }

    async refreshData(): Promise<void> {
        try {
            // Get all jobs
            const jobs = await this.overviewService.getMegaMapData();

            // Transform data for map
            const {pickups, deliveries, drivers} = this.transformMapData(jobs);

            this.drivers = drivers;
            this.pickupPoints = pickups;
            this.deliveryPoints = deliveries;
            this.jobs = jobs;

            // Update HERE map configuration with new data
            this.updateHereMapConfig();
        } catch (error) {
            this.toastrService.showErrorToast("Error updating data");
            console.error("Error:", error);
        }
    }

    updateHereMapConfig(): void {
        if (!this.jobs.length) return;

        const primaryJob = this.jobs[0];
        const compositeJob = {
            id: 'mega-map-composite',
            pickup: {
                lat: primaryJob.pickupLocation?.latitude || this.mapCenter.lat,
                lng: primaryJob.pickupLocation?.longitude || this.mapCenter.lng
            },
            delivery: {
                lat: primaryJob.deliveryLocation?.latitude || this.mapCenter.lat,
                lng: primaryJob.deliveryLocation?.longitude || this.mapCenter.lng
            },
            childJobs: this.jobs.map((job, _) => ({
                id: job.jobId,
                pickup: {
                    lat: job.pickupLocation?.latitude ?? 0,
                    lng: job.pickupLocation?.longitude ?? 0
                },
                delivery: {
                    lat: job.deliveryLocation?.latitude ?? 0,
                    lng: job.deliveryLocation?.longitude ?? 0
                },
                flight: job.isFlightJob ?? false
            }))
        };

        // Get an average courier location if we have drivers
        let avgCourierLocation = null;
        if (this.drivers.length > 0) {
            const avgLat = this.drivers.reduce((sum, driver) => sum + driver.lat, 0) / this.drivers.length;
            const avgLng = this.drivers.reduce((sum, driver) => sum + driver.lng, 0) / this.drivers.length;
            avgCourierLocation = {lat: avgLat, lng: avgLng};
        }

        // Keep the same center and zoom - don't auto-zoom
        const currentZoom = this.isUsCustomer ? 4 : 6;

        this.hereMapConfig = {
            center: this.mapCenter, // Keep the original center
            zoom: currentZoom, // Keep country-level zoom
            job: compositeJob,
            courierLocation: avgCourierLocation,
            timestamp: dayjs().valueOf(),
            disableAutoZoom: true,
            preserveView: true 
        };

        // Trigger map refresh
        this.$rootScope.$broadcast('map-refresh-requested');
    }
    
    centerOnDriver(driver: any): void {
        if (!this.map) return;

        this.hereMapConfig = {
            ...this.hereMapConfig,
            center: {lat: driver.lat, lng: driver.lng},
            zoom: 15,
            courierLocation: {lat: driver.lat, lng: driver.lng},
            disableAutoZoom: false,
            timestamp: dayjs().valueOf()
        };

        this.registerTimeout(() => {
            this.returnToCountryView();
        }, 5000);
    }

    returnToCountryView(): void {
        const countryZoom = this.isUsCustomer ? 4 : 6;

        if (this.map) {
            this.map.setCenter(this.mapCenter);
            this.map.setZoom(countryZoom);
        }

        this.hereMapConfig = {
            ...this.hereMapConfig,
            center: this.mapCenter,
            zoom: countryZoom,
            timestamp: dayjs().valueOf()
        };
    }


    transformMapData(jobs: MegaMapResponse[]) {
        console.debug("Starting transformMapData with %d jobs", jobs.length);

        const pickups: MapPoint[] = [];
        const deliveries: MapPoint[] = [];
        const driversMap = new Map<number, {
            courierId: number;
            name: string;
            lat: number;
            lng: number;
            assignedJobs: { jobId: number; jobNumber: string; }[];
        }>();

        jobs.forEach(job => {
            console.debug("Processing job %s:", job.jobNumber, job);

            const isFlightRoute = job?.isFlightJob || false;

            // Add pickup points
            if (job.pickupLocation && job.pickupLocation.latitude && job.pickupLocation.longitude) {
                const lat = job.pickupLocation.latitude;
                const lng = job.pickupLocation.longitude;

                if (!isNaN(lat) && !isNaN(lng)) {
                    console.debug("Adding pickup point for job %s at [%d, %d]",
                        job.jobNumber, lat, lng
                    );

                    pickups.push({
                        lat,
                        lng,
                        address: job.pickupLocation.fullAddress,
                        jobId: job.jobId,
                        jobNumber: job.jobNumber,
                        isFlightRoute
                    });
                } else {
                    console.warn("Job %s has invalid pickup coordinates", job.jobNumber);
                }
            } else {
                console.warn("Job %s missing valid pickup location", job.jobNumber);
            }

            // Add delivery points
            if (job.deliveryLocation && job.deliveryLocation.latitude && job.deliveryLocation.longitude) {
                const lat = job.deliveryLocation.latitude;
                const lng = job.deliveryLocation.longitude;

                if (!isNaN(lat) && !isNaN(lng)) {
                    console.debug("Adding delivery point for job %s at [%d, %d]",
                        job.jobNumber, lat, lng
                    );

                    deliveries.push({
                        lat,
                        lng,
                        address: job.deliveryLocation.fullAddress,
                        jobId: job.jobId,
                        jobNumber: job.jobNumber,
                        isFlightRoute
                    });
                } else {
                    console.warn("Job %s has invalid delivery coordinates", job.jobNumber);
                }
            } else {
                console.warn("Job %s missing valid delivery location", job.jobNumber);
            }

            // Add driver location if exists
            if (job.courierLocation && job.courierLocation.coordinates) {
                const lat = job.courierLocation.coordinates.lat;
                const lng = job.courierLocation.coordinates.lng;

                if (!isNaN(lat) && !isNaN(lng)) {
                    const courierId = job.courierLocation.courierId;

                    // Update or create a driver entry in the Map
                    if (driversMap.has(courierId)) {
                        // Update existing driver's job assignments
                        const driver = driversMap.get(courierId);
                        if (driver == null) throw new Error(
                            `Driver ${courierId} not found in driversMap`
                        )

                        driver.assignedJobs = driver.assignedJobs || [];
                        driver.assignedJobs.push({
                            jobId: job.jobId,
                            jobNumber: job.jobNumber
                        });
                    } else {
                        // Create a new driver entry
                        driversMap.set(courierId, {
                            courierId: courierId,
                            name: job.courierLocation.courierName,
                            lat,
                            lng,
                            assignedJobs: [{
                                jobId: job.jobId,
                                jobNumber: job.jobNumber
                            }]
                        });
                    }
                } else {
                    console.warn("Job %s has invalid driver coordinates", job.jobNumber);
                }
            }
        });

        // Convert driversMap to array for the view
        const drivers = Array.from(driversMap.values()).map(driver => ({
            ...driver,
            assignedJobNumber: driver.assignedJobs
                .map(job => job.jobNumber)
                .join(", ")
        }));

        console.debug("Transformed data:", {
            pickups: pickups.length,
            deliveries: deliveries.length,
            drivers: drivers.length,
            flightJobs: pickups.filter(p => p.isFlightRoute).length
        });

        this.flightRoutes = this.calculateFlightRoutes(jobs, pickups, deliveries);
        
        return {
            pickups,
            deliveries,
            drivers
        };
    }

    calculateFlightRoutes(jobs: MegaMapResponse[], pickups: MapPoint[], deliveries: MapPoint[]) {
        if (!jobs?.length || !pickups?.length || !deliveries?.length) {
            return [];
        }

        return jobs
            .filter(job => job.isFlightJob && job.flightInfo)
            .map(job => {
                const pickup = pickups.find(p => p.jobId === job.jobId);
                const delivery = deliveries.find(d => d.jobId === job.jobId);

                if (!pickup || !delivery) return null;

                const position = this.calculateFlightPosition(
                    pickup.lat,
                    pickup.lng,
                    delivery.lat,
                    delivery.lng,
                    job.flightInfo
                );

                const rotation = this.calculateRotationAngle(
                    {lat: pickup.lat, lng: pickup.lng},
                    {lat: delivery.lat, lng: delivery.lng}
                );

                return {
                    jobId: job.jobId,
                    jobNumber: job.jobNumber,
                    flightNumber: job.flightInfo.flightNumber,
                    position: [position.lat, position.lng],
                    rotation: rotation,
                    progress: position.progress,
                    notes: job.flightInfo.notes,
                    etd: job.flightInfo.expectedDeparture,
                    eta: job.flightInfo.expectedArrival
                };
            })
            .filter(route => route !== null);
    }

    calculateFlightPosition(startLat: number, startLng: number, endLat: number, endLng: number, flightInfo: AssignedFlight): {
        lat: number;
        lng: number;
        progress: number;
    } {
        const now = new Date();
        const departureTime = flightInfo.expectedDeparture ? new Date(flightInfo.expectedDeparture) : null;
        const arrivalTime = flightInfo.expectedArrival ? new Date(flightInfo.expectedArrival) : null;

        // Default to start position if no valid times
        if (!departureTime || !arrivalTime) {
            console.warn(`Missing flight times for flight ${flightInfo.flightNumber}`);
            return {lat: startLat, lng: startLng, progress: 0};
        }

        // Calculate progress (0 to 1) based on current time
        let progress;
        if (now < departureTime) {
            progress = 0; // Not departed yet
        } else if (now > arrivalTime) {
            progress = 1; // Already arrived
        } else {
            // Calculate position between departure and arrival
            const totalTime = arrivalTime.getTime() - departureTime.getTime();
            const elapsedTime = now.getTime() - departureTime.getTime();
            progress = Math.min(Math.max(elapsedTime / totalTime, 0), 1); // Clamp between 0 and 1
        }

        // Interpolate position
        const lat = startLat + (endLat - startLat) * progress;
        const lng = startLng + (endLng - startLng) * progress;

        return {lat, lng, progress};
    }

    calculateRotationAngle(start: Coordinates, end: Coordinates): number {
        // Calculate differences in coordinates
        const deltaLat = end.lat - start.lat;
        const deltaLng = end.lng - start.lng;

        // Calculate angle in radians
        let angle = Math.atan2(deltaLng, deltaLat);

        // Convert to degrees
        angle = angle * (180 / Math.PI);

        // Normalize to 0-360 degrees
        angle = (angle + 360) % 360;

        // Add 45 degrees to point the plane icon in the correct direction
        angle = (angle + 45) % 360;

        return angle;
    }

    showPointInfo(point: MapPoint): void {
        if (!point) {
            console.error("Could not get point data");
            return;
        }

        if (!this.jobs) {
            console.error("No jobs saved!");
            return;
        }

        this.selectedJob = this.jobs.find(job => job.jobId === point.jobId);

        if (!this.selectedJob) {
            console.error("Could not find job data for point:", point);
            return;
        }

        // Center on point with moderate zoom - don't use auto-zoom
        if (this.map) {
            this.map.setCenter({lat: point.lat, lng: point.lng});
            this.map.setZoom(8); // Moderate zoom level
        }
    }

    closeJobInfo(): void {
        this.selectedJob = null;
    }

    formatDateTime(date: string | Date): string {
        if (!date) return "Not scheduled";
        return dayjs(date).format('M/D/YYYY, h:mm:ss A');
    }
}

const MegaMapComponent: angular.IComponentOptions = {
    template: require("./mega-map.template.html"),
    controller: MegaMapController,
    controllerAs: "ctrl"
}

export default MegaMapComponent;