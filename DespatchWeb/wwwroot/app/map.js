let map;
let oms;
let renderingPoints = false;
let infoWindow = new google.maps.InfoWindow();

(() => {
    google.maps.Marker.prototype.jobNumber = "";
    google.maps.Marker.prototype.courierId = 0;
    google.maps.Marker.prototype.code = "";
    google.maps.Map.prototype.labels = [];
    google.maps.Map.prototype.flags = [];
    google.maps.Map.prototype.flightPaths = [];
    google.maps.Map.prototype.addLabel = function (label) {
        this.labels[this.labels.length] = label;
    };
    google.maps.Map.prototype.getLabels = function () {
        return this.labels;
    };
    google.maps.Map.prototype.clearLabels = function () {

        for (let i = 0; i < this.labels.length; i++) {
            this.labels[i].setMap(null);
        }

        this.labels.length = 0;
    };
    google.maps.Map.prototype.markers = [];
    google.maps.Map.prototype.addMarker = marker => {
        map.markers[map.markers.length] = marker;
    };
    google.maps.Map.prototype.getMarkers = () => map.markers;
    google.maps.Map.prototype.clearMarkers = () => {
        if (infoWindow) {
            infoWindow.close();
        }

        for (let i = 0; i < map.markers.length; i++) {
            google.maps.event.clearInstanceListeners(map.markers[i]);
            map.markers[i].setMap(null);
        }

        map.markers.length = 0;
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

function initialize() {
    console.log("Initialize Loaded");
    const newYork = new google.maps.LatLng(40.7128, -74.0060);
    const myOptions = {
        zoom: 10, mapTypeId: google.maps.MapTypeId.ROADMAP, center: newYork
    };

    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
    oms = new OverlappingMarkerSpiderfier(map, {
        markersWontMove: false,   // we promise not to move any markers, allowing optimizations
        markersWontHide: true,   // we promise not to change visibility of any markers, allowing optimizations
        basicFormatEvents: true  // allow the library to skip calculating advanced formatting information
    });

    google.maps.event.addListener(map, "rightclick", e => {
        console.log(e);
    });

    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
}

const currentDrag = null;

let isCtrl = false;
window.onkeydown = e => {
    isCtrl = e.keyIdentifier === 'Control' || e.ctrlKey === true;
};
window.onkeyup = e => {
    isCtrl = false;
};

function addClickHandler(marker, infoWindow) {
    if (!marker) {
        console.error('Invalid marker in addClickHandler');
        return;
    }

    if (infoWindow) {
        google.maps.event.addListener(marker, 'spider_click', () => {
            infoWindow.open(map, marker);

            if (marker.jobNumber) {
                console.log('Job Number:', marker.jobNumber);
                const $columns = angular.element(".columns");
                const scope = $columns.scope();

                if (scope && scope.jobList) {
                    const selectedJobs = scope.jobList.filter(x => x.jobNo === marker.jobNumber);
                    if (selectedJobs.length > 0) {
                        angular.element("#jobList tr").removeClass("active");
                        angular.element("#jobList tr[data-jobid='" + selectedJobs[0].id + "']").addClass("active");
                        scope.selectForDispatch(selectedJobs[0]);
                        scope.selectJob(selectedJobs[0], true);
                    }
                }
            }
        });

        if (window.oms) {
            window.oms.addMarker(marker);
        }
    } else {
        google.maps.event.addListener(marker, 'click', () => {
            if (marker.jobNumber) {
                console.log('Job Number:', marker.jobNumber);
            }
        });
    }
}


const delayFactor = 0;
let boundsSet = false;
let carPos = null;
const latPost = null;
let carMarker = null;

function setMapBounds() {
    boundsSet = true;
    const bounds = new google.maps.LatLngBounds();
    for (let i = 0; i < oms.getMarkers().length; i++) {
        bounds.extend(oms.getMarkers()[i].getPosition());
    }
    if (carPos !== null) {
        bounds.extend(carPos);
    }

    map.fitBounds(bounds);
}

/**
 * @param {Job} job
 */
function highlightPin(job) {
    console.log('finding ' + job.toLat.toString().substring(0, 9) + ',' + job.toLng.toString().substring(0, 9));

    const marker = map.markers.find(obj => {
        return obj.position.lat().toString().substring(0, 9) === job.toLat.toString().substring(0, 9) && obj.position.lng().toString().substring(0, 9) === job.toLng.toString().substring(0, 9);
    });
    if (marker === undefined) return;
    marker.icon = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_black.png", new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));
    marker.setAnimation(google.maps.Animation.BOUNCE);
    window.setTimeout(() => {
        if (marker.getAnimation() !== null) {
            marker.setAnimation(null);
        }
    }, 2000);
}

function displayDeliveryPoint(location) {
    // Validate location data
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
        console.error('Invalid location data:', location);
        return null;
    }

    try {
        // Create marker position
        const position = new google.maps.LatLng(location.latitude, location.longitude);

        // Determine pin color based on job status
        let pinColor = "red"; // default color
        if (location.jobStatus === "C") {
            pinColor = "grey";
        } else if (location.jobStatus === "V") {
            pinColor = "yellow";
        } else if (location.jobStatus === "D") {
            pinColor = "green";
        } else if (location.jobStatus === "P") {
            pinColor = "red";
        } else if (location.jobStatus === "A") {
            pinColor = "blue";
        }

        // Create marker image
        const pinImage = new google.maps.MarkerImage(
            `https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_${pinColor}${(location.runOrder || '').toString()}.png`,
            new google.maps.Size(131, 154),
            new google.maps.Point(0, 0),
            new google.maps.Point(10, 34)
        );

        // Create marker
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            icon: pinImage,
            visible: true,
            optimized: false,
            jobNumber: location.jobNo || '',
            title: location.jobNo || 'Delivery Point'
        });

        // Create info window content
        const contentString = `
            <div id="content">
                <div id="bodyContent">
                    <p><b>${location.jobNo || ''}</b></p>
                    <p><b>${location.type === 'pickup' ? 'Pickup' : 'Delivery'}</b></p>
                    ${location.status ? `<p><b>Status:</b> ${location.status}</p>` : ''}
                </div>
            </div>`;

        const infoWindow = new google.maps.InfoWindow({
            content: contentString,
            pixelOffset: new google.maps.Size(-55, 0)
        });

        // Add click handler and marker to management systems
        addClickHandler(marker, infoWindow);
        map.addMarker(marker);

        console.log('Marker created successfully at:', position.lat(), position.lng());

        return marker;
    } catch (error) {
        console.error('Error creating marker:', error);
        return null;
    }
}

