class MegaMapController {
    constructor($interval, toastrService, overviewService, APP_CONFIG, configService) {
        this.$interval = $interval;
        this.toastrService = toastrService;
        this.overviewService = overviewService;
        this.configService = configService;

        // Initialize data
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.jobs = [];
        this.drivers = [];
        this.pickupPoints = [];
        this.deliveryPoints = [];
        this.markers = new Map(); // Store all markers
        this.routeLines = new Map(); // Store all route polylines
        this.bubbles = new Map(); // Store info bubbles

        this.mapCenter = this.isUsCustomer
            ? {lat: 39.8097343, lng: -98.5556199}  // Central USA coordinates
            : {lat: -36.8484597, lng: 174.7633315}; // Auckland, New Zealand coordinates
        this.isLoading = false;

        // Initialize map
        this.initializeMap();
    }

    async initializeMap() {
        // Initialize the platform
        const apiKey = await this.configService.getHereMapsKey();
        const platform = new H.service.Platform({
            apikey: apiKey
        });

        // Get default layers
        const defaultLayers = platform.createDefaultLayers();

        // Initialize map
        this.map = new H.Map(
            document.getElementById('hereMap'),
            defaultLayers.vector.normal.map,
            {
                center: this.mapCenter,
                zoom: 5,
                pixelRatio: window.devicePixelRatio || 1
            }
        );

        // Add map controls
        this.addMapControls(platform);

        // Enable map events
        const behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(this.map));

        // Initialize routing service
        this.routingService = platform.getRoutingService(null, H.service.Platform.ROUTE_MODE_FAST);

