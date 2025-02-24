import app from "../../../app";
import "./dispatch-map.styles.less";

class DispatchMapController {
    static $inject = ["$scope", "NgMap", "$timeout", "configService", "$window"];

    constructor($scope, NgMap, $timeout, configService, $window) {
        this.$scope = $scope;
        this.NgMap = NgMap;
        this.$timeout = $timeout;
        this.configService = configService;
        this.$window = $window;

        this.mapInstance = null;
        this.isUpdating = false;
        this.PICKUP_ICON = null;
        this.DELIVERY_ICON = null;
        this.COURIER_ICON = null;
        this.PICKUP_ICON_HOVER = null;
        this.DELIVERY_ICON_HOVER = null;

        this.$scope.polylines = [];
        this.$scope.directionsRenderers = [];

        this.$scope.mapZoom = this.$scope.mapZoom || 12;
        this.$scope.markers = [];
        this.$scope.flags = [];
        this.$scope.labels = [];
        this.$scope.googleMapsUrl = null;

        this.updateDisplayedJobs = this.updateDisplayedJobs.bind(this);
        this.updateCourierMarkers = this.updateCourierMarkers.bind(this);
        this._setupWatchers = this._setupWatchers.bind(this);

        this._initialize();
    }

    /**
     * @param {string} color
     * @param {boolean} [isHovered=false]
     * @returns {google.maps.Symbol}
     * @private
     */
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

    /**
     * @private
     */
    _setupMarkerIcons() {
        this.PICKUP_ICON = this._createMarkerIcon("#4CAF50");
        this.DELIVERY_ICON = this._createMarkerIcon("#F44336");
        this.COURIER_ICON = this._createMarkerIcon("#2196F3");
        this.PICKUP_ICON_HOVER = this._createMarkerIcon("#4CAF50", true);
        this.DELIVERY_ICON_HOVER = this._createMarkerIcon("#F44336", true);
    }

    /**
     * @private
     */
    async _initialize() {
        try {
            const apiKey = await this.configService.getGoogleMapsKey();
            this.$scope.googleMapsUrl = `https://maps.google.com/maps/api/js?key=${apiKey}&libraries=places`;

            this.$scope.$apply();

            const map = await this.NgMap.getMap();
            this._setupMarkerIcons();

            this.mapInstance = map;
            this.$scope.map = map;
            this.$scope.tooltip = new this.$window.google.maps.InfoWindow({
                disableAutoPan: true
            });

            // Initialize directions service and renderer
            this.directionsService = new this.$window.google.maps.DirectionsService();
            this.directionsRenderer = new this.$window.google.maps.DirectionsRenderer({
                suppressMarkers: true,
                preserveViewport: true
            });

            this._setupWatchers();

            if (this.$scope.jobs || this.$scope.currentJob) {
                await this.updateDisplayedJobs();
            }
        } catch (error) {
            console.error("Error initializing map:", error);
        }
    }

    /**
     * @private
     */
    _setupWatchers() {
        this.$scope.$watch("mapCenter", (newCenter) => {
            if (newCenter && this.mapInstance) {
                this.mapInstance.setCenter(newCenter);
            }
        });

        this.$scope.$watch("currentJob", async () => {
            if (this.mapInstance) {
                await this.updateDisplayedJobs();
            }
        });

        this.$scope.$watchCollection("jobs", async () => {
            if (this.mapInstance) {
                await this.updateDisplayedJobs();
            }
        });

        this.$scope.$watchCollection("courierPositions", (newPositions) => {
            if (newPositions && this.mapInstance) {
                this.updateCourierMarkers(newPositions);
            }
        });

        this.$scope.$watchCollection("jobs", async () => {
            if (this.mapInstance) {
                await this.updateDisplayedJobs();
                await this.drawJobLines();
            }
        });
    }

    async updateDisplayedJobs() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            this.clearJobMarkers();