function isValidCoordinate(coord) {
    return typeof coord === 'number' && !isNaN(coord) && coord !== 0;
}

function getValidCoordinates(location) {
    const lat = location?.latitude;
    const lng = location?.longitude;

    if (isValidCoordinate(lat) && isValidCoordinate(lng)) {
        return {lat, lng};
    }
    return null;
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
    if (map.markers.length) {
        map.clearMarkers();
    }
    const gl1 = new google.maps.LatLng(lat, lng);
    carPos = gl1;

    if (carMarker !== null) {
        carMarker.setMap(null);
    }
    carMarker = new google.maps.Marker({
        position: gl1, map: map, icon: "/images/car3.png"
    });

    map.setCenter(gl1);
    map.setZoom(13);
}

/**
 * @param {*} ac
 * @param {string} courierCode
 * @param {*[]} channels
 * @param {boolean} truckChannel
 * @param {string} truckMode
 * @param {boolean} includeUA
 */
function displayAvailableCouriers(ac, courierCode, channels, truckChannel, truckMode, includeUA) {
    map.clearLabels();
    map.clearFlags();
    $.each(ac, (i, c) => {
        if (!includeUA && c.fleetCode === "UA") {
            return true;
        }
        let col = "#00FF00";  // Bright green for active couriers
        let className = "courier courierActive courierMarker";
        if (c.totalJobs === 0) {
            col = "#FFFF00";  // Yellow for couriers with no jobs
            className = "courier courierIdle courierMarker";
        } else if (c.overDueJobs > 0) {
            col = "#FF0000";  // Bright red for couriers with overdue jobs
            className = "courier courierOverdue courierMarker";
        } else if (c.status === "inactive" || c.status === "off-duty") {
            col = "#000000";  // Black for inactive or off-duty couriers
            className = "courier courierInactive courierMarker";
        }

        const ll = new google.maps.LatLng(c.latitude, c.longitude);
        if (ll.lat() !== null && ll.lng() !== null && c.code !== courierCode && (channels.length === 0 || channels.includes(c.channelID)) && (truckChannel === false || c.vehicleType === "T")) {
            if ((truckChannel === false && truckMode === "Off" && c.vehicleType === "T") || (truckChannel === false && truckMode === "Only" && c.vehicleType !== "T")) {
                return true;
            } else {
                console.log(`Drawing item for courier: ${c.code}, ID: ${c.courierID}`);
                drawItem(col, ll, `${c.code}-${c.vehicleType}${c.totalJobs}`, c.courierID, c.code, className);
            }
        }
    });
}

