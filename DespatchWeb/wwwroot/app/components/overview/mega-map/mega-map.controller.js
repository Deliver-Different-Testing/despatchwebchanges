class MegaMapController {
    constructor($interval, toastrService, NgMap, overviewService, APP_CONFIG, openJobDispatchService) {
        this.$interval = $interval;
        this.toastrService = toastrService;
        this.NgMap = NgMap;
        this.overviewService = overviewService;
        this.openJobDispatchService = openJobDispatchService;

        this.directionsService = new google.maps.DirectionsService();
        this.routePaths = new Map();

        // Initialize data
        this.isUsCustomer = APP_CONFIG.US_Customer;

        /** @type {MegaMapResponse[]} */
        this.jobs = [];
        /** @type {MegaMapPoint[]} */
        this.drivers = [];
        /** @type {MegaMapPoint[]} */
        this.pickupPoints = [];
        /** @type {MegaMapPoint[]} */
        this.deliveryPoints = [];
        this.zoomLevel = 5; // Default zoom level
        /** @type {MegaMapPoint[]} */
        this.flightRoutes = [];
        /** @type {MegaMapResponse|null} */
        this.selectedJob = null;

        this.mapCenter = this.isUsCustomer ? [39.8097343, -98.5556199]  // Central USA coordinates
            : [-36.8484597, 174.7633315]; // Auckland, New Zealand coordinates
        this.isLoading = false;

        /** @type {google.maps.MarkerClusterer} */
        this.markerCluster = null;

        // Bind functions to context
        this.showPointInfo = this.showPointInfo.bind(this);
        this.closeJobInfo = this.closeJobInfo.bind(this);
        this.shouldShowMarkers = this.shouldShowMarkers.bind(this);
        this.onZoomChanged = this.onZoomChanged.bind(this);
        this.handleClusterClick = this.handleClusterClick.bind(this);

        // Initialize map and start refresh interval
        this.initializeMap();
    }

    initializeMap() {
        const mapStyles = [
            {
                "featureType": "poi",
                "stylers": [
                    {"visibility": "off"}
                ]
            },
            {
                "featureType": "road",
                "elementType": "labels",
                "stylers": [
                    {"visibility": "off"}
                ]
            },
            {
                "featureType": "transit",
                "stylers": [
                    {"visibility": "off"}
                ]
            }
        ];

        const clusterOptions = {
            gridSize: 60,          // Controls how close markers need to be to form a cluster
            maxZoom: 7,          // Clusters will break apart when zoomed beyond this level
            minimumClusterSize: 4, // Minimum number of markers to form a cluster
            styles: this.getClusterStyles(),
            zoomOnClick: true,    // Automatically zooms in when clicking a cluster
            averageCenter: true,
            calculator: this.calculateClusterSize
        };
        this.clusterOptions = clusterOptions;

        this.NgMap.getMap().then(map => {
            this.map = map;

            // Apply custom styles
            map.setOptions({
                styles: mapStyles,
                disableDefaultUI: true, // Disable default UI
                zoomControl: true,
                minZoom: 4,        // Prevent zooming out too far
                maxZoom: 16,       // Maximum zoom level
                zoomControlOptions: {
                    position: google.maps.ControlPosition.RIGHT_BOTTOM
                }
            });

            // Rest of your initialization code...
            if (typeof MarkerClusterer === 'undefined') {
                console.error('MarkerClusterer library not loaded');
                return;
            }

            this.markerCluster = new MarkerClusterer(map, [], clusterOptions);

            // Add zoom change listener
            google.maps.event.addListener(map, 'zoom_changed', () => {
                this.onZoomChanged();
            });

            this.refreshData();
        });
    }

    getClusterStyles() {
        return [{
            // Small cluster style
            url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="18" fill="white" stroke="#3EAFC2" stroke-width="2"/>
            </svg>
        `),
            height: 40,
            width: 40,
            textColor: '#3EAFC2',
            textSize: 13,
            fontFamily: 'Roboto, Arial, sans-serif',
            fontWeight: '500',
            anchorText: [-5, 0],
            textAlign: 'center'
        }, {
            // Medium cluster style
            url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="23" fill="white" stroke="#3EAFC2" stroke-width="2"/>
            </svg>
        `),
            height: 50,
            width: 50,
            textColor: '#3EAFC2',
            textSize: 14,
            fontFamily: 'Roboto, Arial, sans-serif',
            fontWeight: '500',
            anchorText: [-6, 0],
            textAlign: 'center'
        }, {
            // Large cluster style
            url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r="28" fill="white" stroke="#3EAFC2" stroke-width="2"/>
            </svg>
        `),
            height: 60,
            width: 60,
            textColor: '#3EAFC2',
            textSize: 16,
            fontFamily: 'Roboto, Arial, sans-serif',
            fontWeight: '500',
            anchorText: [-7, 0],
            textAlign: 'center'
        }];
    }

    calculateClusterSize(markers, numStyles) {
        const count = markers.length;
        let index = 0;

        if (count < 10) index = 0;
        else if (count < 50) index = 1;
        else index = 2;

        return {
            text: count.toString(),
            index: index
        };
    }

    handleClusterClick(cluster) {
        if (!cluster || !cluster.getMarkers) {
            console.error('Invalid cluster object', cluster);
            return;
        }

        const markers = cluster.getMarkers();
        if (!markers.length) return;

        // If cluster is small enough and we're close to max zoom, show all points
        if (markers.length < 10 && this.map.getZoom() > 13) { // Changed from maxZoom - 2
            markers.forEach(marker => {
                if (marker && marker.get && marker.get('point')) {
                    this.showPointInfo(marker);
                }
            });
            return;
        }

        // Otherwise, zoom to fit the cluster
        const bounds = new google.maps.LatLngBounds();
        markers.forEach(marker => bounds.extend(marker.getPosition()));
        this.map.fitBounds(bounds);

        // If we're already quite zoomed in, also adjust zoom level
        if (this.map.getZoom() > 13) { // Changed from maxZoom - 3
            setTimeout(() => {
                this.map.setZoom(this.map.getZoom() + 1);
            }, 100);
        }
    }

    async refreshData() {
        this.isLoading = true;

        // Get all jobs
        const jobs = await this.overviewService.getMegaMapData();

        try {
            // Transform data for map
            const {pickups, deliveries, drivers} = this.transformMapData(jobs);

            this.drivers = drivers;
            this.pickupPoints = pickups;
            this.deliveryPoints = deliveries;

            this.jobs = jobs;

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

            this.toastrService.showSuccessToast('Map updated! Calculating driver routes...');
        } catch (error) {
            this.toastrService.showErrorToast('Error updating data');
            console.error('Error:', error);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * @param {number|string} jobId
     */
    getDeliveryPointForJob(jobId) {
        return this.deliveryPoints.find(point => point.jobId === jobId) || {lat: 0, lng: 0};
    }

    centerOnDriver(driver) {
        this.mapCenter = [driver.lat, driver.lng];
        this.map.setZoom(15);
    }

    /**
     * Transform raw job data into map-friendly format
     * @param {Array<MegaMapResponse>} jobs - Array of job data
     * @returns {Object} Object containing pickups, deliveries, and drivers arrays
     */
    transformMapData(jobs) {
        console.log('Starting transformMapData with %d jobs', jobs.length);

        const pickups = [];
        const deliveries = [];
        const driversMap = new Map();

        jobs.forEach(job => {
            console.log('Processing job %s:', job.jobNumber, job);

            const isFlightRoute = job?.isFlightJob || false;

            // Add pickup points
            if (job.pickupLocation && job.pickupLocation.latitude && job.pickupLocation.longitude) {
                const lat = parseFloat(job.pickupLocation.latitude);
                const lng = parseFloat(job.pickupLocation.longitude);

                if (!isNaN(lat) && !isNaN(lng)) {
                    console.log('Adding pickup point for job %s at [%d, %d]', job.jobNumber, lat, lng);

                    pickups.push({
                        lat,
                        lng,
                        address: job.pickupLocation.fullAddress,
                        jobId: job.jobId,
                        jobNumber: job.jobNumber,
                        isFlightRoute
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
                    console.log('Adding delivery point for job %s at [%d, %d]', job.jobNumber, lat, lng);

                    deliveries.push({
                        lat,
                        lng,
                        address: job.deliveryLocation.fullAddress,
                        jobId: job.jobId,
                        jobNumber: job.jobNumber,
                        isFlightRoute
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
                    const courierId = job.courierLocation.courierId;

                    // Update or create driver entry in the Map
                    if (driversMap.has(courierId)) {
                        // Update existing driver's job assignments
                        const driver = driversMap.get(courierId);
                        driver.assignedJobs = driver.assignedJobs || [];
                        driver.assignedJobs.push({
                            jobId: job.jobId, jobNumber: job.jobNumber
                        });
                    } else {
                        // Create new driver entry
                        driversMap.set(courierId, {
                            courierId: courierId, name: job.courierLocation.courierName, lat, lng, assignedJobs: [{
                                jobId: job.jobId, jobNumber: job.jobNumber
                            }]
                        });
                    }
                } else {
                    console.warn('Job %s has invalid driver coordinates', job.jobNumber);
                }
            }
        });

        // Convert driversMap to array for the view
        const drivers = Array.from(driversMap.values()).map(driver => ({
            ...driver, assignedJobNumber: driver.assignedJobs
                .map(job => job.jobNumber)
                .join(', ')
        }));

        console.log('Transformed data:', {
            pickups: pickups.length,
            deliveries: deliveries.length,
            drivers: drivers.length,
            flightJobs: pickups.filter(p => p.isFlightJob).length
        });

        this.flightRoutes = this.calculateFlightRoutes(jobs, pickups, deliveries);

        const pickupMarkers = pickups.map(p => this.createMarker(p, true));
        const deliveryMarkers = deliveries.map(d => this.createMarker(d, false));
        const flightMarkers = this.flightRoutes.map(route => this.createFlightMarker(route));

        // If markerCluster exists, update its markers
        if (this.markerCluster && typeof this.markerCluster.clearMarkers === 'function') {
            this.markerCluster.clearMarkers();
            this.markerCluster.addMarkers([...pickupMarkers, ...deliveryMarkers, ...flightMarkers]);
        } else {
            console.warn('MarkerCluster not properly initialized');
        }

        return {
            pickups, deliveries, drivers
        };
    }

    createMarker(point, isPickup) {
        // Create SVG icon with circular background
        const svgIcon = {
            url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
                <circle cx="12" cy="12" r="11" fill="white" stroke="${isPickup ? '#4CAF50' : '#F44336'}" stroke-width="2"/>
                <text x="12" y="16" 
                    font-family="Material Symbols Outlined" 
                    font-size="16"
                    text-anchor="middle" 
                    fill="${isPickup ? '#4CAF50' : '#F44336'}">location_on</text>
            </svg>
        `),
            size: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18),
            scaledSize: new google.maps.Size(36, 36)
        };

        const marker = new google.maps.Marker({
            position: new google.maps.LatLng(point.lat, point.lng),
            title: point.jobNumber,
            map: this.map,
            icon: svgIcon
        });

        // Store point data and add click listener
        marker.addListener('click', () => {
            this.showPointInfo(marker);
        });
        marker.set('point', point);

        return marker;
    }

    createFlightMarker(route) {
        // Create SVG icon with circular background and rotated flight icon
        const svgIcon = {
            url: 'data:image/svg+xml;base64,' + btoa(`
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
                <circle cx="12" cy="12" r="11" fill="white" stroke="#3EAFC2" stroke-width="2"/>
                <g transform="rotate(${route.rotation} 12 12)">
                    <text x="12" y="16" 
                        font-family="Material Symbols Outlined" 
                        font-size="16"
                        text-anchor="middle" 
                        fill="#3EAFC2">flight</text>
                </g>
            </svg>
        `),
            size: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18),
            scaledSize: new google.maps.Size(36, 36)
        };

        const marker = new google.maps.Marker({
            position: new google.maps.LatLng(route.position[0], route.position[1]),
            title: route.flightNumber,
            map: this.map,
            icon: svgIcon
        });

        // Store route data and add click listener
        marker.addListener('click', () => {
            this.showPointInfo(marker);
        });
        marker.set('point', {
            jobId: route.jobId,
            jobNumber: route.jobNumber,
            lat: route.position[0],
            lng: route.position[1],
            isFlightRoute: true
        });

        return marker;
    }

    /**
     * @param {MegaMapResponse[]} jobs
     * @param {MegaMapPoint[]} pickups
     * @param {MegaMapPoint[]} deliveries
     */
    calculateFlightRoutes(jobs, pickups, deliveries) {
        if (!jobs?.length || !pickups?.length || !deliveries?.length) {
            return [];
        }

        return jobs
            .filter(job => job.isFlightJob && job.flightInfo)
            .map(job => {
                const pickup = pickups.find(p => p.jobId === job.jobId);
                const delivery = deliveries.find(d => d.jobId === job.jobId);

                if (!pickup || !delivery) return null;

                const position = this.calculateFlightPosition(pickup.lat, pickup.lng, delivery.lat, delivery.lng, job.flightInfo);

                const rotation = this.calculateRotationAngle({lat: pickup.lat, lng: pickup.lng}, {
                    lat: delivery.lat,
                    lng: delivery.lng
                });

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

    /**
     * Gets the route path between pickup and delivery points
     * @param {MegaMapPoint} pickup - The pickup point object
     * @returns {Array<Array<number>>} Array of coordinate pairs forming the route path
     */
    getRoutePath(pickup) {
        console.log('Getting route path for pickup:', pickup);
        if (pickup.isFlightRoute) {
            console.log('Drawing FLIGHT route for job:', pickup.jobId);
            const delivery = this.getDeliveryPointForJob(pickup.jobId);
            if (!delivery) return [];

            // Direct line for flight routes
            return [[pickup.lat, pickup.lng], [delivery.lat, delivery.lng]];
        }

        console.log('Drawing ROAD route for job:', pickup.jobId);
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

    /**
     * Calculate road route between points
     * @param {MegaMapPoint} pickup
     * @param {MegaMapPoint} delivery
     * @returns {Promise<Array>}
     */
    async calculateRoadRoute(pickup, delivery) {
        try {
            const result = await new Promise((resolve, reject) => {
                this.directionsService.route({
                    origin: {lat: parseFloat(pickup.lat), lng: parseFloat(pickup.lng)},
                    destination: {lat: parseFloat(delivery.lat), lng: parseFloat(delivery.lng)},
                    travelMode: google.maps.TravelMode.DRIVING,
                    optimizeWaypoints: true
                }, (response, status) => {
                    if (status === google.maps.DirectionsStatus.OK) {
                        resolve(response);
                    } else {
                        console.warn(`Route calculation failed: ${status}`);
                        reject(status);
                    }
                });
            });

            return result.routes[0].overview_path.map(point => [point.lat(), point.lng()]);
        } catch (error) {
            return null;
        }
    }

    /**
     * Transform the route path for ng-map shape
     * @param {Array} path - Array of coordinate pairs
     * @returns {string} Formatted path string
     */
    formatRoutePath(path) {
        return path.map(point => `[${point[0]}, ${point[1]}]`).join(',');
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
     * Calculate the rotation angle between two points on the map
     * @param {Coordinates} start - Starting point coordinates
     * @param {Coordinates} end - Ending point coordinates
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

    /**
     * Shows info for a map point and pans to its location
     * @param {Event} $event - The NgMap event object
     */
    showPointInfo($event) {
        let point;

        // Handle direct marker clicks from custom markers
        if ($event.target && angular.element($event.target).scope()) {
            const scope = angular.element($event.target).scope();
            point = scope.point;
        }
        // Handle cluster marker clicks
        else if ($event.get && $event.get('point')) {
            point = $event.get('point');
        }

        if (!point) {
            console.error('Could not get point data from event', $event);
            return;
        }

        if (!this.jobs) {
            console.error('No jobs data available');
            return;
        }

        this.selectedJob = this.jobs.find(job => job.jobId === point.jobId);
        if (!this.selectedJob) {
            console.error('Could not find job data for point:', point);
            return;
        }
        console.log('Selected job:', this.selectedJob);

        // Focus map on the delivery point
        if (this.map) {
            this.map.panTo(new google.maps.LatLng(point.lat, point.lng));
        }
    }

    closeJobInfo() {
        this.selectedJob = null;
    }

    /**
     * @param {MegaMapPoint} point
     */
    isPickupPoint(point) {
        return this.pickupPoints.some(p => p.jobId === point.jobId);
    }

    shouldShowMarkers() {
        const show = this.map && this.map.getZoom() > this.clusterOptions.maxZoom;
        console.log(show);
        return show;
    }

    onZoomChanged() {
        if (this.map) {
            this.zoomLevel = this.map.getZoom();
        }
    }

    /**
     * @param {number} jobId
     */
    openJobDispatch(jobId) {
        this.openJobDispatchService.openJobDetail(jobId);
    }
}

angular.module('uDispatch')
    .controller('megaMapController', ['$interval', 'toastrService', 'NgMap', 'overviewService', 'APP_CONFIG', 'openJobDispatchService',
        ($interval, toastrService, NgMap, overviewService, APP_CONFIG, openJobDispatchService) => new MegaMapController(
            $interval, toastrService, NgMap, overviewService, APP_CONFIG, openJobDispatchService)]);
