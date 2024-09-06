angular.module("uDispatch").controller("HomeControl", [
    '$document',
    "$filter",
    'greetingService',
    "JobDetailService",
    'loadingService',
    "$mdDialog",
    "$parse",
    "$q",
    "$scope",
    "$state",
    "$window",
    "$timeout",
    'toastrService',
    "DispatchData",
    "uCSData",
    "dispatchJobService",
    "moment",
    "Upload",
    "bytesFilter",
    "versionUrl",
    "NgMap",
    "MapService",
    "hotkeys",
    ($document, $filter, greetingService, jdSvc,
     loadingService, $mdDialog, $parse, $q, $scope, $state,
     $window, $timeout, toastrService, DispatchData, uCSData,
     dispatchJobService, moment, Upload, bytesFilter, versionUrl,
     NgMap, MapService, hotkeys) => {
        $scope.isInternal = (ClientInternal === "True");
        $scope.name = "Home";
        $scope.jdSvc = jdSvc;
        $scope.googleMapsUrl = "https://maps.googleapis.com/maps/api/js?key=AIzaSyCVgP9vjgRYma7DM0B3tZxQlUS7uvXrgyg";

        $scope.markers = [];
        $scope.autoZoomEnabled = JSON.parse(localStorage.getItem("mapZoom-" + ContactID))?.display ?? true;

        $scope.courierSearchText = "";
        $scope.jobDetailFabIsOpen = false;
        $scope.courierListFabIsOpen = false;
        $scope.isCheckingAttachments = false
        $scope.hasAttachedFile = false;

// I've added these here to aid with performance. AngualarJS material seems to have introduced some overhead

// Array to store all timeout promises
        const timeouts = [];

// Wrapper for $timeout that stores the promise
        const safeTimeout = (fn, delay) => {
            const timeoutPromise = $timeout(fn, delay);
            timeouts.push(timeoutPromise);
            return timeoutPromise;
        };

// Array to store all event listener removal functions
        const cleanupFunctions = [];

// Wrapper for $document.on that stores the removal function
        const safeOn = (eventName, selector, handler) => {
            $document.on(eventName, selector, handler);
            cleanupFunctions.push(() => $document.off(eventName, selector, handler));
        };

// Clean up function
        const cleanup = () => {
// Cancel all timeouts
            timeouts.forEach($timeout.cancel);

// Remove all event listeners
            cleanupFunctions.forEach(fn => fn());

// Stop recurring timer
            $document.stopTime("SP");

// Clear Google Maps objects
            if ($scope.markers) {
                $scope.markers.forEach(marker => marker.setMap(null));
                $scope.markers = [];
            }
            if ($scope.infoWindows) {
                $scope.infoWindows.forEach(infoWindow => infoWindow.close());
                $scope.infoWindows = [];
            }

// Clear large data structures
            $scope.jobList = null;
            $scope.supports = null;
            $scope.pickCouriers = null;
            $scope.couriersThrough = null;
            $scope.couriersPicked = null;
            $scope.couriersClear = null;
            $scope.areaList = null;
            $scope.lateCalls = null;
            $scope.jobGroups = null;
            $scope.currentJob = null;
            $scope.currentCourier = null;
        };

// Register the cleanup function to run when the scope is destroyed
        $scope.$on('$destroy', cleanup);


        $scope.greetUser = () => {
            return greetingService.greetUser(FirstName);
        }

        function debounce(func, wait) {
            let timeout;
            return (...args) => {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }


// Google Map
        $scope.initializeMap = () => {
            if (!$scope.map) {
                MapService.initializeMap().then(map => {
                    $scope.map = map;
                    $scope.getAvailableCourierLocation();
                });
            }
        };

        $scope.updateMapMarkers = debounce(jobs => {
            MapService.updateMarkers(jobs).then(() => {
                console.log('Markers updated successfully');
            }).catch(error => {
                console.error('Error updating markers:', error);
            });
        }, 500);

        $scope.getAvailableCourierLocation = debounce(() => {
            const bounds = MapService.getBounds();
            if (bounds) {
                const southWest = bounds.getSouthWest();
                const northEast = bounds.getNorthEast();

                DispatchData.getAvailableCourierLocation(southWest.lng(), southWest.lat(), northEast.lng(), northEast.lat())
                    .then(returnData => {
                        const courierId = $scope.currentCourier && $scope.currentCourier.courier ?
                            $scope.currentCourier.courier.split(" ")[0].trim() : 0;
                        $scope.displayAvailableCouriers(returnData, courierId, $scope.pickService.channel,
                            $scope.truckMode === "On", $scope.truckMode, $scope.allCouriers.includeUA);
                    });
            } else {
                console.log('Map bounds not available');
            }
        }, 500);

        $scope.displayPickupPoints = (jobs, clear, currentJob) => {
            if (clear) {
                $scope.clearMarkers();
            }

            jobs.forEach(job => {
                if (job.statusID < 5) {
                    const marker = MapService.addMarker(job.pickUpLatitude, job.pickUpLongitude, {
                        map: $scope.map,
                        icon: MapService.getPinImage(MapService.getPinColor(job.status, currentJob, job), job.runOrder),
                        jobNumber: job.jobNo
                    });

                    const infoWindow = MapService.createInfoWindow(
                        '<div id="content"><div id="bodyContent"><p><b>' + job.jobNo + '</b></p><p><b>Pickup</b></p></div></div>'
                    );

                    marker.addListener('click', () => {
                        infoWindow.open($scope.map, marker);
                    });

                    $scope.markers.push(marker);
                }
            });

            if (currentJob) {
                MapService.setCenter(currentJob.pickUpLatitude, currentJob.pickUpLongitude);
                MapService.setZoom(15);
            }
        };

        /**
         * @param {T} courierJobs
         * @param {boolean} clear
         * @param {*} zoom
         */
        $scope.displayRoutePoints = (courierJobs, clear, zoom) => {
            if (clear) {
                $scope.clearMarkers();
            }

            const bounds = new google.maps.LatLngBounds();

            courierJobs.forEach(job => {
                const pickupMarker = $scope.createMarker(job, true);
                const deliveryMarker = $scope.createMarker(job, false);

                if (pickupMarker) bounds.extend(pickupMarker.getPosition());
                if (deliveryMarker) bounds.extend(deliveryMarker.getPosition());
            });

            if (courierJobs.length > 0) {
                if (zoom) {
                    MapService.fitBounds(bounds);
                } else {
                    MapService.panToBounds(bounds);
                }

                safeTimeout(() => {
                    $scope.markers.forEach(marker => {
                        marker.setAnimation(google.maps.Animation.BOUNCE);
                    });
                    safeTimeout(() => {
                        $scope.markers.forEach(marker => {
                            marker.setAnimation(null);
                        });
                    }, 2000);
                }, 200);
            }

            if (courierJobs.length > 0 && courierJobs[0].courierLatitude && courierJobs[0].courierLongitude) {
                const courierMarker = MapService.addMarker(
                    courierJobs[0].courierLatitude,
                    courierJobs[0].courierLongitude,
                    {
                        map: $scope.map,
                        icon: "/images/car3.png"
                    }
                );
                $scope.markers.push(courierMarker);

                if (zoom) {
                    MapService.setCenter(courierJobs[0].courierLatitude, courierJobs[0].courierLongitude);
                    MapService.setZoom(13);
                }
            }
        };

        $scope.createMarker = (job, isPickup) => {
            const position = isPickup
                ? new google.maps.LatLng(job.pickUpLatitude, job.pickUpLongitude)
                : new google.maps.LatLng(job.deliveryLatitude, job.deliveryLongitude);

            const pinColor = MapService.getPinColor(job.status);
            const pinImage = MapService.getPinImage(pinColor, job.runOrder);

            const marker = MapService.addMarker(position.lat(), position.lng(), {
                map: $scope.map,
                icon: pinImage,
                jobNumber: job.jobNo
            });

            const contentString =
                '<div id="content">' +
                '<div id="bodyContent">' +
                '<p><b>' + job.jobNo + '</b></p>' +
                '<p><b>' + (isPickup ? "Pickup" : "Delivery") + '</b></p>' +
                '</div>' +
                '</div>';

            const infoWindow = MapService.createInfoWindow(contentString);

            marker.addListener('click', () => {
                $scope.infoWindows.forEach(iw => {
                    iw.close();
                });
                infoWindow.open($scope.map, marker);
            });

            $scope.markers.push(marker);
            $scope.infoWindows.push(infoWindow);

            return marker;
        };

        $scope.displayAvailableCouriers = (couriers, currentCourierId, channels, isTruckMode, truckMode, includeUA) => {
// Clear existing courier markers
            if ($scope.courierMarkers) {
                $scope.courierMarkers.forEach(marker => {
                    marker.setMap(null);
                });
            }
            $scope.courierMarkers = [];

            couriers.forEach(courier => {
                if ($scope.shouldDisplayCourier(courier, currentCourierId, channels, isTruckMode, truckMode, includeUA)) {
                    const marker = MapService.addMarker(courier.latitude, courier.longitude, {
                        map: $scope.map,
                        icon: $scope.getCourierIcon(courier),
                        title: courier.code
                    });

                    const infoWindow = MapService.createInfoWindow($scope.getCourierInfoContent(courier));

                    marker.addListener('click', () => {
                        if ($scope.openInfoWindow) {
                            $scope.openInfoWindow.close();
                        }
                        infoWindow.open($scope.map, marker);
                        $scope.openInfoWindow = infoWindow;
                    });

                    $scope.courierMarkers.push(marker);
                }
            });
        };

        $scope.shouldDisplayCourier = (courier, currentCourierId, channels, isTruckMode, truckMode, includeUA) => {
// Don't display the current courier
            if (courier.code === currentCourierId) {
                return false;
            }

// Check if the courier's channel is included in the selected channels
            if (channels.length > 0 && !channels.includes(courier.channelID)) {
                return false;
            }

// Handle truck mode
            if (isTruckMode) {
                if (truckMode === "Only" && courier.vehicleType !== "T") {
                    return false;
                }
                if (truckMode === "Off" && courier.vehicleType === "T") {
                    return false;
                }
            }

// Check for UA (Unavailable) couriers
            if (!includeUA && courier.fleetCode === "UA") {
                return false;
            }

// If the courier has passed all checks, display them
            return true;
        };

        $scope.getCourierIcon = courier => {
            const color = courier.totalJobs === 0 ? "yellow" : (courier.overDueJobs > 0 ? "red" : "green");
            return {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 0.8,
                scale: 8,
                strokeColor: "white",
                strokeWeight: 2
            };
        };

        $scope.getCourierInfoContent = courier => '<div>' +
            '<h3>' + courier.code + '</h3>' +
            '<p>Total Jobs: ' + courier.totalJobs + '</p>' +
            '<p>Overdue Jobs: ' + courier.overDueJobs + '</p>' +
            '</div>';


        jdSvc.setSelectJobDetail(() => {
            const currentJob = $scope.currentJob;
            jdSvc.setJob($scope.currentJob);

            $scope.getData().then(() => {
                if (currentJob === null || currentJob === undefined || currentJob === false) {
                    return;
                }

                const refreshedJob = $scope.jobList.find(jo => jo.id === currentJob.id);
                $scope.selectJob(refreshedJob);
                safeTimeout(() => {
                    angular.element("#jobList tr[data-jobid='" + currentJob.id + "']").addClass('active');

                    const element = angular.element("#jobList tr[data-jobid='" + currentJob.id + "']");
                    const parentDiv = element.parent().hasClass('box-content') ? element.parent() : element.parent().closest('.box-content');
                    let goTop = element[0].getBoundingClientRect().top;

                    try {
                        goTop = goTop - parentDiv.offset().top + parentDiv.scrollTop() - 28;
                        parentDiv.scrollTop(goTop);

                    } catch (e) {
                        //ignore
                    }
                }, 1000);
            });
        });

        $scope.allCouriers = {display: false, includeUA: false};
        $scope.mapZoom = {display: true};
        $scope.supportSettings = {autoRefresh: true};

        $scope.options = {
            "detail": {
                "size": [{
                    "id": 1, "label": "Bike"
                }, {
                    "id": 2, "label": "Car"
                }, {
                    "id": 3, "label": "Van"
                }, {
                    "id": 4, "label": "Truck"
                }, {
                    "id": 5, "label": "Scooter"
                }], "tracking": [{
                    "id": 1, "label": "Email"
                }, {
                    "id": 2, "label": "Mobile"
                }, {
                    "id": 3, "label": "Email & Mobile"
                }], "DGClass": [{
                    "id": 0, "label": "0"
                }, {
                    "id": 1, "label": "1"
                }, {
                    "id": 2, "label": "2"
                }, {
                    "id": 3, "label": "3"
                }, {
                    "id": 4, "label": "4"
                }, {
                    "id": 5, "label": "5"
                }, {
                    "id": 6, "label": "6"
                }, {
                    "id": 7, "label": "7"
                }, {
                    "id": 8, "label": "8"
                }, {
                    "id": 9, "label": "9"
                }]
            }
        };
        $scope.markers = [];
        $scope.truckCourierStatus = [];
        $scope.getJobStyle = assigned => {
            const normal = {
                "font-weight": "normal"
            };

            const bold = {
                "font-weight": "bold"
            };

            if (assigned) {
                return bold;
            } else {
                return normal;
            }
        };
        $scope.normalStyle = "{'font-weight:normal'}";
        $scope.showChat = false;
        $scope.chatBox = "";
        $scope.boxes = {
            "jobsList": {
                "title": "Jobs List",
                "tpl": versionUrl("app/components/home/tpls/jobList.tpl"),
                "showSearch": 1,
                "showRefresh": 1
            }, "jobDetail": {
                "title": "Detail",
                "tpl": versionUrl("app/components/common/tpls/jobDetail.tpl"),
                "showSearch": 0,
                "showRefresh": 0,
                "showDetailButtons": 1
            }, "potentialCouriers": {
                "title": "Potential Couriers",
                "tpl": versionUrl("app/components/home/tpls/potentialCouriers.tpl"),
                "showSearch": 1
            }, "currentWork": {
                "title": "Current Work",
                "tpl": versionUrl("app/components/home/tpls/currentWork.tpl"),
                "showSearch": 1,
                "showRefresh": 0
            }, "couriersMoveThrough": {
                "title": "Couriers Movement Through List",
                "tpl": versionUrl("app/components/home/tpls/couriersMovementThroughList.tpl"),
                "showSearch": 1,
                "showRefresh": 0
            }, "courierMovePickedUp": {
                "title": "Couriers Movement Picked Up Run",
                "tpl": versionUrl("app/components/home/tpls/couriersMovementPickedUp.tpl"),
                "showSearch": 1,
                "showRefresh": 0
            }, "courierMoveClear": {
                "title": "Couriers Movement Clear List",
                "tpl": versionUrl("app/components/home/tpls/couriersMovementClearList.tpl"),
                "showSearch": 1,
                "showRefresh": 0
            }, "areaList": {
                "title": "Area List",
                "tpl": versionUrl("app/components/home/tpls/areaList.tpl"),
                "showSearch": 0,
                "showRefresh": 0
            }, "jobUpdates": {
                "title": "Job Updates",
                "tpl": versionUrl("app/components/home/tpls/jobUpdates.tpl"),
                "showSearch": 0,
                "showRefresh": 0
            }, "supports": {
                "title": "Supports",
                "tpl": versionUrl("app/components/home/tpls/supports.tpl"),
                "showSearch": 0,
                "showRefresh": 0
            }, "lateCalls": {
                "title": "Late Calls",
                "tpl": versionUrl("app/components/home/tpls/lateCalls.tpl"),
                "showSearch": 0,
                "showRefresh": 0
            }, "map": {
                "title": "Google Map",
                "tpl": versionUrl("app/components/home/tpls/map.tpl"),
                "showSearch": 0,
                "showRefresh": 1
            }, "clearLists": {
                "title": "Clear Lists",
                "tpl": versionUrl("app/components/home/tpls/clearLists.tpl"),
                "showSearch": 0,
                "showRefresh": 0
            }
        };
        $scope.pickService = {
            "clients": [], "channel": [], "channelTexts": {
                buttonDefaultText: "Select Channel..."
            }, "channelEvents": {
                "onSelectionChanged": () => {
                    const temp = $scope.pickService.channel.map(el => el.label);

                    $scope.setSupportChannel(String(temp) || "All");
                }
            }, "settings": {
                "enableSearch": true,
                "selectedToTop": true,
                "closeOnBlur": true,
                "closeOnSelect": true,
                "buttonClasses": "topBarActive btn-sm btn-clients"
            }
        };
        $scope.pickClients = [];
        $scope.pickChannels = [{
            "id": "1", "label": "City"
        }, {
            "id": "2", "label": "Main"
        }, {
            "id": "3", "label": "Trucks"
        }];

///////////////////////////////
// LAYOUT
///////////////////////////////
        let layoutsObject = null;
        if (Modernizr.localstorage) {
            layoutsObject = JSON.parse(localStorage.getItem("layouts-" + ContactID));
            $scope.mapZoom = JSON.parse(localStorage.getItem("mapZoom-" + ContactID)) || {display: true};
        }
        const defaultLayout = [{
            name: "Default", layout: {
                "columns": [{
                    "id": "col1", "width": "1100px", "boxes": [{
                        "name": "jobsList"
                    }]
                }, {
                    "id": "col2", "width": "300px", "boxes": [{
                        "name": "currentWork", "height": "300px"
                    }, {
                        "name": "potentialCouriers", "height": "200px"
                    }, {
                        "name": "supports", "height": "300px"
                    }, {
                        "name": "jobDetail", "height": "300px"
                    }]
                }, {
                    "id": "col3", "width": "300px", "boxes": $scope.isInternal ? [{
                        "name": "clearLists", "height": "600px"
                    }, {
                        "name": "map"
                    }] : [{
                        "name": "map"
                    }]
                }]
            }
        }];


        if (layoutsObject !== null) {
            layoutsObject[0] = defaultLayout[0];
        }

        $scope.layouts = layoutsObject || defaultLayout;
        $scope.currentLayoutName = "default";
        $scope.truckMode = "On";
        $scope.supportChannel = JSON.parse(localStorage.getItem("support-channel-" + ContactID)) || "All";

        $scope.groupJobsSelection = "";
        $scope.currentWorkSelection = "";
        $scope.potentialCouriersSelection = "";

        $scope.storeMapZoomDisplay = () => {
            if (Modernizr.localstorage) {
                localStorage.setItem("mapZoom-" + ContactID, JSON.stringify({display: $scope.autoZoomEnabled}));
            }
        };

        $scope.layout = angular.copy($scope.layouts[0].layout);

        /**
         * @param {Number} index
         */
        $scope.deleteLayout = (index) => {
            const deleteConfirm = $mdDialog.confirm()
                .title('Delete Layout?')
                .textContent('Are you sure you would like to delete this layout?')
                .ariaLabel('delete layout')
                .ok('Delete')
                .cancel('Cancel');

            $mdDialog.show(deleteConfirm).then(() => {
                $scope.layouts.splice(index, 1);
                if (Modernizr.localstorage) {
                    localStorage.setItem("layouts-" + ContactID, JSON.stringify($scope.layouts));
                }
            }, () => {
                console.log("Delete layout canceled!");
            });
        }

        /**
         * @param {string} layoutName
         */
        $scope.setLastActiveLayoutName = layoutName => {
            if (Modernizr.localstorage) {
                localStorage.setItem("lastActiveLayout-" + ContactID, layoutName);
            }
        };

        /**
         * @param {number} index
         */
        $scope.loadLayout = (index) => {
            $scope.currentLayoutName = $scope.layouts[index].name;
            $scope.layout = angular.copy($scope.layouts[index].layout);

// save layout as last active
            $scope.setLastActiveLayoutName($scope.currentLayoutName);

            safeTimeout($scope.getData, 1000);
        };

        $scope.saveLayout = () => {
            angular.forEach($scope.layout.columns, (column) => {
                column.width = angular.element("#co-" + column.id).css("flex-basis");
                angular.forEach(column.boxes, (box) => {
                    box.height = angular.element("#box-" + box.name).css("flex-basis");
                });
            });

            const saveLayoutPrompt = $mdDialog.prompt()
                .title('Save Layout')
                .textContent('Please enter a name for this layout.')
                .ariaLabel('Layout name')
                .required(true)
                .ok('Save')
                .cancel('Cancel');

            $mdDialog.show(saveLayoutPrompt).then(layoutName => {
                if (Modernizr.localstorage) {
                    $scope.layouts = $scope.layouts.concat({
                        name: layoutName, layout: angular.copy($scope.layout)
                    });
                    localStorage.setItem("layouts-" + ContactID, JSON.stringify($scope.layouts));

// save last active layout
                    $scope.setLastActiveLayoutName(layoutName);
                }

                const deferred = $q.defer();
                deferred.resolve({
                    data: "OK"
                });
                return deferred.promise;
            }, () => {
                console.log("Save Layout Cancelled!")
            });
        };

        $scope.supportChannelChanged = () => {
            console.log($scope.pickService.channel);
        };

        $scope.onCourierSearchClick = ($event) => {
// Check if the click target is the input field itself
            if ($event.target.tagName === 'INPUT') {
                $scope.courierSearchText = '';
            }
        };

        $scope.handleRowClick = ($event, job) => {
// Check if the click target is not one of the special input fields
            if (!$event.target.classList.contains('lateCallField') && !$event.target.classList.contains('dispatchField')) {
// Use $timeout to ensure this runs after the current digest cycle
                safeTimeout(() => {
                    $scope.selectJob(job);
                    angular.element("#input_" + job.id).select();
                });
            }
        };

        $scope.attention = job => {
            let temp = "";

            if (job.direct) {
                temp += "DIRECT ";
            }
            if (job.van) {
                temp = "VAN ";
            }
            if (job.truck || job.speedID === 45) {
                temp += "TRUCK ";
            }
            if (job.return) {
                temp += "RTN ";
            }
            if (job.size.id === 2 && !job.van && !job.truck && job.speedID !== 45) {
                temp = "CAR " + temp;
            }
            if (job.size.id === 5) {
                temp = "Scoot " + temp;
            }

            if (job.childNotes !== null && job.childNotes.length > 0) {
                temp += job.childNotes;
            }
            if (job.pickupFrom === 1) {
                temp += "R ";
            } else {
                if (job.pickupFrom === 2) {
                    temp += "D ";
                }
            }

            if (job.saturdayDelivery) {
                temp += "Sat Del";
            }

            return temp.trim();
        };

        $scope.sortableOptions = {
            connectWith: ".column-sortable",
            items: ".box",
            placeholder: "placeholder",
            scroll: true,
            scrollSensitivity: 100,
            scrollSpeed: 20,
            handle: ".box-handle",
            activate(e, ui) {
                const box = angular.element("#" + ui.item.context.id);
                const parent = box.parent();
                const boxes = parent.children().filter((_, child) => angular.element(child).hasClass('box'));

                angular.forEach(boxes, boxElement => {
                    let box = angular.element(boxElement);
                    box.attr("data-height", box.prop('offsetHeight') + "px");
                });
            },
            update(e, ui) {
                safeTimeout(() => {
                    const box = angular.element("#" + ui.item.context.id);
                    const parent = box.parent();
                    const boxes = parent.children().filter((_, child) => angular.element(child).hasClass('box'));

                    angular.forEach(boxes, boxElement => {
                        let box = angular.element(boxElement);
                        box.css({"flex-basis": box.attr("data-height")});
                    });

                    angular.element(boxes[boxes.length - 1]).css({"flex-basis": "0"});
                }, 0);
            }
        };

        $scope.showInput = {};
        $scope.inputWidth = {};

        /**
         * @param {string} boxName
         * @param {number} index
         */
        $scope.openSearch = (boxName, index) => {
            const boxID = boxName + '-' + index;
            if ($scope.showInput[boxID]) {
                $scope.showInput[boxID] = false;
                $scope.inputWidth[boxID] = 31;
            } else {
                $scope.inputWidth[boxID] = 200;
                $scope.showInput[boxID] = true;
            }
        };


        $scope.openChat = () => {
            if (angular.element(".chat").hasClass("open")) {
                angular.element(".chat input").fadeOut(() => {
                    angular.element(".chat").removeClass("open");
                    angular.element(".chat").animate({"width": "31px"}, 500);
                });
            } else {
                angular.element(".chat").animate({"width": "250px"}, 500, () => {
                    angular.element(".chat").addClass("open");
                    angular.element(".chat").find("input").fadeIn();
                });
            }
        };

        $scope.allCouriers.display = true;
//Column Sorting
        $scope.sort = [];
        $scope.orderList = (list, prop) => {
            const serverOrder = list === "jobList";
            if ($scope.sort[list] !== prop) {
                $scope.sort[list] = prop;
                $scope.jobFilters.asc = "asc";
                if (!serverOrder) {
                    $scope[list] = $filter("orderBy")($scope[list], prop);
                }

            } else {
                $scope.sort[list] = "d-" + prop;
                $scope.jobFilters.asc = "desc";
                if (!serverOrder) {
                    $scope[list] = $filter("orderBy")($scope[list], "-" + prop);
                }

            }

            if (serverOrder) {
                $scope.setFilters({"order": prop});
            }
        };

        ///////////////////////////
        // HOTKEYS
        //////////////////////////
        hotkeys.add({
            combo: "ctrl+d",
            description: "Dispatch selected jobs",
            allowIn: ["INPUT", "SELECT", "TEXTAREA"],
            callback: () => {
                if ($(".activeTable .active").length > 0) {
                    $scope.dispatchJobsForm();
                }
            }
        });

        /**
         * @param {Job} currentJob
         */
        $scope.unlockJob = currentJob => {
            return jdSvc.unlockJob(currentJob);
        };

        /**
         * @param {Job} currentJob
         */
        $scope.lockJob = currentJob => {
            return jdSvc.lockJob(currentJob);
        };

        /**
         * @param {number} id
         * @param {$event} event
         * @param {string} area
         */
        $scope.selectClearList = (id, event, area) => {
            let areaGroupButtons = angular.element("#area-group .btn");
            areaGroupButtons.removeClass("topBarActive");

            let clearListsActive = angular.element("#clearLists .listActive");
            if (clearListsActive.length <= 1) {
                $scope.getClearListEnvelope(id);
            }

            $scope.setFilters({'clearList': area});
        };

        $scope.selectForDispatch = job => {
            console.log("In SelectForDispatch");
            $scope.jobForDispatch = job;
        };

        $scope.swapPOD = event => {
            const jobNumberPrompt = $mdDialog.prompt()
                .title('Enter the other job number')
                .textContent('Please enter the Job Number to swap the POD.')
                .placeholder('Job Number')
                .ariaLabel('Job Number')
                .targetEvent(event)
                .required(true)
                .ok('Submit')
                .cancel('Cancel');

            $mdDialog.show(jobNumberPrompt).then(jobNumber => uCSData.validateSwapPOD(jobNumber).then(data => {
                if (!data) {
                    $mdDialog.show($mdDialog.alert()
                        .clickOutsideToClose(true)
                        .title('Invalid Job')
                        .textContent('This job is invalid.')
                        .ok('OK'));
                } else {
                    const secondJobId = data;
                    const firstJobId = $scope.currentJob.id;

                    const confirmSwap = $mdDialog.confirm()
                        .title('Swap Delivery Info?')
                        .textContent(`Are you sure you wish to swap delivery info between ${$scope.currentJob.jobNo} and ${jobNumber}?`)
                        .targetEvent(event)
                        .ok('Yes')
                        .cancel('No');

                    $mdDialog.show(confirmSwap).then(() => {
                        uCSData.swapPOD($scope.currentJob.jobNo, jobNumber).then(() => {

                            $mdDialog.show($mdDialog.alert()
                                .clickOutsideToClose(true)
                                .title('Successful')
                                .textContent('POD Swap Completed Successfully')
                                .ok('OK'));

                            uCSData.reSendJobs(secondJobId);
                            uCSData.reAssignJobs(firstJobId).then(() => {
                                uCSData.reSendJobs(firstJobId).then(() => {
                                    $scope.refreshData(true);
                                });
                            });

                        });
                    }, () => {
                        console.log("POD Swap Canceled");
                    });
                }
            }), () => {
// action when cancel is clicked
            });
        }

        /**
         * @param {string} jobNumber
         * @param {number} jobId
         */
        $scope.voidJobForm = (jobNumber, jobId) => {
            const voidJobPrompt = $mdDialog.prompt()
                .title("Void Job")
                .textContent("Add Note")
                .placeholder('Note')
                .ariaLabel('Void job')
                .required(true)
                .ok('Void')
                .cancel('Cancel');

            $mdDialog.show(voidJobPrompt).then(note => {
                return DispatchData.addNote(jobId, note, FirstName, false).then(() => {
                    return DispatchData.voidJob(jobId).then(() => {
                        return $scope.getData();
                    })
                }, () => {
// User canceled the void
                });
            });
        }

        /**
         * @param {$event} event
         * @param {Job} job
         */
        $scope.messageClick = (event, job) => {
            const selectedCourierId = $scope.selectedCourier ? $scope.selectedCourier.id : job.courierData.courierID;

            $mdDialog.show({
                controller: SendMessageDialogController,
                controllerAs: 'ctrl',
                parent: angular.element($document.body),
                targetEvent: event,
                templateUrl: versionUrl('app/components/dialogs/send-message-dialog/send-message-dialog.html'),
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    selectedCourierId, contactId: ContactID, dispatcherName: FirstName,
                },
            }).then(_ => {
                console.log('Dialog closed!')
            });
        }

        /**
         * @param {$event} $event
         * @param {Job} job
         */
        $scope.otherEventForm = ($event, job) => {
            $mdDialog.show({
                controller: AddEventDialogController,
                controllerAs: "ctrl",
                templateUrl: versionUrl("app/components/dialogs/add-event-dialog/add-event-dialog.html"),
                parent: angular.element($document.body),
                targetEvent: $event,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    job: job, dispatcherName: FirstName, contactId: ContactID
                }
            }).then(() => {
                console.log('Pallet Dialog closed!');
            });
        };


        $scope.getSupportColorClass = support => {
            switch (support.eventType) {
                case 73:
                    return "Yel";
                case 1:
                    return "Gre";
                case 2:
                    return "Gre";
                default:
                    break;
            }
        }

////////////////////////////////////////
// LOAD DISPATCH JOBS SCREEN
///////////////////////////////////////


        /**
         * @param {number} lat
         * @param {number} lng
         * @param {Object} flags
         * @param {string} carMarker
         * @param {number} jobNumber
         */
        $scope.dispatchDroppedMarkerToClosestCourier = (lat, lng, flags, carMarker, jobNumber) => {
            if (flags.length === 0 && carMarker === null) {
                const confirm = $mdDialog.confirm()
                    .title('Dispatch Invalid')
                    .textContent('Could not find courier for Dispatch')
                    .ok('Close')
                    .cancel();

                $mdDialog.show(confirm).then(() => {
                    const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                    displayPickupPoints(unDispatchedData, true, null);
                    $scope.getAvailableCourierLocation();
                });
                return;
            }

            console.log(jobNumber);

            let toCompare = [];

            angular.forEach(flags, (f, key) => {
                toCompare.push([key, f.position.lat(), f.position.lng()]);
            });

            if (carMarker !== null) {
                toCompare.push([9999, carMarker.position.lat(), carMarker.position.lng()]);
            }

            let closestIndex = closestLocation(lat, lng, toCompare);
            let closestCourier = closestIndex[0] === 9999 ? carMarker : flags[closestIndex[0]];
            let foundCourier = $scope.pickCouriers.find(c => c.courierID === closestCourier.courierId);

            let dispatchToCourierCode = closestCourier.code;
            if (closestIndex[0] !== 9999) {
                if (foundCourier !== undefined) {
                    if (foundCourier.code === undefined) {
                        dispatchToCourierCode = foundCourier.label;
                    } else {
                        dispatchToCourierCode = dispatchToCourierCode + ' ' + foundCourier.code;
                    }
                }
            }

            const confirm = $mdDialog.confirm()
                .title('Dispatch Job ' + jobNumber)
                .textContent('Dispatch to ' + dispatchToCourierCode + '?')
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(() => {
                let j = $scope.jobList.find(jo => jo.jobNo === jobNumber);
                let jn = j.jobNo;

                if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                    $mdDialog.alert().clickOutsideToClose(true).title("DG job " + jn + " can not be despatched to courier " + courier + " - doesn't have DGLicense.").ok('Close').show();
                    return;
                }
                if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                    $mdDialog.alert().clickOutsideToClose(true).title("Courier " + courier + " doesn't have a DGLicense or license has expired.").ok('Close').show();
                    return;
                }

                if (j.dgClass !== null && j.dgClass > 0) {
                    DispatchData.addFollowupEvent(jn, j.clientID, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
                }
                let jobs = [];
                jobs.push(j.id);
                return DispatchData.allocateJobs(foundCourier.courierID, ContactID, jobs).then(() => {
                    $scope.getData().then(() => {
                        angular.element('#box-map .loading').css('display', '');

                        $scope.courier = {gpsCourier: foundCourier.id};
                        $scope.searchCourier();
                    });
                });
            }, () => {
                let unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                displayPickupPoints(unDispatchedData, true, null);
                $scope.getAvailableCourierLocation();
            });
        };

        $scope.selectAllContent = $event => {
            $event.target.select();
        };

        $scope.latePickup = (minsAway, j, obj) => {
            console.log("current = " + j.lp);
            console.log("param minsAway = " + minsAway);
            console.log(obj);
            $scope.lateCall(minsAway, 1, j, true);
        }

        $scope.lateDelivery = (minsAway, j, obj) => {
            console.log("current = " + j.ld);
            console.log("param minsAway = " + minsAway);
            console.log(obj);
            $scope.lateCall(minsAway, 2, j, true);

        }

/////////////////////////////////////
// LATE CALLS
/////////////////////////////////////
        /**
         * @param {Date} lateTime
         * @param {number} lateType
         * @param {Job} job
         * @param {boolean} calc
         */
        $scope.lateCall = (lateTime, lateType, job, calc) => {
            return DispatchData.lateCall(lateType, lateTime, job.minutes, job.pickupTime, job.alertLatePickup, job.deliveryTime, job.alertLateDelivery, job.jobNo, job.clientId, job.contactName, ContactID, job.time, job.id, job.jobType, job.speed, job.notify || job.speed, FirstName, calc)
                .then(response => {
                    $scope.getData().then(() => {
                        toastrService.showSuccessToast("Late call applied successfully");
                    });
                    return response;
                });
        };

        $scope.jobClass = job => {
            let classToUse = job.direct ? "direct " : "";
            classToUse = classToUse + ((job.speed === "CT" || job.speed === "CTHIRE" || job.speed === "FT" || job.speed === "FTHIRE" || job.speed === "HC" || job.speed === "TC") ? "chilled" : "");
            return classToUse;
        }

////////////////////////////////////////
// DISPATCH THE JOBS
///////////////////////////////////////
        $scope.getJobsToDispatch = () => {
            let activeJobs = Array.from(angular.element("#jobList .active"));
            return $scope.jobList.filter(jo => activeJobs.some(aJob => jo.id === $(aJob).data("jobid")));
        }

        $scope.dispatchJobs = courierNumber => {
            const deferred = $q.defer();

            const jobsToDispatch = $scope.getJobsToDispatch();

            if (!Array.isArray(jobsToDispatch) || jobsToDispatch.length === 0) {
                console.warn('No jobs to dispatch');
                deferred.resolve();
                return deferred.promise;
            }

            dispatchJobService.dispatchJobs(courierNumber, jobsToDispatch)
                .then(() => $scope.getJobList())
                .then(() => {
                    deferred.resolve();
                })
                .catch(error => {
                    console.error('Error dispatching jobs:', error);
                    deferred.reject(error);
                });

            return deferred.promise;
        };

////////////////////////////////////////
// RESTORE JOB
///////////////////////////////////////
        $scope.restoreJobs = function () {
            const $q = this.$q;

            const callData = {
                "call": "restoreJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
            };

            let foundCourier = null;

            const activeElements = angular.element('#jobList .active');
            angular.forEach(activeElements, element => {
                const currentElement = angular.element(element);
                const jobId = currentElement.data("jobid");
                const job = $scope.jobList.find(jo => jo.id === jobId);

                if (job) {
                    const jobNo = job.jobNo;
                    DispatchData.addRestoreEvent(jobNo, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
                    if (callData.courierID === null) {
                        callData.courierID = job.courierData.courierID;
                        foundCourier = $scope.pickCouriers.find(c => c.courierID === job.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === job.courierData.courierID);
                    }
                    if (job.displaySplitJobDetail) {
                        callData.splitJobs.push(jobId);
                    } else {
                        callData.jobs.push(jobId);
                    }
                }
            });

            const promises = [];

            if (callData.splitJobs.length > 0) {
                promises.push(DispatchData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs));
            }
            if (callData.jobs.length > 0) {
                promises.push(DispatchData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs));
            }

            return $q.all(promises)
                .then(() => $scope.getData())
                .then(() => {
                    angular.element('#box-map .loading').css('display', '');

                    $scope.courier = {gpsCourier: foundCourier.id};
                    return $scope.searchCourier();
                });
        };

