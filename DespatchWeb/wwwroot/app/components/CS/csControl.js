angular
    .module('uDispatch')
    .controller('CSControl', ['$scope', 'uCSData', "$state", "$stateParams", "$filter", '$parse', "hotkeys", "$location", 'NgMap', 'GeoCoder', '$ngConfirm', function ($scope, uCSData, $state, $stateParams, $filter, $parse, hotkeys, $location, NgMap, GeoCoder, $ngConfirm) {

        $scope.isAdmin = (ClientInternal === "True");
        $scope.mapSetting = {
            "allCouriers": false,
            "allRuns": false
        };

        $scope.searchBox = "";
        $scope.selectedEvents = [];
        $scope.maxSize = 5;     // Limit number for pagination display number.  
        $scope.totalCount = 0;  // Total number of items in all pages. initialize as a zero  
        $scope.pageIndex = 1;   // Current page number. First page is 1.-->  
        $scope.pageSizeSelected = 50; // Maximum number of items per page.  
        //$(document).stopTime("CL");
        //$(document).stopTime("RD");

        //$scope.linkedEventId = $location.$$search.eid;
        //$scope.linkedEvent = undefined;



        $scope.gather = {
            submit: function () {
                $scope.gather.form.onSubmit();
                $(".gatherForm").hide();

            },
            cancel: function () {
                $(".gatherForm").hide();
            },
            showForm: function () {
                $(".gatherForm").show(0, function () {
                    setTimeout(function () { $(".gatherForm .focusMe").focus(); }, 100);
                });
            },
            submitValue: "Save"
        };

        $scope.options = {
            "detail": {
                "size": [
                    {
                        "id": 2,
                        "label": "Car"
                    },
                    {
                        "id": 3,
                        "label": "Van"
                    },
                    {
                        "id": 4,
                        "label": "Truck"
                    }
                ]
            }
        };

        $scope.boxes = {
            "pickDate": {
                "title": "Filters",
                "tpl": "app/components/CS/tpls/pickDate.tpl?v=1.4",
                "showSearch": 0
            },

            "jobList": {
                "title": "Job Data",
                "tpl": "app/components/CS/tpls/jobList.tpl?v=1.31",
                "showSearch": 1,
                "model": "jobList",
                "headings": [
                    {
                        "label": "Created",
                        "name": "created"
                    },
                    {
                        "label": "ID",
                        "name": "bulkEventID"
                    },
                    {
                        "label": "Job #",
                        "name": "jobNumber"
                    },
                    {
                        "label": "Courier",
                        "name": "courierCode"
                    },
                    {
                        "label": "Created By",
                        "name": "name"
                    },
                    {
                        "label": "Followup By",
                        "name": "clientFollowup"
                    },
                    {
                        "label": "Client Visible",
                        "name": "clientVisible"
                    },
                    {
                        "label": "Closed By",
                        "name": "closedByName"
                    },
                    {
                        "label": "Notes",
                        "name": "notes"
                    }


                ]
            },
            "jobDetail": {
                "title": "Detail",
                "tpl": "app/components/CS/tpls/jobDetail.tpl?v=1.14",
                "showSearch": 0,
                "showDetailButtons": 1
            },
            "map": {
                "title": "Google Map",
                "tpl": "app/components/CS/tpls/map.tpl?v=1.2",
                "showSearch": 0
            }

        };

        ///////////////////////////////
        // LAYOUT 
        ///////////////////////////////
        $scope.layouts = [
            {
                name: "Default",
                layout: {
                    "columns": [
                        {
                            "id": "col1",
                            "width": "350px",
                            "boxes": [
                                {

                                    "name": "pickDate"
                                }
                            ]
                        },
                        {
                            "id": "col2",
                            "width": "1350px",
                            "boxes": [
                                {

                                    "name": "jobList"
                                }
                            ]
                        },

                        {
                            "id": "col3",
                            "boxes": [
                                {
                                    "name": "jobDetail",
                                    "height": "550px"
                                },
                                {
                                    "name": "map"
                                }
                            ]
                        }
                    ]
                }
            }
        ];

        $scope.pickDateService = {
            "couriers": [],
            "date": moment().format("YYYY-MM-DD"),
            "from_date": moment().format("YYYY-MM-DD"),
            "to_date": moment().format("YYYY-MM-DD"),
            "followupClient": "All",
            "includeClosed": true
        };

        $scope.followupClient = {
            name: "All"
        };

        var layoutToUse = angular.copy($scope.layouts[0].layout);
        if (!$scope.isAdmin) {
            //layoutToUse.columns[0].boxes.splice(0, 1);
            //layoutToUse.columns.splice(2, 1);
        }

        $scope.layout = layoutToUse;

        $scope.loadLayout = function (i) {
            $scope.layout = angular.copy($scope.layouts[i].layout, function () {
                setTimeout(sizeHeadings(), 1000);

            });
            //$scope.$apply();
        };

        $scope.saveLayout = function () {


            angular.forEach($scope.layout.columns, function (column, colKey) {
                column.width = $("#co-" + column.id).css("flex-basis");
                angular.forEach(column.boxes, function (box, boxKey) {
                    box.height = $("#box-" + box.name).css("flex-basis");
                });
            });


            $scope.gather.form = {
                id: "saveLayout",
                title: "Save Layout",
                fields: [
                    {
                        "name": "layoutName",
                        "label": "Layout Name",
                        "value": ""
                    }
                ],
                onSubmit: function () {

                    var layoutName = $("#saveLayout").find("input").val();

                    var callData = {
                        "call": "saveLayout",
                        "layoutName": layoutName,
                        "layout": $scope.layout
                    };

                    //DO THE API CALL
                    uCSData.doAPI(callData).then(function (data) {

                        console.log(data);

                        if (data.response === "Success") {

                            $scope.layouts = $scope.layouts.concat(
                                {
                                    name: layoutName,
                                    layout: angular.copy($scope.layout)
                                }
                            );

                        } else {

                            alert("Critial Error");

                        }

                    });





                },
                submitValue: "Save"
            };

            $scope.gather.showForm();

        };

        $scope.sortableOptions = {
            connectWith: ".column-sortable",
            items: '.box',
            placeholder: "placeholder",
            scroll: true,
            scrollSensitivity: 100,
            scrollSpeed: 20,
            handle: '.box-handle',
            activate: function (e, ui) {
                var box = $("#" + ui.item.context.id);
                var parent = box.parent();
                parent.find(".box").each(function () {
                    $(this).attr("data-height", $(this).height() + "px");
                });
            },
            update: function (e, ui) {
                setTimeout(function () {
                    var box = $("#" + ui.item.context.id);
                    var parent = box.parent();
                    parent.find(".box").each(function () {
                        $(this).css({ "flex-basis": $(this).attr("data-height") });
                    });
                    parent.find(".box").last().css({ "flex-basis": "0" });
                }, 0);
            }
        };

        $scope.openSearch = function (boxID) {

            if ($("#box-" + boxID).find(".box-search").hasClass("open")) {

                $("#box-" + boxID).find(".box-search input").fadeOut(function () {

                    $("#box-" + boxID).find(".box-search").removeClass("open");
                    $("#box-" + boxID).find(".box-search").animate({ "width": "31px" }, 500);

                });

            } else {

                $("#box-" + boxID).find(".box-search").animate({ "width": "200px" }, 500, function () {
                    $("#box-" + boxID).find(".box-search").addClass("open");
                    $("#box-" + boxID).find(".box-search input").fadeIn();
                });

            }

        };

        $scope.goToRunViewer = function () {
            console.log("goToRunViewer.");
            $state.go('home');
        };

        //Column Sorting
        $scope.sort = [];
        $scope.orderList = function (list, prop) {


            if ($scope.sort[list] !== prop) {
                $scope.sort[list] = prop;
                $scope[list] = $filter('orderBy')($scope[list], prop);
            } else {
                $scope.sort[list] = "d-" + prop;
                $scope[list] = $filter('orderBy')($scope[list], "-" + prop);
            }



        };

        ///////////////////////////
        // HOTKEYS 
        //////////////////////////


        hotkeys.add({
            combo: 'esc',
            description: 'Close gather screen',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $(".gatherForm").hide();
                $(".eventForm").hide();
            }
        });

        hotkeys.add({
            combo: 'ctrl+a',
            description: 'Select All',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                $(".activeTable").find(".clickable-row").addClass("active");
                $scope.showRun();
            }
        });

        hotkeys.add({
            combo: 'enter',
            description: 'Submit gather form',
            allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
            callback: function () {
                setTimeout($scope.gather.submit(), 0);
            }
        });

        $scope.chooseFromDate = function () {

            $scope.gather.form = {
                id: "chooseDate",
                title: "Choose Date",
                fields: [
                    {
                        "name": "fromdatepicker",
                        "type": "fromdatepicker"
                    }
                ],
                onSubmit: function () {

                    $scope.gather.cancel();
                    if ($scope.currentFromDate !== $scope.pickDateService.from_date) {

                        $scope.currentFromDate = $scope.pickDateService.from_date;
                        dateChanged = true;
                    }
                    if ($scope.currentToDate !== $scope.pickDateService.to_date) {

                        $scope.currentToDate = $scope.pickDateService.to_date;
                        dateChanged = true;
                    }
                    //$scope.refreshData(true);

                },
                submitValue: "Choose"
            };
            $scope.gather.showForm();


        };

        $scope.chooseToDate = function () {

            $scope.gather.form = {
                id: "chooseDate",
                title: "Choose Date",
                fields: [
                    {
                        "name": "todatepicker",
                        "type": "todatepicker"
                    }
                ],
                onSubmit: function () {

                    $scope.gather.cancel();
                    
                    if ($scope.currentToDate !== $scope.pickDateService.to_date) {

                        $scope.currentToDate = $scope.pickDateService.to_date;
                        dateChanged = true;
                    }
                    //$scope.refreshData(true);

                },
                submitValue: "Choose"
            };
            $scope.gather.showForm();


        };

        $scope.filterRegion = function (region) {
            var sr = $scope.pickRegions.find(obj => {

                return obj.id === region.id;

            });
            $scope.pickDateService.regions = [];
            $scope.pickDateService.regions.push(sr);
            $scope.refreshData(true);
        };

        $scope.sendPOD = function () {
            if (!$scope.currentJob.podPhoto) {
                alert("Sorry no photo for this Job");
                return;
            }
            $scope.gather.form = {
                id: "sendPOD",
                title: "Email the photo POD",
                fields: [
                    {
                        "name": "email",
                        "label": "Email Address",
                        "type": "email"
                    }
                ],
                onSubmit: function () {
                    uCSData.sendPOD($scope.currentJob.id, $scope.gather.form.fields[0].value).then(function (data) {

                    });
                    alert("Email sent!");
                },
                submitValue: "Send"
            };
            $scope.gather.showForm();


        }

        $scope.refreshData = function (wait) {

            var goTop = $("#jobList").offset().top;
            var $parentDiv = $("#jobList").parents(".box-content");

            try {
                goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 31;
                $parentDiv.scrollTop(goTop);
            } catch (e) {
                //ignore
            }
            $("#box-jobList").find(".loading").show();
        

            var dateChanged = false;
            if ($scope.currentFromDate !== $scope.pickDateService.from_date) {

                $scope.currentFromDate = $scope.pickDateService.from_date;
                dateChanged = true;
            }
            if ($scope.currentToDate !== $scope.pickDateService.to_date) {

                $scope.currentToDate = $scope.pickDateService.to_date;
                dateChanged = true;
            }

            //localStorageService.set("Date", $scope.currentDate);
            if (($scope.pickDateService.client || "") === "" &&
                ($scope.pickDateService.courier || "") === "" &&
                ($scope.pickDateService.wild || "") === "") {
                $ngConfirm("You must use more Search Criteria");
                $("#box-jobList").find(".loading").hide();
                return;
            }

            console.log("about to call data - page " + $scope.pageIndex);
            //$scope.getData();
            uCSData.getPodJobs($scope.pickDateService.courier,
                $scope.pickDateService.client,
                ($scope.pickDateService.wild || ""),
                moment($scope.currentFromDate),
                moment($scope.currentToDate),
                $scope.pageIndex,
                $scope.pageSizeSelected).then(
                function(data) {
                    //var filteredData = $filter('filter')(data, $scope.searchBox);
                        $scope.jobList = data.item2;
                        $scope.totalCount = data.item1;
                        $("#box-jobList").find(".loading").hide();
                        setTimeout(function () {
                            sizeHeadings($("#jobList").parents(".column"));

                        }, 1000);

                });

        };




        $scope.selectJobData = function (lat, lng) {

            var toCompare = [];

            angular.forEach($scope.runBuilder, function (job, key) {
                toCompare.push([key, job.toLat, job.toLng]);
            });

            var closestIndex = closestLocation(lat, lng, toCompare);

            var closestJob = $scope.runBuilder[closestIndex[0]];

            return closestJob;

        };


      


        $scope.showItems = function (job) {
            if (job.clientCode !== "Other") {

                if ($scope.cancelledSelected) {
                    return true;

                } else {

                    if (job.Status === "Cancelled") {

                        return false;

                    } else {

                        return true;
                    }

                }

            } else {
                return false;
            }


        };


        /////////////////////////////////

        $scope.showJobs = function (group) {

            $("#box-jobsList").find(".loading").show();
            $scope.jobList = group.jobs;
            setTimeout(function () { sizeHeadings($("#jobList").parents(".column")); }, 1000);
            $("#box-jobsList .loading").fadeOut();


        };

        $scope.sizeName = function (sizeId) {
            if (!sizeId) {
                return "";
            }
            var sn = $scope.options.detail.size.find(obj => {

                return obj.id === sizeId;

            });
            return sn === undefined ? "" : sn.label;
        };

        //Select Job
        $scope.selectJobDetail = function (job) {
            console.log("select Job  " + job.id);
            //$("#jobList").find(".active").removeClass("active");
            clearTimeout($scope.myTimer);
            //$scope.currentEvent = event;
            
            $("#box-jobDetail").find(".loading").show();
            
            uCSData.getJobDetail(job.id).then(function (data) {
                $scope.currentJob = data;
                $("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + job.jobNo;
                var jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true);
                setMapBounds();
                map.setZoom(14);
            });
 


        };


        //This method is calling from pagination number  
        $scope.pageChanged = function (i) {

            $scope.pageIndex = i;
            $scope.refreshData();
          
        };

        //This method is calling from dropDown  
        $scope.changePageSize = function (i) {
            $scope.pageIndex = 1;
            $scope.pageSizeSelected = i;
            $scope.refreshData();
        };

      


        $scope.currentFromDate = $scope.pickDateService.from_date;
        $scope.currentToDate = $scope.pickDateService.to_date;

        setTimeout(function () {
                $("#FilterClient").select2({
                    ajax: {
                        url: "/home/ActiveClients",
                        dataType: 'json',
                        delay: 250,
                        data: function (params) {
                            return {
                                searchTerm: params.term
                            };
                    },
                    processResults: function (data) {
                        // parse the results into the format expected by Select2
                        return {
                            results: data
                        };
                    },
                    cache: true
                },
                    placeholder: "Start typing to enter new client...",
                    allowClear: true,
                minimumInputLength: 3
            });
            $("#FilterCourier").select2({
                ajax: {
                    url: "/courier/AllActive",
                    dataType: 'json',
                    delay: 250,
                    data: function (params) {
                        return {
                            searchTerm: params.term
                        };
                    },
                    processResults: function (data) {
                        // parse the results into the format expected by Select2
                        return {
                            results: data
                        };
                    },
                    cache: true
                },
                placeholder: "Start typing to enter new courier...",
                allowClear: true,
                minimumInputLength: 3
            });
        }, 400);
        //$(document).everyTime("15s", "RD", function () { $scope.refreshData(); });

        // $scope.getData();


        $scope.highlightEvent = function () {
            $("#jobList .active").each(function () {
                $(this).removeClass("active");
            });
            //loop actives

            setTimeout(function () {
                $scope.selectedEvents = [];
                $("#jobList .active").each(function () {
                    var eventIndex = $(this).data("index");
                    var event = $scope.jobList[eventIndex];
                    $scope.selectedEvents.push(event);
                });
                //$scope.$apply();
            }, 10);


            setTimeout(function () { sizeHeadings($("#jobList").parents(".column")); }, 1000);

        };

        $scope.jobListMenu =
            [
                {
                    text: "Close Event",
                    click: function ($itemScope, $event, modelValue, text, $li) {

                        $scope.gather.form = {
                            id: "closeEvent",
                            title: "Close Event?",
                            fields: [
                                {
                                    "name": "editName",
                                    "label": "Edit your name",
                                    "value": ""
                                }
                            ],
                            onSubmit: function () {
                                $("#box-jobList").find(".loading").show();
                                $("#box-map").find(".loading").show();
                                var userName = $("#gather-editName").val();
                                uCSData.closeEvent($itemScope.event.bulkEventID, userName).then(function () {
                                    $scope.refreshData(1, true);
                                });



                            },
                            submitValue: "Close Event"
                        };

                        $scope.gather.showForm();

                    }
                }
            ];

        $scope.reply = function (currentEvent) {
            function resetCursor(txtElement) {
                if (txtElement.setSelectionRange) {
                    txtElement.focus();
                    txtElement.setSelectionRange(0, 0);
                } else if (txtElement.createTextRange) {
                    var range = txtElement.createTextRange();
                    range.moveStart('character', 0);
                    range.select();
                }
            };

            function afterShowAnimation(scope, element, options) {
                var e = document.getElementById("event-notes");
                resetCursor(e);
            };

            $mdDialog.show({
                locals: { dataToPass: currentEvent },
                controller: $scope.eventDialogController,
                scope: $scope,
                preserveScope: true,
                templateUrl: "app/components/CS/tpls/createEvent.html?v=1.13",
                parent: angular.element(document.body),
                //targetEvent: $event,
                clickOutsideToClose: true,
                onComplete: afterShowAnimation

            });
        };

        $scope.createJobEvent = function (job, $event) {
            $scope.currentJob = job;
            $mdDialog.show({
                locals: { dataToPass: undefined },
                controller: $scope.eventDialogController,
                scope: $scope,
                preserveScope: true,
                templateUrl: "app/components/CS/tpls/createEvent.html?v=1.13",
                parent: angular.element(document.body),
                //targetEvent: $event,
                clickOutsideToClose: true

            });

        };

        $scope.eventDialogController = function ($scope, $mdDialog, dataToPass) {
            console.log($scope.currentJob);
            console.log(dataToPass);
            $scope.book = {};

            $scope.book.courier = $scope.currentJob.courierCode;
            $scope.book.job = $scope.currentJob.jobNumber;

            if (dataToPass !== undefined) {
                $scope.book.notes = (" - " + moment().format("DD/MM/YY HH:mm") + " " + ClientName + "\r\n" + dataToPass.notes);
                $scope.book.reply = true;
                $scope.book.closeEventId = dataToPass.bulkEventID;
            } else {
                $scope.book.reply = false;
                $scope.book.closeEventId = undefined;
            }

            $scope.hide = function () {
                $mdDialog.hide();
            };

            $scope.cancel = function () {
                $mdDialog.cancel();
            };

            $scope.answer = function (answer) {
                $mdDialog.hide(answer);
            };

            $scope.createEvent = function () {
                var error = $scope.bookForm.$error;

                angular.forEach(error.required, function (field) {
                    if (field.$invalid) {
                        field.$touched = true;
                    }
                });

                if ((error.required || []).length > 0) {
                    return;
                }


                $(".wait").show();
                processEventBooking();


            }

            function processEventBooking() {

                var event = {
                    "dataType": "json",
                    "BulkJobID": $scope.currentJob.bulkJobID,
                    "CourierID": $scope.currentJob.courierID,
                    "Name": `${ClientName}-${$scope.book.name}`,
                    "Notes": $scope.book.notes,
                    "Internal": $scope.isAdmin ? !$scope.book.internal : 0,
                    "ClientCreated": !$scope.isAdmin,
                    "ClientFollowup": $scope.book.account !== "UCL" ? 1 : 0,
                    "EventDate": $scope.pickDateService.date,
                    "ClientID": $scope.currentJob.clientID
                };

                uCSData.createEvent(event, $scope.isAdmin ? $scope.book.notify : true)
                    .then(function (returnData) {
                        if ((returnData === undefined ||
                            returnData !== "OK")) {
                            alert("Sorry, create event failed");
                            $(".wait").hide();
                            $scope.cancel();
                        } else {
                            $(".wait").hide();
                            $scope.cancel();
                            if ($scope.book.reply) {
                                uCSData.closeEvent($scope.book.closeEventId, event.Name).then(function () {
                                    $scope.refreshData(true, true);
                                });
                            }

                            alert("Event Created!");
                        }

                        $scope.refreshData(true, true);
                    });


            }


        };

        /////////////////////////
        // JOB DETAILS
        /////////////////////////

        $scope.updateGPS = function (field) {
            var suburb = "";
            if (field === "toAddress") {
                if ($scope.currentEvent.toLat) {
                    var postCode = $scope.currentEvent.toPostCode;
                    var lat = $scope.currentEvent.toLat;
                    var long = $scope.currentEvent.toLng;
                    var q = $("#gpsMap").attr("data-src") + lat + "," + long;
                    suburb = $scope.currentEvent.toSuburb;
                } else {
                    var lat = "";
                    var long = "";
                    var q = $("#gpsMap").attr("data-src") + encodeURIComponent($scope.currentEvent[field]);
                }
            } else {
                if ($scope.currentEvent.fromLat) {
                    var postCode = $scope.currentEvent.fromPostCode;
                    var lat = $scope.currentEvent.fromLat;
                    var long = $scope.currentEvent.fromLng;
                    var q = $("#gpsMap").attr("data-src") + lat + "," + long;
                    suburb = $scope.currentEvent.fromSuburb;
                } else {
                    var lat = "";
                    var long = "";
                    var q = $("#gpsMap").attr("data-src") + encodeURIComponent($scope.currentEvent[field]);
                }
            }

            $("#gpsMap").attr("src", q);

            $scope.gpsForm = {
                "data": {
                    "address": $scope.currentEvent[field] + ", " + suburb,
                    "lat": lat,
                    "long": long,
                    "postCode": postCode

                },
                submit: function (response) {
                    var location;
                    var postCode = null;
                    // Custom GPS Location
                    if (!response) {
                        location = new google.maps.LatLng($scope.gpsForm.data.lat, $scope.gpsForm.data.long);
                        postCode = $scope.gpsForm.data.postCode;
                    } else {
                        location = response.geometry.location;

                        if (response.address_components.find(x => x.types[0] === "postal_code")) {
                            postCode = response.address_components.find(x => x.types[0] === "postal_code").long_name;
                        }
                    }

                    var callData = {
                        "address": field,
                        "lat": location.lat(),
                        "lng": location.lng(),
                        "postCode": postCode,
                        "jobId": $scope.currentEvent.bulkJobID
                    };

                    uCSData.updateGps(callData.address, callData.jobId, callData.lat, callData.lng, callData.postCode).then(function (data) {
                        if (data.response === "Success") {
                            if (field === "toAddress") {
                                $scope.currentEvent.toLat = location.lat();
                                $scope.currentEvent.toLng = location.lng();
                                $scope.currentEvent.ToPostCode = postCode;
                            } else {
                                $scope.currentEvent.fromLat = location.lat();
                                $scope.currentEvent.fromLng = location.lng();
                                $scope.currentEvent.FromPostCode = postCode;
                            }
                            alert("GPS updated successfully!");
                        } else {
                            alert(data.response);
                        }

                        // Hide the GPS update form
                        $(".gpsForm").hide(0);
                        // Hide the Update address form and return to the Detail section
                        $scope.gather.cancel();

                        setTimeout(function () {
                            $scope.$apply();
                        },
                            0);

                    });
                },
                cancel: function () {
                    $(".gpsForm").hide(0);
                },
                placeChanged: function (place) {
                    if (place !== undefined && place !== null) {
                        $scope.place = place;
                    } else {
                        $scope.place = this.getPlace();
                    }

                    $scope.gpsForm.search = $scope.place.formatted_address;
                    $scope.gpsForm.data.lat = $scope.place.geometry.location.lat();
                    $scope.gpsForm.data.long = $scope.place.geometry.location.lng();
                    if ($scope.place.address_components.find(x => x.types[0] === "postal_code")) {
                        $scope.gpsForm.data.postCode = $scope.place.address_components
                            .find(x => x.types[0] === "postal_code").long_name;
                    }
                    $scope.map.setCenter($scope.place.geometry.location);
                },
                moveMarker: function (event) {
                    var latlng = event.latLng;
                    GeoCoder.geocode({ location: latlng })
                        .then(function (result) {
                            $scope.marker.setPosition(latlng);
                            $scope.gpsForm.placeChanged(result[0]);
                        });
                },
                markerDragend: function () {
                    //Geo coder for drag marker
                    GeoCoder.geocode({ location: $scope.marker.getPosition() })
                        .then(function (result) {
                            $scope.gpsForm.placeChanged(result[0]);
                        });
                }
            };

            $(".gpsForm").show(0);

            $scope.$watch('gpsForm.details', function (newValue, oldValue, scope) {
                setTimeout(function () {
                    if ($scope.gpsForm.search) {

                        $("#gpsMap").attr("src", $("#gpsMap").attr("data-src") + encodeURIComponent($scope.gpsForm.search));
                        if ($scope.gpsForm.details.geometry.location) {
                            $scope.gpsForm.data.lat = $scope.gpsForm.details.geometry.location.lat();
                            $scope.gpsForm.data.long = $scope.gpsForm.details.geometry.location.lng();
                            if ($scope.gpsForm.details.address_components.find(x => x.types[0] === "postal_code")) {
                                $scope.gpsForm.data.postCode = $scope.gpsForm.details.address_components
                                    .find(x => x.types[0] === "postal_code").long_name;
                            }
                        }

                    } else {
                        if (!$scope.gpsForm.data.long) {
                            $("#gpsMap").attr("src", $("#gpsMap").attr("data-src") + "Auckland");
                        }
                    }
                }, 1000);
            });

            $scope.copyGpsAddress = function () {
                //Trim to street address only
                $scope.gpsForm.search = $scope.gpsForm.data.address.split(",")[1].trim();
                //$scope.gpsForm.search = angular.copy($scope.gpsForm.data.address);
                $("#gpsSearch").focus();
            };


        };

        $scope.addEventNote = function (eventId, type, options) {

            $scope.gather.form = {
                id: "addNote",
                title: "Add Event Note ",
                fields: [
                    {
                        "name": "notes",
                        "label": "Notes" + "...",
                        "value": "",
                        "eventID": eventId,
                        "type": type,
                        "options": options
                    }
                ],
                onSubmit: function () {

                    uCSData.addEventNote($scope.gather.form.fields[0].eventID, $scope.gather.form.fields[0].value).then(function (data) {

                        if (data.response === "Success") {
                            $scope.currentEvent = data.bulkEvent;
                            var ci = $scope.jobList.findIndex(obj => {

                                return obj.bulkEventID === data.bulkEvent.bulkEventID;

                            });
                            $scope.jobList[ci] = data.bulkEvent;
                            //  $scope.$apply();
                            //alert(field + "Note added successfully!");

                        } else {

                            alert(data.response);

                        }

                    });

                },
                submitValue: "Add Note"
            };
            $scope.gather.showForm();

        };

        $scope.editDetailField = function (fieldName, label, value, jobId, type, options) {

            if (type === "date") {
                if (!(value instanceof Date)) {
                    value = moment(value, "DD/MM/YYYY").toDate();
                }
            }

            if (type === "time") {
                value = moment(value, "hh:mm:ss").toDate();
            }

            $scope.gather.form = {
                id: "editField",
                title: "Edit " + label,
                fields: [
                    {
                        "name": fieldName,
                        "label": label + "...",
                        "value": value,
                        "jobID": jobId,
                        "type": type,
                        "options": options
                    }
                ],
                onSubmit: function () {

                    $scope.updateDetailField($scope.gather.form.fields[0].name, $scope.gather.form.fields[0].value, $scope.gather.form.fields[0].jobID);

                },
                submitValue: "Update Field"
            };
            $scope.gather.showForm();

        };

        $scope.updateDetailField = function (field, value, jobId) {


            uCSData.updateJobDetail(jobId, field, value).then(function (data) {

                if (data.response === "Success") {
                    $scope.currentEvent = data.job;
                    alert(field + " updated successfully!");

                } else {

                    alert(data.response);

                }

            });

        };

    }]);


// Convert Degress to Radians
function Deg2Rad(deg) {
    return deg * Math.PI / 180;
}

function PythagorasEquirectangular(lat1, lon1, lat2, lon2) {
    lat1 = Deg2Rad(lat1);
    lat2 = Deg2Rad(lat2);
    lon1 = Deg2Rad(lon1);
    lon2 = Deg2Rad(lon2);
    var R = 6371; // km
    var x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
    var y = (lat2 - lat1);
    var d = Math.sqrt(x * x + y * y) * R;
    return d;
}

function closestLocation(latitude, longitude, locations) {
    var mindif = 99999;
    var closest;

    for (index = 0; index < locations.length; ++index) {
        var dif = PythagorasEquirectangular(latitude, longitude, locations[index][1], locations[index][2]);
        if (dif < mindif) {
            closest = index;
            mindif = dif;
        }
    }

    // return the nearest location
    var closestLocation = (locations[closest]);
    return closestLocation;
}

function inStruct(val, structure) {

    for (a in structure) {

        if (structure[a] === val && structure.hasOwnProperty(a)) {
            return true;
        }
    }
    return false;
}