/**
 * @param {Job[]} jobs
 * @param {boolean} clear
 */
function displayPickupPoints(jobs, clear) {
    if (clear === true) {
        if (map.markers.length) {
            map.clearMarkers();
        }

        oms.removeAllMarkers();
        if (carMarker !== null) {
            carMarker.setMap(null);
        }
    }

    for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];

        // Create location object for pickup point
        const pickupLocation = {
            latitude: job.pickupAddress.latitude,
            longitude: job.pickupAddress.longitude,
            jobStatus: job.status,
            jobNo: job.jobNo,
            runOrder: job.runOrder || "",
            type: "pickup"
        };

        // Create location object for delivery point
        const deliveryLocation = {
            latitude: job.deliveryAddress.latitude,
            longitude: job.deliveryAddress.longitude,
            jobStatus: job.status,
            jobNo: job.jobNo,
            runOrder: job.runOrder || "",
            type: "delivery"
        };

        // Only show pickup marker if statusID < 5
        if (job.statusID < 5) {
            displayDeliveryPoint(pickupLocation);
        }

        // Always show delivery marker
        displayDeliveryPoint(deliveryLocation);
    }
}

/**
 * @param {Job[]} courierJobs
 */
function highlightJobPoints(courierJobs) {
    for (let i = 0; i < courierJobs.length; i++) {
        const job = courierJobs[i];
        console.log('finding ' + job.jobNo);

        const marker = oms.getMarkers().find(obj => {
            return obj.jobNumber === job.jobNo;
        });
        if (marker === undefined) return;

        marker.setAnimation(google.maps.Animation.BOUNCE);
        window.setTimeout(() => {
            if (marker.getAnimation() !== null) {
                marker.setAnimation(null);
            }
        }, 2000);
    }
}

/**
 * @param {Job[]} courierJobs
 * @param {boolean} clear
 */
function displayRoutePointsOnly(courierJobs, clear) {
    if (clear === true) {
        if (map.markers.length) {
            map.clearMarkers();
        }
        oms.removeAllMarkers();
        if (carMarker !== null) {
            carMarker.setMap(null);
        }
    }

    for (let i = 0; i < courierJobs.length; i++) {
        const job = courierJobs[i];

        // Create location object for pickup point
        const pickupLocation = {
            latitude: job.pickupAddress.latitude,
            longitude: job.pickupAddress.longitude,
            jobStatus: job.status,
            jobNo: job.jobNo,
            runOrder: job.runOrder || "",
            type: "pickup"
        };

        // Create location object for delivery point
        const deliveryLocation = {
            latitude: job.deliveryAddress.latitude,
            longitude: job.deliveryAddress.longitude,
            jobStatus: job.status,
            jobNo: job.jobNo,
            runOrder: job.runOrder || "",
            type: "delivery"
        };

        // Only show pickup marker if statusID < 5
        if (job.statusID < 5) {
            displayDeliveryPoint(pickupLocation);
        }

        // Always show delivery marker
        displayDeliveryPoint(deliveryLocation);
    }
}
/**
 * @param {Job[]} courierJobs
 * @param {boolean} clear
 * @param {boolean} zoom
 */