////////////////////////////////////////
// REDESPATCHED JOB
///////////////////////////////////////
        $scope.reAllocateJobs = () => {
            const callData = {
                "call": "redespatchJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
            };

            let foundCourier = null;

            let activeElements = angular.element('#jobList .active');
            for (let i = 0; i < activeElements.length; i++) {
                const currentElement = angular.element(activeElements[i]);
                const jobId = currentElement.attr("data-jobid");
                let job = $scope.jobList.find(jo => jo.id === jobId);
                if (job) {

                    foundCourier = $scope.pickCouriers.find(c => c.courierID === job.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === job.courierData.courierID);
                    callData.jobs.push(jobId);
                }
            }

            if (callData.jobs.length > 0) {
                DispatchData.reAllocateJobs(foundCourier.courierID, ContactID, callData.jobs);
            }

            $scope.getData().then(() => {
                angular.element('#box-map .loading').css('display', '');

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();
            });
        };

        $scope.resendJobs = () => {
            const activeJobElements = angular.element("#jobList .active");
            const jobIds = activeJobElements.map((index, element) => angular.element(element).attr("data-jobid")).get();

            if (jobIds.length === 0) {
                return;
            }

            DispatchData.resendJobs(jobIds)
                .then(() => $scope.getData())
                .then(() => {
                    const lastJobElement = activeJobElements.last();
                    const lastJobId = lastJobElement.attr("data-jobid");
                    const lastJob = $scope.jobList.find(job => job.id === lastJobId);

                    const foundCourier = $scope.pickCouriers.find(c => c.courierID === lastJob.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === lastJob.courierData.courierID);

                    if (foundCourier) {
                        $scope.courier = {gpsCourier: foundCourier.id};
                        $scope.searchCourier();
                    }

                    angular.element('#box-map .loading').css('display', '');
                })
                .catch(error => {
                    console.error('Error updating data:', error);
                });
        };

        /**
         * @param  {$event}  $event
         */
        $scope.restoreAll = $event => {
            let confirm = $mdDialog.confirm()
                .title('Restore All Jobs')
                .textContent('Are you sure you wish to restore all jobs for ' + $scope.currentCourier.courier)
                .targetEvent($event)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(() => {
                let callData = {
                    "call": "restoreJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
                };

                let foundCourier = null;

                angular.element("#currentWork tr.droppable-row").each(function () {
                    const j = $scope.jobsCurrentList.find(function (jo) {
                        return jo.id === angular.element(this).data("jobid")
                    });
                    const jn = j.jobNo;
                    DispatchData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
                    if (callData.courierID === null) {
                        callData.courierID = j.courierData.courierID;
                        foundCourier = $scope.pickCouriers.find(c => {
                            return c.courierID === j.courierData.courierID
                        }) || $scope.pickAllCouriers.find(c => c.courierID === j.courierData.courierID);
                    }
                    if (j.displaySplitJobDetail) {
                        callData.splitJobs.push(angular.element(this).data("jobid"));
                    } else {
                        callData.jobs.push(angular.element(this).attr("data-jobid"));
                    }
                });

                if (callData.splitJobs.length > 0) {
                    DispatchData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs);
                }
                if (callData.jobs.length > 0) {
                    DispatchData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
                }

                safeTimeout(() => {
                    $scope.getCurrentJobs(foundCourier.courierID);
                    $scope.getData();
                }, 1000);
            }, () => {
// Cancelled dialog.
            });
        };

        /**
         * @param       {$event}  $event
         */
        $scope.redispatchAll = $event => {
            const confirm = $mdDialog.confirm()
                .title('Restore All Jobs')
                .textContent('Are you sure you wish to redispatch all jobs for ' + $scope.currentCourier.courier)
                .targetEvent($event)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(() => {
                let callData = {
                    "call": "redespatchJobs",
                    "jobs": [],
                    "splitJobs": [],
                    "jobNos": [],
                    "courierID": $scope.currentCourier.courierID
                };

                let foundCourier = null;

                angular.element("#currentWork tr.droppable-row").each(function () {
                    callData.jobs.push(angular.element(this).attr("data-jobid"));
                    foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === callData.courierID);
                });

                if (callData.jobs.length > 0) {
                    DispatchData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
                }

                $scope.getData().then(() => {
                    angular.element('#box-map .loading').css('display', '');
                    $scope.courier = {gpsCourier: foundCourier.id};
                    $scope.searchCourier();
                });
            }, () => {
// Cancelled dialog.
            });
        };

        /**
         * @param  {$event}  $event
         */
        $scope.resendAll = $event => {
            let confirm = $mdDialog.confirm()
                .title('Resend All Jobs')
                .textContent('Are you sure you wish to resend all jobs for ' + $scope.currentCourier.courier)
                .targetEvent($event)
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(() => {
                let callData = {
                    "call": "resendJobs",
                    "jobs": [],
                    "splitJobs": [],
                    "jobNos": [],
                    "courierID": $scope.currentCourier.courierID
                };

                let foundCourier = null;

                angular.element("#currentWork tr.droppable-row").each(function () {
                    callData.jobs.push(angular.element(this).attr("data-jobid"));
                    foundCourier = $scope.pickCouriers.find(c => {
                        return c.courierID === callData.courierID
                    }) || $scope.pickAllCouriers.find(c => {
                        return c.courierID === callData.courierID
                    });
                });

                if (callData.jobs.length > 0) {
                    DispatchData.resendAllJobs(callData.courierID);
                }

                $scope.getData().then(() => {
                    angular.element('#box-map .loading').css('display', '');
                    $scope.courier = {gpsCourier: foundCourier.id};
                    $scope.searchCourier();
                });
            }, () => {
// No action for 'No'
            });

        };

        $scope.reAllocateJobsFromCurrentWindow = () => {
            let callData = {
                "call": "redespatchJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": $scope.currentCourier.courierID
            };

            let foundCourier = null;

            angular.element("#currentWork .active").each(function () {
                callData.jobs.push(angular.element(this).attr("data-jobid"));
                foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === callData.courierID);
            });

            if (callData.jobs.length > 0) {
                DispatchData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
            }

            $scope.getData().then(() => {
                angular.element('#box-map .loading').css('display', '');
                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();
            });
        };

        $scope.resendJobsFromCurrentWindow = () => {
            let callData = {
                "call": "resendJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": $scope.currentCourier.courierID
            };

            let foundCourier = null;

            angular.element("#currentWork .active").each(function () {
                callData.jobs.push(angular.element(this).attr("data-jobid"));
                foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === callData.courierID);
            });

            if (callData.jobs.length > 0) {
                DispatchData.resendJobs(callData.jobs);
            }

            $scope.getData().then(() => {
                angular.element('#box-map .loading').css('display', '');
                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();
            });
        };

        $scope.restoreJobsFromCurrentWindow = () => {
            let callData = {
                "call": "restoreJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
            };

            let foundCourier = null;

            angular.element("#currentWork .active").each(function () {
                let jobIdElement = angular.element(this);
                let j = $scope.jobsCurrentList.find(jo => jo.id === jobIdElement.data("jobid"));
                let jn = j.jobNo;
                DispatchData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
                if (callData.courierID === null) {
                    callData.courierID = j.courierData.courierID;
                    foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === j.courierData.courierID)
                }
                if (j.displaySplitJobDetail) {
                    callData.splitJobs.push(jobIdElement.data("jobid"));
                } else {
                    callData.jobs.push(jobIdElement.attr("data-jobid"));
                }
            });

            if (callData.splitJobs.length > 0) {
                DispatchData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs);
            }
            if (callData.jobs.length > 0) {
                DispatchData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
            }

            safeTimeout(() => {
                $scope.getCurrentJobs(foundCourier.courierID);
                $scope.getData();
            }, 1000);
        };

        /**
         * @param {Job} job
         */
        $scope.setFirstJob = job => {
            let confirm = $mdDialog.confirm()
                .title('Set First Job?')
                .textContent('Are you sure you wish to set this as the First Job?')
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(() => {
                DispatchData.setFirstJob(job.id, $scope.currentCourier.courierID).then(() => {
                    $scope.getCurrentJobs($scope.currentCourier.courierID);
                });
            }, () => {
// No action for 'No'
            });
        };

