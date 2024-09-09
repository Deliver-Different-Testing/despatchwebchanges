// Global variables
let map, oms, infoWindow, carMarker, carPos;
const renderingPoints = false;

// Initialize map
function initMap() {
    console.log("initMap called");
    initializeMap().then(() => {
        console.log("Map initialized from initMap callback");
    }).catch(error => {
        console.error("Error initializing map from initMap callback:", error);
    });
}

function initializeMap() {
    return new Promise((resolve, reject) => {
        console.log("Attempting to initialize map...");
        const mapDiv = document.getElementById("map_canvas");
        if (!mapDiv) {
            console.error("Map container #map_canvas not found in the DOM");
            reject(new Error("Map container not found"));
            return;
        }

        console.log("Map container found. Dimensions:", mapDiv.offsetWidth, "x", mapDiv.offsetHeight);

        try {
            console.log("Creating map instance...");
            const auckland = new google.maps.LatLng(-36.8804466, 174.6117981);
            const myOptions = {
                zoom: 10, mapTypeId: google.maps.MapTypeId.ROADMAP, center: auckland
            };

            map = new google.maps.Map(mapDiv, myOptions);
            console.log("Map instance created successfully");

            oms = new OverlappingMarkerSpiderfier(map, {
                markersWontMove: false, markersWontHide: true, basicFormatEvents: true
            });

            infoWindow = new google.maps.InfoWindow();

            google.maps.event.addListener(map, "rightclick", (e) => console.log(e));

            const trafficLayer = new google.maps.TrafficLayer();
            trafficLayer.setMap(map);

            resolve(map);
        } catch (error) {
            console.error("Error during map initialization:", error);
            reject(error);
        }
    });
}

(() => {
    google.maps.Marker.prototype.jobNumber = "";
    google.maps.Marker.prototype.courierId = 0;
    google.maps.Marker.prototype.code = "";

    google.maps.Map.prototype.labels = [];
    google.maps.Map.prototype.flags = [];
    google.maps.Map.prototype.flightPaths = [];
    google.maps.Map.prototype.markers = [];

    google.maps.Map.prototype.addLabel = function (label) {
        this.labels.push(label);
    };

    google.maps.Map.prototype.getLabels = function () {
        return this.labels;
    };

    google.maps.Map.prototype.clearLabels = function () {
        this.labels.forEach(label => label.setMap(null));
        this.labels = [];
    };

    google.maps.Map.prototype.addMarker = function (marker) {
        this.markers.push(marker);
    };

    google.maps.Map.prototype.getMarkers = function () {
        return this.markers;
    };

    google.maps.Map.prototype.clearMarkers = function () {
        if (infoWindow) {
            infoWindow.close();
        }
        this.markers.forEach(marker => {
            google.maps.event.clearInstanceListeners(marker);
            marker.setMap(null);
        });
        this.markers = [];
    };

    google.maps.Map.prototype.addFlag = flag => {
        map.flags[map.flags.length] = flag;
    };
    google.maps.Map.prototype.getFlags = () => map.flags;
    google.maps.Map.prototype.clearFlags = () => {
        if (infoWindow) {
            infoWindow.close();
        }

        for (let i = 0; i < map.flags.length; i++) {
            google.maps.event.clearInstanceListeners(map.flags[i]);
            map.flags[i].setMap(null);
        }

        map.flags.length = 0;
    };

    google.maps.Map.prototype.addFlightPath = flightPath => {
        map.flightPaths[map.flightPaths.length] = flightPath;
    };
    google.maps.Map.prototype.getFlightPaths = () => map.flightPaths;
    google.maps.Map.prototype.clearFlightPaths = () => {

        for (let i = 0; i < map.flightPaths.length; i++) {
            map.flightPaths[i].setMap(null);
        }

        map.flightPaths.length = 0;
    };
})();

/**
 * @param {*} marker
 * @param {google.maps.InfoWindow} infoWindow
 */
function addClickHandler(marker, infoWindow) {
    map.addMarker(marker);
    if (infoWindow) {
        google.maps.event.addListener(marker, 'spider_click', (e) => {
            infoWindow.open(map, marker);
            console.log(marker.jobNumber || '');
            const scope = angular.element(".columns").scope();
            const selectedJob = scope.jobList.find(x => x.jobNo === marker.jobNumber);
            if (selectedJob) {
                angular.element("#jobList tr").removeClass("active");
                angular.element("#jobList tr[data-jobid='" + selectedJob.id + "']").addClass("active");
                scope.selectForDispatch(selectedJob);
                scope.selectJob(selectedJob, true);
            }
        });
        oms.addMarker(marker);
    } else {
        google.maps.event.addListener(marker, 'click', () => {
            console.log(marker.jobNumber || '');
        });
    }
}

