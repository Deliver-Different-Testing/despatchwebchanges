var map;
var oms;
var renderingPoints = false;
var infoWindow = new google.maps.InfoWindow();

(function () {
    google.maps.Marker.prototype.jobNumber = "";
    google.maps.Marker.prototype.courierId = 0;
    google.maps.Marker.prototype.code = "";
    google.maps.Map.prototype.labels = new Array();
    google.maps.Map.prototype.flags = new Array();
    google.maps.Map.prototype.flightPaths = new Array();
    google.maps.Map.prototype.addLabel = function (label) {
        this.labels[this.labels.length] = label;
    };
    google.maps.Map.prototype.getLabels = function () {
        return this.labels;
    };
    google.maps.Map.prototype.clearLabels = function () {

        for (var i = 0; i < this.labels.length; i++) {
            this.labels[i].setMap(null);
        }

        this.labels.length = 0;
    };
    google.maps.Map.prototype.markers = new Array();
    google.maps.Map.prototype.addMarker = function (marker) {
        map.markers[map.markers.length] = marker;
    };
    google.maps.Map.prototype.getMarkers = function () {
        return map.markers;
    };
    google.maps.Map.prototype.clearMarkers = function () {
        if (infoWindow) {
            infoWindow.close();
        }

        for (var i = 0; i < map.markers.length; i++) {
            google.maps.event.clearInstanceListeners(map.markers[i]);
            map.markers[i].setMap(null);
        }

        map.markers.length = 0;
    };

    google.maps.Map.prototype.addFlag = function (flag) {
        map.flags[map.flags.length] = flag;
    };
    google.maps.Map.prototype.getFlags = function () {
        return map.flags;
    };
    google.maps.Map.prototype.clearFlags = function () {
        if (infoWindow) {
            infoWindow.close();
        }

        for (var i = 0; i < map.flags.length; i++) {
            google.maps.event.clearInstanceListeners(map.flags[i]);
            map.flags[i].setMap(null);
        }

        map.flags.length = 0;
    };

    google.maps.Map.prototype.addFlightPath = function (flightPath) {
        map.flightPaths[map.flightPaths.length] = flightPath;
    };
    google.maps.Map.prototype.getFlightPaths = function () {
        return map.flightPaths;
    };
    google.maps.Map.prototype.clearFlightPaths = function () {

        for (var i = 0; i < map.flightPaths.length; i++) {
            map.flightPaths[i].setMap(null);
        }

        map.flightPaths.length = 0;
    };
})();

function initialize() {
    var auckland = new google.maps.LatLng(-36.8804466, 174.6117981);
    var myOptions = {
        zoom: 10,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        center: auckland
    };
    map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);
    oms = new OverlappingMarkerSpiderfier(map, {
        markersWontMove: false,   // we promise not to move any markers, allowing optimizations
        markersWontHide: true,   // we promise not to change visibility of any markers, allowing optimizations
        basicFormatEvents: true  // allow the library to skip calculating advanced formatting information
    });
    google.maps.event.addListener(map, "rightclick", function (e) {
        console.log(e);
    });
    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
    
}

//google.maps.event.addDomListener(window, 'load', initialize);

var currentDrag = null;

var isCtrl = false;
window.onkeydown = function (e) {
    isCtrl = e.keyIdentifier === 'Control' || e.ctrlKey === true;
};
window.onkeyup = function (e) {
    isCtrl = false;
};