//////////////////////////////
//  SPLIT JOB //
/////////////////////////////
        /**
         * @param {$event} $event
         * @param {Job} job
         */
        $scope.splitJob = ($event, job) => {
            if (!job.allowSplit) {
                return showAlert($event, 'Unable to split job', `Can not split ${job.JobNo}.`);
            }

            return showConfirm($event, 'Split Job?', 'Are you sure you wish to split this job?')
                .then(result => {
                    if (result) {
                        loadingService.showLoader();
                        return DispatchData.splitJob(job.id, FirstName)
                            .then(() => {
                                loadingService.closeLoader();
                                return $scope.setSplitJobMeetingPoint($event, job);
                            });
                    }
// If the user clicked 'No', we don't do anything
                    return Promise.resolve();
                })
                .catch(error => {
                    loadingService.closeLoader();
                    if (error instanceof Error) {
                        toastrService.showErrorToast(error.message);
                    }
                    console.log("Splitting job failed:", error);
                });
        };

        /**
         * @param {$event} $event
         * @param {string} title
         * @param {string} content
         */
        function showAlert($event, title, content) {
            return $mdDialog.show($mdDialog.alert()
                .parent(angular.element($document.body))
                .clickOutsideToClose(true)
                .title(title)
                .textContent(content)
                .ariaLabel('Alert')
                .ok("OK")
                .targetEvent($event));
        }

        /**
         * @param {$event} $event
         * @param {string} title
         * @param {string} content
         */
        function showConfirm($event, title, content) {
            const confirm = $mdDialog.confirm()
                .title(title)
                .textContent(content)
                .ariaLabel('Confirm')
                .targetEvent($event)
                .ok('Yes')
                .cancel('No');

            return $mdDialog.show(confirm);
        }

