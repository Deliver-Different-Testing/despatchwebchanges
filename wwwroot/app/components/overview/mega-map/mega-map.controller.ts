import app from "../../../app";
import ToastrService from "../../../services/toastr.service";
import OverviewService from "../overview.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import ConfigService from "../../../services/config.service";
import {Coordinates, MegaMapResponse} from "../overview.interfaces";
import {MapPoint} from "./mega-map.interfaces";
import {AssignedFlight} from "../../../interfaces/job.interface";

class MegaMapController implements angular.IController {
    static $inject = [
        "toastrService",
        "NgMap",
        "overviewService",
        "APP_CONFIG",
        "configService",
        "$window"
    ];

    isUsCustomer: boolean;
    jobs: any[];
    drivers: any[];
    pickupPoints: any[];
    deliveryPoints: any[];
    zoomLevel: number;
    flightRoutes: any[];
    selectedJob: any;
    mapCenter: [number, number];
    isLoading: boolean;
    googleMapsUrl: string | null;
    map: any;
    directionsService: any;
    routePaths: Map<string, any> = new Map();

    constructor(
        private toastrService: ToastrService,
        private NgMap: angular.map.INgMap,
        private overviewService: OverviewService,
        appConfig: AppConfig,
        private configService: ConfigService,
        private $window: angular.IWindowService
    ) {
        this.isUsCustomer = appConfig.US_Customer;

        this.jobs = [];
        this.drivers = [];
        this.pickupPoints = [];
        this.deliveryPoints = [];
        this.zoomLevel = 5; // Default zoom level
        this.flightRoutes = [];
        this.selectedJob = null;

        this.mapCenter = this.isUsCustomer
            ? [39.8097343, -98.5556199] // Central USA coordinates
            : [-36.8484597, 174.7633315]; // Auckland, New Zealand coordinates
        this.isLoading = false;
        this.googleMapsUrl = null;

        // Bind all methods
        this.bindMethods();

        // Initialize map and start refresh interval
        this.initializeMap();
    }

    bindMethods(): void {
        this.initializeMap = this.initializeMap.bind(this);
        this.refreshData = this.refreshData.bind(this);
        this.getDeliveryPointForJob = this.getDeliveryPointForJob.bind(this);
        this.centerOnDriver = this.centerOnDriver.bind(this);
        this.transformMapData = this.transformMapData.bind(this);
        this.calculateFlightRoutes = this.calculateFlightRoutes.bind(this);
        this.checkVisiblePoints = this.checkVisiblePoints.bind(this);
        this.getRoutePath = this.getRoutePath.bind(this);
        this.calculateRoadRoute = this.calculateRoadRoute.bind(this);
        this.formatRoutePath = this.formatRoutePath.bind(this);
        this.calculateFlightPosition = this.calculateFlightPosition.bind(this);
        this.calculateRotationAngle = this.calculateRotationAngle.bind(this);
        this.getInfoWindowContent = this.getInfoWindowContent.bind(this);
        this.formatDateTime = this.formatDateTime.bind(this);
        this.showPointInfo = this.showPointInfo.bind(this);
        this.closeJobInfo = this.closeJobInfo.bind(this);
        this.isPickupPoint = this.isPickupPoint.bind(this);
        this.createClusterIcon = this.createClusterIcon.bind(this);
        this.onZoomChanged = this.onZoomChanged.bind(this);
    }

    /**
     * @returns {Promise<void>}
     */
    async initializeMap(): Promise<void> {
        try {
            this.isLoading = true;
            const apiKey = await this.configService.getGoogleMapsKey();
            this.googleMapsUrl = `https://maps.google.com/maps/api/js?key=${apiKey}&libraries=places`;

            // Wait for map to be ready
            const waitForMap = new Promise((resolve) => {
                const checkMap = () => {
                    this.NgMap.getMap({ id: "megaMap" })
                        .then((map: any) => {
                            this.map = map;
                            this.directionsService = new this.$window.google.maps.DirectionsService();
                            this.routePaths = new Map();

                            // Add zoom change listener
                            this.$window.google.maps.event.addListener(
                                map,
                                "zoom_changed",
                                () => {
                                    this.onZoomChanged();
                                }
                            );

                            resolve(map);
                        })
                        .catch(() => {
                            setTimeout(checkMap, 100);
                        });
                };
                checkMap();
            });

            await waitForMap;

            await this.refreshData();
        } catch (error) {
            console.error("Error initializing map:", error);
            this.toastrService.showErrorToast("Error initializing map");
        } finally {
            this.isLoading = false;
        }
    }