function displayDeliveryPoint(location) {
    let pinColor = "red";
    if (run[i].jobStatus === "C") {
        pinColor = "grey";
    }
    if (run[i].jobStatus === "V") {
        pinColor = "yellow";
    }

    const pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (run[i].ro || '').toString() + ".png", new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));
    const marker = new google.maps.Marker({
        position: run[i], map: map, icon: pinImage
    });
}

function displayAllRoutePoints() {
    if (map.markers.length) {
        map.clearMarkers();
    }
    const run = angular.element(".columns").scope().allRuns;


    for (let i = 0; i < run.length; i++) {
        let pinColor = "red";
        if (run[i].jobStatus === "C") {
            pinColor = "grey";
        }
        if (run[i].jobStatus === "V") {
            pinColor = "yellow";
        }

        const pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (run[i].ro || '').toString() + ".png", new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));
        const marker = new google.maps.Marker({
            position: run[i], map: map, icon: pinImage
        });

        if (run[i].jobStatus === "C") {
            const contentString = '<div id="content">' + '<div id="bodyContent">' + '<p><b>Received By: </b>' + run[i].rb + '</p>' + '<p><b>Received Time: </b>' + moment(run[i].rt).format('hh:mm a') + '</p>' + '</div>' + '</div>';

            const infoWindow = new google.maps.InfoWindow({
                content: contentString, pixelOffset: new google.maps.Size(-55, 0)
            });

            addClickHandler(marker, infoWindow);
        } else {
            addClickHandler(marker);
        }
    }
}

/**
 * @param {number} lat
 * @param {number} lng
 */
function displayCourierPositionOnly(lat, lng) {
    map.clearMarkers();
    const position = new google.maps.LatLng(lat, lng);
    carPos = position;

    if (carMarker) {
        carMarker.setMap(null);
    }
    carMarker = new google.maps.Marker({
        position: position, map: map, icon: "/images/car3.png"
    });

    map.setCenter(position);
    map.setZoom(13);
}

function displayAvailableCouriers(availableCouriers, courierCode, channels, truckChannel, truckMode, includeUA) {
    map.clearLabels();
    map.clearFlags();

    availableCouriers.forEach(courier => {
        if (!includeUA && courier.fleetCode === "UA") {
            return;
        }

        const {color, className} = getCourierStyle(courier);
        const position = new google.maps.LatLng(courier.latitude, courier.longitude);

        if (isCourierEligible(courier, courierCode, channels, truckChannel, truckMode)) {
            drawItem(color, position, formatCourierCode(courier), courier.courierID, courier.code, className);
        }
    });
}

/**
 * @param {Job[]} jobs
 * @param {boolean} clear
 * @param {Job|null} currentJob
 */
function displayPickupPoints(jobs, clear, currentJob) {
    if (!map) {
        console.error('Map is not initialized');
        return;
    }

    if (clear) {
        map.clearMarkers();
        if (oms) {
            oms.removeAllMarkers();
        }
        if (carMarker) {
            carMarker.setMap(null);
        }
    }

    jobs.forEach(job => {
        const pinColor = getPinColor(job.status, job === currentJob);
        const pinImage = createPinImage(pinColor, job.runOrder);

        if (job.statusID < 5) {
            const pickupMarker = createMarker(job.pickUpLatitude, job.pickUpLongitude, pinImage, job.jobNo);
            const infoWindow = createInfoWindow(job.jobNo, "Pickup");
            addClickHandler(pickupMarker, infoWindow);
        }
    });
}

/**
 * @param {Job[]} courierJobs
 * @param {boolean} clear
 * @param {boolean} zoom
 */