//////////////////////////////
//  PALLET CONTROLS //
/////////////////////////////
        $scope.palletMenu = [// NEW IMPLEMENTATION
            {
                text: "Delete", click($itemScope) {
//$scope.items.splice($itemScope.$index, 1);

                    const index = $scope.currentJob.PalletInfo.indexOf($itemScope.pallet);
                    $scope.currentJob.PalletInfo.splice(index, 1);

//LOCK WITH CURRENT USER

                }
            }];


//ACTIVATE DROP
        $scope.activateDrop = () => {
            safeTimeout(() => {
                $document.ready(() => {
                    angular.element(".droppable-row").droppable({
                        classes: {
                            "ui-droppable-hover": "active"
                        }, drop() {

                            let parent = angular.element(this).parents(".box");
                            let parentOffset = parent.offset();
                            let parentTop = parentOffset.top;
                            let parentBottom = parentTop + parent.outerHeight();

                            let row = angular.element(this);
                            let rowOffset = row.offset();
                            let rowTop = rowOffset.top;
                            let rowBottom = rowTop + row.outerHeight();

                            if (rowTop < parentBottom && rowBottom > parentTop) {

                                angular.element(this).css({"background-color": "#c6dfad"});
                                angular.element(this).animate({backgroundColor: "inherit"}, 300, function () {
                                    angular.element(this).removeAttr("style");
                                });
                                $scope.dispatchJobs(angular.element(this).attr("data-courier").replace(/[^\d.-]/g, ''));
                                $scope.getClearListsData();
                            }
                        }
                    });
                });
            }, 0);
        };

