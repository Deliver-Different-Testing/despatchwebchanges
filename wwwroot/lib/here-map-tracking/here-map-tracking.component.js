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
            template: '<div class="here-map" id="{{mapId}}"></div>',
            controller: ['$scope', 'HereMapService', '$rootScope', function ($scope, HereMapService, $rootScope) {
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

                        window.setTimeout(() => {
                            HereMapService.resizeMapPreserveView(mapInstance.map);
                        }, 100); // Small delay to ensure DOM has settled

                        // Listen for resize events from angular-resizable
                        $rootScope.$on("angular-resizable.resizeEnd", (event, args) => {
                            // Check if the resized element contains or is related to our map
                            if (args.id) {
                                // You may want to check specific IDs or simply resize anyway
                                console.log("Map container resized, resizing map", args);
                                // Resize while preserving view
                                HereMapService.resizeMapPreserveView(mapInstance.map);
                            }
                        });
                    }
                };

                //Watch for changes in config
                $scope.$watchGroup(['config', 'credentials'], function (newValues, oldValues) {
                    if (newValues[0] && newValues[1]) {
                        //Setup map if no map
                        if (!mapInstance) {
                            initialiseMap();
                        }

                        //Check if new job or already on map
                        if (newValues[0].job && (!oldValues[0].job || newValues[0].job.id !== oldValues[0].job.id)) {
                            //Update map if first/new job
                            $scope.showJobOnMap(newValues[0].job, newValues[0].courierLocation);
                        } else if (!newValues[0].job) {
                            //Clear map if no job passed
                            $scope.clearMap();
                        }
                    }
                });

                $scope.$watch('config.selectedJobIndex', function(newValue, oldValue) {
                    if ((newValue || newValue === 0) && oldValue !== null && $scope.credentials && mapInstance.map) {
                        //one more jawn to fix - this is called when changing from one job to a new one while it's already called in showJobOnMap
                        $scope.centerMapOnIndex(newValue);
                    }
                });

                $scope.$watch('config.courierLocation', function (newValue, oldValue) {
                    if (newValue && newValue.lat !== null && newValue.lng !== null && (!oldValue ||
                        (newValue.lat != oldValue.lat && newValue.lng != oldValue.lng))) {
                        //don't know flight/latDiff here but shouldn't matter as this is just moving the existing icon - not adding new
                        courierMarker = HereMapService.getHereCourierMarker(newValue.lat, newValue.lng, courierMarker, mapInstance.map, null, null);
                    }
                });

                $scope.centerMapOnIndex = function(selectedJobIndex) {
                    var thisJob = $scope.getScopedJob(selectedJobIndex);
                    HereMapService.centerHereMap(thisJob.pickup.lat,
                        thisJob.pickup.lng,
                        thisJob.delivery.lat,
                        thisJob.delivery.lng,
                        thisJob,
                        routeLine,
                        extraRouteLines,
                        mapInstance.map);
                };

                $scope.getScopedJob = function(selectedJobIndex) {
                    var index = selectedJobIndex - 1;
                    var thisJob = null;
                    if (index !== -1) {
                        //Scope map to selected leg of job
                        thisJob = $scope.config.job.childJobs[index];
                        thisJob.index = extraRouteLines.findIndex(x => x.id.slice(-1) === index.toString());
                    } else {
                        //Scope map to flight leg of job
                        index = $scope.config.job.childJobs.findIndex(x => x.flight === true);
                        thisJob = $scope.config.job.childJobs[index];
                        thisJob.index = extraRouteLines.findIndex(x => x.id.slice(-1) === index.toString());
                    }
                    return thisJob;
                };

                // Clear map
                $scope.clearMap = function () {
                    //Remove all markers
                    if (extraMarkers.length > 0) {
                        extraMarkers = HereMapService.removeExtraMarkers(extraMarkers, mapInstance.map);
                    };
                    if (fromMarker && toMarker) {
                        mapInstance.map.removeObjects([fromMarker, toMarker]);
                        fromMarker = null;
                        toMarker = null;
                    };
                    if (courierMarker) {
                        mapInstance.map.removeObject(courierMarker);
                        courierMarker = null;
                    };

                    //Remove all route lines
                    if (extraRouteLines.length > 0) {
                        extraRouteLines = HereMapService.removeExtraRouteLines(extraRouteLines, mapInstance.map);
                    };
                    if (routeLine) {
                        HereMapService.removeObjectById('route', mapInstance.map);
                        routeLine = null;
                    };
                };

                // Set up all job data on map
                $scope.showJobOnMap = function (job, courierLocation) {
                    //Remove all markers and route lines
                    $scope.clearMap();

                    //Add all markers
                    fromMarker = HereMapService.getHereFromMarker(job.pickup.lat, job.pickup.lng, fromMarker, mapInstance.map);
                    toMarker = HereMapService.getHereToMarker(job.delivery.lat, job.delivery.lng, toMarker, mapInstance.map);
                    if (courierLocation) {
                        courierMarker = HereMapService.getHereCourierMarker(courierLocation.lat, courierLocation.lng, courierMarker, mapInstance.map, job.childJobs.some(x => x.flight === true),
                        job.pickup.lng - job.delivery.lng);
                    };

                    //Get scoped job in case initialised with it
                    var scopedJob = null;
                    if ($scope.config.selectedJobIndex && $scope.config.selectedJobIndex !== 0) {
                        scopedJob = $scope.getScopedJob($scope.config.selectedJobIndex);
                    };

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
                                job.childJobs[i].flight, extraRouteLines, job, mapInstance.map, platform, scopedJob ? job.childJobs[i].id === scopedJob.id : null);
                        }
                    } else {
                        routeLine = HereMapService.drawRouteLine(job.pickup.lat,
                            job.pickup.lng,
                            job.delivery.lat,
                            job.delivery.lng, routeLine, job, mapInstance.map, platform, job.flight);
                    }
                };
        }]

    }}]);
