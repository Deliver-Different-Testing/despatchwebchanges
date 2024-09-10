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
    const auckland = new google.maps.LatLng(-36.8804466, 174.6117981);
    const myOptions = {
        zoom: 10, mapTypeId: google.maps.MapTypeId.ROADMAP, center: auckland
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

    google.maps.event.addListenerOnce(map, 'idle', () => {
        loadInitialData();
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

function addClickHandler(m, iw) {
    if (iw !== null) {
        google.maps.event.addListener(m, 'spider_click', e => {  // 'spider_click', not plain 'click'
            iw.open(map, m);
            console.log(m.jobNumber || '');
            const $columns = $(".columns");
            const sel = $columns.scope().jobList.filter(x => x.jobNo === m.jobNumber);
            if (sel.length > 0) {
                $("#jobList tr").removeClass("active");
                $("#jobList tr[data-jobid='" + sel[0].id + "']").addClass("active");
                $columns.scope().selectForDispatch(sel[0]);
                $columns.scope().selectJob(sel[0], true);
            }
        });

        oms.addMarker(m);
    } else {
        google.maps.event.addListener(m, 'click', () => {
            console.log(m.jobNumber || '');
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
    const run = $(".columns").scope().allRuns;


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

            const infowindow = new google.maps.InfoWindow({
                content: contentString, pixelOffset: new google.maps.Size(-55, 0)
            });

            addClickHandler(marker, infowindow);
        } else {
            addClickHandler(marker);
        }
    }
}

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

function displayAvailableCouriers(ac, courierCode, channels, truckChannel, truckMode, includeUA) {
    map.clearLabels();
    map.clearFlags();
    $.each(ac, (i, c) => {
        if (!includeUA && c.fleetCode === "UA") {
            return true;
        }
        let col = "#00FF00";
        let className = "courier courierMarker";
        if (c.totalJobs === 0) {
            col = "#FFFDD0";
            className = "courier courierCream courierMarker";
        } else if (c.overDueJobs > 0) {
            col = "#FF0000";
            className = "courier courierRed courierMarker";
        }
        const ll = new google.maps.LatLng(c.latitude, c.longitude);
        if (ll.lat !== null && ll.lng !== null && c.code !== courierCode && (channels.length === 0 || channels.includes(c.channelID)) && (truckChannel === false || c.vehicleType === "T")) {
            if ((truckChannel === false && truckMode === "Off" && c.vehicleType === "T") || (truckChannel === false && truckMode === "Only" && c.vehicleType !== "T")) {
                return true;

            } else {
                drawItem(col, ll, pad(c.code + '-' + c.vehicleType + c.totalJobs, 5, '_', 2), c.courierID, c.code, className);
            }
        }
    });


}

function displayPickupPoints(jobs, clear, currentJob) {
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
        let pinColor = "purple";

        if (jobs[i].status === "C") {
            pinColor = "grey";
        }
        if (jobs[i].status === "N") {
            pinColor = "grey";
        }
        if (jobs[i].status === "D") {
            pinColor = "green";
        }
        if (jobs[i].status === "P") {
            pinColor = "red";
        }
        if (jobs[i].status === "A") {
            pinColor = "blue";
        }
        if (jobs[i].status === "V") {
            pinColor = "yellow";
        }
        if ((currentJob !== null) && (jobs[i].jobNo === currentJob.jobNo)) {
            pinColor = "black";
        }


        const pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (jobs[i].runOrder || "").toString() + ".png", new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));

        if (jobs[i].statusID < 5) {
            const pickupMarker = new google.maps.Marker({
                position: new google.maps.LatLng(jobs[i].pickUpLatitude, jobs[i].pickUpLongitude),
                draggable: false,
                map: map,
                icon: pinImage,
                jobNumber: jobs[i].jobNo,
                optimized: true

            });

            const contentString = '<div id="content">' + '<div id="bodyContent">' + "<p><b>" + jobs[i].jobNo + '</b></p>' + "<p><b>Pickup</b></p>" + "</div>" + "</div>";

            const infoWindow = new google.maps.InfoWindow({
                content: contentString, pixelOffset: new google.maps.Size(-55, 0)
            });


            addClickHandler(pickupMarker, infoWindow);
        }
    }
}

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
        let pinColor = "purple";

        if (courierJobs[i].status === "C") {
            pinColor = "grey";
        }
        if (courierJobs[i].status === "N") {
            pinColor = "grey";
        }
        if (courierJobs[i].status === "D") {
            pinColor = "green";
        }
        if (courierJobs[i].status === "P") {
            pinColor = "red";
        }
        if (courierJobs[i].status === "A") {
            pinColor = "blue";
        }
        if (courierJobs[i].status === "V") {
            pinColor = "yellow";
        }


        const pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (courierJobs[i].runOrder || "").toString() + ".png", new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));

        if (courierJobs[i].statusID < 5) {
            const pickupMarker = new google.maps.Marker({
                position: new google.maps.LatLng(courierJobs[i].pickUpLatitude, courierJobs[i].pickUpLongitude),
                map: map,
                icon: pinImage,
                jobNumber: courierJobs[i].jobNo
            });


            const contentString = '<div id="content">' + '<div id="bodyContent">' + "<p><b>" + courierJobs[i].jobNo + '</b></p>' + "<p><b>Pickup</b></p>" + "</div>" + "</div>";

            const infoWindow = new google.maps.InfoWindow({
                content: contentString, pixelOffset: new google.maps.Size(-55, 0)
            });


            addClickHandler(pickupMarker, infoWindow);
        }


        const deliveryMarker = new google.maps.Marker({
            position: new google.maps.LatLng(courierJobs[i].deliveryLatitude, courierJobs[i].deliveryLongitude),
            map: map,
            icon: pinImage,
            jobNumber: courierJobs[i].jobNo
        });


        const deliveryContentString = '<div id="content">' + '<div id="bodyContent">' + "<p><b>" + courierJobs[i].jobNo + '</b></p>' + "<p><b>Delivery</b></p>" + "</div>" + "</div>";

        const deliveryInfoWindow = new google.maps.InfoWindow({
            content: deliveryContentString, pixelOffset: new google.maps.Size(-55, 0)
        });


        addClickHandler(deliveryMarker, deliveryInfoWindow);
    }
}

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
        let pinColor = "purple";

        if (courierJobs[i].status === "C") {
            pinColor = "grey";
        }
        if (courierJobs[i].status === "N") {
            pinColor = "grey";
        }
        if (courierJobs[i].status === "D") {
            pinColor = "green";
        }
        if (courierJobs[i].status === "P") {
            pinColor = "red";
        }
        if (courierJobs[i].status === "A") {
            pinColor = "blue";
        }
        if (courierJobs[i].status === "V") {
            pinColor = "yellow";
        }


        const pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (courierJobs[i].runOrder || "").toString() + ".png", new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));
        const deliveryPinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_red" + (courierJobs[i].runOrder || "").toString() + ".png", new google.maps.Size(131, 154), new google.maps.Point(0, 0), new google.maps.Point(10, 34));

        if (courierJobs[i].statusID < 5) {
            const pickupMarker = new google.maps.Marker({
                position: new google.maps.LatLng(courierJobs[i].pickUpLatitude, courierJobs[i].pickUpLongitude),
                map: map,
                icon: pinImage,
                jobNumber: courierJobs[i].jobNo
            });


            const contentString = '<div id="content">' + '<div id="bodyContent">' + "<p><b>" + courierJobs[i].jobNo + '</b></p>' + "<p><b>Pickup</b></p>" + "</div>" + "</div>";

            const infoWindow = new google.maps.InfoWindow({
                content: contentString, pixelOffset: new google.maps.Size(-55, 0)
            });


            addClickHandler(pickupMarker, infoWindow);
            zoomMarkers.push(pickupMarker);
        }


        const deliveryMarker = new google.maps.Marker({
            position: new google.maps.LatLng(courierJobs[i].deliveryLatitude, courierJobs[i].deliveryLongitude),
            map: map,
            icon: deliveryPinImage,
            jobNumber: courierJobs[i].jobNo
        });


        const deliveryContentString = '<div id="content">' + '<div id="bodyContent">' + "<p><b>" + courierJobs[i].jobNo + '</b></p>' + "<p><b>Delivery</b></p>" + "</div>" + "</div>";

        const deliveryInfoWindow = new google.maps.InfoWindow({
            content: deliveryContentString, pixelOffset: new google.maps.Size(-55, 0)
        });


        addClickHandler(deliveryMarker, deliveryInfoWindow);

        zoomMarkers.push(deliveryMarker);

    }

    const bounds = new google.maps.LatLngBounds();
    for (let x = 0; x < zoomMarkers.length; x++) {
        bounds.extend(zoomMarkers[x].getPosition());
    }

    if (zoom) {
        map.fitBounds(bounds);
    } else {
        map.panToBounds(bounds);
    }


    for (var y = 0; y < zoomMarkers.length; y++) {
        const thisMarker = zoomMarkers[y];
        thisMarker.setAnimation(google.maps.Animation.BOUNCE);

    }

    window.setTimeout(() => {
        for (let y = 0; y < zoomMarkers.length; y++) {
            const bounceMarker = zoomMarkers[y];
            if (bounceMarker.getAnimation() !== null) {
                bounceMarker.setAnimation(null);
            }
        }

    }, 2000);


    if (courierJobs.length === 0) return;

    if (courierJobs[0].courierLatitude === null || courierJobs[0].courierLatitude === 0) {
        return;
    }

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

