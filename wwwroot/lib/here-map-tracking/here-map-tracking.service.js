
angular.module("hereMapTracking.services")
    .factory('HereMapService',
        [function() {
            var service = {};

            //Init platform with credentials
            service.initPlatform = function (credentials) {
                return new H.service.Platform({
                    apikey: credentials.apiKey
                });
            };

            service.resizeMap = (map) => {
                if (map && map.getViewPort()) {
                    // Force the map to recalculate its size based on container
                    window.setTimeout(() => {
                        map.getViewPort().resize();
                    }, 100); // Small delay to ensure DOM has settled
                }
            };

            service.resizeMapPreserveView = (map) => {
                if (map && map.getViewPort()) {
                    // Store current center and zoom
                    const center = map.getCenter();
                    const zoom = map.getZoom();

                    // Force the map to recalculate its size based on container
                    window.setTimeout(() => {
                        map.getViewPort().resize();

                        // Reset center and zoom
                        map.setCenter(center);
                        map.setZoom(zoom);
                    }, 100); // Small delay to ensure DOM has settled
                }
            };

            // Initialize map instance
            service.createMap = function (elementId, platform, config) {
                var defaultConfig = {
                    zoom: 5,
                    center: { lat: 39.8097343, lng: -98.5556199 }
                };

                const engineType = H.Map.EngineType['HARP'];

                var mapConfig = angular.extend({}, defaultConfig, config);

                // Initialize the default map layers
                var defaultLayers = platform.createDefaultLayers({ engineType });

                // Create map instance
                var map = new H.Map(
                    document.getElementById(elementId),
                    defaultLayers.raster.normal.map,
                    {
                        zoom: mapConfig.zoom,
                        center: mapConfig.center,
                        engineType: engineType
                    }
                );

                //Resize if window size changed
                window.addEventListener('resize', () => map.getViewPort().resize());

                // Add map behavior (pan/zoom)
                var behavior = new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

                // Add UI components
                var ui = H.ui.UI.createDefault(map, defaultLayers);

                ui.removeControl('zoom');

                // disable fractional zooming for Behavior
                behavior.disable(H.mapevents.Behavior.Feature.FRACTIONAL_ZOOM);

                // add H.ui.ZoomControl with the disabled fractional zooming
                var zoomControl = new H.ui.ZoomControl({ fractionalZoom: false });
                ui.addControl('zoom', zoomControl);

                return {
                    map: map,
                    behavior: behavior,
                    ui: ui
                };
            };

            service.getHereFromMarker = function (fromLat, fromLong, fromMarker, map) {
                //Creates here maps marker if it doesn't exist, otherwise updates marker location
                if (!fromMarker) {
                    var fromPoint = new H.geo.Point(fromLat, fromLong);
                    var icon = new H.map.Icon("https://img.icons8.com/ios-filled/50/39e75f/marker.png", { size: { w: 50, h: 50 } });
                    fromMarker = new H.map.Marker(fromPoint, { icon: icon });
                    map.addObject(fromMarker);
                } else {
                    fromMarker.setGeometry(new H.geo.Point(fromLat, fromLong));
                }

                return fromMarker;
            };

            service.getHereToMarker = function (toLat, toLong, toMarker, map) {
                //Creates here maps marker if it doesn't exist, otherwise updates marker location
                if (!toMarker) {
                    var toPoint = new H.geo.Point(toLat, toLong);
                    var icon = new H.map.Icon("https://img.icons8.com/ios-filled/50/ff6863/marker.png", { size: { w: 50, h: 50 } });
                    toMarker = new H.map.Marker(toPoint, { icon: icon });
                    map.addObject(toMarker);
                } else {
                    toMarker.setGeometry(new H.geo.Point(toLat, toLong));
                }

                return toMarker;
            };

            service.getHereCourierMarker = function (courierLat, courierLong, courierMarker, map, flight, lngDiff) {
                //Creates here maps marker if it doesn't exist, otherwise updates marker location
                if (!courierMarker) {
                    if (lngDiff && flight) {
                        var courierPoint = new H.geo.Point(courierLat, courierLong);
                        var planeSvgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 24 24" {{TRANSFORM}} fill="lightblue" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-plane"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M16 10h4a2 2 0 0 1 0 4h-4l-4 7h-3l2 -7h-4l-2 2h-3l2 -4l-2 -4h3l2 2h4l-2 -7h3z" /></svg>';
                        var carSvgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" width="70" height="70" viewBox="0 0 24 24" {{TRANSFORM}} fill="lightblue" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-car"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" /><path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5" /></svg>';
                        var svgMarkup = flight ? planeSvgMarkup : carSvgMarkup;
                        var svgMarkup = svgMarkup.replace('{{TRANSFORM}}', (lngDiff > 0 ? 'transform="scale(-1, 1)"' : ''));
                        var courierIcon = new H.map.Icon(svgMarkup, { anchor: { x: 35, y: 35} }); //half of w/h of icon
                        courierMarker = new H.map.Marker(courierPoint, { icon: courierIcon });
                        map.addObject(courierMarker);
                    }
                } else {
                    courierMarker.setGeometry(new H.geo.Point(courierLat, courierLong));
                }

                return courierMarker;
            };

            service.addExtraMarker = function (lat, long, extraMarkers, map) {
                //Adds extra markers and saves to group for easy removal
                var point = new H.geo.Point(lat, long);
                var icon = new H.map.Icon("https://img.icons8.com/ios-filled/50/000000/marker.png", { size: { w: 50, h: 50 } });
                var marker = new H.map.Marker(point, { icon: icon });
                extraMarkers.push(marker);
                map.addObject(marker);

                return extraMarkers;
            };

            service.removeExtraMarkers = function (extraMarkers, map) {
                //Removes extra markers
                for (i in extraMarkers) {
                    map.removeObject(extraMarkers[i]);
                }
                extraMarkers = [];

                return extraMarkers;
            };

            service.centerHereMap = function (fromLat, fromLong, toLat, toLong, job, routeLine, extraRouteLines, map) {
                //Centers map on single routeline or flight part of multi-route
                var totalLat = fromLat + toLat;
                var totalLong = fromLong + toLong;
                var centerLat = totalLat / 2;
                var centerLong = totalLong / 2;

                map.setCenter({ lat: centerLat, lng: centerLong });

                // Get the current bounding box
                var boundingBox;
                if (routeLine) {
                    boundingBox = routeLine.getBoundingBox();
                } else {
                    boundingBox = extraRouteLines[job.index].getBoundingBox();
                }

                // Expand the bounding box to zoom out
                var topLeft = boundingBox.getTopLeft();
                var bottomRight = boundingBox.getBottomRight();

                // Calculate how much to expand the bounding box by (around 25%)
                var latDiff = Math.abs(topLeft.lat - bottomRight.lat) * 0.25;
                var lngDiff = Math.abs(topLeft.lng - bottomRight.lng) * 0.25;

                // Create an expanded bounding box
                var expandedBoundingBox = new H.geo.Rect(
                    topLeft.lat + latDiff,
                    topLeft.lng - lngDiff,
                    bottomRight.lat - latDiff,
                    bottomRight.lng + lngDiff
                );

                // Set the view to use the expanded bounding box
                map.getViewModel().setLookAtData({ bounds: expandedBoundingBox });
            };

            service.drawRouteLine = function (fromLat, fromLong, toLat, toLong, routeLine, job, map, platform, flight) {
                //Draws a single routeline
                var routingParameters = {
                    routingMode: 'fast',
                    transportMode: 'car',
                    origin: fromLat + ',' + fromLong,

                    destination: toLat + ',' + toLong,
                    return: 'polyline'
                };

                // Define a callback function to process the routing response:
                var onResult = function (result) {
                    // ensure that at least one route was found
                    if (result.routes.length) {
                        result.routes[0].sections.forEach((section) => {
                            if (flight) {
                                // Create a linestring to use as a point source for the route line and add start and end points with curved line
                                const lineString = new H.geo.LineString();
                                const startPoint = { lat: fromLat, lng: fromLong };
                                const endPoint = { lat: toLat, lng: toLong };

                                const curvePoints = service.createCurvedPath(startPoint, endPoint, 0.1);

                                curvePoints.forEach(point => {
                                    lineString.pushPoint(point);
                                });

                                var curvedLine = new H.map.Polyline(lineString, {
                                    style: { lineWidth: 4 }
                                });

                                curvedLine.id = 'route';

                                // Add the route polyline:
                                map.addObject(curvedLine);
                            } else {
                                // Create a linestring to use as a point source for the route line
                                var linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);

                                // Create a polyline to display the route:
                                routeLine = new H.map.Polyline(linestring, {
                                    style: { strokeColor: 'black', lineWidth: 3 }
                                });

                                routeLine.id = 'route';

                                // Add the route polyline (potentially multiple parts):
                                map.addObject(routeLine);
                            }
                        });

                        if (result.routes[0].sections.length > 1) {
                            // Make a group so bounding box fits
                            var group = new H.map.Group();
                            var group1 = new H.map.Marker({ lat: fromLat, lng: fromLong });
                            var group2 = new H.map.Marker({ lat: toLat, lng: toLong });
                            group.addObjects([group1, group2]);

                            // Set the map's viewport to make the whole route visible:
                            map.getViewModel().setLookAtData({ bounds: group.getBoundingBox() });

                            // Clear group after using bounds
                            group.removeObjects([group1, group2]);
                        } else {
                            // Set the map's viewport to make the whole route visible:
                            map.getViewModel().setLookAtData({ bounds: routeLine.getBoundingBox() });
                        }

                        // Center the map
                        service.centerHereMap(fromLat, fromLong, toLat, toLong, job, routeLine, null, map);
                    }
                };

                // Get an instance of the routing service version 8:
                var router = platform.getRoutingService(null, 8);

                // Call calculateRoute() with the routing parameters,
                // the callback and an error callback function (called if a
                // communication error occurs):
                return router.calculateRoute(routingParameters, onResult,
                    function (error) {
                        alert(error.message);
                    });
            };

            service.addExtraRouteLine = function (fromLat, fromLong, toLat, toLong, index, flight, extraRouteLines, job, map, platform, isScopedJob) {
                //Draws multiple routelines for multipart job
                var routingParameters = {
                    routingMode: 'fast',
                    transportMode: 'car',
                    origin: fromLat + ',' + fromLong,

                    destination: toLat + ',' + toLong,
                    return: 'polyline'
                };

                // Define a callback function to process the routing response:
                var onResult = function (result) {
                    // ensure that at least one route was found
                    if (result.routes.length) {
                        result.routes[0].sections.forEach((section) => {
                            if (flight) {
                                // Create a linestring to use as a point source for the route line and add start and end points with curved line
                                const lineString = new H.geo.LineString();
                                const startPoint = { lat: fromLat, lng: fromLong };
                                const endPoint = { lat: toLat, lng: toLong };

                                const curvePoints = service.createCurvedPath(startPoint, endPoint, 0.1);

                                curvePoints.forEach(point => {
                                    lineString.pushPoint(point);
                                });

                                var curvedLine = new H.map.Polyline(lineString, {
                                    style: { lineWidth: 4 }
                                });

                                curvedLine.id = 'route' + index;
                                extraRouteLines.push(curvedLine);
                                job.childJobs[index].index = extraRouteLines.length - 1;

                                // Add the route polyline:
                                map.addObject(curvedLine);
                            } else {
                                // Create a linestring to use as a point source for the route line
                                var linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);

                                // Create a polyline to display the route:
                                var routeLine = new H.map.Polyline(linestring, {
                                    style: { strokeColor: 'purple', lineWidth: 3 }
                                });

                                routeLine.id = 'route' + index;
                                extraRouteLines.push(routeLine);
                                job.childJobs[index].index = extraRouteLines.length - 1;

                                // Add the route polyline (potentially multiple parts):
                                map.addObject(routeLine);
                            }
                        });

                        if ((flight && isScopedJob == null) || isScopedJob) {
                            // Center the map and set viewport
                            service.centerHereMap(fromLat, fromLong, toLat, toLong, job.childJobs[index], null, extraRouteLines, map);
                            //match parents index to the flight part (as it encompasses whole route)
                            job.index = job.childJobs[index].index;
                        }

                        return extraRouteLines;
                    }
                };

                // Get an instance of the routing service version 8:
                var router = platform.getRoutingService(null, 8);

                // Call calculateRoute() with the routing parameters,
                // the callback and an error callback function (called if a
                // communication error occurs):
                router.calculateRoute(routingParameters, onResult,
                    function (error) {
                        alert(error.message);
                    });

                return extraRouteLines;
            };

            service.removeExtraRouteLines = function (extraRouteLines, map) {
                //Remove all extra routelines
                for (i in extraRouteLines) {
                    service.removeObjectById('route' + i, map);
                };
                extraRouteLines = [];

                return extraRouteLines;
            };

            service.removeObjectById = function (id, map) {
                //Removes item off map by using id
                for (object of map.getObjects()) {
                    if (object.id === id) {
                        map.removeObject(object);
                    }
                }
            };

            // Function to create a curved path between two points
            service.createCurvedPath = function (startPoint, endPoint, curvature = 0.5) {
                // Calculate control point for the curve (perpendicular to the line)
                const dx = endPoint.lng - startPoint.lng;
                const dy = endPoint.lat - startPoint.lat;

                // Midpoint
                const midPoint = {
                    lat: startPoint.lat + dy * 0.5,
                    lng: startPoint.lng + dx * 0.5
                };

                // Calculate perpendicular offset for control point
                const offset = {
                    lat: -dx * curvature,
                    lng: dy * curvature
                };

                // Control point
                const controlPoint = {
                    lat: midPoint.lat + Math.abs(offset.lat),
                    lng: midPoint.lng + Math.abs(offset.lng)
                };

                // Generate points along the quadratic B�zier curve
                const curvePoints = [];
                const steps = 30; // Number of points along the curve

                for (let t = 0; t <= 1; t += 1 / steps) {
                    // Quadratic B�zier formula: B(t) = (1-t)^2*P0 + 2(1-t)tP1 + t^2*P2
                    const lat = Math.pow(1 - t, 2) * startPoint.lat +
                        2 * (1 - t) * t * controlPoint.lat +
                        Math.pow(t, 2) * endPoint.lat;

                    const lng = Math.pow(1 - t, 2) * startPoint.lng +
                        2 * (1 - t) * t * controlPoint.lng +
                        Math.pow(t, 2) * endPoint.lng;

                    curvePoints.push({ lat: lat, lng: lng });
                }

                return curvePoints;
            };

            return service;
        }]);