    async refreshData(): Promise<void> {
        this.isLoading = true;

        // Get all jobs
        const jobs = await this.overviewService.getMegaMapData();

        try {
            // Transform data for map
            const {pickups, deliveries, drivers} = this.transformMapData(
                jobs
            );

            this.drivers = drivers;
            this.pickupPoints = pickups;
            this.deliveryPoints = deliveries;

            this.jobs = jobs;

            // Check visibility after setting points
            if (this.map) {
                this.checkVisiblePoints();

                // Optionally, fit bounds to show all points
                const bounds = new this.$window.google.maps.LatLngBounds();
                [...pickups, ...deliveries, ...drivers].forEach((point) => {
                    bounds.extend(
                        new this.$window.google.maps.LatLng(point.lat, point.lng)
                    );
                });
                this.map.fitBounds(bounds);
            }

            this.toastrService.showSuccessToast(
                "Map updated! Calculating driver routes..."
            );
        } catch (error) {
            this.toastrService.showErrorToast("Error updating data");
            console.error("Error:", error);
        } finally {
            this.isLoading = false;
        }
    }

    getDeliveryPointForJob(jobId: number): any {
        return (
            this.deliveryPoints.find((point) => point.jobId === jobId) || {
                lat: 0,
                lng: 0
            }
        );
    }

    centerOnDriver(driver: any): void {
        this.mapCenter = [driver.lat, driver.lng];
        this.map.setZoom(15);
    }

