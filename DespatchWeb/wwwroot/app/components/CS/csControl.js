angular
    .module('uDispatch')
    .controller('CSControl', ['$scope', 'JobDetailService', 'uCSData', "$state", "$stateParams", "$filter", '$parse', "hotkeys", "$location", "$q", 'NgMap', 'GeoCoder', '$ngConfirm', function ($scope, jdSvc, uCSData, $state, $stateParams, $filter, $parse, hotkeys, $location, $q, NgMap, GeoCoder, $ngConfirm) {

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
        $scope.bulkTotalCount = 0;  // Total number of items in all pages. initialize as a zero  
        $scope.bulkPageIndex = 1;   // Current page number. First page is 1.-->  
        $scope.bulkPageSizeSelected = 50; // Maximum number of items per page.
        $scope.pbTotalCount = 0;  // Total number of items in all pages. initialize as a zero  
        $scope.pbPageIndex = 1;   // Current page number. First page is 1.-->  
        $scope.pbPageSizeSelected = 50; // Maximum number of items per page.
        //$(document).stopTime("CL");
        //$(document).stopTime("RD");

        //$scope.linkedEventId = $location.$$search.eid;
        //$scope.linkedEvent = undefined;
        $scope.name = "POD";
        $scope.jdSvc = jdSvc;
        $scope.gpsForm = {
            submit: function() {
                return $scope.jdSvc.gpsForm.onSubmit().then(function (response) {
                    if ($scope.currentJob.bulkJob) {
                        $scope.selectBulkJobDetail($scope.currentJob.id);
                    } else {
                        $scope.selectJobDetail($scope.currentJob.id);
                    }
                    
                });
            }
        };

        $scope.jdSvc.setGPSForm($scope.gpsForm);

        $scope.jdSvc = jdSvc;
        var gpsForm = {
            submit: function () {
                return $scope.jdSvc.gpsForm.onSubmit().then(function (response) {
                    if ($scope.currentJob.bulkJob) {
                        $scope.selectBulkJobDetail($scope.currentJob.id);
                    } else {
                        $scope.selectJobDetail($scope.currentJob.id);
                    }
                });
            },
            showForm: function (fromRightClick) {

                $(".gpsForm").show(0, function () {
                    if (fromRightClick) {
                        $scope.$apply();
                    }
                    waitingDialog.hide();

                });
                setTimeout(function () {
                    $scope.onMapReady();
                    $('#location').select2('open').val(null).trigger('change');
                    var search = $('#location').data('select2').dropdown.$search;
                    if ($scope.jdSvc.gpsForm.data.address.indexOf(',') > 0) {
                        search.val($scope.jdSvc.gpsForm.data.address.split(',')[1].split());
                    } else {
                        search.val($scope.jdSvc.gpsForm.data.address);
                    }
                    search.trigger("input");
                }, 150);
            }
        };

        $scope.gpsForm = gpsForm;
        $scope.jdSvc.setGPSForm($scope.gpsForm);


        $scope.updateGPS = function (currentJob, field, fromRightClick) {
            $scope.gpsForm = null;
            $scope.jdSvc.gpsForm = null;
            $scope.gpsForm = gpsForm;
            $scope.jdSvc.setGPSForm($scope.gpsForm);
            $scope.jdSvc.updateGPS(currentJob, field, fromRightClick);
        };

        $scope.gather = {
            submit: function () {
                $(".gatherForm").hide();
                $scope.gather.form.onSubmit().then(function(response) {
                    if ($scope.currentJob) {
                        $scope.currentJob.bulkJob ? $scope.selectBulkJobDetail($scope.currentJob.id) : $scope.currentJob.preBook ? $scope.selectPreBookDetail($scope.currentJob.id) : $scope.selectJobDetail($scope.currentJob.id);
                    }
                    
                });
                
                //setTimeout(function () {  }, 1000);
                

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

        $scope.jdSvc.setGather($scope.gather);

        $scope.options = {
            "detail": {
                "size": [
                    {
                        "id": 1,
                        "label": "Bike"
                    },
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
                    },
                    {
                        "id": 5,
                        "label": "Scooter"
                    }
                ],
                "tracking": [
                    {
                        "id": 1,
                        "label": "Email"
                    },
                    {
                        "id": 2,
                        "label": "Mobile"
                    },
                    {
                        "id": 3,
                        "label": "Email & Mobile"
                    }
                ],
                "DGClass": [
                    {
                        "id": 0,
                        "label": "0"
                    },
                    {
                        "id": 1,
                        "label": "1"
                    },
                    {
                        "id": 2,
                        "label": "2"
                    },
                    {
                        "id": 3,
                        "label": "3"
                    },
                    {
                        "id": 4,
                        "label": "4"
                    },
                    {
                        "id": 5,
                        "label": "5"
                    },
                    {
                        "id": 6,
                        "label": "6"
                    },
                    {
                        "id": 7,
                        "label": "7"
                    },
                    {
                        "id": 8,
                        "label": "8"
                    },
                    {
                        "id": 9,
                        "label": "9"
                    }
                ]
            }
        };

        $scope.boxes = {
            "pickDate": {
                "title": "Filters",
                "tpl": "app/components/CS/tpls/pickDate.tpl?v=1.8",
                "showSearch": 0
            },

            "jobList": {
                "title": "Live Job Data",
                "tpl": "app/components/CS/tpls/jobList.tpl?v=1.12",
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
            "bulkJobList": {
                "title": "Bulk Job Data",
                "tpl": "app/components/CS/tpls/bulkJobList.tpl?v=1.14",
                "showSearch": 1,
                "model": "bulkJobList",
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
            "pbList": {
                "title": "PreBook Data",
                "tpl": "app/components/CS/tpls/pbList.tpl?v=1.4",
                "showSearch": 1,
                "showRefresh": 1,
                "model": "pbList",
                "headings": [
                    {
                        "label": "Booked",
                        "name": "booked"
                    },
                    {
                        "label": "Speed",
                        "name": "speed"
                    },
                    {
                        "label": "Job #",
                        "name": "jobNumber"
                    },
                    {
                        "label": "Client",
                        "name": "clientCode"
                    },
                    {
                        "label": "From",
                        "name": "froAddress"
                    },
                    {
                        "label": "To",
                        "name": "toAddress"
                    },
                    {
                        "label": "Code",
                        "name": "code"
                    },
                    {
                        "label": "Send",
                        "name": "send"
                    },
                    {
                        "label": "Void",
                        "name": "void"
                    }


                ]
            },
            "jobDetail": {
                "title": "Detail",
                "tpl": "app/components/home/tpls/jobDetail.tpl?v=2.44",
                "showSearch": 0,
                "showDetailButtons": 1
            },
            "scanList": {
                "title": "Scan Detail",
                "tpl": "app/components/CS/tpls/scanList.tpl?v=1.0",
                "showSearch": 0,
                "model": "scanList",
                "headings": [
                    {
                        "label": "Time",
                        "name": "scanDateTime"
                    },
                    {
                        "label": "Scan Type",
                        "name": "scanDetail"
                    },
                    {
                        "label": "Courier",
                        "name": "courier"
                    }
                ]
            },
            "map": {
                "title": "Google Map",
                "tpl": "app/components/CS/tpls/map.tpl?v=1.3",
                "showSearch": 0
            }

        };

        ///////////////////////////////
        // LAYOUT
        ///////////////////////////////
        var layoutsObject = null;
        if (Modernizr.localstorage) {
            layoutsObject = JSON.parse(localStorage.getItem("layoutsCS-" + ContactID));
        }

        var defaultLayout = [
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

                                    "name": "jobList",
                                    "height": "550px"
                                },
                                {

                                    "name": "bulkJobList",
                                    "height": "225px"
                                },
                                {

                                    "name": "pbList",
                                    "height": "225px"
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
                                    "name": "scanList",
                                    "height": "225px"
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

        if (layoutsObject !== null) {
            layoutsObject[0] = defaultLayout[0];
        }

        $scope.layouts = layoutsObject || defaultLayout;
        $scope.userName = FirstName;
        

        $scope.pickDateService = {
            "couriers": [],
            "date": moment().format("YYYY-MM-DD"),
            "from_date": moment().subtract(7, 'days').format("YYYY-MM-DD"),
            "to_date": moment().add(7, 'days').format("YYYY-MM-DD"),
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
        $scope.currentLayoutName = $scope.layouts[0].name;

        $scope.deleteLayout = function (i) {
            $scope.layouts.splice(i, 1);
            if (Modernizr.localstorage) {
                localStorage.setItem("layoutsCS-" + ContactID, JSON.stringify($scope.layouts));
            }
        }

        $scope.loadLayout = function (i) {
            $scope.currentLayoutName = $scope.layouts[i].name;
            $scope.layout = angular.copy($scope.layouts[i].layout);
            setTimeout($scope.initFilters, 1000);
        };

        $scope.saveLayout = function () {


            angular.forEach($scope.layout.columns,
                function (column, colKey) {
                    column.width = $("#co-" + column.id).css("flex-basis");
                    angular.forEach(column.boxes,
                        function (box, boxKey) {
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


                    if (Modernizr.localstorage) {
                        $scope.layouts = $scope.layouts.concat(
                            {
                                name: layoutName,
                                layout: angular.copy($scope.layout)
                            });
                        localStorage.setItem("layoutsCS-" + ContactID, JSON.stringify($scope.layouts));
                    }

                    var deferred = $q.defer();
                    deferred.resolve({
                        data: "OK"
                    });
                    return deferred.promise;
                    

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
                if ($(".gatherForm").is(":visible") === true) {
                    setTimeout($scope.gather.submit(), 0);
                }
                if (event.srcElement.id === "Wild" || event.srcElement.id === "Job") {
                    $scope.refreshAllData(true);
                }
                
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
            $scope.refreshBulkData(true);
            $scope.refreshPreBookData(true);
        };

        $scope.unlockJob = function() {
            return $scope.jdSvc
                .unlockJob($scope.currentJob);
                    
        };

        $scope.lockJob = function () {
            return $scope.jdSvc
                .lockJob($scope.currentJob);

        };

        $scope.unSplitJob = function () {
            $ngConfirm({
                title: 'Un-Split Job?',
                content: 'Are you sure you wish to un-split this job?',
                scope: $scope,
                buttons: {

                    Yes: {
                        btnClass: 'btn-green',
                        action: function (scope, button) {
                            uCSData.unSplitJob($scope.currentJob.id).then(function(msg) {
                                if ((msg || "").length > 2) {
                                    $ngConfirm({
                                        title: 'Error',
                                        content: msg,
                                        scope: $scope,
                                        buttons: {

                                            Close: {
                                                btnClass: 'btn-red',
                                                action: function (scope, button) {

                                                }
                                            }

                                        }
                                    });
                                }
                            });
                            
                        }
                    },
                    No: {
                        btnClass: 'btn-red',
                        action: function (scope, button) {

                        }
                    }

                }
            });
            

        };

        $scope.restoreJob = function (job) {
            $("#box-jobDetail").find(".loading").show();
            var callData = {
                "call": "restoreJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };

            var foundCourier = null;

            
            var jn = job.jobNo;
            uCSData.addRestoreEvent(jn, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
            if (callData.courierID === null) {
                callData.courierID = job.courierData.courierID;
                foundCourier = $scope.pickCouriers.find(c => c.courierID === job.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === job.courierData.courierID);
            }
            if (job.displaySplitJobDetail) {
                callData.splitJobs.push(job.id);
            } else {
                callData.jobs.push(job.id);
            }

            if (callData.splitJobs.length > 0) {
                uCSData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs).then(function () {
                    return $scope.selectJobDetail(job.id);
                });
            }
            if (callData.jobs.length > 0) {
                uCSData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs).then(function () {
                    return $scope.selectJobDetail(job.id);
                });
            }




        };

        $scope.dispatchJobs = function (courier, job) {
            var foundCourier = $scope.pickCouriers.find(c => c.id === courier);
            if (foundCourier === undefined) {
                $ngConfirm({
                    title: 'Courier Offline',
                    content: 'Dispatch anyway?',
                    scope: $scope,
                    buttons: {

                        Yes: {
                            btnClass: 'btn-green',
                            action: function (scope, button) {
                                foundCourier = $scope.pickAllCouriers.find(c => c.id === courier);
                                //console.log(foundCourier);
                                return $scope.dispatchJobsContinue(courier, foundCourier, true, job);
                            }


                        },
                        No: {
                            btnClass: 'btn-red',
                            action: function (scope, button) {

                            }
                        }
                    }
                });
                return;
            };

            return $scope.dispatchJobsContinue(courier, foundCourier, false, job);


        };

        $scope.dispatchJobsContinue = function (courier, foundCourier, offline, job) {
            var callData = {
                "call": "dispatchJobs",
                "courier": courier,
                "jobs": []
            };

            

            var jn = job.jobNo;
            if (job.courierData.courierID !== null) {
                alert("restore " + jn + " prior to despatching to another courier");
                return;
            }
            
            if (job.dgClass !== null && job.dgClass > 0 && !foundCourier.dangerousGoods) {
                alert("DG job " + jn + " can not be despatched to courier " + courier + " - doesn't have DGLicense.");
                return;
            }
            if (job.dgClass !== null && job.dgClass > 0 && (job.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                alert("Courier " + courier + " doesn't have a DGLicense or license has expired.");
                return;
            }

            //if (job.dgClass !== null && job.dgClass > 0) {
            //    DispatchData.addFollowupEvent(jn, j.clientID, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
            //}

            callData.jobs.push(job.id);

            return uCSData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(function (response) {
                $("input.pod-DispatchField:visible").val("");
                $scope.selectJobDetail(job.id);
                return response;
            });

        }

        $scope.swapPOD = function () {
            
            $scope.gather.form = {
                id: "swapPOD",
                title: "Enter the other job number",
                fields: [
                    {
                        "name": "JobNumber",
                        "label": "Job Number",
                        "type": "text"
                    }
                ],
                onSubmit: function () {
                    return uCSData.validateSwapPOD($scope.gather.form.fields[0].value).then(function (data) {
                        if (!data) {
                            $ngConfirm("Invalid Job");
                        } else {
                            var secondJobId = data;
                            var firstJobId = $scope.currentJob.id;
                            $ngConfirm({
                                title: 'Swap Delivery Info',
                                content: `Are you sure you wish to swap delivery info between ${$scope.currentJob.jobNo} and ${$scope.gather.form.fields[0].value}?`,
                                scope: $scope,
                                buttons: {

                                    Yes: {
                                        btnClass: 'btn-green',
                                        action: function (scope, button) {
                                            return uCSData.swapPOD($scope.currentJob.jobNo, $scope.gather.form.fields[0].value).then(function (data) {
                                                $ngConfirm("POD Swap Completed Successfully");
                                                uCSData.reSendJobs(secondJobId);
                                                uCSData.reAssignJobs(firstJobId).then(function (data) {
                                                    uCSData.reSendJobs(firstJobId).then(function (data) {
                                                        $scope.refreshData(true);
                                                    });
                                                });
                                                

                                            });
                                            
                                            
                                        }
                                    },
                                    No: {
                                        btnClass: 'btn-red',
                                        action: function (scope, button) {

                                        }
                                    }

                                }
                            });
                            
                        }
                    });
                    
                },
                submitValue: "Submit"
            };
            $scope.gather.showForm();


        }

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

        $scope.refreshAllData = function(wait) {
            $scope.refreshData(wait);
            $scope.refreshBulkData(wait);
            $scope.refreshPreBookData(wait);
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
                ($scope.pickDateService.job || "") === "" &&
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
                ($scope.pickDateService.job || ""),
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

        $scope.refreshBulkData = function (wait) {

            var goTop = $("#bulkJobList").offset().top;
            var $parentDiv = $("#bulkJobList").parents(".box-content");

            try {
                goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 31;
                $parentDiv.scrollTop(goTop);
            } catch (e) {
                //ignore
            }
            $("#box-bulkJobList").find(".loading").show();


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
                ($scope.pickDateService.job || "") === "" &&
                ($scope.pickDateService.wild || "") === "") {
                $ngConfirm("You must use more Search Criteria");
                $("#box-jobList").find(".loading").hide();
                return;
            }

            console.log("about to call bulk data - page " + $scope.bulkPageIndex);
            
            uCSData.searchBulkJobs($scope.pickDateService.courier,
                $scope.pickDateService.client,
                ($scope.pickDateService.job || ""),
                ($scope.pickDateService.wild || ""),
                moment($scope.currentFromDate),
                moment($scope.currentToDate),
                $scope.bulkPageIndex,
                $scope.bulkPageSizeSelected).then(
                    function (data) {
                        //var filteredData = $filter('filter')(data, $scope.searchBox);
                        $scope.bulkJobList = data.item2;
                        $scope.bulkTotalCount = data.item1;
                        $("#box-bulkJobList").find(".loading").hide();
                        setTimeout(function () {
                            sizeHeadings($("#bulkJobList").parents(".column"));

                        }, 1000);

                    });

        };

        $scope.refreshPreBookData = function (wait) {

            var goTop = $("#pbList").offset().top;
            var $parentDiv = $("#pbList").parents(".box-content");

            try {
                goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 31;
                $parentDiv.scrollTop(goTop);
            } catch (e) {
                //ignore
            }
            $("#box-pbList").find(".loading").show();


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
                ($scope.pickDateService.job || "") === "" &&
                ($scope.pickDateService.wild || "") === "") {
                $ngConfirm("You must use more Search Criteria");
                $("#box-pbList").find(".loading").hide();
                return;
            }

            console.log("about to call prebook data - page " + $scope.pbPageIndex);

            uCSData.searchPreBookJobs($scope.pickDateService.courier,
                $scope.pickDateService.client,
                ($scope.pickDateService.wild || ""),
                ($scope.pickDateService.job || ""),
                moment($scope.currentFromDate),
                moment($scope.currentToDate),
                $scope.pbPageIndex,
                $scope.pbPageSizeSelected).then(
                    function (data) {
                        //var filteredData = $filter('filter')(data, $scope.searchBox);
                        $scope.pbList = data.item2;
                        $scope.pbTotalCount = data.item1;
                        $("#box-pbList").find(".loading").hide();
                        setTimeout(function () {
                            sizeHeadings($("#pbList").parents(".column"));

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

        $scope.loadRelatedJobDetail = function (id, jn) {
            $("#box-jobDetail").find(".loading").show();
            uCSData.getJobDetail(id).then(function (data) {
                $scope.currentJob = data;
                $("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + jn;
            });
        }

        //Select Job
        $scope.selectJobDetail = function (id) {
            $scope.scanList = [];
            console.log("select Job  " + id);
            //$("#jobList").find(".active").removeClass("active");
            clearTimeout($scope.myTimer);
            //$scope.currentEvent = event;
            
            $("#box-jobDetail").find(".loading").show();
            
            uCSData.getJobDetail(id).then(function (data) {
                $scope.currentJob = data;
                jdSvc.setJob($scope.currentJob);
                $("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + data.jobNo;
                var jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true);
                setMapBounds();
                map.setZoom(14);
                if ($scope.currentJob.rootParentID) {
                    uCSData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientID).then(function (data) {
                        //data = data.filter(item => item.id !== $scope.currentJob.id);
                        $scope.currentJob.relatedJobs = data;
                    });
                }
                $("#box-scanList").find(".loading").show();
                uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(function (data) {
                    $scope.scanList = data;
                    
                    setTimeout(function () {
                        sizeHeadings($("#scanList").parents(".column"));
                        $("#box-scanList").find(".loading").fadeOut();
                    }, 200);
                });

                if ($scope.currentJob.courier && $scope.currentJob.completedTime) { 
                    $("#box-map").find(".loading").show();
                    uCSData.getCourierRoute($scope.currentJob.courier, moment($scope.currentJob.completedTime).subtract(5, 'm'), moment($scope.currentJob.completedTime).add(5, 'm')).then(function (data) {
                        var flightPathCoordinates = [];

                        $("#box-map").find(".loading").fadeOut();
                        if (data.length === 0) {
                            return;
                        }
                        for (i = 0; i < data.length; i++) {
                            var coordinatePair = new google.maps.LatLng(data[i].latitude, data[i].longitude);
                            flightPathCoordinates.push(coordinatePair);
                        }
                        var flightPathPoly = new google.maps.Polyline({
                            //map: map,
                            path: flightPathCoordinates,
                            strokeColor: "#FF0000",
                            strokeOpacity: 1.0,
                            strokeWeight: 2
                        });

                        var flightPath = flightPathPoly.getPath();

                        var pathValues = [];
                        for (var i = 0; i < flightPath.getLength(); i++) {
                            pathValues.push(flightPath.getAt(i).toUrlValue());
                        }

                        $.get('https://roads.googleapis.com/v1/snapToRoads', {
                            interpolate: true,
                            key: googleMapsApiKey,
                            path: pathValues.join('|')
                        }, function (data) {
                            var snappedCoordinates = [];
                            for (var i = 0; i < data.snappedPoints.length; i++) {
                                var latlng = new google.maps.LatLng(
                                    data.snappedPoints[i].location.latitude,
                                    data.snappedPoints[i].location.longitude);
                                snappedCoordinates.push(latlng);
                            }
                            var snappedFlightPath = new google.maps.Polyline({
                                map: map,
                                path: snappedCoordinates,
                                strokeColor: "#FF0000",
                                strokeOpacity: 1.0,
                                strokeWeight: 2
                            });
                            map.addFlightPath(snappedFlightPath);
                        });


                        map.addFlightPath(flightPathPoly);
                    });
                }
                

                
            });
 


        };

        $scope.selectPreBookDetail = function (id) {
            $scope.scanList = [];
            console.log("select pre book Job  " + id);
            //$("#jobList").find(".active").removeClass("active");
            clearTimeout($scope.myTimer);
            //$scope.currentEvent = event;

            $("#box-jobDetail").find(".loading").show();

            uCSData.getPreBookDetail(id).then(function (data) {
                $scope.currentJob = data;
                jdSvc.setJob($scope.currentJob);
                $("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + data.jobNo;
                console.log($scope.currentJob.days);
                var freq = $scope.currentJob.days.slice(8, 9).trimEnd() === "" ? "0" : $scope.currentJob.days.slice(8, 9);
                console.log(freq);
                jdSvc.combos.frequency = [jdSvc.pickFrequency[freq]];
                console.log(jdSvc.combos.frequency);
                var hol = $scope.currentJob.days.slice(9, 10).trimEnd() === "" ? "0" : $scope.currentJob.days.slice(9, 10);
                console.log(hol);
                jdSvc.combos.holidays = [jdSvc.pickHolidays[hol]];
                console.log(jdSvc.combos.holidays);
                var selectedDays = [];
                var days = $scope.currentJob.days.slice(0, 7);
                for (let i = 0; i < days.length; i++) {
                    if (days[i] === '1') {
                        selectedDays.push(jdSvc.pickDays[i]);
                    }
                }
                console.log(selectedDays);
                jdSvc.combos.days = selectedDays;
                var jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true);
                setMapBounds();
                map.setZoom(14);
                uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(function (data) {
                    $scope.scanList = data;

                    setTimeout(function () {
                        sizeHeadings($("#scanList").parents(".column"));
                        $("#box-scanList").find(".loading").fadeOut();
                    }, 200);
                });
            });



        };

        //Select Bulk Job
        $scope.selectBulkJobDetail = function (id) {
            $scope.scanList = [];
            console.log("select Bulk Job  " + id);
            //$("#jobList").find(".active").removeClass("active");
            clearTimeout($scope.myTimer);
            //$scope.currentEvent = event;

            $("#box-jobDetail").find(".loading").show();

            uCSData.getBulkJobDetail(id).then(function (data) {
                $scope.currentJob = data;
                jdSvc.setJob($scope.currentJob);
                $("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Bulk Job " + data.jobNo;
                var jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true);
                setMapBounds();
                map.setZoom(14);
                uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(function (data) {
                    $scope.scanList = data;

                    setTimeout(function () {
                        sizeHeadings($("#scanList").parents(".column"));
                        $("#box-scanList").find(".loading").fadeOut();
                    }, 200);
                });
            });



        };

        $scope.jdSvc.setSelectJobDetail($scope.selectJobDetail);
        $scope.jdSvc.setSelectBulkJobDetail($scope.selectBulkJobDetail);

        //This method is calling from pagination number  
        $scope.pageChanged = function (i) {

            $scope.pageIndex = i;
            $scope.refreshData();
          
        };

        //This method is calling from dropDown  
        $scope.changeBulkPageSize = function (i) {
            $scope.bulkPageIndex = i;
            $scope.bulkPageSizeSelected = i;
            $scope.refreshBulkData();
        };

        //This method is calling from pagination number  
        $scope.pbPageChanged = function (i) {

            $scope.pbPageIndex = i;
            $scope.refreshPreBookData();

        };

        $scope.changePBPageSize = function (i) {
            $scope.pbPageIndex = i;
            $scope.pbPageSizeSelected = i;
            $scope.refreshPreBookData();
        };

        //This method is calling from pagination number  
        $scope.bulkPageChanged = function (i) {

            $scope.bulkPageIndex = i;
            $scope.refreshBulkData();

        };

        //This method is calling from dropDown  
        $scope.changePageSize = function (i) {
            $scope.pageIndex = i;
            $scope.pageSizeSelected = i;
            $scope.refreshData();
        };



        $scope.currentFromDate = $scope.pickDateService.from_date;
        $scope.currentToDate = $scope.pickDateService.to_date;


        $scope.initFilters = function () {
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
                        url: "/courier/AllActiveSearch",
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
        }


        $scope.initFilters();
        //$(document).everyTime("15s", "RD", function () { $scope.refreshData(); });

        // $scope.getData();

        uCSData.getActiveCouriers().then(function (data) {
            $scope.pickCouriers = data;
        });

        uCSData.getAllCouriers().then(function (data) {
            $scope.pickAllCouriers = data;
        });

        NgMap.getMap().then(function (map) {
            $scope.map = map;
            $scope.marker = map.markers[0];
            $scope.onMapReady();
        });

        $scope.onMapReady = function () {
            //$scope.heremaps = heremaps;

            var options = {
                minimumInputLength: 1,
                ajax: {
                    url: 'https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json',
                    delay: 250,
                    dataType: "json",
                    data: function (params) {
                        return {
                            query: params.term,
                            app_id: "bBPfh2x8Cauun3ygLMAx",
                            app_code: "yjfwTdkin_R2rGXYTrwWVg",
                            beginHighlight: "<b>",
                            endHighlight: "</b>",
                            country: "NZL"
                        };
                    },
                    processResults: function (data) {
                        return {
                            results: $.map(data.suggestions, function (obj) {
                                return { id: obj.locationId, text: obj.label.split(", ").reverse().join(", ") };
                            })
                        };
                    }
                },
                escapeMarkup: function (markup) { return markup; }
            };

            $("#location").select2(options).on("select2:select", function (e) {
                $.getJSON("https://geocoder.cit.api.here.com/6.2/geocode.json", {
                    app_id: "bBPfh2x8Cauun3ygLMAx",
                    app_code: "yjfwTdkin_R2rGXYTrwWVg",
                    locationId: e.params.data.id
                }).done(function (data) {
                    var locn = data.Response.View[0].Result[0].Location;
                    console.log("Suburb = " + locn.Address.District);
                    console.log("PostCode = " + locn.Address.PostalCode);
                    $("#suburb").val(locn.Address.District);
                    var mappedSub = $scope.jdSvc.pickSuburbs.find(obj => obj.text === locn.Address.District || obj.alias === locn.Address.District);
                    if (mappedSub !== undefined) {
                        console.log(mappedSub);
                        $('#our_suburb').val(mappedSub.id).trigger('change');
                    }
                    else {
                        $('#our_suburb').val(null).trigger('change');
                    }


                    $scope.jdSvc.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                    $scope.jdSvc.gpsForm.data.long = locn.DisplayPosition.Longitude;
                    $scope.jdSvc.gpsForm.data.address = locn.Address.Label;
                    $scope.jdSvc.gpsForm.data.suburb = locn.Address.District;
                    $scope.jdSvc.gpsForm.data.postCode = locn.Address.PostalCode;
                    var ll = new google.maps.LatLng(locn.DisplayPosition.Latitude, locn.DisplayPosition.Longitude);
                    $scope.map.setCenter(ll);
                    $scope.marker.setPosition(ll);

                });
            });

            var suburbOptions = {
                minimumInputLength: 1,
                data: $scope.jdSvc.pickSuburbs
            };

            $("#our_suburb").select2(suburbOptions);

            waitingDialog.hide();
        };

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


