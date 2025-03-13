import app from "../../../app";
import ConfigService from "../../../services/config.service";
import {Job} from "../../../interfaces/job.interface";
import {Courier} from "../../../interfaces/courier.interface";
import angular from "angular";
import {DispatchMapControllerScope} from "./dispatch-map.interfaces";
import "./dispatch-map.styles.less";

class DispatchMapController implements angular.IController {
    static $inject = ["$scope", "NgMap", "$timeout", "configService", "$window"];

    private mapInstance: google.maps.Map | null = null;
    private isUpdating: boolean = false;
    private PICKUP_ICON: google.maps.Symbol | null = null;
    private DELIVERY_ICON: google.maps.Symbol | null = null;
    private COURIER_ICON: google.maps.Symbol | null = null;
    private PICKUP_ICON_HOVER: google.maps.Symbol | null = null;
    private DELIVERY_ICON_HOVER: google.maps.Symbol | null = null;

    constructor(private $scope: DispatchMapControllerScope,
                private NgMap: angular.map.INgMap,
                private $timeout: angular.ITimeoutService,
                private configService: ConfigService,
                private $window: angular.IWindowService) {
        this.$scope.polylines = [];

        this.$scope.mapZoom = this.$scope.mapZoom || 12;
        this.$scope.markers = [];
        this.$scope.flags = [];
        this.$scope.labels = [];
        this.$scope.googleMapsUrl = null;

        this.bindFunctions()
    }

    private bindFunctions() {
        this.$onInit = this.$onInit.bind(this);
        this._createMarkerIcon = this._createMarkerIcon.bind(this);
        this._setupMarkerIcons = this._setupMarkerIcons.bind(this);
        this._setupWatchers = this._setupWatchers.bind(this);
        this._updateDisplayedJobs = this._updateDisplayedJobs.bind(this);
        this._updateCourierMarkers = this._updateCourierMarkers.bind(this);
        this._addPickupMarker = this._addPickupMarker.bind(this);
        this._addDeliveryMarker = this._addDeliveryMarker.bind(this);
        this._setupMarkerListeners = this._setupMarkerListeners.bind(this);
        this._addCourierMarker = this._addCourierMarker.bind(this);
        this._clearJobMarkers = this._clearJobMarkers.bind(this);
        this._clearCourierMarkers = this._clearCourierMarkers.bind(this);
        this._fitMapToMarkers = this._fitMapToMarkers.bind(this);
        this._isValidCoordinates = this._isValidCoordinates.bind(this);
    }

    $onInit() {
        this.configService.getGoogleMapsKey()
            .then((apiKey: string) => {
                this.$scope.googleMapsUrl = `https://maps.google.com/maps/api/js?key=${apiKey}&libraries=places`;
                this.$scope.$apply();

                return this.NgMap.getMap();
            })
            .then((map) => {
                this._setupMarkerIcons();

                this.mapInstance = map;
                this.$scope.map = map;
                this.$scope.tooltip = new this.$window.google.maps.InfoWindow({
                    disableAutoPan: true
                });

                this._setupWatchers();

                if (this.$scope.jobs || this.$scope.currentJob) {
                    return this._updateDisplayedJobs();
                }
            })
            .catch((error) => {
                console.error("Error initializing map:", error);
            });
    }

