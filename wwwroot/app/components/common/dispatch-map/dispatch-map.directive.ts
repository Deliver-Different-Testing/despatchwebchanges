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
        this.createMarkerIcon = this.createMarkerIcon.bind(this);
        this.setupMarkerIcons = this.setupMarkerIcons.bind(this);
        this.setupWatchers = this.setupWatchers.bind(this);
        this.updateDisplayedJobs = this.updateDisplayedJobs.bind(this);
        this.updateCourierMarkers = this.updateCourierMarkers.bind(this);
        this.addPickupMarker = this.addPickupMarker.bind(this);
        this.addDeliveryMarker = this.addDeliveryMarker.bind(this);
        this.setupMarkerListeners = this.setupMarkerListeners.bind(this);
        this.addCourierMarker = this.addCourierMarker.bind(this);
        this.clearJobMarkers = this.clearJobMarkers.bind(this);
        this.clearCourierMarkers = this.clearCourierMarkers.bind(this);
        this.fitMapToMarkers = this.fitMapToMarkers.bind(this);
        this.isValidCoordinates = this.isValidCoordinates.bind(this);
    }

    $onInit() {
        this.configService.getGoogleMapsKey()
            .then((apiKey: string) => {
                this.$scope.googleMapsUrl = `https://maps.google.com/maps/api/js?key=${apiKey}&libraries=places`;
                this.$scope.$apply();

                return this.NgMap.getMap();
            })
            .then((map) => {
                this.setupMarkerIcons();

                this.mapInstance = map;
                this.$scope.map = map;
                this.$scope.tooltip = new this.$window.google.maps.InfoWindow({
                    disableAutoPan: true
                });

                this.setupWatchers();

                if (this.$scope.jobs || this.$scope.currentJob) {
                    return this.updateDisplayedJobs();
                }
            })
            .catch((error) => {
                console.error("Error initializing map:", error);
            });
    }

    private createMarkerIcon(color: string, isHovered: boolean = false): google.maps.Symbol {
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

    private setupMarkerIcons() {
        this.PICKUP_ICON = this.createMarkerIcon("#4CAF50");
        this.DELIVERY_ICON = this.createMarkerIcon("#F44336");
        this.COURIER_ICON = this.createMarkerIcon("#2196F3");
        this.PICKUP_ICON_HOVER = this.createMarkerIcon("#4CAF50", true);
        this.DELIVERY_ICON_HOVER = this.createMarkerIcon("#F44336", true);
    }

    private setupWatchers() {
        this.$scope.$watch("mapCenter", (newCenter: google.maps.LatLng | google.maps.LatLngLiteral) => {
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

        this.$scope.$watchCollection("courierPositions", (newPositions: Courier[]) => {
            if (newPositions && this.mapInstance) {
                this.updateCourierMarkers(newPositions);
            }
        });

        this.$scope.$watchCollection("jobs", async () => {
            if (this.mapInstance) {
                await this.updateDisplayedJobs();
            }
        });
    }

    private async updateDisplayedJobs() {
        if (this.isUpdating) return;
        this.isUpdating = true;

        try {
            this.clearJobMarkers();

            if (this.$scope.currentJob) {
                if (this.isValidCoordinates(
                    this.$scope.currentJob.pickupAddress?.latitude,
                    this.$scope.currentJob.pickupAddress?.longitude
                )) {
                    this.addPickupMarker(this.$scope.currentJob);
                }
                if (this.isValidCoordinates(
                    this.$scope.currentJob.deliveryAddress?.latitude,
                    this.$scope.currentJob.deliveryAddress?.longitude
                )) {
                    this.addDeliveryMarker(this.$scope.currentJob);
                }
            } else if (this.$scope.jobs?.length) {
                this.$scope.jobs.forEach((job: any) => {
                    if (this.isValidCoordinates(
                        job.pickupAddress?.latitude,
                        job.pickupAddress?.longitude
                    )) {
                        this.addPickupMarker(job);
                    }
                    if (this.isValidCoordinates(
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

    private updateCourierMarkers(couriers: Courier[]) {
        if (!couriers || !this.$scope.showAvailableCouriers) return;
        this.clearCourierMarkers();

        couriers.forEach((courier: any) => {
            if (this.isValidCoordinates(courier.latitude, courier.longitude)) {
                this.addCourierMarker(courier);
            }
        });
    }

    private addPickupMarker(job: Job) {
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

        this.setupMarkerListeners(marker, job, this.PICKUP_ICON!, this.PICKUP_ICON_HOVER!, "Pickup");
        this.$scope.markers.push(marker);
    }

    private addDeliveryMarker(job: Job) {
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

        this.setupMarkerListeners(marker, job, this.DELIVERY_ICON!, this.DELIVERY_ICON_HOVER!, "Delivery");
        this.$scope.markers.push(marker);
    }

    private setupMarkerListeners(marker: google.maps.Marker, job: any, normalIcon: google.maps.Symbol, hoverIcon: google.maps.Symbol, locationType: string) {
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

    private addCourierMarker(courier: Courier) {
        const position = new this.$window.google.maps.LatLng(courier.latitude, courier.longitude);

        const marker = new this.$window.google.maps.Marker({
            position: position,
            map: this.mapInstance,
            icon: this.COURIER_ICON,
            title: `Courier ${courier.code || courier.name}`
        });

        this.$scope.markers.push(marker);
    }

    private clearJobMarkers() {
        this.$scope.markers.forEach((marker: google.maps.Marker) => marker.setMap(null));
        this.$scope.markers = [];
    }

    private clearCourierMarkers() {
        this.$scope.flags.forEach((flag: any) => flag.setMap(null));
        this.$scope.flags = [];
        this.$scope.labels.forEach((label: any) => label.setMap(null));
        this.$scope.labels = [];
    }

    private fitMapToMarkers() {
        if (this.$scope.markers.length === 0) return;

        const bounds = new this.$window.google.maps.LatLngBounds();
        this.$scope.markers.forEach((marker: google.maps.Marker) => bounds.extend(marker.getPosition() as google.maps.LatLng));
        this.mapInstance!.fitBounds(bounds);

        const zoom = this.mapInstance!.getZoom();
        if (zoom && zoom > 16) {
            this.mapInstance!.setZoom(16);
        }
    }

    private isValidCoordinates(lat?: number, lng?: number): boolean {
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
            showAvailableCouriers: '<'
        };
        this.controller = DispatchMapController;
    }

    static factory(): angular.IDirectiveFactory {
        return () => new DispatchMapDirective();
    }
}

app.directive("dispatchMap", DispatchMapDirective.factory());