////////////////////////////
// POTENTIAL COURIERS
////////////////////////////

        /**
         * @param {number} jobId
         */
        $scope.getPotentialCouriers = (jobId) => {

            angular.element('#box-potentialCouriers .loading').css('display', 'block');
            DispatchData.getPotentialCouriers(jobId).then((data) => {

                $scope.potentialCouriers = data;

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);

                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);

                angular.element('#box-potentialCouriers .loading').css('display', 'none');

                $scope.activateDrop();
            });
        };

        /**
         * @param {string} searchText
         */
        $scope.courierSearch = searchText => {
            const url = "/courier/AllActiveSearch";

            return DispatchData.autocompleteSearch(searchText, url)
                .then(result => result)
                .catch(error => {
                    toastrService.showErrorToast(error.message);
                });
        };
        $scope.jobRecordSearchText = "";

        /**
         * @param {string} searchText
         */
        $scope.jobRecordSearch = searchText => {
            return $scope.jobList
                .filter(job => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
                .map(job => ({id: job.id, text: job.jobNo}));
        }

        /**
         * @param {number} selectedJobId
         */
        $scope.JobRecordSelected = selectedJobId => {
            const selectedJob = $scope.jobList.find(job => job.id === selectedJobId);
            $scope.selectJob(selectedJob);
        }

        /**
         * @param {number} courierID
         * @param {string} courierName
         */
        $scope.updateCourierData = (courierID, courierName) => {
            $scope.currentWorkSelection = ` for Courier  ${courierID}  ${courierName}`;
            $scope.currentCourier = {
                courierID, courier: courierName
            };

            $scope.currentSelection = ` for Courier ${courierID}  ${courierName}`;
            $scope.getCurrentJobs(courierID);
            DispatchData.truckCourierStatus(courierID).then(result => {
                $scope.truckCourierStatus = result.data;
            });
        };

        $scope.displayLoadingIndicators = () => {
            loadingService.showLoader();
        };

        $scope.hideLoadingIndicators = () => {
            loadingService.closeLoader();
        };

        $scope.selectedCourier = null;
        $scope.selectedCourierChange = courier => {
            if (courier === undefined) {
                $scope.currentCourier = null;
            } else {
                $scope.updateCourierData(courier.id, courier.text);
            }
        };

        $scope.searchCourier = () => {
            $scope.displayLoadingIndicators();
            let foundCourier = $scope.pickAllCouriers.find(c => c.id === $scope.courier.gpsCourier);
            console.log(foundCourier);
            if (foundCourier === undefined) {
                $scope.hideLoadingIndicators();
                $mdDialog.show($mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Attention')
                    .textContent('Courier not found.')
                    .ok('OK'));
                return;
            }
            $scope.updateCourierData(foundCourier.id, foundCourier.name);
            $scope.hideLoadingIndicators();
        };

// Select the courier
        $scope.selectCourier = (courier) => {
            const loadingElement = angular.element("#box-jobDetail .loading");
            const mapLoadingElement = angular.element('#box-map .loading');

            loadingElement.css('display', 'block');
            mapLoadingElement.css('display', '');

            if (!courier.courier) {
                courier.courier = `${courier.code} ${courier.firstName}`;
            }

            console.log(courier);

            $scope.currentWorkSelection = " for Courier " + courier.courier;
            $scope.currentCourier = courier;

            $scope.getCurrentJobs(courier.courierID);

            safeTimeout(() => {
                loadingElement.css('display', 'none');
                mapLoadingElement.css('display', 'none');
            }, 100);

            DispatchData.truckCourierStatus(courier.courierID)
                .then(result => {
                    $scope.truckCourierStatus = result.data;
                })
                .catch(error => {
                    console.error('Error fetching truck courier status:', error);
                });
        }

        $scope.refreshTruckCourierStatus = () => {
            DispatchData.truckCourierStatus($scope.currentCourier.courierID).then(result => {
                $scope.truckCourierStatus = result.data;
            });
        };

        $scope.selectMapCourier = courier => {
            angular.element("#box-jobDetail .loading").css('display', 'block');
            angular.element('#box-map .loading').css('display', 'block');

            angular.element("#box-currentWork .loading").css('display', 'block');
            let foundCourier = $scope.pickCouriers.find(x => x.courierID === courier.courierID);

            $scope.currentCourier = {
                courierID: foundCourier.courierID, courier: foundCourier.label
            };

            DispatchData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done").then(data => {
                angular.element("#box-currentWork .loading").css('display', 'none');

                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    displayRoutePointsOnly(data, false, $scope.mapZoom.display);
                }
                $scope.activateDrop();

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);

                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
            });

            $scope.currentWorkSelection = " for Courier " + courier.label;
            $scope.currentSelection = " for Courier " + courier.label;

            safeTimeout(() => {
                $document.ready(() => {
                    angular.element("#box-jobDetail .loading").css('display', 'none');
                    angular.element("#box-map .loading").css('display', 'none');
                });
            }, 100);

            DispatchData.truckCourierStatus(courier.courierID).then(data => {
                $scope.truckCourierStatus = data;
            });
        };

        $scope.clearCourierSearch = () => {
            $scope.jobsCurrentList = false;
            $scope.courier.gpsCourier = '';
            $scope.currentWorkSelection = '';
        }

        $scope.selectPotentialCourier = (courier) => {
            angular.element('#box-jobDetail').find(".loading").css('display', 'block');
            angular.element('#box-map .loading').css('display', '');

            if (courier.courier === undefined) {
                courier.courier = courier.code + ' ' + courier.firstName;
            }

            if ($scope.jobList.length > 0) {
                let jid = angular.element("#jobList .active").last().data("jobid");
                let currentJob = $scope.jobList.find(jo => jo.id === jid);
                let unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                displayPickupPoints(unDispatchedData, true, currentJob);
            }

            angular.element('#box-currentWork').find(".loading").css('display', 'block');
            const code = $scope.pickCouriers.find(x => x.courierID === courier.courierID).id;
            DispatchData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done").then((data) => {
                angular.element('#box-currentWork').find(".loading").css('display', 'none');
                if ($scope.currentJob !== null && $scope.currentJob.courier !== code) {
                    $scope.currentJob = null;
                }
                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    displayRoutePoints(data, false, $scope.mapZoom.display);
                } else {
                    DispatchData.getCourierPosition(code).then((posData) => {
                        displayCourierPositionOnly(posData.latitude, posData.longitude);
                    });
                }
                $scope.activateDrop();
                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);
                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
                $scope.getAvailableCourierLocation();
            });

            $scope.currentWorkSelection = " for Courier " + courier.courier;

            $scope.currentCourier = courier;

            $scope.currentSelection = " for Courier " + courier.courier;

            safeTimeout(() => {
                $document.ready(() => {
                    angular.element('#box-jobDetail').find(".loading").css('display', 'none');
                    angular.element('#box-map').find(".loading").css('display', 'none');
                });
            }, 100);
        };
////////////////////////////
// GROUPED JOBS
////////////////////////////

        $scope.getGroupedJobs = () => {
            angular.element('#box-jobGroups').find(".loading").css('display', 'block');
            DispatchData.getJobsGrouped().then((data) => {

                angular.element('#box-jobGroups').find(".loading").css('display', 'none');
                $scope.jobGroups = data;

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);
                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);

            });
        };