function addClickHandler(m, iw) {

    //map.addMarker(m);
    if (iw !== null) {
        //google.maps.event.addListener(m, 'click', function () {
        //    //angular.element(".columns").scope().selectJobFromMap(this.position.lat(), this.position.lng());
        //    iw.open(map, m);
        //});

        google.maps.event.addListener(m, 'spider_click', function (e) {  // 'spider_click', not plain 'click'
            iw.open(map, m);
            console.log(m.jobNumber || '');
            var sel = angular.element(".columns").scope().jobList.filter(x => x.jobNo === m.jobNumber);
            if (sel.length > 0) {
                $("#jobList tr").removeClass("active");
                $("#jobList tr[data-jobid='" + sel[0].id + "']").addClass("active");
                angular.element(".columns").scope().selectForDispatch(sel[0]);
                angular.element(".columns").scope().selectJob(sel[0], true);
                
            }
            
        });
        
        //google.maps.event.addListener(m, 'dragstart', function (marker) {
        //    var latLng = marker.latLng;
        //    console.log("marker drag start");
        //    console.log(marker);
        //    console.log(latLng);
        //    currentDrag = oms.getMarkers().find(obj => {
        //        return obj.position.lat() === latLng.lat() && obj.position.lng() === latLng.lng();
        //    });
        //    console.log("drag marker = ");
        //    console.log(currentDrag);
        //    //angular.element(".columns").scope().dispatchDroppedMarkerToClosestCourier(latLng.lat(), latLng.lng(), map.flags, carMarker, marker.jobNumber);
        //});
        //google.maps.event.addListener(m, 'dragend', function (marker) {
        //    var latLng = marker.latLng;
        //    console.log("marker moved");
        //    console.log(marker);
        //    console.log(latLng);
        //    angular.element(".columns").scope().dispatchDroppedMarkerToClosestCourier(latLng.lat(), latLng.lng(), map.flags, carMarker, currentDrag.jobNumber);
        //});

        oms.addMarker(m);

    }
    else {
        google.maps.event.addListener(m, 'click', function () {
            console.log(m.jobNumber || '');
            //angular.element(".columns").scope().selectJobFromMap(this.position.lat(), this.position.lng());
        });

    }

}


var delayFactor = 0;
var boundsSet = false;
var carPos = null;
var latPost = null;
var carMarker = null;

function setMapBounds() {
    boundsSet = true;
    var bounds = new google.maps.LatLngBounds();
    for (var i = 0; i < oms.getMarkers().length; i++) {
        bounds.extend(oms.getMarkers()[i].getPosition());
    }
    if (carPos !== null) {
        bounds.extend(carPos);
    }

    map.fitBounds(bounds);
}

function highlightPin(job) {
    console.log('finding ' + job.toLat.toString().substr(0, 9) + ',' + job.toLng.toString().substr(0, 9));

    var marker = map.markers.find(obj => {
        return obj.position.lat().toString().substr(0, 9) === job.toLat.toString().substr(0, 9) &&
            obj.position.lng().toString().substr(0, 9) === job.toLng.toString().substr(0, 9);
    });
    if (marker === undefined) return;
    var pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_black.png",
        new google.maps.Size(131, 154),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34));
    marker.icon = pinImage;
    marker.setAnimation(google.maps.Animation.BOUNCE);
    window.setTimeout(function () {
        if (marker.getAnimation() !== null) {
            marker.setAnimation(null);
        }
    }, 2000);
}

function displayDeliveryPoint(location) {
    var pinColor = "red";
    if (run[i].jobStatus === "C") {
        pinColor = "grey";
    }
    if (run[i].jobStatus === "V") {
        pinColor = "yellow";
    }

    var pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (run[i].ro || '').toString() + ".png",
        new google.maps.Size(131, 154),
        new google.maps.Point(0, 0),
        new google.maps.Point(10, 34));
    var marker = new google.maps.Marker({
        position: run[i],
        map: map,
        icon: pinImage
        //label: (run[i].ro || '').toString()
    });
}

function displayAllRoutePoints() {
    if (map.markers.length) {
        map.clearMarkers();
    }
    var run = angular.element(".columns").scope().allRuns;


    for (var i = 0; i < run.length; i++) {
        var pinColor = "red";
        if (run[i].jobStatus === "C") {
            pinColor = "grey";
        }
        if (run[i].jobStatus === "V") {
            pinColor = "yellow";
        }

        var pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (run[i].ro || '').toString() + ".png",
            new google.maps.Size(131, 154),
            new google.maps.Point(0, 0),
            new google.maps.Point(10, 34));
        var marker = new google.maps.Marker({
            position: run[i],
            map: map,
            icon: pinImage
            //draggable: true
            //label: (run[i].ro || '').toString()
        });

        if (run[i].jobStatus === "C") {
            var contentString = '<div id="content">' +
                '<div id="bodyContent">' +
                '<p><b>Received By: </b>' + run[i].rb + '</p>' +
                '<p><b>Received Time: </b>' + moment(run[i].rt).format('hh:mm a') + '</p>' +
                '</div>' +
                '</div>';

            var infowindow = new google.maps.InfoWindow({
                content: contentString,
                pixelOffset: new google.maps.Size(-55, 0)
            });

            addClickHandler(marker, infowindow);
        }
        else {
            addClickHandler(marker);
        }



    }


}