function displayRoutePoints(courierJobs, clear, zoom) {
    if (clear === true) {
        if (map.markers.length) {
            map.clearMarkers();
        }

        oms.removeAllMarkers();
        if (carMarker !== null) {
            carMarker.setMap(null);
        }
    }

    const zoomMarkers = [];

    for (let i = 0; i < courierJobs.length; i++) {
        const job = courierJobs[i];

        // Create location object for pickup point
        const pickupLocation = {
            latitude: job.pickupAddress.latitude,
            longitude: job.pickupAddress.longitude,
            jobStatus: job.status,
            jobNo: job.jobNo,
            runOrder: job.runOrder || "",
            type: "pickup"
        };

        // Create location object for delivery point
        const deliveryLocation = {
            latitude: job.deliveryAddress.latitude,
            longitude: job.deliveryAddress.longitude,
            jobStatus: job.status,
            jobNo: job.jobNo,
            runOrder: job.runOrder || "",
            type: "delivery"
        };

        // Only show pickup marker if statusID < 5
        if (job.statusID < 5) {
            const pickupMarker = displayDeliveryPoint(pickupLocation);
            if (pickupMarker) {
                zoomMarkers.push(pickupMarker);
            }
        }

        // Always show delivery marker
        const deliveryMarker = displayDeliveryPoint(deliveryLocation);
        if (deliveryMarker) {
            zoomMarkers.push(deliveryMarker);
        }
    }

    // Handle map bounds and zoom
    if (zoomMarkers.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        zoomMarkers.forEach(marker => {
            bounds.extend(marker.getPosition());
        });

        if (zoom) {
            map.fitBounds(bounds);
        } else {
            map.panToBounds(bounds);
        }
    }

    // Add courier marker if available
    if (courierJobs.length > 0 && courierJobs[0].courierLatitude && courierJobs[0].courierLongitude) {
        const gl1 = new google.maps.LatLng(courierJobs[0].courierLatitude, courierJobs[0].courierLongitude);
        carPos = gl1;

        if (carMarker !== null) {
            carMarker.setMap(null);
        }

        carMarker = new google.maps.Marker({
            position: gl1,
            map: map,
            icon: "/images/car3.png",
            code: courierJobs[0].courierData.courier,
            courierId: courierJobs[0].courierData.courierID
        });

        map.setCenter(gl1);
        if (zoom) {
            map.setZoom(13);
        }
    }
}

/**
 * @param {string} col
 * @param {google.maps.LatLng} ll
 * @param {string} code
 * @param id
 * @param originalCode
 */
function drawItem(col, ll, code, id, originalCode) {
    const flagIcon = {
        url: createFlagSVG(col, code),
        scaledSize: new google.maps.Size(40, 35),
        anchor: new google.maps.Point(0, 35),
    };

    const marker = new google.maps.Marker({
        position: ll,
        map: map,
        icon: flagIcon,
        title: originalCode,
        courierId: id,
        code: originalCode
    });

    map.addFlag(marker);

    google.maps.event.addListener(marker, 'click', function () {
        try {
            const $columns = angular.element(".columns");
            const scope = $columns.scope();

            if (!scope || typeof scope.pickCouriers === 'undefined') {
                console.error('Unable to access scope or pickCouriers');
                return;
            }

            const courier = scope.pickCouriers.find(x => x.courierID === this.courierId);

            if (!courier) {
                console.warn(`No courier found with ID ${this.courierId}`);
                return;
            }

            if (typeof scope.selectMapCourier !== 'function') {
                console.error('selectMapCourier is not a function');
                return;
            }

            scope.selectMapCourier(courier);

            // Force a digest cycle to ensure the UI updates
            if (scope.$apply && !scope.$$phase) {
                scope.$apply();
            }
        } catch (error) {
            console.error('Error in flag click event:', error);
        }
    });
}