        // Force a refresh after map is initialized
        await this.refreshData();
    }

    addMapControls(platform) {
        // Add zoom control
        const ui = H.ui.UI.createDefault(this.map, platform.createDefaultLayers());
        const zoomControl = new H.ui.ZoomControl();
        ui.addControl('zoom', zoomControl);
    }

    getDeliveryPointForJob(jobId) {
        return this.deliveryPoints.find(point => point.jobId === jobId) || {lat: 0, lng: 0};
    }

    /**
     * Check if job is a flight route
     * @param {number} jobId - The job ID to check
     * @returns {boolean} True if it's a flight job
     */
    isFlightRoute(jobId) {
        const job = this.jobs.find(j => j.jobId === jobId);
        return job?.IsFlightJob || false;
    }

    /**
     * @param {string} message
     */
    showToast(message) {
        this.toastrService.showSuccessToast(message);
    }

    async refreshData() {
        this.isLoading = true;

        try {
            // Store raw response
            this.jobs = await this.overviewService.getMegaMapData();

            // Transform data for map
            const {pickups, deliveries, drivers} = this.transformMapData(this.jobs);

            this.drivers = drivers;
            this.pickupPoints = pickups;
            this.deliveryPoints = deliveries;

            // Clear existing markers and routes
            this.clearMapObjects();

            // Add new markers and routes
            this.addMarkersToMap();
            this.addRoutesToMap();

            // Fit map to show all points
            this.fitMapToPoints();

            this.showToast('Data updated successfully');
        } catch (error) {
            this.showToast('Error updating data');
            console.error('Error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @param {Array<MegaMapResponse>} jobs
     */
    transformMapData(jobs) {
        console.log('Starting transformMapData with %d jobs', jobs.length);

        const pickups = [];
        const deliveries = [];
        const drivers = [];

        jobs.forEach(job => {
            console.log('Processing job %s:', job.jobNumber, job);

            // Add pickup points
            if (job.pickupLocation && job.pickupLocation.latitude && job.pickupLocation.longitude) {
                const lat = parseFloat(job.pickupLocation.latitude);
                const lng = parseFloat(job.pickupLocation.longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    console.log('Adding pickup point for job %s at [%d, %d]',
                        job.jobNumber, lat, lng
                    );

                    pickups.push({
                        lat,
                        lng,
                        address: job.pickupLocation.fullAddress,
                        jobId: job.jobId,
                        jobNumber: job.jobNumber
                    });
                } else {
                    console.warn('Job %s has invalid pickup coordinates', job.jobNumber);
                }
            } else {
                console.warn('Job %s missing valid pickup location', job.jobNumber);
            }

            // Add delivery points
            if (job.deliveryLocation && job.deliveryLocation.latitude && job.deliveryLocation.longitude) {
                const lat = parseFloat(job.deliveryLocation.latitude);
                const lng = parseFloat(job.deliveryLocation.longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    console.log('Adding delivery point for job %s at [%d, %d]',
                        job.jobNumber, lat, lng
                    );

                    deliveries.push({
                        lat,
                        lng,
                        address: job.deliveryLocation.fullAddress,
                        jobId: job.jobId,
                        jobNumber: job.jobNumber
                    });
                } else {
                    console.warn('Job %s has invalid delivery coordinates', job.jobNumber);
                }
            } else {
                console.warn('Job %s missing valid delivery location', job.jobNumber);
            }

            // Add driver location if exists
            if (job.courierLocation && job.courierLocation.coordinates) {
                const lat = parseFloat(job.courierLocation.coordinates.latitude);
                const lng = parseFloat(job.courierLocation.coordinates.longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    // Check if driver already exists (to avoid duplicates)
                    const existingDriver = drivers.find(d => d.courierId === job.courierLocation.courierId);
                    if (!existingDriver) {
                        console.log('Adding driver %s for job %s at [%d, %d]',
                            job.courierLocation.courierName,
                            job.jobNumber,
                            lat,
                            lng
                        );

                        drivers.push({
                            courierId: job.courierLocation.courierId,
                            name: job.courierLocation.courierName,
                            lat,
                            lng,
                            assignedJobId: job.jobId,
                            assignedJobNumber: job.jobNumber
                        });
                    } else {
                        console.log('Driver %s already exists, skipping duplicate', job.courierLocation.courierName);
                    }
                } else {
                    console.warn('Job %s has invalid driver coordinates', job.jobNumber);
                }
            }
        });

        // Log routes after transformation
        console.log('Routes:', pickups.map(pickup => {
            const delivery = deliveries.find(d => d.jobId === pickup.jobId);
            return {
                jobNumber: pickup.jobNumber,
                from: pickup.address,
                to: delivery ? delivery.address : 'Unknown'
            };
        }));

        return {pickups, deliveries, drivers};
    }

    clearMapObjects() {
        // Clear existing objects from the map
        this.markers.forEach(marker => this.map.removeObject(marker));
        this.routeLines.forEach(line => this.map.removeObject(line));
        this.markers.clear();
        this.routeLines.clear();
        this.bubbles.clear();
    }

    addMarkersToMap() {
        // Add driver markers
        this.drivers.forEach(driver => {
            const driverIcon = new H.map.Icon(`
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#3EAFC2"/>
                </svg>
            `, {anchor: {x: 12, y: 12}});

            const marker = new H.map.Marker(
                {lat: driver.lat, lng: driver.lng},
                {icon: driverIcon}
            );

            marker.addEventListener('tap', () => this.showDriverInfo(driver));
            this.markers.set(`driver-${driver.courierId}`, marker);
            this.map.addObject(marker);
        });

        // Add pickup markers
        this.pickupPoints.forEach(point => {
            const marker = new H.map.Marker(
                {lat: point.lat, lng: point.lng},
                {icon: this.createMarkerIcon('#4CAF50')} // Green for pickup
            );

            marker.addEventListener('tap', () => this.showPickupInfo(point));
            this.markers.set(`pickup-${point.jobId}`, marker);
            this.map.addObject(marker);
        });

        // Add delivery markers
        this.deliveryPoints.forEach(point => {
            const marker = new H.map.Marker(
                {lat: point.lat, lng: point.lng},
                {icon: this.createMarkerIcon('#F44336')} // Red for delivery
            );

            marker.addEventListener('tap', () => this.showDeliveryInfo(point));
            this.markers.set(`delivery-${point.jobId}`, marker);
            this.map.addObject(marker);
        });
    }

    createMarkerIcon(color) {
        return new H.map.Icon(`
            <svg width="24" height="24" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" fill="${color}"/>
            </svg>
        `, {anchor: {x: 12, y: 12}});
    }

    async addRoutesToMap() {
        for (const pickup of this.pickupPoints) {
            const delivery = this.getDeliveryPointForJob(pickup.jobId);
            if (!delivery) continue;

            if (this.isFlightRoute(pickup.jobId)) {
                // Direct line for flight routes
                const lineString = new H.geo.LineString([
                    [pickup.lat, pickup.lng],
                    [delivery.lat, delivery.lng]
                ]);

                const polyline = new H.map.Polyline(lineString, {
                    style: {
                        lineWidth: 2,
                        strokeColor: '#3EAFC2',
                        lineDash: [8, 4]
                    }
                });

                this.routeLines.set(`route-${pickup.jobId}`, polyline);
                this.map.addObject(polyline);
            } else {
                // Calculate road route
                try {
                    const route = await this.calculateRoadRoute(pickup, delivery);
                    if (route) {
                        const polyline = new H.map.Polyline(route, {
                            style: {
                                lineWidth: 2,
                                strokeColor: '#FFB300'
                            }
                        });

                        this.routeLines.set(`route-${pickup.jobId}`, polyline);
                        this.map.addObject(polyline);
                    }
                } catch (error) {
                    console.warn('Failed to calculate road route:', error);
                }
            }
        }
    }

    async calculateRoadRoute(pickup, delivery) {
        return new Promise((resolve, reject) => {
            const params = {
                routingMode: 'fast',
                transportMode: 'car',
                origin: `${pickup.lat},${pickup.lng}`,
                destination: `${delivery.lat},${delivery.lng}`,
                return: 'polyline'
            };

            this.routingService.calculateRoute(params, (result) => {
                if (result.routes && result.routes.length > 0) {
                    const lineString = H.geo.LineString.fromFlexiblePolyline(
                        result.routes[0].sections[0].polyline
                    );
                    resolve(lineString);
                } else {
                    reject(new Error('No route found'));
                }
            }, reject);
        });
    }

    showDriverInfo(driver) {
        const bubble = new H.ui.InfoBubble(
            {lat: driver.lat, lng: driver.lng},
            {
                content: `
                    <div>
                        <h4>${driver.name}</h4>
                        ${driver.assignedJobNumber ?
                    `<p>Job: ${driver.assignedJobNumber}</p>` :
                    ''}
                    </div>`
            }
        );

        this.closeBubbles();
        this.bubbles.set(`driver-${driver.courierId}`, bubble);
        this.ui.addBubble(bubble);
    }

    showPickupInfo(point) {
        const bubble = new H.ui.InfoBubble(
            {lat: point.lat, lng: point.lng},
            {
                content: `
                    <div class="job-info-window">
                        <h4>Pickup: ${point.jobNumber}</h4>
                        <p>${point.address}</p>
                    </div>`
            }
        );

        this.closeBubbles();
        this.bubbles.set(`pickup-${point.jobId}`, bubble);
        this.ui.addBubble(bubble);
    }

    showDeliveryInfo(point) {
        const bubble = new H.ui.InfoBubble(
            {lat: point.lat, lng: point.lng},
            {
                content: `
                    <div class="job-info-window">
                        <h4>Delivery: ${point.jobNumber}</h4>
                        <p>${point.address}</p>
                    </div>`
            }
        );

        this.closeBubbles();
        this.bubbles.set(`delivery-${point.jobId}`, bubble);
        this.ui.addBubble(bubble);
    }

    closeBubbles() {
        this.bubbles.forEach(bubble => bubble.close());
        this.bubbles.clear();
    }

    fitMapToPoints() {
        const group = new H.map.Group();

        [...this.pickupPoints, ...this.deliveryPoints, ...this.drivers].forEach(point => {
            group.addObject(new H.map.Marker({lat: point.lat, lng: point.lng}));
        });

        this.map.getViewModel().setLookAtData({
            bounds: group.getBoundingBox()
        });
    }

    centerOnDriver(driver) {
        this.map.setCenter({lat: driver.lat, lng: driver.lng});
        this.map.setZoom(15);
    }

    /**
     * Calculate flight position based on time and flight info
     * @param {number} startLat - Pickup latitude
     * @param {number} startLng - Pickup longitude
     * @param {number} endLat - Delivery latitude
     * @param {number} endLng - Delivery longitude
     * @param {AssignedFlight} flightInfo - Flight information
     * @returns {{lat: number, lng: number, progress: number}} Flight position and progress
     */
    calculateFlightPosition(startLat, startLng, endLat, endLng, flightInfo) {
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
            const totalTime = arrivalTime - departureTime;
            const elapsedTime = now - departureTime;
            progress = Math.min(Math.max(elapsedTime / totalTime, 0), 1); // Clamp between 0 and 1
        }

        // Interpolate position
        const lat = startLat + (endLat - startLat) * progress;
        const lng = startLng + (endLng - startLng) * progress;

        return {lat, lng, progress};
    }

    /**
     * Get all flight routes for display
     * @returns {Array} Array of flight route objects
     */
    getFlightRoutes() {
        if (!this.jobs || !this.pickupPoints) {
            return [];
        }

        const flightRoutes = [];

        this.pickupPoints.forEach(pickup => {
            const delivery = this.getDeliveryPointForJob(pickup.jobId);
            const job = this.jobs.find(j => j.jobId === pickup.jobId);

            if (delivery && job?.IsFlightJob && job.FlightInfo) {
                const position = this.calculateFlightPosition(
                    pickup.lat,
                    pickup.lng,
                    delivery.lat,
                    delivery.lng,
                    job.FlightInfo
                );

                const rotation = this.calculateRotationAngle(
                    {lat: pickup.lat, lng: pickup.lng},
                    {lat: delivery.lat, lng: delivery.lng}
                );

                flightRoutes.push({
                    jobId: pickup.jobId,
                    jobNumber: pickup.jobNumber,
                    flightNumber: job.FlightInfo.flightNumber,
                    position: [position.lat, position.lng],
                    rotation: rotation,
                    progress: position.progress,
                    notes: job.FlightInfo.Notes,
                    etd: job.FlightInfo.expectedDeparture,
                    eta: job.FlightInfo.expectedArrival
                });
            }
        });

        return flightRoutes;
    }

    /**
     * Calculate the rotation angle between two points on the map
     * @param {Object} start - Starting point coordinates
     * @param {number} start.lat - Starting point latitude
     * @param {number} start.lng - Starting point longitude
     * @param {Object} end - Ending point coordinates
     * @param {number} end.lat - Ending point latitude
     * @param {number} end.lng - Ending point longitude
     * @returns {number} Rotation angle in degrees (0-360)
     */
    calculateRotationAngle(start, end) {
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
        // (since the Material Icon points up by default)
        angle = (angle + 45) % 360;

        return angle;
    }

    /**
     * @param {number|string|Date|VarDate} date
     */
    formatDateTime(date) {
        if (!date) return 'Not scheduled';
        return new Date(date).toLocaleString();
    }
}

angular.module('uDispatch')
    .controller('megaMapController',
        ['$interval', 'toastrService', 'overviewService', 'APP_CONFIG', 'configService',
            ($interval, toastrService, overviewService, APP_CONFIG, configService) => new MegaMapController(
                $interval, toastrService, overviewService, APP_CONFIG, configService)]);