function displayRoutePoints(courierJobs, clear, zoom) {
    if (clear) {
        map.clearMarkers();
        oms.removeAllMarkers();
        if (carMarker) {
            carMarker.setMap(null);
        }
    }

    const zoomMarkers = [];

    courierJobs.forEach(job => {
        const pinColor = getPinColor(job.status);
        const pinImage = createPinImage(pinColor, job.runOrder);
        const deliveryPinImage = createPinImage("red", job.runOrder);

        if (job.statusID < 5) {
            const pickupMarker = createMarker(job.pickUpLatitude, job.pickUpLongitude, pinImage, job.jobNo);
            const infoWindow = createInfoWindow(job.jobNo, "Pickup");
            addClickHandler(pickupMarker, infoWindow);
            zoomMarkers.push(pickupMarker);
        }

        const deliveryMarker = createMarker(job.deliveryLatitude, job.deliveryLongitude, deliveryPinImage, job.jobNo);
        const deliveryInfoWindow = createInfoWindow(job.jobNo, "Delivery");
        addClickHandler(deliveryMarker, deliveryInfoWindow);
        zoomMarkers.push(deliveryMarker);
    });

    if (zoomMarkers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        zoomMarkers.forEach(marker => bounds.extend(marker.getPosition()));

        if (zoom) {
            map.fitBounds(bounds);
        } else {
            map.panToBounds(bounds);
        }

        zoomMarkers.forEach(marker => marker.setAnimation(google.maps.Animation.BOUNCE));
        setTimeout(() => zoomMarkers.forEach(marker => marker.setAnimation(null)), 2000);
    }

    if (courierJobs.length > 0 && courierJobs[0].courierLatitude && courierJobs[0].courierLatitude !== 0) {
        const courierPosition = new google.maps.LatLng(courierJobs[0].courierLatitude, courierJobs[0].courierLongitude);
        carPos = courierPosition;

        if (carMarker) {
            carMarker.setMap(null);
        }
        carMarker = new google.maps.Marker({
            position: courierPosition,
            map: map,
            icon: "/images/car3.png",
            code: courierJobs[0].courierData.courier,
            courierId: courierJobs[0].courierData.courierID
        });

        map.setCenter(courierPosition);
        if (zoom) {
            map.setZoom(13);
        }
    }
}

function refreshCourierLocation(returnData) {
    if (returnData && !renderingPoints) {
        const courierPosition = new google.maps.LatLng(returnData.latitude, returnData.longitude);
        carPos = courierPosition;

        if (carMarker) {
            carMarker.setMap(null);
        }
        carMarker = new google.maps.Marker({
            position: courierPosition, map: map, icon: "/images/car3.png"
        });

        var lastPos = courierPosition;
    }
}

function computeTotalDistance(result) {
    const myRoute = result.routes[0];
    const totalDist = myRoute.legs.reduce((acc, leg) => acc + leg.distance.value, 0) / 1000;
    const totalTime = myRoute.legs.reduce((acc, leg) => acc + leg.duration.value, 0);
    const newOrder = myRoute.legs.map(leg => ({
        lat: leg.end_location.lat(), lng: leg.end_location.lng()
    }));

    const scope = angular.element(".columns").scope();
    scope.updateRunDetails(totalTime, Math.round(totalDist), myRoute.legs.length, newOrder);
}

function validateGoogleJobRoute(job) {
    const origin = new google.maps.LatLng(job.fromLat, job.fromLng);
    const dest = new google.maps.LatLng(job.toLat, job.toLng);
    const request = {
        origin: origin, destination: dest, travelMode: google.maps.DirectionsTravelMode.DRIVING
    };

    directionsService.route(request, (response, status) => {
        if (status === google.maps.DirectionsStatus.NOT_FOUND || status === google.maps.DirectionsStatus.ZERO_RESULTS) {
            angular.element("#box-map").find(".loading").fadeOut();
            alert(`Job ${job.jobNumber} Could not Route!`);
            const scope = angular.element(".columns").scope();
            scope.selectJobFromMap(job.toLat, job.toLng);
        }
    });
}

function validateGoogleRoute(run) {
    const origin = new google.maps.LatLng(run[0].fromLat, run[0].fromLng);
    const wayPoints = run.map(point => ({
        location: new google.maps.LatLng(point.toLat, point.toLng), stopover: true
    }));

    const request = {
        origin: origin,
        destination: origin,
        waypoints: wayPoints,
        optimizeWaypoints: true,
        travelMode: google.maps.DirectionsTravelMode.DRIVING
    };

    directionsService.route(request, (response, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
            angular.element("#box-map").find(".loading").fadeOut();
            alert("Run OK!");
        }
        if (status === google.maps.DirectionsStatus.NOT_FOUND || status === google.maps.DirectionsStatus.ZERO_RESULTS) {
            run.forEach(validateGoogleJobRoute);
        }
    });
}

// Helper functions

/**
 * @param {number} status
 * @param {boolean} isCurrentJob
 */
function getPinColor(status, isCurrentJob = false) {
    if (isCurrentJob) return "black";
    const statusColors = {
        "C": "grey", "N": "grey", "D": "green", "P": "red", "A": "blue", "V": "yellow"
    };
    return statusColors[status] || "purple";
}

/**
 * @param {string} color
 * @param {string} runOrder
 */
