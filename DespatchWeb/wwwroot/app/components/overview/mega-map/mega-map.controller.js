class MegaMapController {
    constructor($interval, toastrService, NgMap, overviewService, APP_CONFIG) {
        this.$interval = $interval;
        this.toastrService = toastrService;
        this.NgMap = NgMap;
        this.overviewService = overviewService;

        // Initialize data
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.drivers = [];
        this.pickupPoints = [];
        this.deliveryPoints = [];
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

    showDriverInfo(driver, event) {
        this.selectedDriver = driver;
        this.map.showInfoWindow('driver-info', event.target);
    }

    showPickupInfo(point, event) {
        this.selectedPickup = point;
        this.map.showInfoWindow(`pickup-${this.pickupPoints.indexOf(point)}`);
    }

    showDeliveryInfo(point, event) {
        this.selectedDelivery = point;
        this.map.showInfoWindow(`delivery-${this.deliveryPoints.indexOf(point)}`);
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
            const response = await this.overviewService.getMegaMapData();
            const {pickups, deliveries, drivers} = this.transformMapData(response);

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

        console.log('Transform complete:', {
            pickupCount: pickups.length,
            deliveryCount: deliveries.length,
            driverCount: drivers.length,
            pickups,
            deliveries,
            drivers
        });

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
}

angular.module('uDispatch')
    .controller('megaMapController',
        ['$interval', 'toastrService', 'NgMap', 'overviewService', 'APP_CONFIG',
            ($interval, toastrService, NgMap, overviewService, APP_CONFIG) => new MegaMapController(
                $interval, toastrService, NgMap, overviewService, APP_CONFIG)]);
