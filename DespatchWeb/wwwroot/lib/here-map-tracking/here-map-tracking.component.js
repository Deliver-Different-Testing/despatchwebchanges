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

// here-map.component.js
angular.module('hereMapTracking.components', [])
    .directive('hereMapTracking', [function () {
        return {
            restrict: 'E',
            scope: {
                mapId: '@',
                credentials: '=',
                config: '=',
                onMapReady: '&'
            },
            template: '<div class="here-map" id="{{mapId}}" style="width: 800px; height:500px;"></div>',
            controller: ['$scope', 'HereMapService', function ($scope, HereMapService) {
                var platform;
                var mapInstance;
                var fromMarker;
                var toMarker;
                var courierMarker;
                var extraMarkers = [];
                var routeLine;
                var extraRouteLines = [];

                function initialiseMap() {
                    if ($scope.credentials && $scope.mapId) {
                        // Initialize HERE platform
                        platform = HereMapService.initPlatform($scope.credentials);

                        // Initialize map
                        mapInstance = HereMapService.createMap($scope.mapId, platform, $scope.config);

                        // Notify parent component that map is ready
                        if ($scope.onMapReady) {
                            $scope.onMapReady({
                                map: mapInstance.map,
                                platform: platform
                            });
                        }
                    }
                };

                //Watch for changes in config
                $scope.$watchGroup(['config', 'config.selectedJobIndex'], function (newValues, oldValues) {
                    if ($scope.credentials && newValues[0]) {
                        //Setup map if no map
                        if (!mapInstance) {
                            initialiseMap();
                        }
                        //Check if new job or already on map
                        if (newValues[0].job && (!oldValues[0].job || newValues[0].job.id !== oldValues[0].job.id) && newValues[1] === 0) {
                            //Update map if first/new job
                            $scope.showJobOnMap(newValues[0].job, newValues[0].courierLocation);
                        } else {
                            //To center map for job leg
                            if (newValues[1] || newValues[1] === 0) {
                                var index = newValues[1] - 1;
                                var thisJob = null;
                                if (index !== -1) {
                                    //Scope map to selected leg of job
                                    thisJob = newValues[0].job.childJobs[index];
                                    thisJob.index = extraRouteLines.findIndex(x => x.id.slice(-1) === index.toString());
                                    HereMapService.centerHereMap(thisJob.pickup.lat, thisJob.pickup.lng, thisJob.delivery.lat, thisJob.delivery.lng, thisJob, routeLine, extraRouteLines, mapInstance.map);
                                } else {
                                    //Scope map to flight leg of job
                                    index = newValues[0].job.childJobs.findIndex(x => x.flight === true);
                                    thisJob = newValues[0].job.childJobs[index];
                                    thisJob.index = extraRouteLines.findIndex(x => x.id.slice(-1) === index.toString());
                                    HereMapService.centerHereMap(thisJob.pickup.lat, thisJob.pickup.lng, thisJob.delivery.lat, thisJob.delivery.lng, thisJob, routeLine, extraRouteLines, mapInstance.map);
                                }
                            }
                            //If courier location updated on existing job then update marker location
                            if (newValues[0].courierLocation && newValues[0].courierLocation.lat !== null && newValues[0].courierLocation.lng !== null && (!oldValues[0].courierLocation ||
                                (newValues[0].courierLocation.lat != oldValues[0].courierLocation.lat && newValues[0].courierLocation.lng != oldValues[0].courierLocation.lng))) {
                                courierMarker = HereMapService.getHereCourierMarker(newValues[0].courierLocation.lat, newValues[0].courierLocation.lng, courierMarker, mapInstance.map);
                            }
                        }
                    }
                });

                // Set up all job data on map
                $scope.showJobOnMap = function (job, courierLocation) {
                    //Remove all markers
                    if (extraMarkers.length > 0) {
                        extraMarkers = HereMapService.removeExtraMarkers(extraMarkers, mapInstance.map);
                    }
                    ;
                    if (fromMarker && toMarker) {
                        mapInstance.map.removeObjects([fromMarker, toMarker]);
                        fromMarker = null;
                        toMarker = null;
                    }
                    ;
                    if (courierMarker) {
                        mapInstance.map.removeObject(courierMarker);
                        courierMarker = null;
                    }
                    ;

                    //Add all markers
                    fromMarker = HereMapService.getHereFromMarker(job.pickup.lat, job.pickup.lng, fromMarker, mapInstance.map);
                    toMarker = HereMapService.getHereToMarker(job.delivery.lat, job.delivery.lng, toMarker, mapInstance.map);
                    if (courierLocation) {
                        courierMarker = HereMapService.getHereCourierMarker(courierLocation.lat, courierLocation.lng, courierMarker, mapInstance.map);
                    }
                    ;

                    //Remove all route lines
                    if (extraRouteLines.length > 0) {
                        extraRouteLines = HereMapService.removeExtraRouteLines(extraRouteLines, mapInstance.map);
                    }
                    ;
                    if (routeLine) {
                        HereMapService.removeObjectById('route', mapInstance.map);
                        routeLine = null;
                    }
                    ;

                    //Add all route lines (and extra markers if needed), also centers map
                    if (job.childJobs.length > 0) {
                        for (i in job.childJobs) {
                            if (i !== '0') {
                                extraMarkers = HereMapService.addExtraMarker(job.childJobs[i].pickup.lat,
                                    job.childJobs[i].pickup.lng, extraMarkers, mapInstance.map);
                            }
                            extraRouteLines = HereMapService.addExtraRouteLine(job.childJobs[i].pickup.lat,
                                job.childJobs[i].pickup.lng,
                                job.childJobs[i].delivery.lat,
                                job.childJobs[i].delivery.lng,
                                i,
                                job.childJobs[i].flight, extraRouteLines, job, mapInstance.map, platform);
                        }
                    } else {
                        routeLine = HereMapService.drawRouteLine(job.pickup.lat,
                            job.pickup.lng,
                            job.delivery.lat,
                            job.delivery.lng, routeLine, job, mapInstance.map, platform);
                    }
                };
            }]

        }
    }]);