////////////////////////////
// CURRENT JOBS
////////////////////////////

        /**
         * @param {number} courierId
         */
        $scope.getCurrentJobs = courierId => {
            angular.element('#box-currentWork').find(".loading").css('display', 'block');
            const foundCourier = $scope.pickCouriers.find(x => x.courierID === courierId);
            const code = foundCourier !== undefined ? foundCourier.id : "";

            DispatchData.getJobsCurrent(courierId, $scope.jobFilters.status === "done").then(data => {
                angular.element('#box-currentWork').find(".loading").css('display', 'none');

                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    $scope.displayRoutePoints(data, true, $scope.mapZoom.display);
                } else {
                    DispatchData.getCourierPosition(code).then(posData => {
                        $scope.displayCourierPositionOnly(posData.latitude, posData.longitude);
                    });
                }
                $scope.activateDrop();

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);
                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
            });
        };

        let filtersObject = null;
        if (Modernizr.localstorage) {
            filtersObject = JSON.parse(localStorage.getItem("disp-filters-" + ContactID));
        }
        $scope.jobFilters = filtersObject || {"status": "nda", "area": "main1", "order": "remain", "asc": "asc"};
        let f = ".top-bar .btn-group .btn." + $scope.jobFilters.status;
        angular.element(f).addClass("topBarActive");
        const areas = $scope.jobFilters.area.split(',');

        for (let i = 0; i < areas.length; i++) {
            f = ".top-bar .btn-group .btn." + areas[i];
            angular.element(f).addClass("topBarActive");
        }

        $scope.sort["jobList"] = "remain";

        $scope.setFiltersFromTopBar = data => {
            angular.element('.clearLists-list-title').removeClass('listActive');
            $scope.setFilters(data);
        };

        $scope.setFilters = data => {
            safeTimeout(() => {
                if (data.status) {
                    $scope.jobFilters.status = data.status;
                }


                if (data.area) {
                    let selected = angular.element("#area-group > .btn.topBarActive").length;
                    if (selected > 1) {
                        $scope.jobFilters.area += "," + data.area;
                    } else {
                        $scope.jobFilters.area = data.area;
                    }
                }

                if (data.clearList) {
                    let clSelected = angular.element("#clearLists").find('.listActive').length;
                    if (clSelected > 1) {
                        $scope.jobFilters.area += "," + data.clearList;
                    } else {
                        $scope.jobFilters.area = data.clearList;
                    }
                }

                if (data.order) {
                    $scope.jobFilters.order = data.order;
                }

                $scope.getData();
            }, 300);
        };

        $scope.selectJobDetail = job => {
            $scope.currentJob = job;
            $scope.currentSupport = null;
            $scope.potentialCouriers = false;
            $scope.potentialCouriersSelection = " for Job " + job.jobNo;
            $scope.currentSelection = " for Job " + job.jobNo;

// Check attachments
            $scope.hasAttachedFile(job.id);

            if ($scope.job.rootParentID) {
                DispatchData.getRelatedJobs(job.rootParentID, job.clientID).then(data => {
                    job.relatedJobs = data;
                });
            }
        };

        $scope.loadRelatedJobDetail = (id, jn) => {
            angular.element("#box-jobDetail").find(".loading").show();
            DispatchData.getJobDetail(id).then(data => {
                $scope.currentJob = data;
                angular.element("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + jn;
            });
        };

        $scope.selectSupportJobDetail = support => {
            console.log("select Job  " + support.jobId);

            $scope.currentSupport = support;
            angular.element("#box-jobDetail").find(".loading").show();

            DispatchData.getJobDetail(support.jobId).then(data => {
                $scope.selectJob(data);
                $scope.currentJob = data;

                angular.element("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + support.jobNumber;
                let jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true, $scope.mapZoom.display);

                if ($scope.mapZoom.display) {
                    setMapBounds();
                    map.setZoom(12);
                }

                if ($scope.currentJob.rootParentID) {
                    DispatchData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientID).then(data => {
                        $scope.currentJob.relatedJobs = data;
                    });
                }
            });
        };