    transformMapData(jobs: MegaMapResponse[]) {
        console.log("Starting transformMapData with %d jobs", jobs.length);

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
            console.log("Processing job %s:", job.jobNumber, job);

            const isFlightRoute = job?.isFlightJob || false;

            // Add pickup points
            if (job.pickupLocation && job.pickupLocation.latitude && job.pickupLocation.longitude) {
                const lat = parseFloat(job.pickupLocation.latitude.toString());
                const lng = parseFloat(job.pickupLocation.longitude.toString());

                if (!isNaN(lat) && !isNaN(lng)) {
                    console.log("Adding pickup point for job %s at [%d, %d]",
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
                const lat = parseFloat(job.deliveryLocation.latitude.toString());
                const lng = parseFloat(job.deliveryLocation.longitude.toString());

                if (!isNaN(lat) && !isNaN(lng)) {
                    console.log("Adding delivery point for job %s at [%d, %d]",
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
                const lat = parseFloat(job.courierLocation.coordinates.lat.toString());
                const lng = parseFloat(job.courierLocation.coordinates.lng.toString());

                if (!isNaN(lat) && !isNaN(lng)) {
                    const courierId = job.courierLocation.courierId;

                    // Update or create driver entry in the Map
                    if (driversMap.has(courierId)) {
                        // Update existing driver's job assignments
                        const driver = driversMap.get(courierId);
                        if(driver == null) throw new Error(
                            `Driver ${courierId} not found in driversMap`
                        )

                        driver.assignedJobs = driver.assignedJobs || [];
                        driver.assignedJobs.push({
                            jobId: job.jobId,
                            jobNumber: job.jobNumber
                        });
                    } else {
                        // Create new driver entry
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

        console.log("Transformed data:", {
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

    checkVisiblePoints() {
        if (!this.map) {
            console.warn("Map not initialized yet");
            return;
        }

        const bounds = this.map.getBounds();
        if (!bounds) {
            console.warn("Map bounds not available");
            return;
        }

        console.log("Current map bounds:", bounds.toJSON());

        // Check pickups
        this.pickupPoints.forEach(point => {
            const isVisible = bounds.contains(new this.$window.google.maps.LatLng(point.lat, point.lng));
            console.log(`Pickup ${point.jobNumber} visible: ${isVisible}`, point);
        });

        // Check deliveries
        this.deliveryPoints.forEach(point => {
            const isVisible = bounds.contains(new this.$window.google.maps.LatLng(point.lat, point.lng));
            console.log(`Delivery ${point.jobNumber} visible: ${isVisible}`, point);
        });

        // Check drivers
        this.drivers.forEach(driver => {
            const isVisible = bounds.contains(new this.$window.google.maps.LatLng(driver.lat, driver.lng));
            console.log(`Driver ${driver.name} visible: ${isVisible}`, driver);
        });
    }

    getRoutePath(pickup: MapPoint) {
        console.log("Getting route path for pickup:", pickup);
        if (pickup.isFlightRoute) {
            console.log("Drawing FLIGHT route for job:", pickup.jobId);
            const delivery = this.getDeliveryPointForJob(pickup.jobId);
            if (!delivery) return [];

            // Direct line for flight routes
            return [[pickup.lat, pickup.lng], [delivery.lat, delivery.lng]];
        }

        console.log("Drawing ROAD route for job:", pickup.jobId);
        // Get cached road route if available
        const cacheKey = `${pickup.jobId}`;
        const cachedPath = this.routePaths.get(cacheKey);
        if (cachedPath) {
            return cachedPath;
        }

        // Calculate road route if not cached
        const delivery = this.getDeliveryPointForJob(pickup.jobId);
        if (!delivery) return [];

        // Start calculating road route
        this.calculateRoadRoute(pickup, delivery).then(path => {
            if (path) {
                this.routePaths.set(cacheKey, path);
                if (this.map) {
                    const center = this.map.getCenter();
                    this.map.setCenter(center);
                }
            }
        });

        // Return direct line while calculating road route
        return [[pickup.lat, pickup.lng], [delivery.lat, delivery.lng]];
    }

    async calculateRoadRoute(pickup: MapPoint, delivery: MapPoint): Promise<Array<Array<number>> | null> {
        try {
            const result = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
                this.directionsService.route({
                    origin: {lat: parseFloat(pickup.lat.toString()), lng: parseFloat(pickup.lng.toString())},
                    destination: {lat: parseFloat(delivery.lat.toString()), lng: parseFloat(delivery.lng.toString())},
                    travelMode: this.$window.google.maps.TravelMode.DRIVING,
                    optimizeWaypoints: true
                }, (response: google.maps.DirectionsResult, status: google.maps.DirectionsStatus) => {
                    if (status === this.$window.google.maps.DirectionsStatus.OK) {
                        resolve(response);
                    } else {
                        reject(status);
                    }
                });
            });

            return result.routes[0].overview_path.map((point: google.maps.LatLng) => [point.lat(), point.lng()]);
        } catch (error) {
            return null;
        }
    }

    formatRoutePath(path: string[]) {
        return path.map(point => `[${point[0]}, ${point[1]}]`).join(",");
    }

    calculateFlightPosition(startLat: number, startLng: number, endLat: number, endLng: number, flightInfo: AssignedFlight): { lat: number; lng: number; progress: number; } {
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

    getInfoWindowContent(route: { flightNumber: any; jobNumber: any; notes: any; etd: any; eta: any; }) {
        return `
        <div class="flight-info-window">
            <h4>Flight ${route.flightNumber}</h4>
            <p>Job: ${route.jobNumber}</p>
            ${route.notes ? `<p class="notes">${route.notes}</p>` : ""}
            <p>ETD: ${this.formatDateTime(route.etd)}</p>
            <p>ETA: ${this.formatDateTime(route.eta)}</p>
        </div>
    `;
    }


    formatDateTime(date: number | string | Date | VarDate) {
        if (!date) return "Not scheduled";
        return new Date(date.toString()).toLocaleString();
    }

    /**
     * Shows info for a map point and pans to its location
     * @param {Event} $event - The NgMap event object
     */
    showPointInfo($event: MouseEvent) {
        const element = $event.target as HTMLElement || $event.srcElement as HTMLElement;
        if(element == null) return;

        const scope = angular.element(element).scope() as angular.IScope & { point: MapPoint };
        const point = scope.point;

        if (!point) {
            console.error("Could not get point data from event");
            return;
        }

        if (!this.jobs) {
            console.error("No jobs saved!");
        }
        this.selectedJob = this.jobs.find(job => job.jobId === point.jobId);

        console.log(this.selectedJob);

        if (!this.selectedJob) {
            console.error("Could not find job data for point:", point);
            return;
        }

        if (this.map) {
            this.map.panTo(new this.$window.google.maps.LatLng(point.lat, point.lng));
        }
    }

    closeJobInfo() {
        this.selectedJob = null;
    }

    isPickupPoint(point: MapPoint) {
        return this.pickupPoints.some(p => p.jobId === point.jobId);
    }

    createClusterIcon(type: string) {
        const color = type === "pickup" ? "#4CAF50" : "#F44336";
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
                <circle cx="20" cy="20" r="19" fill="white" stroke="${color}" stroke-width="2"/>
            </svg>
        `;
        return `data:image/svg+xml;base64,${btoa(svg)}`;
    }

    onZoomChanged() {
        if (this.map) {
            this.zoomLevel = this.map.getZoom();
        }
    }
}

app.controller("megaMapController", MegaMapController);