    private _createMarkerIcon(color: string, isHovered: boolean = false): google.maps.Symbol {
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

    private _createCarMarkerIcon(color: string): google.maps.Symbol {
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

    private _createCourierLabel(position: google.maps.LatLng, text: string): google.maps.Marker {
        return new this.$window.google.maps.Marker({
            position: new this.$window.google.maps.LatLng(
                position.lat() + 0.0005,
                position.lng()
            ),
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

    private _setupMarkerIcons() {
        this.PICKUP_ICON = this._createMarkerIcon("#4CAF50");
        this.DELIVERY_ICON = this._createMarkerIcon("#F44336");
        this.COURIER_ICON = this._createCarMarkerIcon("#2196F3");
        this.PICKUP_ICON_HOVER = this._createMarkerIcon("#4CAF50", true);
        this.DELIVERY_ICON_HOVER = this._createMarkerIcon("#F44336", true);
    }

    private _setupWatchers() {
        this.$scope.$watch("mapCenter", (newCenter: google.maps.LatLng | google.maps.LatLngLiteral) => {
            if (newCenter && this.mapInstance) {
                this.mapInstance.setCenter(newCenter);
            }
        });

        this.$scope.$watch("currentJob", async () => {
            if (this.mapInstance) {
                await this._updateDisplayedJobs();
            }
        });

        this.$scope.$watchCollection("jobs", async () => {
            if (this.mapInstance) {
                await this._updateDisplayedJobs();
            }
        });

        this.$scope.$watchCollection("courierPositions", (newPositions: Courier[]) => {
            if (newPositions && this.mapInstance) {
                this._updateCourierMarkers(newPositions);
            }
        });

        this.$scope.$watchCollection("jobs", async () => {
            if (this.mapInstance) {
                await this._updateDisplayedJobs();
            }
        });

        this.$scope.$watch("autoZoomEnabled", (newValue: boolean) => {
            if (newValue && this.mapInstance && this.$scope.markers.length > 0) {
                this._fitMapToMarkers();
            }
        });
    }

    private async _updateDisplayedJobs() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            this._clearJobMarkers();

            if (this.$scope.currentJob) {
                if (this._isValidCoordinates(
                    this.$scope.currentJob.pickupAddress?.latitude,
                    this.$scope.currentJob.pickupAddress?.longitude
                )) {
                    this._addPickupMarker(this.$scope.currentJob);
                }
                if (this._isValidCoordinates(
                    this.$scope.currentJob.deliveryAddress?.latitude,
                    this.$scope.currentJob.deliveryAddress?.longitude
                )) {
                    this._addDeliveryMarker(this.$scope.currentJob);
                }
            } else if (this.$scope.jobs?.length) {
                this.$scope.jobs.forEach((job: any) => {
                    if (this._isValidCoordinates(
                        job.pickupAddress?.latitude,
                        job.pickupAddress?.longitude
                    )) {
                        this._addPickupMarker(job);
                    }
                    if (this._isValidCoordinates(
                        job.deliveryAddress?.latitude,
                        job.deliveryAddress?.longitude
                    )) {
                        this._addDeliveryMarker(job);
                    }
                });
            }

            await this.$timeout(() => {
                if (this.$scope.autoZoomEnabled) {
                    this._fitMapToMarkers();
                }
            }, 100);
        } finally {
            this.isUpdating = false;
        }
    }

    private _updateCourierMarkers(couriers: Courier[]) {
        if (!couriers || !this.$scope.showAvailableCouriers) return;
        this._clearCourierMarkers();

        couriers.forEach((courier: any) => {
            if (this._isValidCoordinates(courier.latitude, courier.longitude)) {
                this._addCourierMarker(courier);
            }
        });
    }

    private _addPickupMarker(job: Job) {
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

        this._setupMarkerListeners(marker, job, this.PICKUP_ICON!, this.PICKUP_ICON_HOVER!, "Pickup");
        this.$scope.markers.push(marker);
    }

    private _addDeliveryMarker(job: Job) {
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

        this._setupMarkerListeners(marker, job, this.DELIVERY_ICON!, this.DELIVERY_ICON_HOVER!, "Delivery");
        this.$scope.markers.push(marker);
    }

    private _setupMarkerListeners(marker: google.maps.Marker, job: any, normalIcon: google.maps.Symbol, hoverIcon: google.maps.Symbol, locationType: string) {
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

    private _addCourierMarker(courier: Courier) {
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
            this.$scope.tooltip.setContent(content);
            this.$scope.tooltip.open(this.mapInstance, marker);
        });

        marker.addListener("mouseout", () => {
            this.$scope.tooltip.close();
        });

        this.$scope.markers.push(marker);
        this.$scope.labels.push(label);
    }


    private _clearJobMarkers() {
        this.$scope.markers.forEach((marker: google.maps.Marker) => marker.setMap(null));
        this.$scope.markers = [];
    }

    private _clearCourierMarkers() {
        this.$scope.flags.forEach((flag: any) => flag.setMap(null));
        this.$scope.flags = [];
        this.$scope.labels.forEach((label: any) => label.setMap(null));
        this.$scope.labels = [];
    }

    private _fitMapToMarkers() {
        if (this.$scope.markers.length === 0 || !this.$scope.autoZoomEnabled) return;

        const bounds = new this.$window.google.maps.LatLngBounds();
        this.$scope.markers.forEach((marker: google.maps.Marker) => bounds.extend(marker.getPosition() as google.maps.LatLng));
        this.mapInstance!.fitBounds(bounds);

        const zoom = this.mapInstance!.getZoom();
        if (zoom && zoom > 16) {
            this.mapInstance!.setZoom(16);
        }
    }

    private _isValidCoordinates(lat?: number, lng?: number): boolean {
        return Boolean(
            lat && lng && !isNaN(lat) && !isNaN(lng) &&
            lat !== 0 && lng !== 0 &&
            lat >= -90 && lat <= 90 &&
            lng >= -180 && lng <= 180
        );
    }
}

class DispatchMapDirective implements angular.IDirective {
    restrict: string;
    template: string;
    scope: any;
    controller: typeof DispatchMapController;

    constructor() {
        this.restrict = "E";
        this.template = require("./dispatch-map.template.html");
        this.scope = {
            jobs: '<',
            currentJob: '<',
            courierPositions: '<',
            mapCenter: '<',
            mapZoom: '<',
            onMarkerClick: '&',
            showAvailableCouriers: '<',
            autoZoomEnabled: '<'
        };
        this.controller = DispatchMapController;
    }

    static factory(): angular.IDirectiveFactory {
        return () => new DispatchMapDirective();
    }
}

app.directive("dispatchMap", DispatchMapDirective.factory());