// Select Job
        $scope.selectJob = (job) => {
            safeTimeout(() => {
                console.log("selectJob");
                $scope.currentJob = job;
                console.log(job);

                jdSvc.setJob($scope.currentJob);

// Check for attachments
                $scope.checkForAttachments(job.id);

                DispatchData.getActiveCouriers().then((data) => {
                    $scope.pickCouriers = data;
                });

                if ($scope.currentJob.rootParentID) {
                    DispatchData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientID).then((data) => {
                        $scope.currentJob.relatedJobs = data;
                    });
                }

                if (job.courier === null) {
                    $scope.jobGroups = false;
                    $scope.getPotentialCouriers(job.id);
                    $scope.potentialCouriersSelection = " for Job " + job.jobNo;
                    $scope.currentCourier = null;
                    $scope.currentSelection = " for Job " + job.jobNo;

                    const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                    displayPickupPoints(unDispatchedData, true, job);
                } else {
                    $scope.potentialCouriers = false;
                }

                if (job.courier !== null) {
                    $scope.selectCourier(job.courierData);
                } else {
                    const jobs = [job];

                    displayRoutePoints(jobs, false, $scope.mapZoom.display);
                }

                if (jobRow) {
                    // Check if the selected descendant is not undefined
                    const dispatchField = angular.element(jobRow).find(".dispatchField");
                    if (dispatchField && dispatchField.length > 0) {
                        dispatchField[0].focus();
                    }
                }
            }, 0);
        };

        $scope.setCurrentWorkMenu = () => {
            return [{
                text: "Restore", click() {
                    $scope.restoreJobsFromCurrentWindow();
                }
            }, {
                text: "Redispatch", click() {
                    $scope.reAllocateJobsFromCurrentWindow();
                }
            }, {
                text: "Resend", click() {
                    $scope.resendJobsFromCurrentWindow();
                }
            }

            ];
        };

        $scope.fromColumnClick = (evt, job) => {
            switch (evt.which) {
                case 1:
// this is left click
                    break;
                case 2:
// in case you need some middle click things
                    break;
                case 3:
// this is right click
                    safeTimeout(() => {
                        jdSvc.updateGPS(job, 'fromAddress', true);
                    }, 100);
                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.toColumnClick = ($event, job) => {
            switch ($event.which) {
                case 1:
// this is left click
                    break;
                case 2:
// in case you need some middle click things
                    break;
                case 3:
// this is right click
                    safeTimeout(() => {
                        jdSvc.updateGPS(job, 'toAddress', true);
                    }, 100);
                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.latePickColumnClick = evt => {
            switch (evt.which) {
                case 1:
// this is left click
                    break;
                case 2:
// in case you need some middle click things
                    break;
                case 3:
// this is right click
                    safeTimeout(() => {
                        const dueTime = moment($scope.currentJob.booked).add($scope.currentJob.lp || $scope.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');
                        let items = [];
                        for (let i = 1; i < 37; i++) {
                            if (parseInt(dueTime) < (i * 5)) items.push({
                                "id": (i * 5),
                                "text": ((i * 5).toString() + " mins away")
                            });
                        }

                        $scope.lateForm = {
                            "data": {
                                "jobNum": $scope.currentJob.jobNo,
                                "client": $scope.currentJob.client,
                                "dueMins": dueTime,
                                "choose": ""
                            }, submit() {
                                const pickupETAValue = parseInt($scope.lateForm.choose.value);
                                const dueMins = moment($scope.currentJob.booked).add($scope.currentJob.lp || $scope.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');

                                if ($scope.currentJob.lp !== pickupETAValue) {
                                    const window = $scope.currentJob.lp || $scope.currentJob.pickupTime;
                                    const lateMins = pickupETAValue - dueMins + window;
                                    $scope.currentJob.lp = lateMins;
                                    console.log(lateMins);
                                    $scope.lateCall(lateMins, 1, $scope.currentJob, false);
                                    $scope.lateForm.data = null;
                                    angular.element("#AwayMins").select2().empty();
                                    angular.element("#AwayMins").select2('destroy');
                                    angular.element(".lateForm").hide(0)
                                }
                            }, cancel() {
                                $scope.lateForm.data = null;
                                angular.element("#AwayMins").select2().empty();
                                angular.element("#AwayMins").select2('destroy');
                                angular.element(".lateForm").hide(0);
                            }
                        };
                        $scope.$apply();
                        angular.element(".lateForm").show(0);

                        safeTimeout(() => {
                            const dueOptions = {
                                minimumInputLength: 0, data: items, placeholder: "Start typing to enter new time..."
                            };

                            angular.element("#AwayMins").select2(dueOptions);
                            angular.element("#AwayMins").select2('open');
                        }, 200);
                    }, 400);

                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.speedColumnClick = ($event, job) => {
            switch ($event.which) {
                case 1:
// this is left click
                    break;
                case 2:
// in case you need some middle click things
                    break;
                case 3:
// this is right click
                    safeTimeout(() => {
                        jdSvc.speedClick($event, job);
                        $scope.$apply();
                    }, 400);

                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.clientColumnClick = ($event, job) => {
            switch ($event.which) {
                case 1:
// this is left click
                    break;
                case 2:
// in case you need some middle click things
                    break;
                case 3:
// this is right click
                    safeTimeout(() => {
                        jdSvc.clientClick($event, job);
                        $scope.$apply();
                    }, 400);

                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.notifyColumnClick = (evt, job) => {
            switch (evt.which) {
                case 1:
// this is left click
                    break;
                case 2:
// in case you need some middle click things
                    break;
                case 3:
// this is right click
                    safeTimeout(() => {
                        jdSvc.notifyClick(job);
                        $scope.$apply();
                    }, 400);

                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.setEventsMenu = ($event) => {
            return [{
                text: "Void Job", click() {
                    $scope.voidJobForm($scope.currentJob.jobNo, $scope.currentJob.id);
                }
            },

                {
                    text: "Add Event - Other", click() {
                        $scope.otherEventForm($event, $scope.currentJob);
                    }
                },

                {
                    text: "Split Job", click() {
                        $scope.splitJob($event, $scope.currentJob);
                    }, enabled($itemScope) {
                        return $itemScope.job.allowSplit;
                    },
                },

                {
                    text: "Set First Job", click() {
                        $scope.setFirstJob($scope.currentJob);
                    }
                }];
        };

        $scope.setJobsMenu = () => {
            let multiple = angular.element(".activeTable .active").length > 1;
            let lastCourier = null;
            let sameCourier = true;
            angular.element(".activeTable .active").each(() => {
                let j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                if (lastCourier !== null && lastCourier !== j.courier) {
                    sameCourier = false;
                    return false;
                }
                lastCourier = j.courier;
            });

            console.log("same courier =" + sameCourier + " last courier =" + lastCourier);
            if (!sameCourier) {
                return [];
            }

            let multipleMenu = [{
                text: "Dispatch Selected", click($itemScope, $event) {
                    $scope.dispatchJobs($itemScope.courier.courier);
                }
            }, {
                text: "Re-dispatch Selected", click() {
//$scope.items.splice($itemScope.$index, 1);
                }
            }];
            if (sameCourier) {
                multipleMenu.push({
                    text: "Restore Selected", click() {
                        $scope.restoreJobs();
                    }
                }, {
                    text: "Redispatch Selected", click() {
                        $scope.reAllocateJobs();
                    }
                }, {
                    text: "Resend Selected", click() {
                        $scope.resendJobs();
                    }
                });
            }

            if ((sameCourier && lastCourier === null)) {

                multipleMenu = [{
                    text: "Dispatch Selected", click() {
                        $scope.dispatchJobs(null);

                    }

                }];
            }


            const fullMenu = [{
                text: "Dispatch", click() {
                    $scope.dispatchJobs(null);
                }
            }];

            if (lastCourier !== null) {
                multipleMenu.shift();
                multipleMenu.shift();
                fullMenu.shift();
                fullMenu.push({
                    text: "Restore", click() {
                        $scope.restoreJobs();
                    }
                }, {
                    text: "Redispatch", click() {
                        $scope.reAllocateJobs();
                    }
                }, {
                    text: "Resend", click() {
                        $scope.resendJobs();
                    }
                });
            }
            return multiple ? multipleMenu : fullMenu;
        };

        /**
         * @param {string} mode
         */
        $scope.setTruckMode = (mode) => {
            $scope.truckMode = mode;
            $scope.getData();
        };

        /**
         * @param {string} channel
         */
        $scope.setSupportChannel = (channel) => {
            $scope.supportChannel = channel;
            if (Modernizr.localstorage) {
                localStorage.setItem("support-channel-" + ContactID, JSON.stringify($scope.supportChannel));
            }
            $scope.getSupports();
        };

        $scope.getAvailableCourierLocation = () => {
            if (!mapReady) {
                console.log('Map not ready yet');
                return;
            }

            if (!$scope.allCouriers.display) {
                map.clearLabels();
                map.clearFlags();
                return;
            }

            const areas = $scope.jobFilters.area.split(",");
            const channels = [];
            let trucks = false;
            for (let i = 0; i < areas.length; i++) {
                switch (areas[i]) {
                    case "main1":
                    case "main2":
                        if (!channels.includes(1)) {
                            channels.push(1);
                        }
                        break;
                    case "city":
                        if (!channels.includes(2)) {
                            channels.push(2);
                        }
                        break;
                    case "truck":
                        trucks = true;
                        break;
                    default:
                        console.log("Default case reached");
                }
            }

            try {
                const bounds = map.getBounds();
                const southWestLng = bounds.getSouthWest().lng();
                const southWestLat = bounds.getSouthWest().lat();
                const northEastLng = bounds.getNorthEast().lng();
                const northEastLat = bounds.getNorthEast().lat();

                DispatchData.getAvailableCourierLocation(southWestLng, southWestLat, northEastLng, northEastLat)
                    .then(returnData => {
                        const courierId = $scope.currentCourier === false || $scope.currentCourier === null ? 0 : $scope.currentCourier.courier.split(" ")[0].trim();
                        displayAvailableCouriers(returnData, courierId, channels, trucks, $scope.truckMode, $scope.allCouriers.includeUA);
                    })
                    .catch(error => {
                        console.error('Error getting available courier location:', error);
                    });
            } catch (error) {
                console.error('Error accessing map bounds:', error);
            }
        };

        $scope.courierMenu = [// NEW IMPLEMENTATION
            {
                text: "Dispatch Selected", click($itemScope) {
                    $scope.dispatchJobs($itemScope.courier.courier || $itemScope.courier.code);
                }
            }];

        $scope.potentialCourierMenu = [{
            text: "Dispatch Selected", click($itemScope) {
                $scope.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
            }
        }];

        $scope.getJobList = () => {
            if (Modernizr.localstorage) {
                localStorage.setItem("disp-filters-" + ContactID, JSON.stringify($scope.jobFilters));
            }
            const selectedClients = $scope.pickService.clients.map(a => a.id);
            return DispatchData.getJobsFilter($scope.jobFilters, selectedClients, $scope.isInternal).then(data => {
                $scope.jobList = data;

                angular.element("#box-jobsList .loading").fadeOut();
                safeTimeout(() => {

                    sizeHeadings();
                    if (data.length > 0) {
                        const unDispatchedData = data.filter(x => x.courierData.courierID === null);
                        displayPickupPoints(unDispatchedData, true, null);

                    }
                    $scope.getAvailableCourierLocation();
                }, 200);

            });
        };

        $scope.closeSupport = support => {
            DispatchData.closeSupport(support.eventId, ContactID).then(() => {
                $scope.getSupports();
                $scope.currentSupport = null;
            });
        }

        $scope.lockSupport = support => {
            console.log(support);
            if (support.lockedBy === Dispatcher) {
                DispatchData.unLockSupport(support.eventId, Dispatcher).then(() => {
                    $scope.getSupports();
                });
            } else {
                DispatchData.lockSupport(support.eventId, Dispatcher).then(() => {
                    $scope.getSupports();
                });
            }
        }

        /**
         * @param {string} item
         */
        function SetSelectedChannels(item) {
            const sr = $scope.pickChannels.find(obj => obj.label === item);
            $scope.pickService.channel.push(sr);
        }

        $scope.getSupports = () => {
////////////////////////////
// SUPPORTS
////////////////////////////
            angular.element("#box-supports").find(".loading").show();
            return DispatchData.getSupports($scope.supportChannel).then(data => {
                const first = $scope.supports === null || $scope.supports === undefined;

                $scope.supports = data;

                if (first) {
                    $scope.supportChannel.split(',').forEach(SetSelectedChannels);
                }
                angular.element("#box-supports").find(".loading").fadeOut();

                $scope.supportMenu = [// NEW IMPLEMENTATION
                    {
                        text: "Complete", click($itemScope) {
                            $scope.closeSupport($itemScope.support);
                        }
                    }, {
                        text: "Toggle Lock", click($itemScope) {
                            $scope.lockSupport($itemScope.support);
                        }
                    }, {
                        text: "Void Job", click($itemScope) {
                            $scope.voidJobForm($itemScope.support.jobNumber, $itemScope.support.jobId);
                        }, enabled($itemScope) {
                            return ($itemScope.support.jobId);
                        },
                    },];


                safeTimeout(() => {
                    $document.ready(() => {
                        if ($scope.currentSupport) {
                            angular.element("#supports tr[data-id='" + $scope.currentSupport.eventId + "']").addClass("active");
                        }
                    });
                }, 100);


                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);
                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
            });
        }

        $scope.getClientContacts = () => {
            DispatchData.getClientContacts(ContactID).then(data => {
                $scope.pickClients = data;
            });
        };

        $scope.getData = () => {
///////////////////////////////
// JOB LIST
///////////////////////////////

//Get Job Data
            angular.element("#box-jobsList").find(".loading").show();
            $scope.jobList = [];
            $scope.currentJob = null;
            $scope.jdSvc.currentJob = null;
            $scope.potentialCouriers = null;
            $scope.jobGroups = false;
            if (!$scope.courier) {
                $scope.jobsCurrentList = false;
                $scope.currentCourier = null;
            }

            $scope.getClearListEnvelope = id => {
                DispatchData.getClearListEnvelope(id).then(data => {
                    const swll = new google.maps.LatLng(data.minimumLatitude, data.minimumLongitude);
                    const nell = new google.maps.LatLng(data.maximumLatitude, data.maximumLongitude);
                    map.fitBounds(new google.maps.LatLngBounds(swll, nell));
                    map.setZoom(13);
                    $scope.getAvailableCourierLocation();
                });
            };

            $scope.getClearListsData = () => {
                DispatchData.getClearLists().then(data => {
                    $scope.clearLists = data;
                    safeTimeout(() => {
                        angular.element("#clearLists .loading").fadeOut();
                    }, 0);
                    console.log($scope.clearLists);
                    $scope.activateDrop();
                });
            };

            $scope.getClearListsData();


            DispatchData.getActiveCouriers().then(data => {
                $scope.pickCouriers = data;
            });

            DispatchData.getAllCouriers().then(data => {
                $scope.pickAllCouriers = data;
            });

////////////////////////////
// COURIER MOVEMENTS THROUGH
////////////////////////////
            angular.element("#box-couriersMoveThrough").find(".loading").show();

            DispatchData.getCouriersThrough().then(data => {
                $scope.couriersThrough = data;
                $scope.couriersThroughMenu = [{
                    text: "Delete", click: () => {
                        angular.element(".rightActiveTable .active").fadeOut();
                    }
                }];
                $scope.activateDrop();
                safeTimeout(() => {
                    angular.element("#box-couriersMoveThrough").find(".loading").fadeOut();
                }, 100);

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);
                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
            });


////////////////////////////
// COURIER MOVEMENTS PICKED UP
////////////////////////////

            angular.element("#box-courierMovePickedUp").find(".loading").show();

            DispatchData.getCouriersPicked().then(data => {
                $scope.couriersPicked = data;

                $scope.couriersPickedMenu = [// NEW IMPLEMENTATION
                    {
                        text: "Hold", click: ($itemScope) => {
                            const callData = {
                                "call": "holdCourier", "courier": $itemScope.courier
                            };

                            DispatchData.doAPI(callData).then(data => {
                                console.log(data);
                                if (data.response === "Success") {
                                    angular.element(".rightActiveTable .active").css({"background-color": "#c6dfad"});
                                    angular.element(".rightActiveTable .active").animate({backgroundColor: "inherit"}, 300, function () {
                                        angular.element(this).removeAttr("style");
                                    });
                                } else {
                                    console.log("Critical Error");
                                }
                            });
                        }
                    }, {
                        text: "Head", click($itemScope) {
                            const callData = {
                                "call": "headCourier", "courier": $itemScope.courier
                            };
                            DispatchData.doAPI(callData).then(data => {
                                console.log(data);
                                if (data.response === "Success") {
                                    angular.element(".rightActiveTable .active").css({"background-color": "#c6dfad"});
                                    angular.element(".rightActiveTable .active").animate({backgroundColor: "inherit"}, 300, function () {
                                        angular.element(this).removeAttr("style");
                                    });
                                } else {
                                    console.log("Critical Error");
                                }
                            });
                        }
                    }, {
                        text: "Delete", click() {
                            angular.element(".rightActiveTable .active").fadeOut();
                        }
                    }];

                safeTimeout(() => {
                    $document.ready(() => {
                        angular.element("#box-courierMovePickedUp").find(".loading").fadeOut();
                    });
                }, 100);

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);
                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
            });


////////////////////////////
// COURIER MOVEMENTS CLEAR
////////////////////////////
            angular.element("#box-courierMoveClear").find(".loading").show();

            DispatchData.getCouriersClear().then(data => {
                $scope.couriersClear = data;

                $scope.couriersClearMenu = [{
                    click: ($itemScope) => {
                        let callData = {
                            "call": "holdCourier", "courier": $itemScope.courier
                        }

                        DispatchData.doAPI(callData).then(data => {
                            console.log(data);

                            if (data.response === "Success") {
                                angular.element(".rightActiveTable .active").css({"background-color": "#c6dfad"});
                                angular.element(".rightActiveTable .active").animate({backgroundColor: "inherit"}, 300, function () {
                                    angular.element(this).removeAttr("style");
                                });
                            } else {
                                console.log("Critical Error");
                            }
                        });
                    }, text: "Hold"
                }, {
                    text: "Move", click($itemScope) {
                        let callData = {
                            "call": "moveCourier", "courier": $itemScope.courier
                        };

                        DispatchData.doAPI(callData).then(data => {
                            console.log(data);

                            if (data.response === "Success") {
                                angular.element(".rightActiveTable .active").css({"background-color": "#c6dfad"});
                                angular.element(".rightActiveTable .active").animate({backgroundColor: "inherit"}, 300, function () {
                                    angular.element(this).removeAttr("style");
                                });
                            } else {
                                console.log("Critical Error");
                            }
                        });
                    }
                }, {
                    text: "Delete", click() {
                        angular.element(".rightActiveTable .active").fadeOut();
                    }
                }];

                safeTimeout(() => {
                    $document.ready(() => {
                        angular.element("#box-courierMoveClear").find(".loading").fadeOut();
                    });
                }, 100);

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);

                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
            });


////////////////////////////
// AREA LIST
////////////////////////////

            angular.element("#box-areaList").find(".loading").show();
            DispatchData.getAreaList().then(data => {
                $scope.areaList = data;

                safeTimeout(() => {
                    $document.ready(() => {
                        angular.element("#box-areaList").find(".loading").fadeOut();
                    });
                }, 100);

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);
                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
            });

////////////////////////////
// LATE CALLS
////////////////////////////

            angular.element("#box-lateCalls").find(".loading").show();
            DispatchData.getLateCalls().then(data => {
                $scope.lateCalls = data;

                $scope.lateCallsMenu = [// NEW IMPLEMENTATION
                    {
                        text: "Complete", click($itemScope) {
                            //$scope.selected = $itemScope.item.name;

                            let callData = {
                                "call": "dismissSupport", "support": $itemScope.support
                            };

                            DispatchData.doAPI(callData).then(data => {
                                console.log(data);
                                if (data.response === "Success") {
                                    angular.element(".rightActiveTable .active").fadeOut();
                                } else {
                                    console.log("Critical Error");
                                }
                            });
                        }
                    }, {
                        text: "Lock", click() {
                            //$scope.items.splice($itemScope.$index, 1)
                            //LOCK WITH CURRENT USER
                        }
                    }];

                safeTimeout(() => {
                    $document.ready(() => {
                        angular.element("#box-lateCalls").find(".loading").fadeOut();
                    });
                }, 100);

                safeTimeout(() => {
                    sizeHeadings();
                }, 1000);
                safeTimeout(() => {
                    sizeHeadings();
                }, 2000);
            });

///////////////////////////
// JOB DETAIL
//////////////////////////
            return $scope.getJobList();
        };

        if (!$scope.isInternal) {
            $scope.getClientContacts();
        }

        $scope.getData();

        const runSupportsUpdate = () => {
            $scope.getSupports().then(() => {
                safeTimeout(runSupportsUpdate, 60000);
            });
        };
        runSupportsUpdate();


// on first focus (bubbles up to document), open the menu
        safeOn('focus', '.select2-selection.select2-selection--single', function () {
            angular.element(this).closest(".select2-container").siblings('select:enabled').select2('open');
        });

        angular.element('select.select2').on('select2:closing', e => {
            angular.element(e.target).data("select2").$selection.one('focus focusin', e => {
                e.stopPropagation();
            });
        });

/////////////////////////
// JOB DETAILS
/////////////////////////

        /**
         * @param {$event} $event
         * @param {Job} currentJob
         */
        $scope.setSplitJobMeetingPoint = ($event, currentJob) => {
            const getDeliveryLocation = (job) => ({
                lat: job.deliveryLatitude || "", long: job.deliveryLongitude || ""
            });

            const location = getDeliveryLocation(currentJob);
            console.log("Retrieved job coordinates!");

            DispatchData.getSuburbList()
                .then(selectedSuburbs => showEditAddressDialog($event, currentJob, selectedSuburbs, location))
                .then(dialogResult => handleDialogResult(dialogResult, currentJob))
                .catch(error => toastrService.showErrorToast(error.message))
                .finally(() => console.log("Split jobs process completed."));
        };

        function showEditAddressDialog($event, currentJob, selectedSuburbs, location) {
            return $mdDialog.show({
                controller: EditAddressDialogController,
                controllerAs: 'ctrl',
                templateUrl: versionUrl("app/components/dialogs/edit-address-dialog/edit-address-dialog.html"),
                parent: angular.element($document.body),
                targetEvent: $event,
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    addressDetails: {
                        address: currentJob.toAddress,
                        lat: location.lat,
                        long: location.long,
                        suburb: currentJob.toSuburbName,
                        postCode: currentJob.postCode,
                    }, suburbOptions: selectedSuburbs, title: "Split Job Address and GPS", submitLabel: "Split Job",
                },
            });
        }

        function handleDialogResult(addressDetails, currentJob) {
            if (!addressDetails) {
                console.log("Split jobs canceled!");
                return;
            }

            const updatedJob = angular.extend({}, currentJob, {
                toAddress: addressDetails.address, toSuburbID: addressDetails.our_suburb,
            });

            const callData = {
                jobID: updatedJob.id,
                lat: addressDetails.lat,
                long: addressDetails.long,
                toSuburbId: updatedJob.toSuburbID,
                toAddress: updatedJob.toAddress,
            };

            return updateJobData(callData)
                .then(() => DispatchData.reRateSplitJob(callData.jobID))
                .then(() => DispatchData.finishSplitJobProcess(callData.jobID, FirstName))
                .then(() => $scope.getData())
                .then(() => {
                    toastrService.showSuccessToast("Job Successfully Split");
                    console.log("Job splitting complete!");
                    console.log('Dialog closed!');
                    return $scope.getJobList();
                });
        }

        function updateJobData(callData) {
            return DispatchData.updateSplitJobAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long);
        }


        $scope.addEvent = () => {
            let time = new Date();
            time.setSeconds(0);
            time.setMilliseconds(0);

            $scope.eventForm = {
                "data": {
                    "jobNum": $scope.currentJob.jobNo,
                    "client": $scope.currentJob.client,
                    "event": "Other",
                    "date": new Date(),
                    "time": time
                }, submit() {

                }, cancel() {
                    angular.element('.eventForm').css('display', 'none');
                }
            };

            angular.element('.eventForm').css('display', '');
        };

        /**
         * @param {$event}  $event
         */
        $scope.truckLoadingStatus = ($event) => {
            return $mdDialog.show({
                controller: TruckCourierStatusDialogController,
                controllerAs: 'ctrl',
                parent: angular.element($document.body),
                targetEvent: $event,
                templateUrl: versionUrl("app/components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    data: $scope.truckCourierStatus[0],
                },
            }).then(() => {
// Dialog Closed
            });
        };

        $scope.createNewJob = $event => {
            function showCreateJobDialog() {
                return $mdDialog.show({
                    controller: CreateJobDialogController,
                    controllerAs: 'ctrl',
                    parent: angular.element($document.body),
                    targetEvent: $event,
                    templateUrl: versionUrl("app/components/dialogs/create-job-dialog/create-job-dialog.html"),
                    clickOutsideToClose: false,
                    fullscreen: true,
                    locals: {
                        staffId: ContactID, despatcherName: FirstName
                    }
                });
            }

            /**
             * @param {number} newJobId
             */
            function processNewJob(newJobId) {
                return DispatchData.getJobDetail(newJobId)
                    .then(job => $scope.getData()
                        .then(() => {
                            $scope.selectJob(job);
                            toastrService.showSuccessToast("New Job Created Successfully");
                        }))
                    .finally(() => {
                        loadingService.closeLoader();
                    });
            }

            function handleError(error) {
                console.error('Error in createNewJob:', error);
                toastrService.showErrorToast(error.message || "An error occurred while creating the job");
                loadingService.closeLoader();
            }

            showCreateJobDialog()
                .then(newJobId => {
                    if (newJobId) {
                        return processNewJob(newJobId);
                    }
                })
                .catch(handleError);
        };

        /**
         * @param {$event}  $event
         */
        $scope.interCourierCharge = $event => {
            return $mdDialog.show({
                controller: InterCourierChargeDialog,
                controllerAs: 'ctrl',
                parent: angular.element($document.body),
                targetEvent: $event,
                templateUrl: versionUrl("app/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    staffId: ContactID,
                },
            }).then(() => {
                console.log("Inter-courier Charge Added!")
            }).then(() => "Inter-courier Charge Canceled!");
        }

        /**
         * @param {$event}  $event
         * @param {Job}  job
         */
        $scope.createEvent = ($event, job) => {
            return $mdDialog.show({
                controller: AddEventDialogController,
                controllerAs: "ctrl",
                templateUrl: versionUrl("app/components/dialogs/add-event-dialog/add-event-dialog.html"),
                parent: angular.element($document.body),
                targetEvent: $event,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    job: job, dispatherName: FirstName, contactId: ContactID
                }
            }).then(() => {
                console.log('Pallet Dialog closed!');
            });
        };

        /**
         * @param {number} jobId
         */
        $scope.checkForAttachments = (jobId) => {
            const deferred = $q.defer();

            $scope.isCheckingAttachments = true;
            $scope.hasAttachedFile = false;

            DispatchData.isFilesAttachedToJob(jobId)
                .then(response => {
                    $scope.hasAttachedFile = response;
                    deferred.resolve(response);
                })
                .catch(error => {
                    console.log('Error checking for attachments:', error);
                    $scope.hasAttachedFile = false;
                    deferred.reject(error);
                })
                .finally(() => {
                    $scope.isCheckingAttachments = false;
                });

            return deferred.promise;
        };

        /**
         * @param {$event}  event
         * @param {Job} job
         */
        $scope.openFileAttachmentDialog = (event, job) => {
            return $mdDialog.show({
                controller: JobFileUploadController,
                controllerAs: 'ctrl',
                parent: angular.element($document.body),
                targetEvent: event,
                templateUrl: versionUrl("app/components/dialogs/job-file-upload-dialog/job-file-upload-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    jobId: job.id
                },
            }).then(() => {
// Dialog Closed
                console.log('Job File Upload Dialog Closed!')
            });
        };

        /**
         * @param  {Event}  event
         * @param  {Job}  job
         */
        $scope.showAdditionalServicesMenu = (event, job) => {
            DispatchData.hasClientItemsAvailable(job.clientId, job.speedId).then(isClientItemsAvailable => {

                if (!isClientItemsAvailable) {
                    return $mdDialog.show($mdDialog.alert()
                        .clickOutsideToClose(true)
                        .title('No Additional Services')
                        .targetEvent(event)
                        .textContent('No additional services  has been set up for this client. Please add a service through Admin Manager and try again.')
                        .ok('OK'));
                }

// Show additional services dialog
                return $mdDialog.show({
                    controller: AdditionalServicesDialogController,
                    controllerAs: "ctrl",
                    templateUrl: versionUrl("app/components/dialogs/additional-services-dialog/additional-services-dialog.html"),
                    parent: angular.element($document.body),
                    targetEvent: event,
                    clickOutsideToClose: false,
                    fullscreen: true,
                    locals: {
                        job
                    }
                });
            }).then(() => {
                console.log('Additional Services Dialog closed!');
            }).catch(error => {
// handle or throw the error
                console.log(error);
            });
        }

// Load custom layout
        $scope.init = () => {
            if (Modernizr.localstorage) {
                const storedLayouts = localStorage.getItem("layouts-" + ContactID);
                const lastActiveLayoutName = localStorage.getItem("lastActiveLayout-" + ContactID);

                if (storedLayouts) {
                    $scope.layouts = JSON.parse(storedLayouts);

                    if (lastActiveLayoutName) {
                        const lastActiveLayoutIndex = $scope.layouts.findIndex(l => l.name === lastActiveLayoutName);

                        if (lastActiveLayoutIndex !== -1) {
                            safeTimeout(() => {
                                $scope.loadLayout(lastActiveLayoutIndex);
                            }, 0);
                        }
                    }
                }
            }
        };

// Call the init function when the controller loads
        $scope.init();
    }]);

// Convert Degrees to Radians
function Deg2Rad(deg) {
    return deg * Math.PI / 180;
}

function PythagorasEquirectAngular(lat1, lon1, lat2, lon2) {
    lat1 = Deg2Rad(lat1);
    lat2 = Deg2Rad(lat2);
    lon1 = Deg2Rad(lon1);
    lon2 = Deg2Rad(lon2);
    const R = 6371; // km
    const x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
    const y = (lat2 - lat1);
    return Math.sqrt(x * x + y * y) * R;
}

function closestLocation(latitude, longitude, locations) {
    let minDifference = 99999;
    let closest;

    for (let index = 0; index < locations.length; ++index) {
        const dif = PythagorasEquirectAngular(latitude, longitude, locations[index][1], locations[index][2]);
        if (dif < minDifference) {
            closest = index;
            minDifference = dif;
        }
    }

    // return the nearest location
    return (locations[closest]);
}
