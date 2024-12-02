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
        this.refreshData();
        //this.$interval(() => this.refreshData(), 30000);
    }

    initializeMap() {
        this.NgMap.getMap().then(map => {
            this.map = map;
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
        console.log('Refreshing map data...');
        this.isLoading = true;

        try {
            const response = await this.overviewService.getMegaMapData();
            const {pickups, deliveries, drivers} = this.transformMapData(response);

            this.drivers = drivers;
            this.pickupPoints = pickups;
            this.deliveryPoints = deliveries;

            this.showToast('Data updated successfully');
        } catch (error) {
            this.showToast('Error updating data');
            console.error('Error:', error);
        } finally {
            this.isLoading = false;
            console.log('Refreshing map data complete...')
        }
    }

    transformMapData(jobs) {
        const pickups = [];
        const deliveries = [];
        const drivers = [];

        jobs.forEach(job => {
            // Add pickup points
            if (job.pickupLocation && job.pickupLocation.latitude && job.pickupLocation.longitude) {
                pickups.push({
                    lat: parseFloat(job.pickupLocation.latitude),
                    lng: parseFloat(job.pickupLocation.longitude),
                    address: job.pickupLocation.fullAddress,
                    jobId: job.jobId,
                    jobNumber: job.jobNumber
                });
            }

            // Add delivery points
            if (job.deliveryLocation && job.deliveryLocation.latitude && job.deliveryLocation.longitude) {
                deliveries.push({
                    lat: parseFloat(job.deliveryLocation.latitude),
                    lng: parseFloat(job.deliveryLocation.longitude),
                    address: job.deliveryLocation.fullAddress,
                    jobId: job.jobId,
                    jobNumber: job.jobNumber
                });
            }

            // Add driver location if exists
            if (job.courierLocation && job.courierLocation.coordinates) {
                // Check if driver already exists (to avoid duplicates)
                const existingDriver = drivers.find(d => d.courierId === job.courierLocation.courierId);
                if (!existingDriver) {
                    drivers.push({
                        courierId: job.courierLocation.courierId,
                        name: job.courierLocation.courierName,
                        lat: parseFloat(job.courierLocation.coordinates.latitude),
                        lng: parseFloat(job.courierLocation.coordinates.longitude),
                        assignedJobId: job.jobId,
                        assignedJobNumber: job.jobNumber
                    });
                }
            }
        });

        return {pickups, deliveries, drivers};
    }
}

angular.module('uDispatch')
    .controller('megaMapController',
        ['$interval', 'toastrService', 'NgMap', 'overviewService', 'APP_CONFIG',
            ($interval, toastrService, NgMap, overviewService, APP_CONFIG) => new MegaMapController(
                $interval, toastrService, NgMap, overviewService, APP_CONFIG)]);