function drawItem(col, ll, code, id, originalCode, className) {
    const label = new Label({
        map: map, color: col, isVisible: true, cssClass: className
    });


    const marker = new google.maps.Marker({
        position: ll,
        draggable: false,
        map: map,
        title: code,
        visible: true,
        display: code,
        courierId: id,
        code: originalCode
    });

    const iconFile = '/images/flagpole.png';
    marker.setIcon(iconFile);
    label.bindTo('position', marker, 'position');
    label.bindTo('text', marker, 'display');
    label.bindTo('zIndex', marker);

    map.addFlag(marker);
    map.addLabel(label);

    google.maps.event.addListener(marker, 'click', () => {
        const $columns = $(".columns");
        const courier = $columns.scope().pickCouriers.find(x => x.courierID === this.courierId);
        $columns.scope().selectMapCourier(courier);
    });
}

function pad(str, len, pad, dir) {
    if (typeof (len) === "undefined") {
        var len = 0;
    }
    if (typeof (pad) === "undefined") {
        var pad = ' ';
    }
    if (typeof (dir) === "undefined") {
        var dir = 2;
    }

    if (len + 1 >= str.length) {
        str = str + Array(len + 1 - str.length).join(pad);
    }

    return str;
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
    let totalDist = 0;
    var totalTime = 0;
    const myroute = result.routes[0];
    const newOrder = [];
    for (i = 0; i < myroute.legs.length; i++) {
        totalDist += myroute.legs[i].distance.value;
        totalTime += myroute.legs[i].duration.value;
        newOrder.push({
            "lat": myroute.legs[i].end_location.lat(), "lng": myroute.legs[i].end_location.lng()
        });
    }

    totalDist = totalDist / 1000;

    $(".columns").scope().updateRunDetails(totalTime, Math.round(totalDist), myroute.legs.length, newOrder);

    var totalTime = (totalTime / 60).toFixed(0);
}

function validateGoogleJobRoute(job) {
    const origin = new google.maps.LatLng(job.fromLat, job.fromLng);
    const dest = new google.maps.LatLng(job.toLat, job.toLng);
    const request = {
        origin: origin, destination: dest, travelMode: google.maps.DirectionsTravelMode.DRIVING
    };

    directionsService.route(request, (response, status) => {
        if (status === google.maps.DirectionsStatus.NOT_FOUND || status === google.maps.DirectionsStatus.ZERO_RESULTS) {
            $("#box-map").find(".loading").fadeOut();
            alert("Job " + job.jobNumber + " Could not Route!");
            $(".columns").scope().selectJobFromMap(job.toLat, job.toLng);

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
            $("#box-map").find(".loading").fadeOut();
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