/**
 * @param {string} color
 * @param {string} text
 */
function createFlagSVG(color, text) {
    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 100">
      <rect x="0" y="0" width="3" height="100" fill="#333"/>
      <path d="M3,5 L113,5 L108,32.5 L113,60 L3,60 Z" fill="${color}"/>
      <text x="58" y="32.5" font-family="Arial, sans-serif" font-size="30" font-weight="bold" 
            fill="${getContrastColor(color)}" text-anchor="middle" dominant-baseline="middle">
        ${text}
      </text>
    </svg>`;
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

/**
 * @param {string} hexColor
 */
function getContrastColor(hexColor) {
    // For yellow backgrounds, always use black text
    if (hexColor === "#FFFF00") return "black";

    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}

function pad(stringToPad, length = 0, paddingChar = ' ', direction = 2) {
    if (length + 1 >= stringToPad.length) {
        stringToPad += Array(length + 1 - stringToPad.length).join(paddingChar);
    }
    return stringToPad;
}


function refreshCourierLocation(returnData) {
    if (returnData !== null && !renderingPoints) {
        const gl1 = new google.maps.LatLng(returnData.latitude, returnData.longitude);
        carPos = gl1;

        if (carMarker !== null) {
            carMarker.setMap(null);
        }
        carMarker = new google.maps.Marker({
            position: gl1, map: map, icon: "/images/car3.png"
        });

        lastPos = gl1;
    }
}

function computeTotalDistance(result) {
    const myRoute = result.routes[0];
    const totalData = calculateTotalDistAndTime(myRoute);
    updateRunDetailsWithAngular(totalData);
}

function calculateTotalDistAndTime(route) {
    let totalDist = 0;
    let totalTime = 0;
    const newOrder = [];

    for (let i = 0; i < route.legs.length; i++) {
        totalDist += route.legs[i].distance.value;
        totalTime += route.legs[i].duration.value;
        newOrder.push({
            "lat": route.legs[i].end_location.lat(),
            "lng": route.legs[i].end_location.lng()
        });
    }

    totalDist = totalDist / 1000;
    totalTime = (totalTime / 60).toFixed(0);

    return {totalDist, totalTime, legCount: route.legs.length, newOrder};
}

function updateRunDetailsWithAngular(totalData) {
    angular.element(".columns").scope().updateRunDetails(
        totalData.totalTime,
        Math.round(totalData.totalDist),
        totalData.legCount,
        totalData.newOrder
    );
}

/**
 * @param {Job} job
 */
function validateGoogleJobRoute(job) {
    const origin = new google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude);
    const dest = new google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude);
    const request = {
        origin: origin, destination: dest, travelMode: google.maps.DirectionsTravelMode.DRIVING
    };

    directionsService.route(request, (response, status) => {
        if (status === google.maps.DirectionsStatus.NOT_FOUND || status === google.maps.DirectionsStatus.ZERO_RESULTS) {
            angular.element("#box-map").find(".loading").fadeOut();
            alert("Job " + job.jobNumber + " Could not Route!");
            angular.element(".columns").scope().selectJobFromMap(job.deliveryAddress.latitude, job.deliveryAddress.longitude);

        }
    });
}

function validateGoogleRoute(run) {
    const origin = new google.maps.LatLng(run[0].fromLat, run[0].fromLng);
    const wayPoints = [];

    for (let i = 0; i < run.length; i++) {
        const to = new google.maps.LatLng(run[i].toLat, run[i].toLng);
        wayPoints.push({
            location: to, stopover: true
        });

    }

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
            for (let i = 0; i < run.length; i++) {
                validateGoogleJobRoute(run[i]);
            }
        }
    });
}

console.log('initialize map starting!');
initialize();
console.log('initialize map finishedst!');
