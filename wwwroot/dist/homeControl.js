"use strict";

function HomeController($document, $filter, greetingService, jdSvc, loadingService, $mdDialog, $parse, $q, $scope, $state, $window, $timeout, toastrService, DispatchData, uCSData, dispatchJobService, moment, Upload, bytesFilter, versionUrl, NgMap, MapService) {
  var _JSON$parse$display,
    _JSON$parse,
    _this = this;
  var ctrl = this;
  $scope.isInternal = ClientInternal === "True";
  $scope.name = "Home";
  ctrl.jdSvc = jdSvc;
  ctrl.courierSearchText = "";
  ctrl.jobDetailFabIsOpen = false;
  ctrl.courierListFabIsOpen = false;
  ctrl.isCheckingAttachments = false;
  ctrl.hasAttachedFile = false;
  ctrl.markers = [];
  ctrl.autoZoomEnabled = (_JSON$parse$display = (_JSON$parse = JSON.parse(localStorage.getItem("mapZoom-" + ContactID))) === null || _JSON$parse === void 0 ? void 0 : _JSON$parse.display) !== null && _JSON$parse$display !== void 0 ? _JSON$parse$display : true;
  ctrl.greetUser = function () {
    return greetingService.greetUser(FirstName);
  };

  // Google Map
  ctrl.initializeMap = function () {
    MapService.initializeMap().then(function (map) {
      ctrl.map = map;
      ctrl.getAvailableCourierLocation();
    });
  };
  ctrl.initializeMap();
  ctrl.updateMapMarkers = function (jobs) {
    MapService.updateMarkers(jobs).then(function () {
      console.log('Markers updated successfully');
    })["catch"](function (error) {
      console.error('Error updating markers:', error);
    });
  };
  ctrl.getAvailableCourierLocation = function () {
    var bounds = MapService.getBounds();
    if (bounds) {
      var southWest = bounds.getSouthWest();
      var northEast = bounds.getNorthEast();
      DispatchData.getAvailableCourierLocation(southWest.lng(), southWest.lat(), northEast.lng(), northEast.lat()).then(function (returnData) {
        var courierId = $scope.currentCourier && $scope.currentCourier.courier ? $scope.currentCourier.courier.split(" ")[0].trim() : 0;
        ctrl.displayAvailableCouriers(returnData, courierId, $scope.pickService.channel, $scope.truckMode === "On", $scope.truckMode, $scope.allCouriers.includeUA);
      });
    } else {
      console.log('Map bounds not available');
    }
  };
  ctrl.displayPickupPoints = function (jobs, clear, currentJob) {
    if (clear) {
      ctrl.clearMarkers();
    }
    jobs.forEach(function (job) {
      if (job.statusID < 5) {
        var marker = MapService.addMarker(job.pickUpLatitude, job.pickUpLongitude, {
          map: ctrl.map,
          icon: MapService.getPinImage(MapService.getPinColor(job.status, currentJob, job), job.runOrder),
          jobNumber: job.jobNo
        });
        var infoWindow = MapService.createInfoWindow('<div id="content"><div id="bodyContent"><p><b>' + job.jobNo + '</b></p><p><b>Pickup</b></p></div></div>');
        marker.addListener('click', function () {
          infoWindow.open(ctrl.map, marker);
        });
        ctrl.markers.push(marker);
      }
    });
    if (currentJob) {
      MapService.setCenter(currentJob.pickUpLatitude, currentJob.pickUpLongitude);
      MapService.setZoom(15);
    }
  };
  ctrl.displayRoutePoints = function (courierJobs, clear, zoom) {
    if (clear) {
      ctrl.clearMarkers();
    }
    var bounds = new google.maps.LatLngBounds();
    courierJobs.forEach(function (job) {
      var pickupMarker = ctrl.createMarker(job, true);
      var deliveryMarker = ctrl.createMarker(job, false);
      if (pickupMarker) bounds.extend(pickupMarker.getPosition());
      if (deliveryMarker) bounds.extend(deliveryMarker.getPosition());
    });
    if (courierJobs.length > 0) {
      if (zoom) {
        MapService.fitBounds(bounds);
      } else {
        MapService.panToBounds(bounds);
      }
      $timeout(function () {
        ctrl.markers.forEach(function (marker) {
          marker.setAnimation(google.maps.Animation.BOUNCE);
        });
        $timeout(function () {
          ctrl.markers.forEach(function (marker) {
            marker.setAnimation(null);
          });
        }, 2000);
      }, 200);
    }
    if (courierJobs.length > 0 && courierJobs[0].courierLatitude && courierJobs[0].courierLongitude) {
      var courierMarker = MapService.addMarker(courierJobs[0].courierLatitude, courierJobs[0].courierLongitude, {
        map: ctrl.map,
        icon: "/images/car3.png"
      });
      ctrl.markers.push(courierMarker);
      if (zoom) {
        MapService.setCenter(courierJobs[0].courierLatitude, courierJobs[0].courierLongitude);
        MapService.setZoom(13);
      }
    }
  };
  ctrl.createMarker = function (job, isPickup) {
    var position = isPickup ? new google.maps.LatLng(job.pickUpLatitude, job.pickUpLongitude) : new google.maps.LatLng(job.deliveryLatitude, job.deliveryLongitude);
    var pinColor = MapService.getPinColor(job.status);
    var pinImage = MapService.getPinImage(pinColor, job.runOrder);
    var marker = MapService.addMarker(position.lat(), position.lng(), {
      map: ctrl.map,
      icon: pinImage,
      jobNumber: job.jobNo
    });
    var contentString = '<div id="content">' + '<div id="bodyContent">' + '<p><b>' + job.jobNo + '</b></p>' + '<p><b>' + (isPickup ? "Pickup" : "Delivery") + '</b></p>' + '</div>' + '</div>';
    var infoWindow = MapService.createInfoWindow(contentString);
    marker.addListener('click', function () {
      ctrl.infoWindows.forEach(function (iw) {
        iw.close();
      });
      infoWindow.open(ctrl.map, marker);
    });
    ctrl.markers.push(marker);
    ctrl.infoWindows.push(infoWindow);
    return marker;
  };
  ctrl.displayAvailableCouriers = function (couriers, currentCourierId, channels, isTruckMode, truckMode, includeUA) {
    // Clear existing courier markers
    if (ctrl.courierMarkers) {
      ctrl.courierMarkers.forEach(function (marker) {
        marker.setMap(null);
      });
    }
    ctrl.courierMarkers = [];
    couriers.forEach(function (courier) {
      if (ctrl.shouldDisplayCourier(courier, currentCourierId, channels, isTruckMode, truckMode, includeUA)) {
        var marker = MapService.addMarker(courier.latitude, courier.longitude, {
          map: ctrl.map,
          icon: ctrl.getCourierIcon(courier),
          title: courier.code
        });
        var infoWindow = MapService.createInfoWindow(ctrl.getCourierInfoContent(courier));
        marker.addListener('click', function () {
          if (ctrl.openInfoWindow) {
            ctrl.openInfoWindow.close();
          }
          infoWindow.open(ctrl.map, marker);
          ctrl.openInfoWindow = infoWindow;
        });
        ctrl.courierMarkers.push(marker);
      }
    });
  };
  ctrl.shouldDisplayCourier = function (courier, currentCourierId, channels, isTruckMode, truckMode, includeUA) {
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
  ctrl.getCourierIcon = function (courier) {
    var color = courier.totalJobs === 0 ? "yellow" : courier.overDueJobs > 0 ? "red" : "green";
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 0.8,
      scale: 8,
      strokeColor: "white",
      strokeWeight: 2
    };
  };
  ctrl.getCourierInfoContent = function (courier) {
    return '<div>' + '<h3>' + courier.code + '</h3>' + '<p>Total Jobs: ' + courier.totalJobs + '</p>' + '<p>Overdue Jobs: ' + courier.overDueJobs + '</p>' + '</div>';
  };
  jdSvc.setSelectJobDetail(function () {
    var currentJob = $scope.currentJob;
    jdSvc.setJob($scope.currentJob);
    ctrl.getData().then(function () {
      if (currentJob === null || currentJob === undefined || currentJob === false) {
        return;
      }
      var refreshedJob = $scope.jobList.find(function (jo) {
        return jo.id === currentJob.id;
      });
      $scope.selectJob(refreshedJob);
      $timeout(function () {
        angular.element("#jobList tr[data-jobid='" + currentJob.id + "']").addClass('active');
        var element = angular.element("#jobList tr[data-jobid='" + currentJob.id + "']");
        var parentDiv = element.parent().hasClass('box-content') ? element.parent() : element.parent().closest('.box-content');
        var goTop = element[0].getBoundingClientRect().top;
        try {
          goTop = goTop - parentDiv.offset().top + parentDiv.scrollTop() - 28;
          parentDiv.scrollTop(goTop);
        } catch (e) {
          //ignore
        }
      }, 1000);
    });
  });
  $scope.allCouriers = {
    display: false,
    includeUA: false
  };
  $scope.mapZoom = {
    display: true
  };
  $scope.supportSettings = {
    autoRefresh: true
  };
  $scope.options = {
    "detail": {
      "size": [{
        "id": 1,
        "label": "Bike"
      }, {
        "id": 2,
        "label": "Car"
      }, {
        "id": 3,
        "label": "Van"
      }, {
        "id": 4,
        "label": "Truck"
      }, {
        "id": 5,
        "label": "Scooter"
      }],
      "tracking": [{
        "id": 1,
        "label": "Email"
      }, {
        "id": 2,
        "label": "Mobile"
      }, {
        "id": 3,
        "label": "Email & Mobile"
      }],
      "DGClass": [{
        "id": 0,
        "label": "0"
      }, {
        "id": 1,
        "label": "1"
      }, {
        "id": 2,
        "label": "2"
      }, {
        "id": 3,
        "label": "3"
      }, {
        "id": 4,
        "label": "4"
      }, {
        "id": 5,
        "label": "5"
      }, {
        "id": 6,
        "label": "6"
      }, {
        "id": 7,
        "label": "7"
      }, {
        "id": 8,
        "label": "8"
      }, {
        "id": 9,
        "label": "9"
      }]
    }
  };
  $scope.markers = [];
  $scope.truckCourierStatus = [];
  $scope.getJobStyle = function (assigned) {
    var normal = {
      "font-weight": "normal"
    };
    var bold = {
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
    },
    "jobDetail": {
      "title": "Detail",
      "tpl": versionUrl("app/components/common/tpls/jobDetail.tpl"),
      "showSearch": 0,
      "showRefresh": 0,
      "showDetailButtons": 1
    },
    "potentialCouriers": {
      "title": "Potential Couriers",
      "tpl": versionUrl("app/components/home/tpls/potentialCouriers.tpl"),
      "showSearch": 1
    },
    "currentWork": {
      "title": "Current Work",
      "tpl": versionUrl("app/components/home/tpls/currentWork.tpl"),
      "showSearch": 1,
      "showRefresh": 0
    },
    "couriersMoveThrough": {
      "title": "Couriers Movement Through List",
      "tpl": versionUrl("app/components/home/tpls/couriersMovementThroughList.tpl"),
      "showSearch": 1,
      "showRefresh": 0
    },
    "courierMovePickedUp": {
      "title": "Couriers Movement Picked Up Run",
      "tpl": versionUrl("app/components/home/tpls/couriersMovementPickedUp.tpl"),
      "showSearch": 1,
      "showRefresh": 0
    },
    "courierMoveClear": {
      "title": "Couriers Movement Clear List",
      "tpl": versionUrl("app/components/home/tpls/couriersMovementClearList.tpl"),
      "showSearch": 1,
      "showRefresh": 0
    },
    "areaList": {
      "title": "Area List",
      "tpl": versionUrl("app/components/home/tpls/areaList.tpl"),
      "showSearch": 0,
      "showRefresh": 0
    },
    "jobUpdates": {
      "title": "Job Updates",
      "tpl": versionUrl("app/components/home/tpls/jobUpdates.tpl"),
      "showSearch": 0,
      "showRefresh": 0
    },
    "supports": {
      "title": "Supports",
      "tpl": versionUrl("app/components/home/tpls/supports.tpl"),
      "showSearch": 0,
      "showRefresh": 0
    },
    "lateCalls": {
      "title": "Late Calls",
      "tpl": versionUrl("app/components/home/tpls/lateCalls.tpl"),
      "showSearch": 0,
      "showRefresh": 0
    },
    "map": {
      "title": "Google Map",
      "tpl": versionUrl("app/components/home/tpls/map.tpl"),
      "showSearch": 0,
      "showRefresh": 1
    },
    "clearLists": {
      "title": "Clear Lists",
      "tpl": versionUrl("app/components/home/tpls/clearLists.tpl"),
      "showSearch": 0,
      "showRefresh": 0
    }
  };
  $scope.pickService = {
    "clients": [],
    "channel": [],
    "channelTexts": {
      buttonDefaultText: "Select Channel..."
    },
    "channelEvents": {
      "onSelectionChanged": function onSelectionChanged() {
        var temp = $scope.pickService.channel.map(function (el) {
          return el.label;
        });
        ctrl.setSupportChannel(String(temp) || "All");
      }
    },
    "settings": {
      "enableSearch": true,
      "selectedToTop": true,
      "closeOnBlur": true,
      "closeOnSelect": true,
      "buttonClasses": "topBarActive btn-sm btn-clients"
    }
  };
  $scope.pickClients = [];
  $scope.pickChannels = [{
    "id": "1",
    "label": "City"
  }, {
    "id": "2",
    "label": "Main"
  }, {
    "id": "3",
    "label": "Trucks"
  }];

  ///////////////////////////////
  // LAYOUT
  ///////////////////////////////
  var layoutsObject = null;
  if (Modernizr.localstorage) {
    layoutsObject = JSON.parse(localStorage.getItem("layouts-" + ContactID));
    $scope.mapZoom = JSON.parse(localStorage.getItem("mapZoom-" + ContactID)) || {
      display: true
    };
  }
  var defaultLayout = [{
    name: "Default",
    layout: {
      "columns": [{
        "id": "col1",
        "width": "1100px",
        "boxes": [{
          "name": "jobsList"
        }]
      }, {
        "id": "col2",
        "width": "300px",
        "boxes": [{
          "name": "currentWork",
          "height": "300px"
        }, {
          "name": "potentialCouriers",
          "height": "200px"
        }, {
          "name": "supports",
          "height": "300px"
        }, {
          "name": "jobDetail",
          "height": "300px"
        }]
      }, {
        "id": "col3",
        "width": "300px",
        "boxes": $scope.isInternal ? [{
          "name": "clearLists",
          "height": "600px"
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
  ctrl.layouts = layoutsObject || defaultLayout;
  ctrl.currentLayoutName = "default";
  $scope.truckMode = "On";
  $scope.supportChannel = JSON.parse(localStorage.getItem("support-channel-" + ContactID)) || "All";
  $scope.groupJobsSelection = "";
  $scope.currentWorkSelection = "";
  $scope.potentialCouriersSelection = "";
  ctrl.storeMapZoomDisplay = function () {
    if (Modernizr.localstorage) {
      localStorage.setItem("mapZoom-" + ContactID, JSON.stringify({
        display: ctrl.autoZoomEnabled
      }));
    }
  };
  ctrl.layout = angular.copy(ctrl.layouts[0].layout);

  /**
   * @param {Number} index
   */
  ctrl.deleteLayout = function (index) {
    var deleteConfirm = $mdDialog.confirm().title('Delete Layout?').textContent('Are you sure you would like to delete this layout?').ariaLabel('delete layout').ok('Delete').cancel('Cancel');
    $mdDialog.show(deleteConfirm).then(function () {
      ctrl.layouts.splice(index, 1);
      if (Modernizr.localstorage) {
        localStorage.setItem("layouts-" + ContactID, JSON.stringify(ctrl.layouts));
      }
    }, function () {
      console.log("Delete layout canceled!");
    });
  };

  /**
   * @param {string} layoutName
   */
  ctrl.setLastActiveLayoutName = function (layoutName) {
    if (Modernizr.localstorage) {
      localStorage.setItem("lastActiveLayout-" + ContactID, layoutName);
    }
  };

  /**
   * @param {number} index
   */
  ctrl.loadLayout = function (index) {
    ctrl.currentLayoutName = ctrl.layouts[index].name;
    ctrl.layout = angular.copy(ctrl.layouts[index].layout);

    // save layout as last active
    ctrl.setLastActiveLayoutName(ctrl.currentLayoutName);
    $timeout(ctrl.getData, 1000);
  };
  ctrl.saveLayout = function () {
    angular.forEach(ctrl.layout.columns, function (column) {
      column.width = angular.element("#co-" + column.id).css("flex-basis");
      angular.forEach(column.boxes, function (box) {
        box.height = angular.element("#box-" + box.name).css("flex-basis");
      });
    });
    var saveLayoutPrompt = $mdDialog.prompt().title('Save Layout').textContent('Please enter a name for this layout.').ariaLabel('Layout name').required(true).ok('Save').cancel('Cancel');
    $mdDialog.show(saveLayoutPrompt).then(function (layoutName) {
      if (Modernizr.localstorage) {
        ctrl.layouts = ctrl.layouts.concat({
          name: layoutName,
          layout: angular.copy(ctrl.layout)
        });
        localStorage.setItem("layouts-" + ContactID, JSON.stringify(ctrl.layouts));

        // save last active layout
        ctrl.setLastActiveLayoutName(layoutName);
      }
      var deferred = $q.defer();
      deferred.resolve({
        data: "OK"
      });
      return deferred.promise;
    }, function () {
      console.log("Save Layout Cancelled!");
    });
  };
  $scope.supportChannelChanged = function () {
    console.log($scope.pickService.channel);
  };
  ctrl.onCourierSearchClick = function ($event) {
    // Check if the click target is the input field itself
    if ($event.target.tagName === 'INPUT') {
      ctrl.courierSearchText = '';
    }
  };
  ctrl.handleRowClick = function ($event, job) {
    // Check if the click target is not one of the special input fields
    if (!$event.target.classList.contains('lateCallField') && !$event.target.classList.contains('dispatchField')) {
      // Use $timeout to ensure this runs after the current digest cycle
      $timeout(function () {
        $scope.selectJob(job);
        angular.element("#input_" + job.id).select();
      });
    }
  };
  $scope.attention = function (job) {
    var temp = "";
    if (job.direct) {
      temp += "DIRECT ";
    }
    if (job.van) {
      temp = "VAN ";
    }
    if (job.truck || job.speedID === 45) {
      temp += "TRUCK ";
    }
    if (job["return"]) {
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
    activate: function activate(e, ui) {
      var box = angular.element("#" + ui.item.context.id);
      var parent = box.parent();
      var boxes = parent.children().filter(function (_, child) {
        return angular.element(child).hasClass('box');
      });
      angular.forEach(boxes, function (boxElement) {
        var box = angular.element(boxElement);
        box.attr("data-height", box.prop('offsetHeight') + "px");
      });
    },
    update: function update(e, ui) {
      $timeout(function () {
        var box = angular.element("#" + ui.item.context.id);
        var parent = box.parent();
        var boxes = parent.children().filter(function (_, child) {
          return angular.element(child).hasClass('box');
        });
        angular.forEach(boxes, function (boxElement) {
          var box = angular.element(boxElement);
          box.css({
            "flex-basis": box.attr("data-height")
          });
        });
        angular.element(boxes[boxes.length - 1]).css({
          "flex-basis": "0"
        });
      }, 0);
    }
  };
  ctrl.showInput = {};
  ctrl.inputWidth = {};

  /**
   * @param {string} boxName
   * @param {number} index
   */
  ctrl.openSearch = function (boxName, index) {
    var boxID = boxName + '-' + index;
    if (ctrl.showInput[boxID]) {
      ctrl.showInput[boxID] = false;
      ctrl.inputWidth[boxID] = 31;
    } else {
      ctrl.inputWidth[boxID] = 200;
      ctrl.showInput[boxID] = true;
    }
  };
  ctrl.openChat = function () {
    if (angular.element(".chat").hasClass("open")) {
      angular.element(".chat input").fadeOut(function () {
        angular.element(".chat").removeClass("open");
        angular.element(".chat").animate({
          "width": "31px"
        }, 500);
      });
    } else {
      angular.element(".chat").animate({
        "width": "250px"
      }, 500, function () {
        angular.element(".chat").addClass("open");
        angular.element(".chat").find("input").fadeIn();
      });
    }
  };
  $scope.allCouriers.display = true;
  //Column Sorting
  $scope.sort = [];
  $scope.orderList = function (list, prop) {
    var serverOrder = list === "jobList";
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
      ctrl.setFilters({
        "order": prop
      });
    }
  };

  /**
   * @param {Job} currentJob
   */
  ctrl.unlockJob = function (currentJob) {
    return jdSvc.unlockJob(currentJob);
  };

  /**
   * @param {Job} currentJob
   */
  ctrl.lockJob = function (currentJob) {
    return jdSvc.lockJob(currentJob);
  };

  /**
   * @param {number} id
   * @param {$event} event
   * @param {string} area
   */
  $scope.selectClearList = function (id, event, area) {
    var areaGroupButtons = angular.element("#area-group .btn");
    areaGroupButtons.removeClass("topBarActive");
    var clearListsActive = angular.element("#clearLists .listActive");
    if (clearListsActive.length <= 1) {
      $scope.getClearListEnvelope(id);
    }
    ctrl.setFilters({
      'clearList': area
    });
  };
  $scope.selectForDispatch = function (job) {
    console.log("In SelectForDispatch");
    $scope.jobForDispatch = job;
  };
  ctrl.swapPOD = function (event) {
    var jobNumberPrompt = $mdDialog.prompt().title('Enter the other job number').textContent('Please enter the Job Number to swap the POD.').placeholder('Job Number').ariaLabel('Job Number').targetEvent(event).required(true).ok('Submit').cancel('Cancel');
    $mdDialog.show(jobNumberPrompt).then(function (jobNumber) {
      return uCSData.validateSwapPOD(jobNumber).then(function (data) {
        if (!data) {
          $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Invalid Job').textContent('This job is invalid.').ok('OK'));
        } else {
          var secondJobId = data;
          var firstJobId = $scope.currentJob.id;
          var confirmSwap = $mdDialog.confirm().title('Swap Delivery Info?').textContent("Are you sure you wish to swap delivery info between ".concat($scope.currentJob.jobNo, " and ").concat(jobNumber, "?")).targetEvent(event).ok('Yes').cancel('No');
          $mdDialog.show(confirmSwap).then(function () {
            uCSData.swapPOD($scope.currentJob.jobNo, jobNumber).then(function () {
              $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Successful').textContent('POD Swap Completed Successfully').ok('OK'));
              uCSData.reSendJobs(secondJobId);
              uCSData.reAssignJobs(firstJobId).then(function () {
                uCSData.reSendJobs(firstJobId).then(function () {
                  $scope.refreshData(true);
                });
              });
            });
          }, function () {
            console.log("POD Swap Canceled");
          });
        }
      });
    }, function () {
      // action when cancel is clicked
    });
  };

  /**
   * @param {string} jobNumber
   * @param {number} jobId
   */
  ctrl.voidJobForm = function (jobNumber, jobId) {
    var voidJobPrompt = $mdDialog.prompt().title("Void Job").textContent("Add Note").placeholder('Note').ariaLabel('Void job').required(true).ok('Void').cancel('Cancel');
    $mdDialog.show(voidJobPrompt).then(function (note) {
      return DispatchData.addNote(jobId, note, FirstName, false).then(function () {
        return DispatchData.voidJob(jobId).then(function () {
          return ctrl.getData();
        });
      }, function () {
        // User canceled the void
      });
    });
  };

  /**
   * @param {$event} event
   * @param {Job} job
   */
  ctrl.messageClick = function (event, job) {
    var selectedCourierId = ctrl.selectedCourier ? ctrl.selectedCourier.id : job.courierData.courierID;
    $mdDialog.show({
      controller: SendMessageDialogController,
      controllerAs: 'ctrl',
      parent: angular.element($document.body),
      targetEvent: event,
      templateUrl: versionUrl('app/components/dialogs/send-message-dialog/send-message-dialog.html'),
      clickOutsideToClose: true,
      fullscreen: true,
      locals: {
        selectedCourierId: selectedCourierId,
        contactId: ContactID,
        dispatcherName: FirstName
      }
    }).then(function (_) {
      console.log('Dialog closed!');
    });
  };

  /**
   * @param {$event} $event
   * @param {Job} job
   */
  ctrl.otherEventForm = function ($event, job) {
    $mdDialog.show({
      controller: AddEventDialogController,
      controllerAs: "ctrl",
      templateUrl: versionUrl("app/components/dialogs/add-event-dialog/add-event-dialog.html"),
      parent: angular.element($document.body),
      targetEvent: $event,
      clickOutsideToClose: true,
      fullscreen: true,
      locals: {
        job: job,
        dispatcherName: FirstName,
        contactId: ContactID
      }
    }).then(function () {
      console.log('Pallet Dialog closed!');
    });
  };
  $scope.getSupportColorClass = function (support) {
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
  };

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
  $scope.dispatchDroppedMarkerToClosestCourier = function (lat, lng, flags, carMarker, jobNumber) {
    if (flags.length === 0 && carMarker === null) {
      var _confirm = $mdDialog.confirm().title('Dispatch Invalid').textContent('Could not find courier for Dispatch').ok('Close').cancel();
      $mdDialog.show(_confirm).then(function () {
        var unDispatchedData = $scope.jobList.filter(function (x) {
          return x.courierData.courierID === null;
        });
        ctrl.displayPickupPoints(unDispatchedData, true, null);
        ctrl.getAvailableCourierLocation();
      });
      return;
    }
    console.log(jobNumber);
    var toCompare = [];
    angular.forEach(flags, function (f, key) {
      toCompare.push([key, f.position.lat(), f.position.lng()]);
    });
    if (carMarker !== null) {
      toCompare.push([9999, carMarker.position.lat(), carMarker.position.lng()]);
    }
    var closestIndex = closestLocation(lat, lng, toCompare);
    var closestCourier = closestIndex[0] === 9999 ? carMarker : flags[closestIndex[0]];
    var foundCourier = $scope.pickCouriers.find(function (c) {
      return c.courierID === closestCourier.courierId;
    });
    var dispatchToCourierCode = closestCourier.code;
    if (closestIndex[0] !== 9999) {
      if (foundCourier !== undefined) {
        if (foundCourier.code === undefined) {
          dispatchToCourierCode = foundCourier.label;
        } else {
          dispatchToCourierCode = dispatchToCourierCode + ' ' + foundCourier.code;
        }
      }
    }
    var confirm = $mdDialog.confirm().title('Dispatch Job ' + jobNumber).textContent('Dispatch to ' + dispatchToCourierCode + '?').ok('Yes').cancel('No');
    $mdDialog.show(confirm).then(function () {
      var j = $scope.jobList.find(function (jo) {
        return jo.jobNo === jobNumber;
      });
      var jn = j.jobNo;
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
      var jobs = [];
      jobs.push(j.id);
      return DispatchData.allocateJobs(foundCourier.courierID, ContactID, jobs).then(function () {
        ctrl.getData().then(function () {
          angular.element('#box-map .loading').css('display', '');
          $scope.courier = {
            gpsCourier: foundCourier.id
          };
          $scope.searchCourier();
        });
      });
    }, function () {
      var unDispatchedData = $scope.jobList.filter(function (x) {
        return x.courierData.courierID === null;
      });
      ctrl.displayPickupPoints(unDispatchedData, true, null);
      ctrl.getAvailableCourierLocation();
    });
  };
  ctrl.selectAllContent = function ($event) {
    $event.target.select();
  };
  ctrl.latePickup = function (minsAway, j, obj) {
    console.log("current = " + j.lp);
    console.log("param minsAway = " + minsAway);
    console.log(obj);
    ctrl.lateCall(minsAway, 1, j, true);
  };
  ctrl.lateDelivery = function (minsAway, j, obj) {
    console.log("current = " + j.ld);
    console.log("param minsAway = " + minsAway);
    console.log(obj);
    ctrl.lateCall(minsAway, 2, j, true);
  };

  /////////////////////////////////////
  // LATE CALLS
  /////////////////////////////////////
  /**
   * @param {Date} lateTime
   * @param {number} lateType
   * @param {Job} job
   * @param {boolean} calc
   */
  ctrl.lateCall = function (lateTime, lateType, job, calc) {
    return DispatchData.lateCall(lateType, lateTime, job.minutes, job.pickupTime, job.alertLatePickup, job.deliveryTime, job.alertLateDelivery, job.jobNo, job.clientId, job.contactName, ContactID, job.time, job.id, job.jobType, job.speed, job.notify || job.speed, FirstName, calc).then(function (response) {
      ctrl.getData().then(function () {
        toastrService.showSuccessToast("Late call applied successfully");
      });
      return response;
    });
  };
  $scope.jobClass = function (job) {
    var classToUse = job.direct ? "direct " : "";
    classToUse = classToUse + (job.speed === "CT" || job.speed === "CTHIRE" || job.speed === "FT" || job.speed === "FTHIRE" || job.speed === "HC" || job.speed === "TC" ? "chilled" : "");
    return classToUse;
  };

  ////////////////////////////////////////
  // DISPATCH THE JOBS
  ///////////////////////////////////////
  ctrl.getJobsToDispatch = function () {
    var activeJobs = Array.from(angular.element("#jobList .active"));
    return $scope.jobList.filter(function (jo) {
      return activeJobs.some(function (aJob) {
        return jo.id === $(aJob).data("jobid");
      });
    });
  };
  ctrl.dispatchJobs = function (courierNumber) {
    var deferred = $q.defer();
    var jobsToDispatch = ctrl.getJobsToDispatch();
    if (!Array.isArray(jobsToDispatch) || jobsToDispatch.length === 0) {
      console.warn('No jobs to dispatch');
      deferred.resolve();
      return deferred.promise;
    }
    dispatchJobService.dispatchJobs(courierNumber, jobsToDispatch).then(function () {
      return $scope.getJobList();
    }).then(function () {
      deferred.resolve();
    })["catch"](function (error) {
      console.error('Error dispatching jobs:', error);
      deferred.reject(error);
    });
    return deferred.promise;
  };

  ////////////////////////////////////////
  // RESTORE JOB
  ///////////////////////////////////////
  ctrl.restoreJobs = function () {
    var $q = this.$q;
    var callData = {
      "call": "restoreJobs",
      "jobs": [],
      "splitJobs": [],
      "jobNos": [],
      "courierID": null
    };
    var foundCourier = null;
    var activeElements = angular.element('#jobList .active');
    angular.forEach(activeElements, function (element) {
      var currentElement = angular.element(element);
      var jobId = currentElement.data("jobid");
      var job = $scope.jobList.find(function (jo) {
        return jo.id === jobId;
      });
      if (job) {
        var jobNo = job.jobNo;
        DispatchData.addRestoreEvent(jobNo, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
        if (callData.courierID === null) {
          callData.courierID = job.courierData.courierID;
          foundCourier = $scope.pickCouriers.find(function (c) {
            return c.courierID === job.courierData.courierID;
          }) || $scope.pickAllCouriers.find(function (c) {
            return c.courierID === job.courierData.courierID;
          });
        }
        if (job.displaySplitJobDetail) {
          callData.splitJobs.push(jobId);
        } else {
          callData.jobs.push(jobId);
        }
      }
    });
    var promises = [];
    if (callData.splitJobs.length > 0) {
      promises.push(DispatchData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs));
    }
    if (callData.jobs.length > 0) {
      promises.push(DispatchData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs));
    }
    return $q.all(promises).then(function () {
      return ctrl.getData();
    }).then(function () {
      angular.element('#box-map .loading').css('display', '');
      $scope.courier = {
        gpsCourier: foundCourier.id
      };
      return $scope.searchCourier();
    });
  };

  ////////////////////////////////////////
  // REDESPATCHED JOB
  ///////////////////////////////////////
  ctrl.reAllocateJobs = function () {
    var callData = {
      "call": "redespatchJobs",
      "jobs": [],
      "splitJobs": [],
      "jobNos": [],
      "courierID": null
    };
    var foundCourier = null;
    var activeElements = angular.element('#jobList .active');
    var _loop = function _loop() {
      var currentElement = angular.element(activeElements[i]);
      var jobId = currentElement.attr("data-jobid");
      var job = $scope.jobList.find(function (jo) {
        return jo.id === jobId;
      });
      if (job) {
        foundCourier = $scope.pickCouriers.find(function (c) {
          return c.courierID === job.courierData.courierID;
        }) || $scope.pickAllCouriers.find(function (c) {
          return c.courierID === job.courierData.courierID;
        });
        callData.jobs.push(jobId);
      }
    };
    for (var i = 0; i < activeElements.length; i++) {
      _loop();
    }
    if (callData.jobs.length > 0) {
      DispatchData.reAllocateJobs(foundCourier.courierID, ContactID, callData.jobs);
    }
    ctrl.getData().then(function () {
      angular.element('#box-map .loading').css('display', '');
      $scope.courier = {
        gpsCourier: foundCourier.id
      };
      $scope.searchCourier();
    });
  };
  $scope.resendJobs = function () {
    var activeJobElements = angular.element("#jobList .active");
    var jobIds = activeJobElements.map(function (index, element) {
      return angular.element(element).attr("data-jobid");
    }).get();
    if (jobIds.length === 0) {
      return;
    }
    DispatchData.resendJobs(jobIds).then(function () {
      return ctrl.getData();
    }).then(function () {
      var lastJobElement = activeJobElements.last();
      var lastJobId = lastJobElement.attr("data-jobid");
      var lastJob = $scope.jobList.find(function (job) {
        return job.id === lastJobId;
      });
      var foundCourier = $scope.pickCouriers.find(function (c) {
        return c.courierID === lastJob.courierData.courierID;
      }) || $scope.pickAllCouriers.find(function (c) {
        return c.courierID === lastJob.courierData.courierID;
      });
      if (foundCourier) {
        $scope.courier = {
          gpsCourier: foundCourier.id
        };
        $scope.searchCourier();
      }
      angular.element('#box-map .loading').css('display', '');
    })["catch"](function (error) {
      console.error('Error updating data:', error);
    });
  };

  /**
   * @param  {$event}  $event
   */
  ctrl.restoreAll = function ($event) {
    var confirm = $mdDialog.confirm().title('Restore All Jobs').textContent('Are you sure you wish to restore all jobs for ' + $scope.currentCourier.courier).targetEvent($event).ok('Yes').cancel('No');
    $mdDialog.show(confirm).then(function () {
      var callData = {
        "call": "restoreJobs",
        "jobs": [],
        "splitJobs": [],
        "jobNos": [],
        "courierID": null
      };
      var foundCourier = null;
      angular.element("#currentWork tr.droppable-row").each(function () {
        var j = $scope.jobsCurrentList.find(function (jo) {
          return jo.id === angular.element(this).data("jobid");
        });
        var jn = j.jobNo;
        DispatchData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
        if (callData.courierID === null) {
          callData.courierID = j.courierData.courierID;
          foundCourier = $scope.pickCouriers.find(function (c) {
            return c.courierID === j.courierData.courierID;
          }) || $scope.pickAllCouriers.find(function (c) {
            return c.courierID === j.courierData.courierID;
          });
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
      $timeout(function () {
        ctrl.getCurrentJobs(foundCourier.courierID);
        ctrl.getData();
      }, 1000);
    }, function () {
      // Cancelled dialog.
    });
  };

  /**
   * @param       {$event}  $event
   */
  ctrl.redispatchAll = function ($event) {
    var confirm = $mdDialog.confirm().title('Restore All Jobs').textContent('Are you sure you wish to redispatch all jobs for ' + $scope.currentCourier.courier).targetEvent($event).ok('Yes').cancel('No');
    $mdDialog.show(confirm).then(function () {
      var callData = {
        "call": "redespatchJobs",
        "jobs": [],
        "splitJobs": [],
        "jobNos": [],
        "courierID": $scope.currentCourier.courierID
      };
      var foundCourier = null;
      angular.element("#currentWork tr.droppable-row").each(function () {
        callData.jobs.push(angular.element(this).attr("data-jobid"));
        foundCourier = $scope.pickCouriers.find(function (c) {
          return c.courierID === callData.courierID;
        }) || $scope.pickAllCouriers.find(function (c) {
          return c.courierID === callData.courierID;
        });
      });
      if (callData.jobs.length > 0) {
        DispatchData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
      }
      ctrl.getData().then(function () {
        angular.element('#box-map .loading').css('display', '');
        $scope.courier = {
          gpsCourier: foundCourier.id
        };
        $scope.searchCourier();
      });
    }, function () {
      // Cancelled dialog.
    });
  };

  /**
   * @param  {$event}  $event
   */
  $scope.resendAll = function ($event) {
    var confirm = $mdDialog.confirm().title('Resend All Jobs').textContent('Are you sure you wish to resend all jobs for ' + $scope.currentCourier.courier).targetEvent($event).ok('Yes').cancel('No');
    $mdDialog.show(confirm).then(function () {
      var callData = {
        "call": "resendJobs",
        "jobs": [],
        "splitJobs": [],
        "jobNos": [],
        "courierID": $scope.currentCourier.courierID
      };
      var foundCourier = null;
      angular.element("#currentWork tr.droppable-row").each(function () {
        callData.jobs.push(angular.element(this).attr("data-jobid"));
        foundCourier = $scope.pickCouriers.find(function (c) {
          return c.courierID === callData.courierID;
        }) || $scope.pickAllCouriers.find(function (c) {
          return c.courierID === callData.courierID;
        });
      });
      if (callData.jobs.length > 0) {
        DispatchData.resendAllJobs(callData.courierID);
      }
      ctrl.getData().then(function () {
        angular.element('#box-map .loading').css('display', '');
        $scope.courier = {
          gpsCourier: foundCourier.id
        };
        $scope.searchCourier();
      });
    }, function () {
      // No action for 'No'
    });
  };
  ctrl.reAllocateJobsFromCurrentWindow = function () {
    var callData = {
      "call": "redespatchJobs",
      "jobs": [],
      "splitJobs": [],
      "jobNos": [],
      "courierID": $scope.currentCourier.courierID
    };
    var foundCourier = null;
    angular.element("#currentWork .active").each(function () {
      callData.jobs.push(angular.element(this).attr("data-jobid"));
      foundCourier = $scope.pickCouriers.find(function (c) {
        return c.courierID === callData.courierID;
      }) || $scope.pickAllCouriers.find(function (c) {
        return c.courierID === callData.courierID;
      });
    });
    if (callData.jobs.length > 0) {
      DispatchData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
    }
    ctrl.getData().then(function () {
      angular.element('#box-map .loading').css('display', '');
      $scope.courier = {
        gpsCourier: foundCourier.id
      };
      $scope.searchCourier();
    });
  };
  $scope.resendJobsFromCurrentWindow = function () {
    var callData = {
      "call": "resendJobs",
      "jobs": [],
      "splitJobs": [],
      "jobNos": [],
      "courierID": $scope.currentCourier.courierID
    };
    var foundCourier = null;
    angular.element("#currentWork .active").each(function () {
      callData.jobs.push(angular.element(this).attr("data-jobid"));
      foundCourier = $scope.pickCouriers.find(function (c) {
        return c.courierID === callData.courierID;
      }) || $scope.pickAllCouriers.find(function (c) {
        return c.courierID === callData.courierID;
      });
    });
    if (callData.jobs.length > 0) {
      DispatchData.resendJobs(callData.jobs);
    }
    ctrl.getData().then(function () {
      angular.element('#box-map .loading').css('display', '');
      $scope.courier = {
        gpsCourier: foundCourier.id
      };
      $scope.searchCourier();
    });
  };
  ctrl.restoreJobsFromCurrentWindow = function () {
    var callData = {
      "call": "restoreJobs",
      "jobs": [],
      "splitJobs": [],
      "jobNos": [],
      "courierID": null
    };
    var foundCourier = null;
    angular.element("#currentWork .active").each(function () {
      var jobIdElement = angular.element(this);
      var j = $scope.jobsCurrentList.find(function (jo) {
        return jo.id === jobIdElement.data("jobid");
      });
      var jn = j.jobNo;
      DispatchData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
      if (callData.courierID === null) {
        callData.courierID = j.courierData.courierID;
        foundCourier = $scope.pickCouriers.find(function (c) {
          return c.courierID === j.courierData.courierID;
        }) || $scope.pickAllCouriers.find(function (c) {
          return c.courierID === j.courierData.courierID;
        });
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
    $timeout(function () {
      ctrl.getCurrentJobs(foundCourier.courierID);
      ctrl.getData();
    }, 1000);
  };

  /**
   * @param {Job} job
   */
  ctrl.setFirstJob = function (job) {
    var confirm = $mdDialog.confirm().title('Set First Job?').textContent('Are you sure you wish to set this as the First Job?').ok('Yes').cancel('No');
    $mdDialog.show(confirm).then(function () {
      DispatchData.setFirstJob(job.id, $scope.currentCourier.courierID).then(function () {
        ctrl.getCurrentJobs($scope.currentCourier.courierID);
      });
    }, function () {
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
  ctrl.splitJob = function ($event, job) {
    if (!job.allowSplit) {
      return showAlert($event, 'Unable to split job', "Can not split ".concat(job.JobNo, "."));
    }
    return showConfirm($event, 'Split Job?', 'Are you sure you wish to split this job?').then(function (result) {
      if (result) {
        loadingService.showLoader();
        return DispatchData.splitJob(job.id, FirstName).then(function () {
          loadingService.closeLoader();
          return ctrl.setSplitJobMeetingPoint($event, job);
        });
      }
      // If the user clicked 'No', we don't do anything
      return Promise.resolve();
    })["catch"](function (error) {
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
    return $mdDialog.show($mdDialog.alert().parent(angular.element($document.body)).clickOutsideToClose(true).title(title).textContent(content).ariaLabel('Alert').ok("OK").targetEvent($event));
  }

  /**
   * @param {$event} $event
   * @param {string} title
   * @param {string} content
   */
  function showConfirm($event, title, content) {
    var confirm = $mdDialog.confirm().title(title).textContent(content).ariaLabel('Confirm').targetEvent($event).ok('Yes').cancel('No');
    return $mdDialog.show(confirm);
  }

  //////////////////////////////
  //  PALLET CONTROLS //
  /////////////////////////////
  $scope.palletMenu = [
  // NEW IMPLEMENTATION
  {
    text: "Delete",
    click: function click($itemScope) {
      //$scope.items.splice($itemScope.$index, 1);

      var index = $scope.currentJob.PalletInfo.indexOf($itemScope.pallet);
      $scope.currentJob.PalletInfo.splice(index, 1);

      //LOCK WITH CURRENT USER
    }
  }];

  //ACTIVATE DROP
  $scope.activateDrop = function () {
    $timeout(function () {
      $document.ready(function () {
        angular.element(".droppable-row").droppable({
          classes: {
            "ui-droppable-hover": "active"
          },
          drop: function drop() {
            var parent = angular.element(this).parents(".box");
            var parentOffset = parent.offset();
            var parentTop = parentOffset.top;
            var parentBottom = parentTop + parent.outerHeight();
            var row = angular.element(this);
            var rowOffset = row.offset();
            var rowTop = rowOffset.top;
            var rowBottom = rowTop + row.outerHeight();
            if (rowTop < parentBottom && rowBottom > parentTop) {
              angular.element(this).css({
                "background-color": "#c6dfad"
              });
              angular.element(this).animate({
                backgroundColor: "inherit"
              }, 300, function () {
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
  ctrl.getPotentialCouriers = function (jobId) {
    angular.element('#box-potentialCouriers .loading').css('display', 'block');
    DispatchData.getPotentialCouriers(jobId).then(function (data) {
      $scope.potentialCouriers = data;
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
      angular.element('#box-potentialCouriers .loading').css('display', 'none');
      $scope.activateDrop();
    });
  };

  /**
   * @param {string} searchText
   */
  ctrl.courierSearch = function (searchText) {
    var url = "/courier/AllActiveSearch";
    return DispatchData.autocompleteSearch(searchText, url).then(function (result) {
      return result;
    })["catch"](function (error) {
      toastrService.showErrorToast(error.message);
    });
  };
  ctrl.jobRecordSearchText = "";

  /**
   * @param {string} searchText
   */
  ctrl.jobRecordSearch = function (searchText) {
    return $scope.jobList.filter(function (job) {
      return job.jobNo.toLowerCase().includes(searchText.toLowerCase());
    }).map(function (job) {
      return {
        id: job.id,
        text: job.jobNo
      };
    });
  };

  /**
   * @param {number} selectedJobId
   */
  ctrl.JobRecordSelected = function (selectedJobId) {
    var selectedJob = $scope.jobList.find(function (job) {
      return job.id === selectedJobId;
    });
    $scope.selectJob(selectedJob);
  };

  /**
   * @param {number} courierID
   * @param {string} courierName
   */
  ctrl.updateCourierData = function (courierID, courierName) {
    $scope.currentWorkSelection = " for Courier  ".concat(courierID, "  ").concat(courierName);
    $scope.currentCourier = {
      courierID: courierID,
      courier: courierName
    };
    ctrl.currentSelection = " for Courier ".concat(courierID, "  ").concat(courierName);
    ctrl.getCurrentJobs(courierID);
    DispatchData.truckCourierStatus(courierID).then(function (result) {
      $scope.truckCourierStatus = result.data;
    });
  };
  ctrl.displayLoadingIndicators = function () {
    loadingService.showLoader();
  };
  ctrl.hideLoadingIndicators = function () {
    loadingService.closeLoader();
  };
  ctrl.selectedCourier = null;
  ctrl.selectedCourierChange = function (courier) {
    if (courier === undefined) {
      $scope.currentCourier = null;
    } else {
      ctrl.updateCourierData(courier.id, courier.text);
    }
  };
  $scope.searchCourier = function () {
    ctrl.displayLoadingIndicators();
    var foundCourier = $scope.pickAllCouriers.find(function (c) {
      return c.id === $scope.courier.gpsCourier;
    });
    console.log(foundCourier);
    if (foundCourier === undefined) {
      ctrl.hideLoadingIndicators();
      $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Attention').textContent('Courier not found.').ok('OK'));
      return;
    }
    ctrl.updateCourierData(foundCourier.id, foundCourier.name);
    ctrl.hideLoadingIndicators();
  };

  // Select the courier
  $scope.selectCourier = function (courier) {
    var loadingElement = angular.element("#box-jobDetail .loading");
    var mapLoadingElement = angular.element('#box-map .loading');
    loadingElement.css('display', 'block');
    mapLoadingElement.css('display', '');
    if (!courier.courier) {
      courier.courier = "".concat(courier.code, " ").concat(courier.firstName);
    }
    console.log(courier);
    $scope.currentWorkSelection = " for Courier " + courier.courier;
    $scope.currentCourier = courier;
    ctrl.getCurrentJobs(courier.courierID);
    $timeout(function () {
      loadingElement.css('display', 'none');
      mapLoadingElement.css('display', 'none');
    }, 100);
    DispatchData.truckCourierStatus(courier.courierID).then(function (result) {
      $scope.truckCourierStatus = result.data;
    })["catch"](function (error) {
      console.error('Error fetching truck courier status:', error);
    });
  };
  $scope.refreshTruckCourierStatus = function () {
    DispatchData.truckCourierStatus($scope.currentCourier.courierID).then(function (result) {
      $scope.truckCourierStatus = result.data;
    });
  };
  $scope.selectMapCourier = function (courier) {
    angular.element("#box-jobDetail .loading").css('display', 'block');
    angular.element('#box-map .loading').css('display', 'block');
    angular.element("#box-currentWork .loading").css('display', 'block');
    var foundCourier = $scope.pickCouriers.find(function (x) {
      return x.courierID === courier.courierID;
    });
    $scope.currentCourier = {
      courierID: foundCourier.courierID,
      courier: foundCourier.label
    };
    DispatchData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done").then(function (data) {
      angular.element("#box-currentWork .loading").css('display', 'none');
      $scope.jobsCurrentList = data;
      if (data.length > 0) {
        displayRoutePointsOnly(data, false, $scope.mapZoom.display);
      }
      $scope.activateDrop();
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
    });
    $scope.currentWorkSelection = " for Courier " + courier.label;
    ctrl.currentSelection = " for Courier " + courier.label;
    $timeout(function () {
      $document.ready(function () {
        angular.element("#box-jobDetail .loading").css('display', 'none');
        angular.element("#box-map .loading").css('display', 'none');
      });
    }, 100);
    DispatchData.truckCourierStatus(courier.courierID).then(function (data) {
      $scope.truckCourierStatus = data;
    });
  };
  $scope.clearCourierSearch = function () {
    $scope.jobsCurrentList = false;
    $scope.courier.gpsCourier = '';
    $scope.currentWorkSelection = '';
  };
  $scope.selectPotentialCourier = function (courier) {
    angular.element('#box-jobDetail').find(".loading").css('display', 'block');
    angular.element('#box-map .loading').css('display', '');
    if (courier.courier === undefined) {
      courier.courier = courier.code + ' ' + courier.firstName;
    }
    if ($scope.jobList.length > 0) {
      var jid = angular.element("#jobList .active").last().data("jobid");
      var currentJob = $scope.jobList.find(function (jo) {
        return jo.id === jid;
      });
      var unDispatchedData = $scope.jobList.filter(function (x) {
        return x.courierData.courierID === null;
      });
      ctrl.displayPickupPoints(unDispatchedData, true, currentJob);
    }
    angular.element('#box-currentWork').find(".loading").css('display', 'block');
    var code = $scope.pickCouriers.find(function (x) {
      return x.courierID === courier.courierID;
    }).id;
    DispatchData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done").then(function (data) {
      angular.element('#box-currentWork').find(".loading").css('display', 'none');
      if ($scope.currentJob !== null && $scope.currentJob.courier !== code) {
        $scope.currentJob = null;
      }
      $scope.jobsCurrentList = data;
      if (data.length > 0) {
        displayRoutePoints(data, false, $scope.mapZoom.display);
      } else {
        DispatchData.getCourierPosition(code).then(function (posData) {
          displayCourierPositionOnly(posData.latitude, posData.longitude);
        });
      }
      $scope.activateDrop();
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
      ctrl.getAvailableCourierLocation();
    });
    $scope.currentWorkSelection = " for Courier " + courier.courier;
    $scope.currentCourier = courier;
    ctrl.currentSelection = " for Courier " + courier.courier;
    $timeout(function () {
      $document.ready(function () {
        angular.element('#box-jobDetail').find(".loading").css('display', 'none');
        angular.element('#box-map').find(".loading").css('display', 'none');
      });
    }, 100);
  };
  ////////////////////////////
  // GROUPED JOBS
  ////////////////////////////

  $scope.getGroupedJobs = function () {
    angular.element('#box-jobGroups').find(".loading").css('display', 'block');
    DispatchData.getJobsGrouped().then(function (data) {
      angular.element('#box-jobGroups').find(".loading").css('display', 'none');
      $scope.jobGroups = data;
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
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
  ctrl.getCurrentJobs = function (courierId) {
    angular.element('#box-currentWork').find(".loading").css('display', 'block');
    var foundCourier = $scope.pickCouriers.find(function (x) {
      return x.courierID === courierId;
    });
    var code = foundCourier !== undefined ? foundCourier.id : "";
    DispatchData.getJobsCurrent(courierId, $scope.jobFilters.status === "done").then(function (data) {
      angular.element('#box-currentWork').find(".loading").css('display', 'none');
      $scope.jobsCurrentList = data;
      if (data.length > 0) {
        ctrl.displayRoutePoints(data, true, $scope.mapZoom.display);
      } else {
        DispatchData.getCourierPosition(code).then(function (posData) {
          ctrl.displayCourierPositionOnly(posData.latitude, posData.longitude);
        });
      }
      $scope.activateDrop();
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
    });
  };
  var filtersObject = null;
  if (Modernizr.localstorage) {
    filtersObject = JSON.parse(localStorage.getItem("disp-filters-" + ContactID));
  }
  $scope.jobFilters = filtersObject || {
    "status": "nda",
    "area": "main1",
    "order": "remain",
    "asc": "asc"
  };
  var f = ".top-bar .btn-group .btn." + $scope.jobFilters.status;
  angular.element(f).addClass("topBarActive");
  var areas = $scope.jobFilters.area.split(',');
  for (var i = 0; i < areas.length; i++) {
    f = ".top-bar .btn-group .btn." + areas[i];
    angular.element(f).addClass("topBarActive");
  }
  $scope.sort["jobList"] = "remain";
  ctrl.setFiltersFromTopBar = function (data) {
    angular.element('.clearLists-list-title').removeClass('listActive');
    ctrl.setFilters(data);
  };
  ctrl.setFilters = function (data) {
    $timeout(function () {
      if (data.status) {
        $scope.jobFilters.status = data.status;
      }
      if (data.area) {
        var selected = angular.element("#area-group > .btn.topBarActive").length;
        if (selected > 1) {
          $scope.jobFilters.area += "," + data.area;
        } else {
          $scope.jobFilters.area = data.area;
        }
      }
      if (data.clearList) {
        var clSelected = angular.element("#clearLists").find('.listActive').length;
        if (clSelected > 1) {
          $scope.jobFilters.area += "," + data.clearList;
        } else {
          $scope.jobFilters.area = data.clearList;
        }
      }
      if (data.order) {
        $scope.jobFilters.order = data.order;
      }
      ctrl.getData();
    }, 300);
  };
  $scope.selectJobDetail = function (job) {
    $scope.currentJob = job;
    ctrl.currentSupport = null;
    $scope.potentialCouriers = false;
    $scope.potentialCouriersSelection = " for Job " + job.jobNo;
    ctrl.currentSelection = " for Job " + job.jobNo;

    // Check attachments
    ctrl.hasAttachedFile(job.id);
    if ($scope.job.rootParentID) {
      DispatchData.getRelatedJobs(job.rootParentID, job.clientID).then(function (data) {
        job.relatedJobs = data;
      });
    }
  };
  $scope.loadRelatedJobDetail = function (id, jn) {
    angular.element("#box-jobDetail").find(".loading").show();
    DispatchData.getJobDetail(id).then(function (data) {
      $scope.currentJob = data;
      angular.element("#box-jobDetail").find(".loading").hide();
      ctrl.currentSelection = " for Job " + jn;
    });
  };
  ctrl.selectSupportJobDetail = function (support) {
    console.log("select Job  " + support.jobId);
    ctrl.currentSupport = support;
    angular.element("#box-jobDetail").find(".loading").show();
    DispatchData.getJobDetail(support.jobId).then(function (data) {
      $scope.selectJob(data);
      $scope.currentJob = data;
      angular.element("#box-jobDetail").find(".loading").hide();
      ctrl.currentSelection = " for Job " + support.jobNumber;
      var jobs = [];
      jobs.push($scope.currentJob);
      displayRoutePointsOnly(jobs, true, $scope.mapZoom.display);
      if ($scope.mapZoom.display) {
        setMapBounds();
        map.setZoom(12);
      }
      if ($scope.currentJob.rootParentID) {
        DispatchData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientID).then(function (data) {
          $scope.currentJob.relatedJobs = data;
        });
      }
    });
  };

  // Select Job
  $scope.selectJob = function (job) {
    $timeout(function () {
      console.log("selectJob");
      $scope.currentJob = job;
      console.log(job);
      jdSvc.setJob($scope.currentJob);

      // Check for attachments
      ctrl.checkForAttachments(job.id);
      DispatchData.getActiveCouriers().then(function (data) {
        $scope.pickCouriers = data;
      });
      if ($scope.currentJob.rootParentID) {
        DispatchData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientID).then(function (data) {
          $scope.currentJob.relatedJobs = data;
        });
      }

      // Center and zoom the map on the selected job
      MapService.initializeMap().then(function (map) {
        var jobPosition = new google.maps.LatLng(job.pickUpLatitude, job.pickUpLongitude);
        if (ctrl.autoZoomEnabled) {
          MapService.setCenter(job.pickUpLatitude, job.pickUpLongitude);
          MapService.setZoom(15);
        } else {
          MapService.panTo(jobPosition);
        }
        var marker = MapService.addMarker(job.pickUpLatitude, job.pickUpLongitude, {
          icon: MapService.getPinImage(MapService.getPinColor(job.status), job.runOrder),
          label: {
            text: job.runOrder.toString(),
            color: 'white'
          },
          jobNumber: job.jobNo
        });
        var infoWindow = MapService.createInfoWindow('<div>' + '<strong>Job: ' + job.jobNo + '</strong><br>' + 'Status: ' + job.status + '</div>');
        marker.addListener('click', function () {
          infoWindow.open(map, marker);
        });
        infoWindow.open(map, marker);
      });
    });
  };
  $scope.setCurrentWorkMenu = function () {
    return [{
      text: "Restore",
      click: function click() {
        ctrl.restoreJobsFromCurrentWindow();
      }
    }, {
      text: "Redispatch",
      click: function click() {
        ctrl.reAllocateJobsFromCurrentWindow();
      }
    }, {
      text: "Resend",
      click: function click() {
        $scope.resendJobsFromCurrentWindow();
      }
    }];
  };
  ctrl.fromColumnClick = function (evt, job) {
    switch (evt.which) {
      case 1:
        // this is left click
        break;
      case 2:
        // in case you need some middle click things
        break;
      case 3:
        // this is right click
        $timeout(function () {
          jdSvc.updateGPS(job, 'fromAddress', true);
        }, 100);
        break;
      default:
        console.log("you have a strange mouse!");
        break;
    }
    return false;
  };
  ctrl.toColumnClick = function ($event, job) {
    switch ($event.which) {
      case 1:
        // this is left click
        break;
      case 2:
        // in case you need some middle click things
        break;
      case 3:
        // this is right click
        $timeout(function () {
          jdSvc.updateGPS(job, 'toAddress', true);
        }, 100);
        break;
      default:
        console.log("you have a strange mouse!");
        break;
    }
    return false;
  };
  $scope.latePickColumnClick = function (evt) {
    switch (evt.which) {
      case 1:
        // this is left click
        break;
      case 2:
        // in case you need some middle click things
        break;
      case 3:
        // this is right click
        $timeout(function () {
          var dueTime = moment($scope.currentJob.booked).add($scope.currentJob.lp || $scope.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');
          var items = [];
          for (var _i = 1; _i < 37; _i++) {
            if (parseInt(dueTime) < _i * 5) items.push({
              "id": _i * 5,
              "text": (_i * 5).toString() + " mins away"
            });
          }
          $scope.lateForm = {
            "data": {
              "jobNum": $scope.currentJob.jobNo,
              "client": $scope.currentJob.client,
              "dueMins": dueTime,
              "choose": ""
            },
            submit: function submit() {
              var pickupETAValue = parseInt($scope.lateForm.choose.value);
              var dueMins = moment($scope.currentJob.booked).add($scope.currentJob.lp || $scope.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');
              if ($scope.currentJob.lp !== pickupETAValue) {
                var window = $scope.currentJob.lp || $scope.currentJob.pickupTime;
                var lateMins = pickupETAValue - dueMins + window;
                $scope.currentJob.lp = lateMins;
                console.log(lateMins);
                ctrl.lateCall(lateMins, 1, $scope.currentJob, false);
                $scope.lateForm.data = null;
                angular.element("#AwayMins").select2().empty();
                angular.element("#AwayMins").select2('destroy');
                angular.element(".lateForm").hide(0);
              }
            },
            cancel: function cancel() {
              $scope.lateForm.data = null;
              angular.element("#AwayMins").select2().empty();
              angular.element("#AwayMins").select2('destroy');
              angular.element(".lateForm").hide(0);
            }
          };
          $scope.$apply();
          angular.element(".lateForm").show(0);
          $timeout(function () {
            var dueOptions = {
              minimumInputLength: 0,
              data: items,
              placeholder: "Start typing to enter new time..."
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
  ctrl.speedColumnClick = function ($event, job) {
    switch ($event.which) {
      case 1:
        // this is left click
        break;
      case 2:
        // in case you need some middle click things
        break;
      case 3:
        // this is right click
        $timeout(function () {
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
  ctrl.clientColumnClick = function ($event, job) {
    switch ($event.which) {
      case 1:
        // this is left click
        break;
      case 2:
        // in case you need some middle click things
        break;
      case 3:
        // this is right click
        $timeout(function () {
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
  ctrl.notifyColumnClick = function (evt, job) {
    switch (evt.which) {
      case 1:
        // this is left click
        break;
      case 2:
        // in case you need some middle click things
        break;
      case 3:
        // this is right click
        $timeout(function () {
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
  $scope.setEventsMenu = function ($event) {
    return [{
      text: "Void Job",
      click: function click() {
        ctrl.voidJobForm($scope.currentJob.jobNo, $scope.currentJob.id);
      }
    }, {
      text: "Add Event - Other",
      click: function click() {
        ctrl.otherEventForm($event, $scope.currentJob);
      }
    }, {
      text: "Split Job",
      click: function click() {
        ctrl.splitJob($event, $scope.currentJob);
      },
      enabled: function enabled($itemScope) {
        return $itemScope.job.allowSplit;
      }
    }, {
      text: "Set First Job",
      click: function click() {
        ctrl.setFirstJob($scope.currentJob);
      }
    }];
  };
  $scope.setJobsMenu = function () {
    var multiple = angular.element(".activeTable .active").length > 1;
    var lastCourier = null;
    var sameCourier = true;
    angular.element(".activeTable .active").each(function () {
      var j = $scope.jobList.find(function (jo) {
        return jo.id === angular.element(_this).data("jobid");
      });
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
    var multipleMenu = [{
      text: "Dispatch Selected",
      click: function click($itemScope, $event) {
        ctrl.dispatchJobs($itemScope.courier.courier);
      }
    }, {
      text: "Re-dispatch Selected",
      click: function click() {
        //$scope.items.splice($itemScope.$index, 1);
      }
    }];
    if (sameCourier) {
      multipleMenu.push({
        text: "Restore Selected",
        click: function click() {
          ctrl.restoreJobs();
        }
      }, {
        text: "Redispatch Selected",
        click: function click() {
          ctrl.reAllocateJobs();
        }
      }, {
        text: "Resend Selected",
        click: function click() {
          $scope.resendJobs();
        }
      });
    }
    if (sameCourier && lastCourier === null) {
      multipleMenu = [{
        text: "Dispatch Selected",
        click: function click() {
          ctrl.dispatchJobs(null);
        }
      }];
    }
    var fullMenu = [{
      text: "Dispatch",
      click: function click() {
        ctrl.dispatchJobs(null);
      }
    }];
    if (lastCourier !== null) {
      multipleMenu.shift();
      multipleMenu.shift();
      fullMenu.shift();
      fullMenu.push({
        text: "Restore",
        click: function click() {
          ctrl.restoreJobs();
        }
      }, {
        text: "Redispatch",
        click: function click() {
          ctrl.reAllocateJobs();
        }
      }, {
        text: "Resend",
        click: function click() {
          $scope.resendJobs();
        }
      });
    }
    return multiple ? multipleMenu : fullMenu;
  };

  /**
   * @param {string} mode
   */
  ctrl.setTruckMode = function (mode) {
    $scope.truckMode = mode;
    ctrl.getData();
  };

  /**
   * @param {string} channel
   */
  ctrl.setSupportChannel = function (channel) {
    $scope.supportChannel = channel;
    if (Modernizr.localstorage) {
      localStorage.setItem("support-channel-" + ContactID, JSON.stringify($scope.supportChannel));
    }
    $scope.getSupports();
    ctrl.displayAvailableCouriers;
  };
  $scope.courierMenu = [
  // NEW IMPLEMENTATION
  {
    text: "Dispatch Selected",
    click: function click($itemScope) {
      $scope.dispatchJobs($itemScope.courier.courier || $itemScope.courier.code);
    }
  }];
  $scope.potentialCourierMenu = [{
    text: "Dispatch Selected",
    click: function click($itemScope) {
      $scope.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
    }
  }];
  $scope.getJobList = function () {
    if (Modernizr.localstorage) {
      localStorage.setItem("disp-filters-" + ContactID, JSON.stringify($scope.jobFilters));
    }
    var selectedClients = $scope.pickService.clients.map(function (a) {
      return a.id;
    });
    return DispatchData.getJobsFilter($scope.jobFilters, selectedClients, $scope.isInternal).then(function (data) {
      $scope.jobList = data;
      ctrl.updateMapMarkers(data);
      angular.element("#box-jobsList .loading").fadeOut();
      $timeout(function () {
        sizeHeadings();
        if (data.length > 0) {
          var unDispatchedData = data.filter(function (x) {
            return x.courierData.courierID === null;
          });
          ctrl.displayPickupPoints(unDispatchedData, true, null);
        }
        ctrl.getAvailableCourierLocation();
      }, 200);
    });
  };
  ctrl.closeSupport = function (support) {
    DispatchData.closeSupport(support.eventId, ContactID).then(function () {
      $scope.getSupports();
      ctrl.currentSupport = null;
    });
  };
  ctrl.lockSupport = function (support) {
    console.log(support);
    if (support.lockedBy === Dispatcher) {
      DispatchData.unLockSupport(support.eventId, Dispatcher).then(function () {
        $scope.getSupports();
      });
    } else {
      DispatchData.lockSupport(support.eventId, Dispatcher).then(function () {
        $scope.getSupports();
      });
    }
  };

  /**
   * @param {string} item
   */
  function SetSelectedChannels(item) {
    var sr = $scope.pickChannels.find(function (obj) {
      return obj.label === item;
    });
    $scope.pickService.channel.push(sr);
  }
  $scope.getSupports = function () {
    ////////////////////////////
    // SUPPORTS
    ////////////////////////////
    angular.element("#box-supports").find(".loading").show();
    return DispatchData.getSupports($scope.supportChannel).then(function (data) {
      var first = $scope.supports === null || $scope.supports === undefined;
      $scope.supports = data;
      if (first) {
        $scope.supportChannel.split(',').forEach(SetSelectedChannels);
      }
      angular.element("#box-supports").find(".loading").fadeOut();
      $scope.supportMenu = [
      // NEW IMPLEMENTATION
      {
        text: "Complete",
        click: function click($itemScope) {
          ctrl.closeSupport($itemScope.support);
        }
      }, {
        text: "Toggle Lock",
        click: function click($itemScope) {
          ctrl.lockSupport($itemScope.support);
        }
      }, {
        text: "Void Job",
        click: function click($itemScope) {
          ctrl.voidJobForm($itemScope.support.jobNumber, $itemScope.support.jobId);
        },
        enabled: function enabled($itemScope) {
          return $itemScope.support.jobId;
        }
      }];
      $timeout(function () {
        $document.ready(function () {
          if (ctrl.currentSupport) {
            angular.element("#supports tr[data-id='" + ctrl.currentSupport.eventId + "']").addClass("active");
          }
        });
      }, 100);
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
    });
  };
  $scope.getClientContacts = function () {
    DispatchData.getClientContacts(ContactID).then(function (data) {
      $scope.pickClients = data;
    });
  };
  ctrl.getData = function () {
    ///////////////////////////////
    // JOB LIST
    ///////////////////////////////

    //Get Job Data
    angular.element("#box-jobsList").find(".loading").show();
    $scope.jobList = [];
    $scope.currentJob = null;
    ctrl.jdSvc.currentJob = null;
    $scope.potentialCouriers = null;
    $scope.jobGroups = false;
    if (!$scope.courier) {
      $scope.jobsCurrentList = false;
      $scope.currentCourier = null;
    }
    $scope.getClearListEnvelope = function (id) {
      DispatchData.getClearListEnvelope(id).then(function (data) {
        var swll = new google.maps.LatLng(data.minimumLatitude, data.minimumLongitude);
        var nell = new google.maps.LatLng(data.maximumLatitude, data.maximumLongitude);
        map.fitBounds(new google.maps.LatLngBounds(swll, nell));
        map.setZoom(13);
        ctrl.getAvailableCourierLocation();
      });
    };
    $scope.getClearListsData = function () {
      DispatchData.getClearLists().then(function (data) {
        $scope.clearLists = data;
        $timeout(function () {
          angular.element("#clearLists .loading").fadeOut();
        }, 0);
        console.log($scope.clearLists);
        $scope.activateDrop();
      });
    };
    $scope.getClearListsData();
    DispatchData.getActiveCouriers().then(function (data) {
      $scope.pickCouriers = data;
    });
    DispatchData.getAllCouriers().then(function (data) {
      $scope.pickAllCouriers = data;
    });

    ////////////////////////////
    // COURIER MOVEMENTS THROUGH
    ////////////////////////////
    angular.element("#box-couriersMoveThrough").find(".loading").show();
    DispatchData.getCouriersThrough().then(function (data) {
      $scope.couriersThrough = data;
      $scope.couriersThroughMenu = [{
        text: "Delete",
        click: function click() {
          angular.element(".rightActiveTable .active").fadeOut();
        }
      }];
      $scope.activateDrop();
      $timeout(function () {
        angular.element("#box-couriersMoveThrough").find(".loading").fadeOut();
      }, 100);
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
    });

    ////////////////////////////
    // COURIER MOVEMENTS PICKED UP
    ////////////////////////////

    angular.element("#box-courierMovePickedUp").find(".loading").show();
    DispatchData.getCouriersPicked().then(function (data) {
      $scope.couriersPicked = data;
      $scope.couriersPickedMenu = [
      // NEW IMPLEMENTATION
      {
        text: "Hold",
        click: function click($itemScope) {
          var callData = {
            "call": "holdCourier",
            "courier": $itemScope.courier
          };
          DispatchData.doAPI(callData).then(function (data) {
            console.log(data);
            if (data.response === "Success") {
              angular.element(".rightActiveTable .active").css({
                "background-color": "#c6dfad"
              });
              angular.element(".rightActiveTable .active").animate({
                backgroundColor: "inherit"
              }, 300, function () {
                angular.element(this).removeAttr("style");
              });
            } else {
              console.log("Critical Error");
            }
          });
        }
      }, {
        text: "Head",
        click: function click($itemScope) {
          var callData = {
            "call": "headCourier",
            "courier": $itemScope.courier
          };
          DispatchData.doAPI(callData).then(function (data) {
            console.log(data);
            if (data.response === "Success") {
              angular.element(".rightActiveTable .active").css({
                "background-color": "#c6dfad"
              });
              angular.element(".rightActiveTable .active").animate({
                backgroundColor: "inherit"
              }, 300, function () {
                angular.element(this).removeAttr("style");
              });
            } else {
              console.log("Critical Error");
            }
          });
        }
      }, {
        text: "Delete",
        click: function click() {
          angular.element(".rightActiveTable .active").fadeOut();
        }
      }];
      $timeout(function () {
        $document.ready(function () {
          angular.element("#box-courierMovePickedUp").find(".loading").fadeOut();
        });
      }, 100);
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
    });

    ////////////////////////////
    // COURIER MOVEMENTS CLEAR
    ////////////////////////////
    angular.element("#box-courierMoveClear").find(".loading").show();
    DispatchData.getCouriersClear().then(function (data) {
      $scope.couriersClear = data;
      $scope.couriersClearMenu = [{
        click: function click($itemScope) {
          var callData = {
            "call": "holdCourier",
            "courier": $itemScope.courier
          };
          DispatchData.doAPI(callData).then(function (data) {
            console.log(data);
            if (data.response === "Success") {
              angular.element(".rightActiveTable .active").css({
                "background-color": "#c6dfad"
              });
              angular.element(".rightActiveTable .active").animate({
                backgroundColor: "inherit"
              }, 300, function () {
                angular.element(this).removeAttr("style");
              });
            } else {
              console.log("Critical Error");
            }
          });
        },
        text: "Hold"
      }, {
        text: "Move",
        click: function click($itemScope) {
          var callData = {
            "call": "moveCourier",
            "courier": $itemScope.courier
          };
          DispatchData.doAPI(callData).then(function (data) {
            console.log(data);
            if (data.response === "Success") {
              angular.element(".rightActiveTable .active").css({
                "background-color": "#c6dfad"
              });
              angular.element(".rightActiveTable .active").animate({
                backgroundColor: "inherit"
              }, 300, function () {
                angular.element(this).removeAttr("style");
              });
            } else {
              console.log("Critical Error");
            }
          });
        }
      }, {
        text: "Delete",
        click: function click() {
          angular.element(".rightActiveTable .active").fadeOut();
        }
      }];
      $timeout(function () {
        $document.ready(function () {
          angular.element("#box-courierMoveClear").find(".loading").fadeOut();
        });
      }, 100);
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
    });

    ////////////////////////////
    // AREA LIST
    ////////////////////////////

    angular.element("#box-areaList").find(".loading").show();
    DispatchData.getAreaList().then(function (data) {
      $scope.areaList = data;
      $timeout(function () {
        $document.ready(function () {
          angular.element("#box-areaList").find(".loading").fadeOut();
        });
      }, 100);
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
        sizeHeadings();
      }, 2000);
    });

    ////////////////////////////
    // LATE CALLS
    ////////////////////////////

    angular.element("#box-lateCalls").find(".loading").show();
    DispatchData.getLateCalls().then(function (data) {
      ctrl.lateCalls = data;
      ctrl.lateCallsMenu = [
      // NEW IMPLEMENTATION
      {
        text: "Complete",
        click: function click($itemScope) {
          //$scope.selected = $itemScope.item.name;

          var callData = {
            "call": "dismissSupport",
            "support": $itemScope.support
          };
          DispatchData.doAPI(callData).then(function (data) {
            console.log(data);
            if (data.response === "Success") {
              angular.element(".rightActiveTable .active").fadeOut();
            } else {
              console.log("Critical Error");
            }
          });
        }
      }, {
        text: "Lock",
        click: function click() {
          //$scope.items.splice($itemScope.$index, 1)
          //LOCK WITH CURRENT USER
        }
      }];
      $timeout(function () {
        $document.ready(function () {
          angular.element("#box-lateCalls").find(".loading").fadeOut();
        });
      }, 100);
      $timeout(function () {
        sizeHeadings();
      }, 1000);
      $timeout(function () {
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
  ctrl.getData();
  $document.everyTime("30s", "SP", function () {
    $scope.getSupports();
  });
  $scope.getSupports();

  // on first focus (bubbles up to document), open the menu
  $document.on('focus', '.select2-selection.select2-selection--single', function () {
    angular.element(this).closest(".select2-container").siblings('select:enabled').select2('open');
  });
  angular.element('select.select2').on('select2:closing', function (e) {
    angular.element(e.target).data("select2").$selection.one('focus focusin', function (e) {
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
  ctrl.setSplitJobMeetingPoint = function ($event, currentJob) {
    var getDeliveryLocation = function getDeliveryLocation(job) {
      return {
        lat: job.deliveryLatitude || "",
        "long": job.deliveryLongitude || ""
      };
    };
    var location = getDeliveryLocation(currentJob);
    console.log("Retrieved job coordinates!");
    DispatchData.getSuburbList().then(function (selectedSuburbs) {
      return showEditAddressDialog($event, currentJob, selectedSuburbs, location);
    }).then(function (dialogResult) {
      return handleDialogResult(dialogResult, currentJob);
    })["catch"](function (error) {
      return toastrService.showErrorToast(error.message);
    })["finally"](function () {
      return console.log("Split jobs process completed.");
    });
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
          "long": location["long"],
          suburb: currentJob.toSuburbName,
          postCode: currentJob.postCode
        },
        suburbOptions: selectedSuburbs,
        title: "Split Job Address and GPS",
        submitLabel: "Split Job"
      }
    });
  }
  function handleDialogResult(addressDetails, currentJob) {
    if (!addressDetails) {
      console.log("Split jobs canceled!");
      return;
    }
    var updatedJob = angular.extend({}, currentJob, {
      toAddress: addressDetails.address,
      toSuburbID: addressDetails.our_suburb
    });
    var callData = {
      jobID: updatedJob.id,
      lat: addressDetails.lat,
      "long": addressDetails["long"],
      toSuburbId: updatedJob.toSuburbID,
      toAddress: updatedJob.toAddress
    };
    return updateJobData(callData).then(function () {
      return DispatchData.reRateSplitJob(callData.jobID);
    }).then(function () {
      return DispatchData.finishSplitJobProcess(callData.jobID, FirstName);
    }).then(function () {
      return ctrl.getData();
    }).then(function () {
      toastrService.showSuccessToast("Job Successfully Split");
      console.log("Job splitting complete!");
      console.log('Dialog closed!');
      return $scope.getJobList();
    });
  }
  function updateJobData(callData) {
    return DispatchData.updateSplitJobAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData["long"]);
  }
  ;
  $scope.addEvent = function () {
    var time = new Date();
    time.setSeconds(0);
    time.setMilliseconds(0);
    $scope.eventForm = {
      "data": {
        "jobNum": $scope.currentJob.jobNo,
        "client": $scope.currentJob.client,
        "event": "Other",
        "date": new Date(),
        "time": time
      },
      submit: function submit() {},
      cancel: function cancel() {
        angular.element('.eventForm').css('display', 'none');
      }
    };
    angular.element('.eventForm').css('display', '');
  };

  /**
   * @param {$event}  $event
   */
  ctrl.truckLoadingStatus = function ($event) {
    return $mdDialog.show({
      controller: TruckCourierStatusDialogController,
      controllerAs: 'ctrl',
      parent: angular.element($document.body),
      targetEvent: $event,
      templateUrl: versionUrl("app/components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.html"),
      clickOutsideToClose: false,
      fullscreen: true,
      locals: {
        data: $scope.truckCourierStatus[0]
      }
    }).then(function () {
      // Dialog Closed
    });
  };
  ctrl.createNewJob = function ($event) {
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
          staffId: ContactID,
          despatcherName: FirstName
        }
      });
    }

    /**
     * @param {number} newJobId
     */
    function processNewJob(newJobId) {
      return DispatchData.getJobDetail(newJobId).then(function (job) {
        return ctrl.getData().then(function () {
          $scope.selectJob(job);
          toastrService.showSuccessToast("New Job Created Successfully");
        });
      })["finally"](function () {
        loadingService.closeLoader();
      });
    }
    function handleError(error) {
      console.error('Error in createNewJob:', error);
      toastrService.showErrorToast(error.message || "An error occurred while creating the job");
      loadingService.closeLoader();
    }
    showCreateJobDialog().then(function (newJobId) {
      if (newJobId) {
        return processNewJob(newJobId);
      }
    })["catch"](handleError);
  };

  /**
   * @param {$event}  $event
   */
  ctrl.interCourierCharge = function ($event) {
    return $mdDialog.show({
      controller: InterCourierChargeDialog,
      controllerAs: 'ctrl',
      parent: angular.element($document.body),
      targetEvent: $event,
      templateUrl: versionUrl("app/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.html"),
      clickOutsideToClose: false,
      fullscreen: true,
      locals: {
        staffId: ContactID
      }
    }).then(function () {
      console.log("Inter-courier Charge Added!");
    }).then(function () {
      return "Inter-courier Charge Canceled!";
    });
  };

  /**
   * @param {$event}  $event
   * @param {Job}  job
   */
  ctrl.createEvent = function ($event, job) {
    return $mdDialog.show({
      controller: AddEventDialogController,
      controllerAs: "ctrl",
      templateUrl: versionUrl("app/components/dialogs/add-event-dialog/add-event-dialog.html"),
      parent: angular.element($document.body),
      targetEvent: $event,
      clickOutsideToClose: true,
      fullscreen: true,
      locals: {
        job: job,
        dispatherName: FirstName,
        contactId: ContactID
      }
    }).then(function () {
      console.log('Pallet Dialog closed!');
    });
  };

  /**
   * @param {number} jobId
   */
  ctrl.checkForAttachments = function (jobId) {
    var deferred = $q.defer();
    ctrl.isCheckingAttachments = true;
    ctrl.hasAttachedFile = false;
    DispatchData.isFilesAttachedToJob(jobId).then(function (response) {
      ctrl.hasAttachedFile = response;
      deferred.resolve(response);
    })["catch"](function (error) {
      console.log('Error checking for attachments:', error);
      ctrl.hasAttachedFile = false;
      deferred.reject(error);
    })["finally"](function () {
      ctrl.isCheckingAttachments = false;
    });
    return deferred.promise;
  };

  /**
   * @param {$event}  event
   * @param {Job} job
   */
  ctrl.openFileAttachmentDialog = function (event, job) {
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
      }
    }).then(function () {
      // Dialog Closed
      console.log('Job File Upload Dialog Closed!');
    });
  };

  /**
   * @param  {Event}  event
   * @param  {Job}  job
   */
  ctrl.showAdditionalServicesMenu = function (event, job) {
    DispatchData.hasClientItemsAvailable(job.clientId, job.speedId).then(function (isClientItemsAvailable) {
      if (!isClientItemsAvailable) {
        return $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('No Additional Services').targetEvent(event).textContent('No additional services  has been set up for this client. Please add a service through Admin Manager and try again.').ok('OK'));
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
          job: job
        }
      });
    }).then(function () {
      console.log('Additional Services Dialog closed!');
    })["catch"](function (error) {
      // handle or throw the error
      console.log(error);
    });
  };

  // Load custom layout
  ctrl.init = function () {
    if (Modernizr.localstorage) {
      var storedLayouts = localStorage.getItem("layouts-" + ContactID);
      var lastActiveLayoutName = localStorage.getItem("lastActiveLayout-" + ContactID);
      if (storedLayouts) {
        ctrl.layouts = JSON.parse(storedLayouts);
        if (lastActiveLayoutName) {
          var lastActiveLayoutIndex = ctrl.layouts.findIndex(function (l) {
            return l.name === lastActiveLayoutName;
          });

          // if the last active layout is found among stored layouts
          if (lastActiveLayoutIndex !== -1) {
            ctrl.loadLayout(lastActiveLayoutIndex);
          }
        }
      }
    }
  };

  // Call the init function when the controller loads
  ctrl.init();

  // Code from html
  var keyIsDown = {};
  function overrideKeyboardEvent(e) {
    switch (e.type) {
      case "keydown":
        if (!keyIsDown[e.keyCode]) {
          keyIsDown[e.keyCode] = true;
          // do key down stuff here
          if (e.keyCode === 82 && e.ctrlKey) {
            //location.reload();
          }
        }
        break;
      case "keyup":
        delete keyIsDown[e.keyCode];
        // do key up stuff here
        break;
    }
    disabledEventPropagation(e);
    if (e.keyCode === 68 && e.ctrlKey) {
      e.preventDefault();
      return false;
    }
  }
  function disabledEventPropagation(e) {
    if (e.keyCode === 68 && e.ctrlKey) {
      if (e.stopPropagation) {
        e.stopPropagation();
      } else if ($window.event) {
        $window.event.cancelBubble = true;
      }
    }
  }
  function sizeHeadings() {
    angular.element("body").find(".box").each(function () {
      var box = angular.element(this);
      box.find(".table-headings thead tr th").each(function (index) {
        var newWidth = box.find(".table tbody tr td").eq(index).outerWidth();
        angular.element(this).outerWidth(newWidth);
      });
      box.find(".table-headings table").width(box.find(".table").width());
    });
    $document.onkeydown = overrideKeyboardEvent;
    $document.onkeyup = overrideKeyboardEvent;
    $document.on('keydown', '.dispatchField, .lateCallField', function (event) {
      if (event.keyCode === 13) {
        angular.element(this).parents(".clickable-row").addClass("doing");
      }
    });
    $document.on('click', '.top-bar .btn-group .btn', function (event) {
      if (!event.ctrlKey && !event.metaKey) {
        angular.element(this).parent().find('.topBarActive').removeClass('topBarActive');
      }
      angular.element(this).addClass('topBarActive');
    });
    $document.on('click', '.clearLists-list-title', function (event) {
      if (!event.ctrlKey && !event.metaKey) {
        angular.element("#clearLists").find('.listActive').removeClass('listActive');
      }
      angular.element(this).addClass('listActive');
    });
    $document.on('ready', function () {
      var isDown = false; // Tracks status of mouse button

      $document.on('mousedown', function () {
        isDown = true; // When mouse goes down, set isDown to true
      }).on('mouseup', function () {
        isDown = false; // When mouse goes up, set isDown to false
      });
      $document.on("mouseenter", ".activeTable .clickable-row", function (event) {
        if (event.ctrlKey) {
          if (isDown) {
            // Only change css if mouse is down
            angular.element(this).addClass("active");
            angular.element(this).siblings(".test").click();
          }
        }
      });
    });
    var mouseDown = 0;
    $document.on('mousedown', '.clickable-row', function (event) {
      var group;
      var jobNo;
      var activeTableClickActive = angular.element(".activeTable .clickable-row.active");
      if (activeTableClickActive.length > 1) {
        jobNo = activeTableClickActive.length + " Jobs";
      } else {
        jobNo = angular.element(this).attr("data-jobno");
      }
      if (mouseDown === 0) {
        mouseDown = 1;
        if (event.which === 1) {
          if (event.ctrlKey) {
            if (angular.element(this).hasClass("active")) {
              angular.element(this).removeClass('active');
            } else {
              angular.element(this).addClass('active');
            }
          } else {
            if (!angular.element(this).hasClass("active")) {
              group = angular.element(this).parents(".table-rows").attr("data-group");
              angular.element('*[data-group="' + group + '"]').each(function () {
                angular.element(this).find('.active').removeClass('active');
              });
              angular.element(this).addClass('active');
            }
          }
          angular.element(".activeTable").removeClass("activeTable");
          angular.element(this).parents(".table").addClass("activeTable");
        }
        if (!event.ctrlKey) {
          if (angular.element(this).hasClass("draggable-row")) {
            if (!angular.element(this).hasClass("active")) {
              group = angular.element(this).parents(".table-rows").attr("data-group");
              angular.element('*[data-group="' + group + '"]').each(function () {
                angular.element(this).find('.active').removeClass('active');
              });
              angular.element(this).addClass('active');
            }
            $timeout(function () {
              if (mouseDown === 1) {
                var $draggingItems = angular.element("#draggingItems");
                $draggingItems.show();
                $draggingItems.html(jobNo);
                $draggingItems.css({
                  "top": event.pageY - 25,
                  "left": event.pageX - 50
                });
                $draggingItems.draggable();
                $draggingItems.trigger(event);
              }
            }, 200);
          }
        }
      }
    });
    $document.on('mouseup', '.clickable-row', function (event) {
      if (event.which === 3) {
        angular.element(".rightActiveTable").removeClass("rightActiveTable");
        angular.element(this).parents(".table").addClass("rightActiveTable");
      }
      if (!event.ctrlKey) {
        if (angular.element(this).hasClass("active")) {} else {
          var group = angular.element(this).parents(".table-rows").attr("data-group");
          angular.element('*[data-group="' + group + '"]').each(function () {
            angular.element(this).find('.active').removeClass('active');
          });
          angular.element(this).addClass('active');
        }
      }
    });
    $document.on("mouseup", function () {
      angular.element("#draggingItems").hide();
      mouseDown = 0;
    });
    $document.on("keydown", function (e) {
      var code = e.keyCode ? e.keyCode : e.which;
      if (code === 40) {
        angular.element(".activeTable").find(".active").removeClass("active").next().addClass("active").mouseup().click();
      } else if (code === 38) {
        angular.element(".activeTable").find(".active").removeClass("active").prev().addClass("active").mouseup().click();
      }
    });
    var height = angular.element("#box-clearLists").find(".box-content").height() - 30;
    angular.element(".clearLists-list").each(function () {
      var newHeight = angular.element(this).data("height") * height / 100;
      angular.element(this).height(newHeight);
    });
  }
}
HomeController.$inject = ['$document', "$filter", 'greetingService', "JobDetailService", 'loadingService', "$mdDialog", "$parse", "$q", "$scope", "$state", "$window", "$timeout", 'toastrService', "DispatchData", "uCSData", "dispatchJobService", "moment", "Upload", "bytesFilter", "versionUrl", "NgMap", "MapService"];
angular.module("uDispatch").controller("HomeControl", HomeController);
function Deg2Rad(deg) {
  return deg * Math.PI / 180;
}
function PythagorasEquirectAngular(lat1, lon1, lat2, lon2) {
  lat1 = Deg2Rad(lat1);
  lat2 = Deg2Rad(lat2);
  lon1 = Deg2Rad(lon1);
  lon2 = Deg2Rad(lon2);
  var R = 6371; // km
  var x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
  var y = lat2 - lat1;
  return Math.sqrt(x * x + y * y) * R;
}
function closestLocation(latitude, longitude, locations) {
  var minDifference = 99999;
  var closest;
  for (var index = 0; index < locations.length; ++index) {
    var dif = PythagorasEquirectAngular(latitude, longitude, locations[index][1], locations[index][2]);
    if (dif < minDifference) {
      closest = index;
      minDifference = dif;
    }
  }

  // return the nearest location
  return locations[closest];
}

//# sourceMappingURL=homeControl.js.map