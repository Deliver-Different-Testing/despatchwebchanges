class MegaMapController {
    constructor($interval, toastrService, NgMap, overviewService, APP_CONFIG) {
        this.$interval = $interval;
        this.toastrService = toastrService;
        this.NgMap = NgMap;
        this.overviewService = overviewService;

        // Initialize data
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.jobs = [];
        this.drivers = [];
        this.pickupPoints = [];
        this.deliveryPoints = [];

        this.selectedDelivery = [];
        this.selectedPickup = [];
        this.selectedDriver = [];

        this.mapCenter = this.isUsCustomer
            ? [39.8097343, -98.5556199]  // Central USA coordinates
            : [-36.8484597, 174.7633315]; // Auckland, New Zealand coordinates
        this.isLoading = false;

        // Initialize map and start refresh interval
        this.initializeMap();
    }

    initializeMap() {
        this.NgMap.getMap().then(map => {
            this.map = map;
            console.log('Map initialized:', {
                center: map.getCenter().toJSON(),
                zoom: map.getZoom()
            });

            // Force a refresh after map is initialized
            this.refreshData();
        });
    }

    getDeliveryPointForJob(jobId) {
        return this.deliveryPoints.find(point => point.jobId === jobId) || {lat: 0, lng: 0};
    }

    /**
     * Show info window for pickup point
     * @param {number} index Array index of the pickup point
     * @param {Event} event The click event
     */
    showPickupInfo(index, event) {
        const point = this.pickupPoints[index];
        if (!point || !point.jobId) {
            console.warn('Invalid pickup point or missing jobId at index:', index);
            return;
        }

        this.selectedPickup = point;
        const markerId = `pickup-marker-${point.jobId}`;
        const marker = document.getElementById(markerId);

        if (marker) {
            this.map.showInfoWindow(`pickup-${point.jobId}`, marker);
        }
    }

    /**
     * Show info window for delivery point
     * @param {number} index Array index of the delivery point
     * @param {Event} event The click event
     */
    showDeliveryInfo(index, event) {
        const point = this.deliveryPoints[index];
        if (!point || !point.jobId) {
            console.warn('Invalid delivery point or missing jobId at index:', index);
            return;
        }

        this.selectedDelivery = point;
        const markerId = `delivery-marker-${point.jobId}`;
        const marker = document.getElementById(markerId);

        if (marker) {
            this.map.showInfoWindow(`delivery-${point.jobId}`, marker);
        }
    }

    highlightRoute(jobId) {
        // You could add logic here to highlight the specific route
        // For example, changing its color or thickness
        const pickup = this.pickupPoints.find(p => p.jobId === jobId);
        const delivery = this.deliveryPoints.find(d => d.jobId === jobId);

        if (pickup && delivery) {
            // Log the route being highlighted
            console.log(`Highlighting route from ${pickup.jobNumber}: ${pickup.address} to ${delivery.address}`);
        }
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

    showDriverInfo(driver, $event) {
        this.selectedDriver = driver;
        if (driver && driver.courierId) {
            this.map.showInfoWindow(`driver-${driver.courierId}`, $event.target);
        } else {
            console.warn('Invalid driver or missing courierId:', driver);
        }
    }

    centerOnDriver(driver) {
        this.mapCenter = [driver.lat, driver.lng];
        this.map.setZoom(15);
    }

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

            // Check visibility after setting points
            if (this.map) {
                this.checkVisiblePoints();

                // Optionally, fit bounds to show all points
                const bounds = new google.maps.LatLngBounds();
                [...pickups, ...deliveries, ...drivers].forEach(point => {
                    bounds.extend(new google.maps.LatLng(point.lat, point.lng));
                });
                this.map.fitBounds(bounds);
            }

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

    checkVisiblePoints() {
        if (!this.map) {
            console.warn('Map not initialized yet');
            return;
        }

        const bounds = this.map.getBounds();
        if (!bounds) {
            console.warn('Map bounds not available');
            return;
        }

        console.log('Current map bounds:', bounds.toJSON());

        // Check pickups
        this.pickupPoints.forEach(point => {
            const isVisible = bounds.contains(new google.maps.LatLng(point.lat, point.lng));
            console.log(`Pickup ${point.jobNumber} visible: ${isVisible}`, point);
        });

        // Check deliveries
        this.deliveryPoints.forEach(point => {
            const isVisible = bounds.contains(new google.maps.LatLng(point.lat, point.lng));
            console.log(`Delivery ${point.jobNumber} visible: ${isVisible}`, point);
        });

        // Check drivers
        this.drivers.forEach(driver => {
            const isVisible = bounds.contains(new google.maps.LatLng(driver.lat, driver.lng));
            console.log(`Driver ${driver.name} visible: ${isVisible}`, driver);
        });
    }

    getRoutePath(pickup) {
        const delivery = this.getDeliveryPointForJob(pickup.jobId);
        if (!delivery) {
            console.warn(`No delivery found for job ${pickup.jobId}`);
            return [];
        }

        // Return path in the format Google Maps expects
        return [
            [parseFloat(pickup.lat), parseFloat(pickup.lng)],
            [parseFloat(delivery.lat), parseFloat(delivery.lng)]
        ];
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

// Update template to show flight info in info window
    getInfoWindowContent(route) {
        return `
        <div class="flight-info-window">
            <h4>Flight ${route.flightNumber}</h4>
            <p>Job: ${route.jobNumber}</p>
            ${route.notes ? `<p class="notes">${route.notes}</p>` : ''}
            <p>ETD: ${this.formatDateTime(route.etd)}</p>
            <p>ETA: ${this.formatDateTime(route.eta)}</p>
        </div>
    `;
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
        ['$interval', 'toastrService', 'NgMap', 'overviewService', 'APP_CONFIG',
            ($interval, toastrService, NgMap, overviewService, APP_CONFIG) => new MegaMapController(
                $interval, toastrService, NgMap, overviewService, APP_CONFIG)]);
