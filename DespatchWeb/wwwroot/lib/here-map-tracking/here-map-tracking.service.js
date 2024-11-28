/*!
 The MIT License

 Copyright (c) 2024 Kerran Tetley

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */

/*
 Example config:

 config = {
    center: { lat: 39.8097343, lng: -98.5556199 },
    zoom: 5,
    job: {
        id: 67,
        pickup: { lat: 40.7128, lng: -74.0060 },
        delivery: { lat: 46.7128, lng: -71.0060 },
        childJobs: [
            {
                id: 68,
                pickup: { lat: 40.7128, lng: -74.0060 },
                delivery: { lat: 42.7128, lng: -73.0060 },
                flight: false
            },
            {
                id: 69,
                pickup: { lat: 42.7128, lng: -73.0060 },
                delivery: { lat: 45.7128, lng: -72.0060 },
                flight: true
            },
            {
                id: 70,
                pickup: { lat: 45.7128, lng: -72.0060 },
                delivery: { lat: 46.7128, lng: -71.0060 },
                flight: false
            }
        ],
        selectedJobIndex: 1, //e.g. parent is index 0, children are 1, 2, 3 in order
        courierLocation: { lat: 39.8097343, lng: -98.5556199 }
    }
 }
*/

angular.module("hereMapTracking.services")
    .factory('HereMapService',
        [function () {
            var service = {};

            //Init platform with credentials
            service.initPlatform = function (credentials) {
                return new H.service.Platform({
                    apikey: credentials.apiKey
                });
            };

            // Initialize map instance
            service.createMap = function (elementId, platform, config) {
                var defaultConfig = {
                    zoom: 5,
                    center: {lat: 39.8097343, lng: -98.5556199},
                    engineType: H.map.render.RenderEngine.EngineType.P2D
                };

                var mapConfig = angular.extend({}, defaultConfig, config);

                // Initialize the default map layers
                var defaultLayers = platform.createDefaultLayers();

                // Create map instance
                var map = new H.Map(
                    document.getElementById(elementId),
                    defaultLayers.raster.normal.map,
                    {
                        zoom: mapConfig.zoom,
                        center: mapConfig.center,
                        engineType: mapConfig.engineType
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
                var zoomControl = new H.ui.ZoomControl({fractionalZoom: false});
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
                    var icon = new H.map.Icon("https://img.icons8.com/ios-filled/50/39e75f/marker.png", {
                        size: {
                            w: 50,
                            h: 50
                        }
                    });
                    fromMarker = new H.map.Marker(fromPoint, {icon: icon});
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
                    var icon = new H.map.Icon("https://img.icons8.com/ios-filled/50/ff6863/marker.png", {
                        size: {
                            w: 50,
                            h: 50
                        }
                    });
                    toMarker = new H.map.Marker(toPoint, {icon: icon});
                    map.addObject(toMarker);
                } else {
                    toMarker.setGeometry(new H.geo.Point(toLat, toLong));
                }

                return toMarker;
            };

            service.getHereCourierMarker = function (courierLat, courierLong, courierMarker, map) {
                //Creates here maps marker if it doesn't exist, otherwise updates marker location
                if (!courierMarker) {
                    var courierPoint = new H.geo.Point(courierLat, courierLong);
                    var icon = new H.map.Icon("https://img.icons8.com/ios-filled/50/ff007f/marker.png", {
                        size: {
                            w: 50,
                            h: 50
                        }
                    });
                    courierMarker = new H.map.Marker(courierPoint, {icon: icon});
                    map.addObject(courierMarker);
                } else {
                    courierMarker.setGeometry(new H.geo.Point(courierLat, courierLong));
                }

                return courierMarker;
            };

            service.addExtraMarker = function (lat, long, extraMarkers, map) {
                //Adds extra markers and saves to group for easy removal
                var point = new H.geo.Point(lat, long);
                var icon = new H.map.Icon("https://img.icons8.com/ios-filled/50/000000/marker.png", {
                    size: {
                        w: 50,
                        h: 50
                    }
                });
                var marker = new H.map.Marker(point, {icon: icon});
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

                map.setCenter({lat: centerLat, lng: centerLong});

                if (routeLine) {
                    map.getViewModel().setLookAtData({bounds: routeLine.getBoundingBox()});
                } else {
                    map.getViewModel().setLookAtData({bounds: extraRouteLines[job.index].getBoundingBox()});
                }
            };

            /*service.getIconPlacement = function (fromLat, fromLong, toLat, toLong, percentage, extraMarkers, map) {
             //Sets courier tracking icon as a percentage of flight completion
                var diffLat = fromLat - toLat;
                var diffLong = fromLong - toLong;
                var iconLat = fromLat - (diffLat - diffLat * percentage);
                var iconLong = fromLong - (diffLong - diffLong * percentage);

                var point = new H.geo.Point(iconLat, iconLong);
                var icon = new H.map.Icon("https://img.icons8.com/ios-filled/50/FFC0CB/marker.png", { size: { w: 50, h: 50 } });
                var marker = new H.map.Marker(point, { icon: icon });
                extraMarkers.push(marker);
                map.addObject(marker);

                return extraMarkers;
            };*/

            service.drawRouteLine = function (fromLat, fromLong, toLat, toLong, routeLine, job, map, platform) {
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
                            // Create a linestring to use as a point source for the route line
                            var linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);

                            // Create a polyline to display the route:
                            routeLine = new H.map.Polyline(linestring, {
                                style: {strokeColor: 'black', lineWidth: 3}
                            });

                            routeLine.id = 'route';

                            // Add the route polyline (potentially multiple parts):
                            map.addObject(routeLine);
                        });

                        if (result.routes[0].sections.length > 1) {
                            // Make a group so bounding box fits
                            var group = new H.map.Group();
                            var group1 = new H.map.Marker({lat: fromLat, lng: fromLong});
                            var group2 = new H.map.Marker({lat: toLat, lng: toLong});
                            group.addObjects([group1, group2]);

                            // Set the map's viewport to make the whole route visible:
                            map.getViewModel().setLookAtData({bounds: group.getBoundingBox()});

                            // Clear group after using bounds
                            group.removeObjects([group1, group2]);
                        } else {
                            // Set the map's viewport to make the whole route visible:
                            map.getViewModel().setLookAtData({bounds: routeLine.getBoundingBox()});
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
                                // Create a linestring to use as a point source for the route line and add start and end points
                                var lineString = new H.geo.LineString();
                                lineString.pushPoint({lat: fromLat, lng: fromLong});
                                lineString.pushPoint({lat: toLat, lng: toLong});

                                var routeLine = new H.map.Polyline(lineString, {
                                    style: {lineWidth: 4}
                                });

                                routeLine.id = 'route' + index;
                                extraRouteLines.push(routeLine);
                                job.childJobs[index].index = extraRouteLines.length - 1;

                                // Add the route polyline:
                                map.addObject(routeLine);
                            } else {
                                // Create a linestring to use as a point source for the route line
                                var linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);

                                // Create a polyline to display the route:
                                var routeLine = new H.map.Polyline(linestring, {
                                    style: {strokeColor: 'purple', lineWidth: 3}
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
                }
                ;
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

            return service;
        }]);
