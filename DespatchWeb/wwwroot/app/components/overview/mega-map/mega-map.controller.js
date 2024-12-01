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
        this.isLoading = true;

        try {
            const [drivers, pickups, deliveries] = await Promise.all([
                this.overviewService.getDrivers(),
                this.overviewService.getPickupPoints(),
                this.overviewService.getDeliveryPoints()
            ]);

            this.drivers = drivers;
            this.pickupPoints = pickups;
            this.deliveryPoints = deliveries;
            this.showToast('Data updated successfully');
        } catch (error) {
            this.showToast('Error updating data');
            console.error('Error:', error);
        } finally {
            this.isLoading = false;
        }
    }
}

angular.module('uDispatch')
    .controller('megaMapController',
        ['$interval', 'toastrService', 'NgMap', 'overviewService', 'APP_CONFIG',
            ($interval, toastrService, NgMap, overviewService, APP_CONFIG) => new MegaMapController(
                $interval, toastrService, NgMap, overviewService, APP_CONFIG)]);