            if (this.$scope.currentJob) {
                if (this._isValidCoordinates(
                    this.$scope.currentJob.pickupAddress?.latitude,
                    this.$scope.currentJob.pickupAddress?.longitude
                )) {
                    this.addPickupMarker(this.$scope.currentJob);
                }
                if (this._isValidCoordinates(
                    this.$scope.currentJob.deliveryAddress?.latitude,
                    this.$scope.currentJob.deliveryAddress?.longitude
                )) {
                    this.addDeliveryMarker(this.$scope.currentJob);
                }
            } else if (this.$scope.jobs?.length) {
                this.$scope.jobs.forEach(job => {
                    if (this._isValidCoordinates(
                        job.pickupAddress?.latitude,
                        job.pickupAddress?.longitude
                    )) {
                        this.addPickupMarker(job);
                    }
                    if (this._isValidCoordinates(
                        job.deliveryAddress?.latitude,
                        job.deliveryAddress?.longitude
                    )) {
                        this.addDeliveryMarker(job);
                    }
                });
            }

            await this.$timeout(() => {
                this.fitMapToMarkers();
            }, 100);
        } finally {
            this.isUpdating = false;
        }
    }

    /**
     * @param {Courier[]} couriers
     */
    updateCourierMarkers(couriers) {
        if (!couriers || !this.$scope.showAvailableCouriers) return;
        this.clearCourierMarkers();

        couriers.forEach(courier => {
            if (this._isValidCoordinates(courier.latitude, courier.longitude)) {
                this.addCourierMarker(courier);
            }
        });
    }

    /**
     * @param {Job} job
     */
    addPickupMarker(job) {
        if (!job.pickupAddress) return;

        const position = new this.$window.google.maps.LatLng(
            job.pickupAddress.latitude,
            job.pickupAddress.longitude
        );

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.PICKUP_ICON,
            title: `Click to open job ${job.jobNo}`,
            animation: this.$window.google.maps.Animation.DROP
        });

        this.setupMarkerListeners(marker, job, this.PICKUP_ICON, this.PICKUP_ICON_HOVER, "Pickup");
        this.$scope.markers.push(marker);
    }

    /**
     * @param {Job} job
     */
    addDeliveryMarker(job) {
        if (!job.deliveryAddress) return;

        const position = new this.$window.google.maps.LatLng(
            job.deliveryAddress.latitude,
            job.deliveryAddress.longitude
        );

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.DELIVERY_ICON,
            title: `Click to open job ${job.jobNo}`,
            animation: this.$window.google.maps.Animation.DROP
        });

        this.setupMarkerListeners(marker, job, this.DELIVERY_ICON, this.DELIVERY_ICON_HOVER, "Delivery");
        this.$scope.markers.push(marker);
    }

    /**
     * @param {google.maps.Marker} marker
     * @param {Job} job
     * @param {google.maps.Symbol} normalIcon
     * @param {google.maps.Symbol} hoverIcon
     * @param {string} locationType
     */
    setupMarkerListeners(marker, job, normalIcon, hoverIcon, locationType) {
        marker.addListener("mouseover", () => {
            marker.setIcon(hoverIcon);
            const content = `
                <div style="padding: 8px;">
                    <strong>Job ${job.jobNo}</strong><br>
                    ${locationType} Location<br>
                    <small style="color: #666;">Click to open job details</small>
                </div>
            `;
            this.$scope.tooltip.setContent(content);
            this.$scope.tooltip.open(this.mapInstance, marker);
        });

        marker.addListener("mouseout", () => {
            marker.setIcon(normalIcon);
            this.$scope.tooltip.close();
        });

        marker.addListener("click", () => {
            if (locationType === "Delivery") {
                marker.setAnimation(this.$window.google.maps.Animation.BOUNCE);
                setTimeout(() => {
                    marker.setAnimation(null);
                }, 750);
            }

            this.$scope.$apply(() => {
                this.$scope.onMarkerClick({job: job});
            });
        });
    }

    /**
     * @param {Courier} courier
     */
    addCourierMarker(courier) {
        const position = new this.$window.google.maps.LatLng(courier.latitude, courier.longitude);

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.COURIER_ICON,
            title: `Courier ${courier.code || courier.courierName}`
        });

        this.$scope.markers.push(marker);
    }

    clearJobMarkers() {
        this.$scope.markers.forEach(marker => marker.setMap(null));
        this.$scope.markers = [];
    }

    clearCourierMarkers() {
        this.$scope.flags.forEach(flag => flag.setMap(null));
        this.$scope.flags = [];
        this.$scope.labels.forEach(label => label.setMap(null));
        this.$scope.labels = [];
    }

    fitMapToMarkers() {
        if (this.$scope.markers.length === 0) return;

        const bounds = new this.$window.google.maps.LatLngBounds();
        this.$scope.markers.forEach(marker => bounds.extend(marker.getPosition()));
        this.mapInstance.fitBounds(bounds);

        const zoom = this.mapInstance.getZoom();
        if (zoom && zoom > 16) {
            this.mapInstance.setZoom(16);
        }
    }

    clearJobLines() {
        // Clear polylines (flight routes)
        this.$scope.polylines.forEach(line => line.setMap(null));
        this.$scope.polylines = [];

        // Clear direction renderers (road routes)
        this.$scope.directionsRenderers.forEach(renderer => renderer.setMap(null));
        this.$scope.directionsRenderers = [];
    }

    async drawJobLines() {
        if (this.$scope.showJobLines) {
            return;
        }
        
        this.clearJobLines();

        const jobs = this.$scope.currentJob ? [this.$scope.currentJob] : this.$scope.jobs;
        if (!jobs?.length) return;

        for (const job of jobs) {
            if (!job.pickupAddress || !job.deliveryAddress) continue;

            const pickup = new this.$window.google.maps.LatLng(
                job.pickupAddress.latitude,
                job.pickupAddress.longitude
            );

            const delivery = new this.$window.google.maps.LatLng(
                job.deliveryAddress.latitude,
                job.deliveryAddress.longitude
            );

            if (job.assignedFlight) {
                // Create straight line for flight jobs
                const flightPath = new this.$window.google.maps.Polyline({
                    path: [pickup, delivery],
                    geodesic: true,
                    strokeColor: "#2196F3",
                    strokeOpacity: 0.8,
                    strokeWeight: 2
                });

                flightPath.setMap(this.mapInstance);
                this.$scope.polylines.push(flightPath);
            } else {
                // Create road-following route for ground jobs
                try {
                    const renderer = new this.$window.google.maps.DirectionsRenderer({
                        suppressMarkers: true,
                        preserveViewport: true,
                        polylineOptions: {
                            strokeColor: "#FF5722",
                            strokeOpacity: 0.7,
                            strokeWeight: 3
                        }
                    });

                    renderer.setMap(this.mapInstance);

                    const result = await new Promise((resolve, reject) => {
                        this.directionsService.route({
                            origin: pickup,
                            destination: delivery,
                            travelMode: this.$window.google.maps.TravelMode.DRIVING
                        }, (response, status) => {
                            if (status === "OK") {
                                resolve(response);
                            } else {
                                reject(status);
                            }
                        });
                    });

                    renderer.setDirections(result);
                    this.$scope.directionsRenderers.push(renderer);
                } catch (error) {
                    console.error("Error getting directions:", error);
                }
            }
        }
    }

    /**
     * @param {number} [lat]
     * @param {number} [lng]
     * @returns {boolean}
     * @private
     */
    _isValidCoordinates(lat, lng) {
        return Boolean(
            lat && lng && !isNaN(lat) && !isNaN(lng) &&
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        );
    }
}

class DispatchMapDirective {
    constructor() {
        this.restrict = "E";
        this.templateUrl = "app/components/common/dispatch-map/dispatch-map.template.html";
        this.scope = {
            mapCenter: "=",
            mapZoom: "=?",
            jobs: "=",
            currentJob: "=?",
            courierPositions: "=?",
            onMarkerClick: "&",
            showAvailableCouriers: "=?",
            showJobLines: "=?"
        };
        this.controller = DispatchMapController;
    }

    /**
     * @returns {Object}
     */
    static factory() {
        return () => new DispatchMapDirective();
    }
}

app.directive("dispatchMap", DispatchMapDirective.factory());
