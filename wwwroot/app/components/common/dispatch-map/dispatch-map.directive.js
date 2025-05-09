"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./dispatch-map.styles.less");
const bindAllMethods_1 = require("../../../bindAllMethods");
class DispatchMapController {
    constructor(NgMap, $timeout, configService, $window, $rootScope) {
        this.NgMap = NgMap;
        this.$timeout = $timeout;
        this.configService = configService;
        this.$window = $window;
        this.$rootScope = $rootScope;
        this.locationRefreshInterval = null;
        this.LOCATION_REFRESH_INTERVAL = 20000; // 20 seconds - adjust as needed
        this.mapInstance = null;
        this.isUpdating = false;
        this.PICKUP_ICON = null;
        this.DELIVERY_ICON = null;
        this.COURIER_ICON = null;
        this.PICKUP_ICON_HOVER = null;
        this.DELIVERY_ICON_HOVER = null;
        this.jobs = [];
        this.courierPositions = [];
        this.mapZoom = 12;
        this.showAvailableCouriers = false;
        this.autoZoomEnabled = true; // Set to true by default
        this.polylines = [];
        this.markers = [];
        this.flags = [];
        this.labels = [];
        this.googleMapsUrl = null;
        this.map = null;
        this.tooltip = null;
        bindAllMethods_1.bindAllMethods(this);
    }
    $onInit() {
        this.configService.getGoogleMapsKey()
            .then((apiKey) => {
            this.googleMapsUrl = `https://maps.google.com/maps/api/js?key=${apiKey}&libraries=places`;
            return this.$timeout(() => {
                return this.NgMap.getMap({ id: 'dispatchMap' });
            }, 1000);
        })
            .then((map) => {
            this._setupMarkerIcons();
            this.mapInstance = map;
            this.map = map;
            this.tooltip = new this.$window.google.maps.InfoWindow({
                disableAutoPan: true
            });
            this._setupWatchers();
            this._startLocationRefreshInterval();
            if (this.jobs || this.currentJob) {
                return this._updateDisplayedJobs();
            }
        })
            .catch((error) => {
            console.error("Error initializing map:", error);
        });
    }
    $onDestroy() {
        this._clearLocationRefreshInterval();
    }
    $onChanges(changes) {
        console.log('$onChanges called with changes:', changes);
        if (!this.mapInstance)
            return;
        if (changes.mapCenter && changes.mapCenter.currentValue) {
            this.mapInstance.setCenter(changes.mapCenter.currentValue);
        }
        if ('jobs' in changes || 'currentJob' in changes) {
            console.log('Updating displayed jobs due to changes in jobs or currentJob');
            return this._updateDisplayedJobs();
        }
        if (changes.courierPositions) {
            this._updateCourierMarkers(changes.courierPositions.currentValue);
        }
        if (changes.autoZoomEnabled &&
            changes.autoZoomEnabled.currentValue &&
            this.markers.length > 0) {
            this._fitMapToMarkers();
        }
    }
    _createMarkerIcon(color, isHovered = false) {
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
    _createCarMarkerIcon(color) {
        return {
            // SVG path for a simple car shape
            path: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
            fillColor: color,
            fillOpacity: 1,
            strokeWeight: 1,
            strokeColor: "#FFFFFF",
            scale: 1.5,
            anchor: new this.$window.google.maps.Point(12, 12)
        };
    }
    _createCourierLabel(position, text) {
        return new this.$window.google.maps.Marker({
            position: new this.$window.google.maps.LatLng(position.lat() + 0.0005, position.lng()),
            map: this.mapInstance,
            icon: {
                path: this.$window.google.maps.SymbolPath.CIRCLE,
                scale: 0,
            },
            label: {
                text: text,
                color: "#000000",
                fontWeight: "bold",
                fontSize: "12px",
                className: "courier-label"
            }
        });
    }
    _setupMarkerIcons() {
        this.PICKUP_ICON = this._createMarkerIcon("#4CAF50");
        this.DELIVERY_ICON = this._createMarkerIcon("#F44336");
        this.COURIER_ICON = this._createCarMarkerIcon("#2196F3");
        this.PICKUP_ICON_HOVER = this._createMarkerIcon("#4CAF50", true);
        this.DELIVERY_ICON_HOVER = this._createMarkerIcon("#F44336", true);
    }
    _setupWatchers() {
        this.$timeout(() => {
            this.$rootScope.$on('refreshCourierMarkers', (_, newPositions) => {
                if (newPositions && this.mapInstance) {
                    this._updateCourierMarkers(newPositions);
                }
            });
        });
    }
    _updateDisplayedJobs() {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isUpdating)
                return;
            this.isUpdating = true;
            try {
                this._clearJobMarkers();
                if (this.currentJob) {
                    // If a current job is selected, just show that job
                    if (this._isValidCoordinates((_a = this.currentJob.pickupAddress) === null || _a === void 0 ? void 0 : _a.latitude, (_b = this.currentJob.pickupAddress) === null || _b === void 0 ? void 0 : _b.longitude)) {
                        this._addPickupMarker(this.currentJob);
                    }
                    if (this._isValidCoordinates((_c = this.currentJob.deliveryAddress) === null || _c === void 0 ? void 0 : _c.latitude, (_d = this.currentJob.deliveryAddress) === null || _d === void 0 ? void 0 : _d.longitude)) {
                        this._addDeliveryMarker(this.currentJob);
                    }
                }
                else if ((_e = this.jobs) === null || _e === void 0 ? void 0 : _e.length) {
                    // Show all jobs if no current job is selected
                    this.jobs.forEach((job) => {
                        var _a, _b, _c, _d;
                        if (this._isValidCoordinates((_a = job.pickupAddress) === null || _a === void 0 ? void 0 : _a.latitude, (_b = job.pickupAddress) === null || _b === void 0 ? void 0 : _b.longitude)) {
                            this._addPickupMarker(job);
                        }
                        if (this._isValidCoordinates((_c = job.deliveryAddress) === null || _c === void 0 ? void 0 : _c.latitude, (_d = job.deliveryAddress) === null || _d === void 0 ? void 0 : _d.longitude)) {
                            this._addDeliveryMarker(job);
                        }
                    });
                }
                yield this.$timeout(() => {
                    // Always auto-zoom when jobs are updated
                    this._fitMapToMarkers();
                }, 100);
            }
            finally {
                this.isUpdating = false;
            }
        });
    }
    _updateCourierMarkers(couriers) {
        if (!couriers || !this.showAvailableCouriers)
            return;
        this._clearCourierMarkers();
        couriers.forEach((courier) => {
            if (this._isValidCoordinates(courier.latitude, courier.longitude)) {
                this._addCourierMarker(courier);
            }
        });
    }
    _addPickupMarker(job) {
        if (!job.pickupAddress)
            return;
        const position = new this.$window.google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude);
        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.PICKUP_ICON,
            title: `Click to open job ${job.jobNo}`,
            animation: this.$window.google.maps.Animation.DROP
        });
        this._setupMarkerListeners(marker, job, this.PICKUP_ICON, this.PICKUP_ICON_HOVER, "Pickup");
        this.markers.push(marker);
    }
    _addDeliveryMarker(job) {
        if (!job.deliveryAddress)
            return;
        const position = new this.$window.google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude);
        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.DELIVERY_ICON,
            title: `Click to open job ${job.jobNo}`,
            animation: this.$window.google.maps.Animation.DROP
        });
        this._setupMarkerListeners(marker, job, this.DELIVERY_ICON, this.DELIVERY_ICON_HOVER, "Delivery");
        this.markers.push(marker);
    }
    _setupMarkerListeners(marker, job, normalIcon, hoverIcon, locationType) {
        marker.addListener("mouseover", () => {
            marker.setIcon(hoverIcon);
            const content = `
                <div style="padding: 8px;">
                    <strong>Job ${job.jobNo}</strong><br>
                    ${locationType} Location<br>
                    <small style="color: #666;">Click to open job details</small>
                </div>
            `;
            this.tooltip.setContent(content);
            this.tooltip.open(this.mapInstance, marker);
        });
        marker.addListener("mouseout", () => {
            marker.setIcon(normalIcon);
            this.tooltip.close();
        });
        marker.addListener("click", () => {
            if (locationType === "Delivery") {
                marker.setAnimation(this.$window.google.maps.Animation.BOUNCE);
                setTimeout(() => {
                    marker.setAnimation(null);
                }, 750);
            }
            // Using callback instead of $scope.$apply
            if (this.onMarkerClick) {
                this.onMarkerClick({ job: job });
            }
        });
    }
    _addCourierMarker(courier) {
        const position = new this.$window.google.maps.LatLng(courier.latitude, courier.longitude);
        // Create the car marker
        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.COURIER_ICON,
            title: `Courier ${courier.code || courier.name}`
        });
        const courierName = courier.code || courier.name || "Courier";
        const label = this._createCourierLabel(position, courierName);
        marker.addListener("mouseover", () => {
            const content = `
                <div style="padding: 8px;">
                    <strong>Courier: ${courierName}</strong><br>
                    ${courier.totalJobs ? `Total Jobs: ${courier.totalJobs}<br>` : ''}
                    ${courier.code ? `Courier Code: ${courier.code}<br>` : ''}
                </div>
            `;
            this.tooltip.setContent(content);
            this.tooltip.open(this.mapInstance, marker);
        });
        marker.addListener("mouseout", () => {
            this.tooltip.close();
        });
        this.markers.push(marker);
        this.labels.push(label);
    }
    _clearJobMarkers() {
        this.markers.forEach((marker) => marker.setMap(null));
        this.markers = [];
    }
    _clearCourierMarkers() {
        this.flags.forEach((flag) => flag.setMap(null));
        this.flags = [];
        this.labels.forEach((label) => label.setMap(null));
        this.labels = [];
    }
    _fitMapToMarkers() {
        if (this.markers.length === 0)
            return;
        const bounds = new this.$window.google.maps.LatLngBounds();
        this.markers.forEach((marker) => bounds.extend(marker.getPosition()));
        this.mapInstance.fitBounds(bounds);
        const zoom = this.mapInstance.getZoom();
        if (zoom && zoom > 16) {
            this.mapInstance.setZoom(16);
        }
    }
    _isValidCoordinates(lat, lng) {
        return Boolean(lat && lng && !isNaN(lat) && !isNaN(lng) &&
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180);
    }
    _startLocationRefreshInterval() {
        this._clearLocationRefreshInterval();
        // Start a new interval
        this.locationRefreshInterval = this.$timeout(() => {
            this._refreshCourierLocations();
        }, this.LOCATION_REFRESH_INTERVAL);
    }
    _refreshCourierLocations() {
        if (this.courierPositions && this.courierPositions.length > 0) {
            this._updateCourierMarkers(this.courierPositions);
            this.$rootScope.$emit('courierLocationsNeedRefresh');
        }
        this.locationRefreshInterval = this.$timeout(() => {
            this._refreshCourierLocations();
        }, this.LOCATION_REFRESH_INTERVAL);
    }
    _clearLocationRefreshInterval() {
        if (this.locationRefreshInterval) {
            this.$timeout.cancel(this.locationRefreshInterval);
            this.locationRefreshInterval = null;
        }
    }
}
DispatchMapController.$inject = ["NgMap", "$timeout", "configService", "$window", "$rootScope"];
const DispatchMapComponent = {
    template: require("./dispatch-map.template.html"),
    controller: DispatchMapController,
    controllerAs: 'ctrl',
    bindings: {
        jobs: '<',
        currentJob: '<',
        courierPositions: '<',
        mapCenter: '<',
        mapZoom: '<',
        onMarkerClick: '&',
        showAvailableCouriers: '<',
        autoZoomEnabled: '<'
    }
};
exports.default = DispatchMapComponent;