function createPinImage(color, runOrder = "") {
    return new google.maps.MarkerImage(`https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_${color}${runOrder}.png`, new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {*} icon
 * @param {string} jobNumber
 */
function createMarker(lat, lng, icon, jobNumber) {
    return new google.maps.Marker({
        position: new google.maps.LatLng(lat, lng), map: map, icon: icon, jobNumber: jobNumber
    });
}

/**
 * @param {string} jobNo
 * @param {string} type
 */
function createInfoWindow(jobNo, type) {
    const content = `<div id="content"><div id="bodyContent"><p><b>${jobNo}</b></p><p><b>${type}</b></p></div></div>`;
    return new google.maps.InfoWindow({
        content: content, pixelOffset: new google.maps.Size(-55, 0)
    });
}

/**
 * @param {Courier} courier
 */
function getCourierStyle(courier) {
    if (courier.totalJobs === 0) {
        return {color: "#FFFDD0", className: "courier courierCream courierMarker"};
    } else if (courier.overDueJobs > 0) {
        return {color: "#FF0000", className: "courier courierRed courierMarker"};
    }
    return {color: "#00FF00", className: "courier courierMarker"};
}

/**
 * @param {Courier} courier
 * @param {string} courierCode
 * @param channels
 * @param {boolean} truckChannel
 * @param truckMode
 */
function isCourierEligible(courier, courierCode, channels, truckChannel, truckMode) {
    if (courier.latitude === null || courier.longitude === null || courier.code === courierCode) {
        return false;
    }
    if (channels.length > 0 && !channels.includes(courier.channelID)) {
        return false;
    }
    if (truckChannel && courier.vehicleType !== "T") {
        return false;
    }
    if (!truckChannel && truckMode === "Off" && courier.vehicleType === "T") {
        return false;
    }

    return !(!truckChannel && truckMode === "Only" && courier.vehicleType !== "T");
}

/**
 * @param {Courier} courier
 */
function formatCourierCode(courier) {
    return pad(`${courier.code}-${courier.vehicleType}${courier.totalJobs}`, 5, '_', 2);
}

/**
 * @param {string} str
 * @param {number} len
 * @param {string} pad
 * @param {number} dir
 */
function pad(str, len, pad, dir) {
    len = len || 0;
    pad = pad || ' ';
    dir = dir || 2;

    if (len + 1 >= str.length) {
        str = str + Array(len + 1 - str.length).join(pad);
    }

    return str;
}

/**
 * @param {string} color
 * @param {google.maps.LatLng} position
 * @param {string} code
 * @param {string} className
 */
function drawItem(color, position, code, id, originalCode, className) {
    const label = new Label({
        map: map, color: color, isVisible: true, cssClass: className
    });

    const marker = new google.maps.Marker({
        position: position,
        draggable: false,
        map: map,
        title: code,
        visible: true,
        display: code,
        courierId: id,
        code: originalCode,
        icon: '/images/flagpole.png'
    });

    label.bindTo('position', marker, 'position');
    label.bindTo('text', marker, 'display');
    label.bindTo('zIndex', marker);

    map.addFlag(marker);
    map.addLabel(label);

    google.maps.event.addListener(marker, 'click', () => {
        const scope = angular.element(".columns").scope();
        const courier = scope.pickCouriers.find(x => x.courierID === this.courierId);
        scope.selectMapCourier(courier);
    });
}

/**
 * @param {Job} job
 */
function highlightPin(job) {
    const pinLatitude = job.toLat.toString().substring(0, 9);
    const pinLongitude = job.toLng.toString().substring(0, 9);
    console.log(`finding ${pinLatitude},${pinLongitude}`);

    const marker = map.markers.find(obj => obj.position.lat().toString().substring(0, 9) === pinLatitude && obj.position.lng().toString().substring(0, 9) === pinLongitude);

    if (!marker) return;

    const pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_black.png", new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));
    marker.setIcon(pinImage);
    marker.setAnimation(google.maps.Animation.BOUNCE);
    setTimeout(() => marker.setAnimation(null), 2000);
}

/**
 * @param {Job} courierJobs
 */
function highlightJobPoints(courierJobs) {
    courierJobs.forEach(job => {
        console.log(`finding ${job.jobNo}`);
        const marker = oms.getMarkers().find(obj => obj.jobNumber === job.jobNo);
        if (marker) {
            marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => marker.setAnimation(null), 2000);
        }
    });
}

function setMapBounds() {
    const bounds = new google.maps.LatLngBounds();
    oms.getMarkers().forEach(marker => bounds.extend(marker.getPosition()));
    if (carPos) {
        bounds.extend(carPos);
    }
    map.fitBounds(bounds);
}

// Event listeners and initialization
let isCtrl = false;

window.onkeydown = (e) => {
    isCtrl = e.keyIdentifier === 'Control' || e.ctrlKey === true;
};

window.onkeyup = () => {
    isCtrl = false;
};

// Use it like this:
initializeMap().then(() => {
    // map is now initialized and ready to use
    console.log('Map initialized successfully');
}).catch(error => {
    console.error('Failed to initialize map:', error);
});