function displayCourierPositionOnly(lat, lng) {
    if (map.markers.length) {
        map.clearMarkers();
    }
    var gl1 = new google.maps.LatLng(lat, lng);
    carPos = gl1;

    if (carMarker !== null) {
        carMarker.setMap(null);
    }
    carMarker = new google.maps.Marker({
        position: gl1,
        map: map,
        icon: "/images/car3.png"
    });

    //setMapBounds();

    map.setCenter(gl1);
    map.setZoom(13);
}

function displayAvailableCouriers(ac, courierCode, channels, truckChannel, truckMode, includeUA) {
    map.clearLabels();
    map.clearFlags();
    $.each(ac, function (i, c) {
        //var col = '#003CA1'; //courier
        if (!includeUA && c.fleetCode === "UA") {
            return true;
        }
        var col = "#00FF00";
        var className = "courier courierMarker";
        if (c.totalJobs === 0) {
            col = "#FFFDD0";
            className = "courier courierCream courierMarker";
        } else if (c.overDueJobs > 0) {
            col = "#FF0000";
            className = "courier courierRed courierMarker";
        }
        var ll = new google.maps.LatLng(c.latitude, c.longitude);
        if (ll.lat !== null && ll.lng !== null && c.code !== courierCode && (channels.length === 0 || channels.includes(c.channelID)) && (truckChannel === false || c.vehicleType === "T")) {
            if ((truckChannel === false && truckMode === "Off" && c.vehicleType === "T") || (truckChannel === false && truckMode === "Only" && c.vehicleType !== "T"))
            {
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


    for (var i = 0; i < jobs.length; i++) {
        var pinColor = "purple";

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


        var pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (jobs[i].runOrder || "").toString() + ".png",
            new google.maps.Size(131, 154),
            new google.maps.Point(0, 0),
            new google.maps.Point(10, 34));

        if (jobs[i].statusID < 5) {
            var pickupMarker = new google.maps.Marker({
                position: new google.maps.LatLng(jobs[i].pickUpLatitude, jobs[i].pickUpLongitude),
                draggable: false,
                map: map,
                icon: pinImage,
                jobNumber: jobs[i].jobNo,
                optimized: true

            });


            var contentString = '<div id="content">' +
                '<div id="bodyContent">' +
                "<p><b>" + jobs[i].jobNo + '</b></p>' +
                "<p><b>Pickup</b></p>" +
                "</div>" +
                "</div>";

            var infoWindow = new google.maps.InfoWindow({
                content: contentString,
                pixelOffset: new google.maps.Size(-55, 0)
            });


            addClickHandler(pickupMarker, infoWindow);
        }


    }


}

function highlightJobPoints(courierJobs) {
    for (var i = 0; i < courierJobs.length; i++) {
        var job = courierJobs[i];
        console.log('finding ' + job.jobNo);

        var marker = oms.getMarkers().find(obj => {
            return obj.jobNumber === job.jobNo;
        });
        if (marker === undefined) return;
        
        marker.setAnimation(google.maps.Animation.BOUNCE);
        window.setTimeout(function () {
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


    for (var i = 0; i < courierJobs.length; i++) {
        var pinColor = "purple";

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


        var pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (courierJobs[i].runOrder || "").toString() + ".png",
            new google.maps.Size(131, 154),
            new google.maps.Point(0, 0),
            new google.maps.Point(10, 34));

        if (courierJobs[i].statusID < 5) {
            var pickupMarker = new google.maps.Marker({
                position: new google.maps.LatLng(courierJobs[i].pickUpLatitude, courierJobs[i].pickUpLongitude),
                map: map,
                icon: pinImage,
                jobNumber: courierJobs[i].jobNo
            });


            var contentString = '<div id="content">' +
                '<div id="bodyContent">' +
                "<p><b>" + courierJobs[i].jobNo + '</b></p>' +
                "<p><b>Pickup</b></p>" +
                "</div>" +
                "</div>";

            var infoWindow = new google.maps.InfoWindow({
                content: contentString,
                pixelOffset: new google.maps.Size(-55, 0)
            });


            addClickHandler(pickupMarker, infoWindow);
        }


        var deliveryMarker = new google.maps.Marker({
            position: new google.maps.LatLng(courierJobs[i].deliveryLatitude, courierJobs[i].deliveryLongitude),
            map: map,
            icon: pinImage,
            jobNumber: courierJobs[i].jobNo
        });


        var deliveryContentString = '<div id="content">' +
            '<div id="bodyContent">' +
            "<p><b>" + courierJobs[i].jobNo + '</b></p>' +
            "<p><b>Delivery</b></p>" +
            "</div>" +
            "</div>";

        var deliveryInfoWindow = new google.maps.InfoWindow({
            content: deliveryContentString,
            pixelOffset: new google.maps.Size(-55, 0)
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

    var zoomMarkers = [];

    for (var i = 0; i < courierJobs.length; i++) {
        var pinColor = "purple";

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
        
        
        var pinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_" + pinColor + (courierJobs[i].runOrder || "").toString() + ".png",
            new google.maps.Size(131, 154),
            new google.maps.Point(0, 0),
            new google.maps.Point(10, 34));
        var deliveryPinImage = new google.maps.MarkerImage("https://raw.githubusercontent.com/Concept211/Google-Maps-Markers/master/images/marker_red"  + (courierJobs[i].runOrder || "").toString() + ".png",
            new google.maps.Size(131, 154),
            new google.maps.Point(0, 0),
            new google.maps.Point(10, 34));

        if (courierJobs[i].statusID < 5) {
            var pickupMarker = new google.maps.Marker({
                position: new google.maps.LatLng(courierJobs[i].pickUpLatitude, courierJobs[i].pickUpLongitude),
                map: map,
                icon: pinImage,
                jobNumber: courierJobs[i].jobNo
            });


            var contentString = '<div id="content">' +
                '<div id="bodyContent">' +
                "<p><b>" + courierJobs[i].jobNo + '</b></p>' +
                "<p><b>Pickup</b></p>" +
                "</div>" +
                "</div>";

            var infoWindow = new google.maps.InfoWindow({
                content: contentString,
                pixelOffset: new google.maps.Size(-55, 0)
            });


            addClickHandler(pickupMarker, infoWindow);
            zoomMarkers.push(pickupMarker);
        }
        

        var deliveryMarker = new google.maps.Marker({
            position: new google.maps.LatLng(courierJobs[i].deliveryLatitude, courierJobs[i].deliveryLongitude),
            map: map,
            icon: deliveryPinImage,
            jobNumber: courierJobs[i].jobNo
        });


        var deliveryContentString = '<div id="content">' +
            '<div id="bodyContent">' +
            "<p><b>" + courierJobs[i].jobNo + '</b></p>' +
            "<p><b>Delivery</b></p>" +
            "</div>" +
            "</div>";

        var deliveryInfoWindow = new google.maps.InfoWindow({
            content: deliveryContentString,
            pixelOffset: new google.maps.Size(-55, 0)
        });


        addClickHandler(deliveryMarker, deliveryInfoWindow);

        zoomMarkers.push(deliveryMarker);

    }

    //zoom out - set bounds
    var bounds = new google.maps.LatLngBounds();
    for (var x = 0; x < zoomMarkers.length; x++) {
        bounds.extend(zoomMarkers[x].getPosition());
    }

    if (zoom) {
        map.fitBounds(bounds);
    } else {
        map.panToBounds(bounds);
    }
    

    for (var y = 0; y < zoomMarkers.length; y++) {
        var thisMarker = zoomMarkers[y];
        thisMarker.setAnimation(google.maps.Animation.BOUNCE);

    }

    window.setTimeout(function () {
        for (var y = 0; y < zoomMarkers.length; y++) {
            var bounceMarker = zoomMarkers[y];
            if (bounceMarker.getAnimation() !== null) {
                bounceMarker.setAnimation(null);
            }
        }
        
    }, 2000);
    

    if (courierJobs.length === 0) return;

    if (courierJobs[0].courierLatitude === null || courierJobs[0].courierLatitude === 0) {
        return;
    }

    var gl1 = new google.maps.LatLng(courierJobs[0].courierLatitude, courierJobs[0].courierLongitude);
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
    var classname = className;

    var label = new Label({
        map: map,
        color: col,
        isVisible: true,
        cssClass: classname
    });


    var marker = new google.maps.Marker({
        position: ll,
        draggable: false,
        map: map,
        title: code,
        visible: true,
        display: code,
        courierId: id,
        code: originalCode
    });

    var iconFile = '/images/flagpole.png';
    marker.setIcon(iconFile);
    label.bindTo('position', marker, 'position');
    label.bindTo('text', marker, 'display');
    label.bindTo('zIndex', marker);

    map.addFlag(marker);
    map.addLabel(label);

    google.maps.event.addListener(marker, 'click', function () {
        var courier = angular.element(".columns").scope().pickCouriers.find(x => x.courierID === this.courierId);
        angular.element(".columns").scope().selectMapCourier(courier);
    });



}

function pad(str, len, pad, dir) {

    if (typeof (len) === "undefined") { var len = 0; }
    if (typeof (pad) === "undefined") { var pad = ' '; }
    if (typeof (dir) === "undefined") { var dir = 2; }

    if (len + 1 >= str.length) {
        str = str + Array(len + 1 - str.length).join(pad);

    }

    return str;

}


function refreshCourierLocation(returnData) {
    if (returnData !== null && !renderingPoints) {
        var gl1 = new google.maps.LatLng(returnData.latitude, returnData.longitude);
        carPos = gl1;

        if (carMarker !== null) {
            carMarker.setMap(null);
        }
        carMarker = new google.maps.Marker({
            position: gl1,
            map: map,
            icon: "/images/car3.png"
        });

        lastPos = gl1;

    }

}

function computeTotalDistance(result) {
    var totalDist = 0;
    var totalTime = 0;
    var myroute = result.routes[0];
    var newOrder = [];
    for (i = 0; i < myroute.legs.length; i++) {
        totalDist += myroute.legs[i].distance.value;
        totalTime += myroute.legs[i].duration.value;
        newOrder.push({
            "lat": myroute.legs[i].end_location.lat(),
            "lng": myroute.legs[i].end_location.lng()
        });
    }

    totalDist = totalDist / 1000;

    angular.element(".columns").scope().updateRunDetails(totalTime, Math.round(totalDist), myroute.legs.length, newOrder);

    var totalTime = (totalTime / 60).toFixed(0);

}

function validateGoogleJobRoute(job) {
    var origin = new google.maps.LatLng(job.fromLat, job.fromLng);
    var dest = new google.maps.LatLng(job.toLat, job.toLng);
    var request = {
        // from: Blackpool to: Preston to: Blackburn
        origin: origin,
        destination: dest,
        travelMode: google.maps.DirectionsTravelMode.DRIVING
    };

    directionsService.route(request,
        function (response, status) {
            if (status === google.maps.DirectionsStatus.NOT_FOUND || status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                $("#box-map").find(".loading").fadeOut();
                alert("Job " + job.jobNumber + " Could not Route!");
                angular.element(".columns").scope().selectJobFromMap(job.toLat, job.toLng);

            }
        });
}

function validateGoogleRoute(run) {
    var origin = new google.maps.LatLng(run[0].fromLat, run[0].fromLng);
    var wayPoints = [];


    for (var i = 0; i < run.length; i++) {
        var to = new google.maps.LatLng(run[i].toLat, run[i].toLng);
        wayPoints.push({
            location: to,
            stopover: true
        });

    }

    var request = {
        // from: Blackpool to: Preston to: Blackburn
        origin: origin,
        destination: origin,
        waypoints: wayPoints,
        optimizeWaypoints: true,
        travelMode: google.maps.DirectionsTravelMode.DRIVING
    };

    directionsService.route(request,
        function (response, status) {
            if (status === google.maps.DirectionsStatus.OK) {
                $("#box-map").find(".loading").fadeOut();
                alert("Run OK!");
            }
            if (status === google.maps.DirectionsStatus.NOT_FOUND || status === google.maps.DirectionsStatus.ZERO_RESULTS) {
                for (var i = 0; i < run.length; i++) {
                    validateGoogleJobRoute(run[i]);
                }
            }
        });
}

initialize();
