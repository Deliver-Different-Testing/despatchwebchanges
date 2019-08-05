

angular
    .module("uDispatch")
    .config(["HereMapsConfigProvider", function (HereMapsConfigProvider) {
        HereMapsConfigProvider.setOptions({
            'app_id': 'bBPfh2x8Cauun3ygLMAx',
            'app_code': 'yjfwTdkin_R2rGXYTrwWVg',
            'useHTTPS': true,
            'useCIT': true,
            'mapTileConfig': {
                metadataQueryParams: {
                    'lg2': 'ara'
                }
            }
        });
    }])
    .controller("HomeControl", ["$scope", "DispatchData", "$state", "$filter", "$parse", "hotkeys", "NgMap", "$q", "$timeout", function ($scope, DispatchData, $state, $filter, $parse, hotkeys, NgMap, $q, $timeout) {

        $scope.gather = {
            submit: function () {
                return $scope.gather.form.onSubmit().then(function (response) {
                    console.log("pointer 3");
                    if (response === undefined) {
                        return;
                    }
                    if (response.data === "OK") {
                        $(".gatherForm").hide();
                        var j = $scope.currentJob;
                        $scope.getData().then(function () {
                            var refreshedJob = $scope.jobList.find(jo => jo.id === j.id);
                            $scope.selectJob(refreshedJob);
                            $timeout(function () {
                                $("#jobList tr[data-jobid='" + j.id + "']").addClass("active");

                                var $parentDiv = $("#jobList tr[data-jobid='" + j.id + "']").parents(".box-content");
                                var goTop = $("#jobList tr[data-jobid='" + j.id + "']").offset().top;


                                try {
                                    goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 28;
                                    $parentDiv.scrollTop(goTop);

                                } catch (e) {
                                    //ignore
                                }
                            }, 1000);

                        });
                    }
                });

            },
            cancel: function () {
                $(".gatherForm").hide();
            },
            showForm: function () {
                $(".gatherForm").show(0,
                    function () {
                        setTimeout(function () { $(".gatherForm .focusMe").focus(); }, 100);
                    });
            },
            submitValue: "Save"
        };

        $scope.allCouriers = { display: false };

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
                ]
            }
        };
        $scope.markers = [];
        $scope.getJobStyle = function (assigned) {
            var normal =
            {
                "font-weight": "normal"

            };
            var bold =
            {
                "font-weight": "bold"

            };
            if (assigned) {
                return bold;
            }
            else {
                return normal;
            }
        };
        $scope.normalStyle = "{'font-weight:normal'}";
        $scope.boxes = {
            "jobsList": {
                "title": "Jobs List",
                "tpl": "app/components/home/tpls/jobList.tpl?v=1.30",
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobDetail": {
                "title": "Detail",
                "tpl": "app/components/home/tpls/jobDetail.tpl?v=1.16",
                "showSearch": 0,
                "showRefresh": 0,
                "showDetailButtons": 1
            },
            //"potentialCouriers": {
            //	"title": "Potential Couriers",
            //	"tpl": "app/components/home/tpls/potentialCouriers.tpl",
            //	"showSearch": 1
            //},
            //"jobGroups": {
            //	"title": "Grouped Jobs",
            //	"tpl": "app/components/home/tpls/jobGroups.tpl",
            //	"showSearch": 1
            //},
            "currentWork": {
                "title": "Current Work",
                "tpl": "app/components/home/tpls/currentWork.tpl?v=1.12",
                "showSearch": 1,
                "showRefresh": 0
            },
            "couriersMoveThrough": {
                "title": "Couriers Movement Through List",
                "tpl": "app/components/home/tpls/couriersMovementThroughList.tpl",
                "showSearch": 1,
                "showRefresh": 0
            },
            "courierMovePickedUp": {
                "title": "Couriers Movement Picked Up Run",
                "tpl": "app/components/home/tpls/couriersMovementPickedUp.tpl",
                "showSearch": 1,
                "showRefresh": 0
            },
            "courierMoveClear": {
                "title": "Couriers Movement Clear List",
                "tpl": "app/components/home/tpls/couriersMovementClearList.tpl",
                "showSearch": 1,
                "showRefresh": 0
            },
            "areaList": {
                "title": "Area List",
                "tpl": "app/components/home/tpls/areaList.tpl",
                "showSearch": 0,
                "showRefresh": 0
            },
            "jobUpdates": {
                "title": "Job Updates",
                "tpl": "app/components/home/tpls/jobUpdates.tpl",
                "showSearch": 0,
                "showRefresh": 0
            },
            "supports": {
                "title": "Supports",
                "tpl": "app/components/home/tpls/supports.tpl",
                "showSearch": 0,
                "showRefresh": 0
            },
            "lateCalls": {
                "title": "Late Calls",
                "tpl": "app/components/home/tpls/lateCalls.tpl",
                "showSearch": 0,
                "showRefresh": 0
            },
            "map": {
                "title": "Google Map",
                "tpl": "app/components/home/tpls/map.tpl?v=1.6",
                "showSearch": 0,
                "showRefresh": 0
            },
            "clearLists": {
                "title": "Clear Lists",
                "tpl": "app/components/home/tpls/clearLists.tpl?v=1.6",
                "showSearch": 0,
                "showRefresh": 0
            }
        };

        ///////////////////////////////
        // LAYOUT 
        ///////////////////////////////
        var layoutsObject = null;
        if (Modernizr.localstorage) {
            layoutsObject = JSON.parse(localStorage.getItem("layouts-" + ContactID));
        }
        var defaultLayout =[
            {
                name: "Default",
                layout: {
                    "columns": [
                        {
                            "id": "col1",
                            "width": "700px",
                            "boxes": [
                                {
                                    "name": "jobsList"
                                }

                            ]
                        },
                        {
                            "id": "col2",
                            "width": "300px",
                            "boxes": [
                                //{
                                //    "name": "jobGroups",
                                //    "height": "400px"
                                //},
                                //{
                                //    "name": "potentialCouriers",
                                //    "height": "200px"
                                //},

                                {
                                    "name": "currentWork",
                                    "height": "300px"
                                },
                                {
                                    "name": "jobDetail",
                                    "height": "300px"
                                }
                            ]
                        },
                        {
                            "id": "col3",
                            "width": "300px",
                            "boxes": [
                                {
                                    "name": "clearLists",
                                    "height": "600px"
                                },
                                {
                                    "name": "map"
                                }
                            ]
                        }//,
                        //{
                        //    "id": "col4",
                        //    "boxes": [
                        //        {
                        //            "name": "jobUpdates",
                        //            "height": "300px"
                        //        },
                        //        {
                        //            "name": "supports",
                        //            "height": "300px"
                        //        },
                        //        {
                        //            "name": "lateCalls"
                        //        }
                        //    ]
                        //}
                    ]
                }
            }
        ];
        if (layoutsObject !== null) {
            layoutsObject[0] = defaultLayout[0];
        }

        $scope.layouts = layoutsObject || defaultLayout;
        $scope.userName = FirstName;
        $scope.currentLayoutName = "default";

        $scope.groupJobsSelection = "";
        $scope.currentWorkSelection = "";
        $scope.potentialCouriersSelection = "";

        $scope.layout = angular.copy($scope.layouts[0].layout);


        $scope.loadLayout = function (i) {
            $scope.currentLayoutName = $scope.layouts[i].name;
            $scope.layout = angular.copy($scope.layouts[i].layout);
            setTimeout($scope.getData, 1000);
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
                        localStorage.setItem("layouts-" + ContactID, JSON.stringify($scope.layouts));
                    }

                    var deferred = $q.defer();
                    deferred.resolve({
                        data: "OK"
                    });
                    return deferred.promise;
                    //DO THE API CALL
                    //DispatchData.doAPI(callData).then(function (data) {

                    //    console.log(data);

                    //    if (data.response === "Success") {

                    //        $scope.layouts = $scope.layouts.concat(
                    //            {
                    //                name: layoutName,
                    //                layout: angular.copy($scope.layout)
                    //            }
                    //        );

                    //    } else {

                    //        alert("Critical Error");

                    //    }

                    //});


                },
                submitValue: "Save"
            };

            $scope.gather.showForm();

        };

        $scope.sortableOptions = {
            connectWith: ".column-sortable",
            items: ".box",
            placeholder: "placeholder",
            scroll: true,
            scrollSensitivity: 100,
            scrollSpeed: 20,
            handle: ".box-handle",
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

                $("#box-" + boxID).find(".box-search").animate({ "width": "200px" },
                    500,
                    function () {
                        $("#box-" + boxID).find(".box-search").addClass("open");
                        $("#box-" + boxID).find(".box-search input").fadeIn();
                    });

            }

        };


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
                $scope.setFilters({ "order": prop });
            }

        };

        ///////////////////////////
        // HOTKEYS 
        //////////////////////////

        hotkeys.add({
            combo: "ctrl+d",
            description: "Dispatch selected jobs",
            allowIn: ["INPUT", "SELECT", "TEXTAREA"],
            callback: function () {
                if ($(".activeTable .active").length > 0) {
                    $scope.dispatchJobsForm();
                }
            }
        });

        hotkeys.add({
            combo: "esc",
            description: "Close gather screen",
            allowIn: ["INPUT", "SELECT", "TEXTAREA"],
            callback: function (event, hk) {
                $(".gatherForm").hide();
                $(".eventForm").hide();
                if (event.srcElement.classList.contains("dispatchField")) {
                    event.srcElement.value = "";
                }
            }
        });

        hotkeys.add({
            combo: "enter",
            description: "Submit gather form",
            allowIn: ["INPUT", "SELECT", "TEXTAREA"],
            callback: function (event, hk) {
                if ($(".gatherForm").is(":visible") === true) {
                    setTimeout($scope.gather.submit(), 0);
                }
                if (event.srcElement.id === "gps") {
                    $scope.searchCourier(event.srcElement.value);
                }
            }
        });

        $scope.selectForDispatch = function (job) {
            $scope.jobForDispatch = job;
        };


        ////////////////////////////////////////
        // LOAD DISPATCH JOBS SCREEN
        ///////////////////////////////////////
        $scope.dispatchJobsForm = function () {
            $scope.gather.form = {
                id: "dispatchJobs",
                title: "Dispatch Jobs",
                fields: [
                    {
                        "name": "courierNumber",
                        "label": "Courier number...",
                        "value": ""
                    }
                ],
                onSubmit: function () {
                    return $scope.dispatchJobs($("#gather-courierNumber").val());
                },
                submitValue: "Dispatch"
            };
            $scope.gather.showForm();

        };

        /////////////////////////////////////
        // LATE CALLS
        /////////////////////////////////////
        $scope.lateCall = function (lateTime, lateType, j) {
            return DispatchData.lateCall(lateType, lateTime, j.minutes, j.pickupTime, j.alertLatePickup, j.deliveryTime, j.alertLateDelivery, j.jobNo, j.clientID, j.contactName, ContactID, j.time, j.id, j.jobType, j.speed, j.notify || j.speed, FirstName).then(function (response) {
                $scope.getJobList().then(function () {



                });
                return response;
            });
        };

        ////////////////////////////////////////
        // DISPATCH THE JOBS
        ///////////////////////////////////////
        $scope.dispatchJobs = function (courier) {
            var foundCourier = $scope.pickCouriers.find(c => c.id === courier);
            if (foundCourier === undefined) {
                alert("Invalid Courier");
                return;
            }

            var callData = {
                "call": "dispatchJobs",
                "courier": courier,
                "jobs": []
            };

            var reset = function () {
                $(".activeTable .active").each(function () {
                    var j = $scope.jobList.find(jo => jo.id === $(this).data("jobid"));
                    j.courier = null;
                });
            };

            $(".activeTable .active").each(function () {
                var j = $scope.jobList.find(jo => jo.id === $(this).data("jobid"));
                var jn = j.jobNo;
                if (j.courierData.courierID !== null) {
                    alert("restore " + jn + " prior to despatching to another courier");
                    reset();
                    return;
                }
                if (!j.allowDispatch) {
                    alert("Can not despatch " + jn + " until all other child jobs have been despatched.");
                    reset();
                    return;
                }
                if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                    alert("DG job " + jn + " can not be despatched to courier " + courier + " - doesn't have DGLicense.");
                    reset();
                    return;
                }
                if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                    reset();
                    alert("Courier " + courier + " doesn't have a DGLicense or license has expired.");
                    return;
                }

                if (j.dgClass !== null && j.dgClass > 0) {
                    DispatchData.addFollowupEvent(jn, j.clientID, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
                }

                callData.jobs.push($(this).attr("data-jobid"));
            });

            return DispatchData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(function (response) {
                $scope.getJobList().then(function () {
                    //$("#box-jobDetail").find(".loading").show();
                    $("#box-map").find(".loading").show();

                    $scope.courier = { gpsCourier: foundCourier.id };
                    $scope.searchCourier();


                });
                return response;
            });



        };


        ////////////////////////////////////////
        // RESTORE JOB
        ///////////////////////////////////////
        $scope.restoreJobs = function () {

            var callData = {
                "call": "restoreJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };

            var reset = function () {
                $(".activeTable .active").each(function () {
                    var j = $scope.jobList.find(jo => jo.id === $(this).data("jobid"));
                    j.courier = null;
                });
            };
            var foundCourier = null;

            $(".activeTable .active").each(function () {
                var j = $scope.jobList.find(jo => jo.id === $(this).data("jobid"));
                var jn = j.jobNo;
                DispatchData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
                if (callData.courierID === null) {
                    callData.courierID = j.courierData.courierID;
                    foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
                }
                if (j.displaySplitJobDetail) {
                    callData.splitJobs.push($(this).data("jobid"));
                } else {
                    callData.jobs.push($(this).attr("data-jobid"));
                }
            });

            if (callData.splitJobs.length > 0) {
                DispatchData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs);
            }
            if (callData.jobs.length > 0) {
                DispatchData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
            }



            $scope.getJobList().then(function () {
                //$("#box-jobDetail").find(".loading").show();
                $("#box-map").find(".loading").show();

                $scope.courier = { gpsCourier: foundCourier.id };
                $scope.searchCourier();


            });


        };

        $scope.restoreJobsFromCurrentWindow = function () {

            var callData = {
                "call": "restoreJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };

            var reset = function () {
                $(".activeTable .active").each(function () {
                    var j = $scope.jobsCurrentList.find(jo => jo.id === $(this).data("jobid"));
                    j.courier = null;
                });
            };
            var foundCourier = null;

            $("#currentWork .active").each(function () {
                var j = $scope.jobsCurrentList.find(jo => jo.id === $(this).data("jobid"));
                var jn = j.jobNo;
                DispatchData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
                if (callData.courierID === null) {
                    callData.courierID = j.courierData.courierID;
                    foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
                }
                if (j.displaySplitJobDetail) {
                    callData.splitJobs.push($(this).data("jobid"));
                } else {
                    callData.jobs.push($(this).attr("data-jobid"));
                }
            });

            if (callData.splitJobs.length > 0) {
                DispatchData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs);
            }
            if (callData.jobs.length > 0) {
                DispatchData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
            }



            $scope.getCurrentJobs(foundCourier.courierID);
            $scope.getData();

        };

        //////////////////////////////
        //  SPLIT JOB //
        /////////////////////////////
        $scope.splitJob = function () {
            var jid;
            jid = $(".activeTable .active").first().data("jobid");
            var j = $scope.jobList.find(jo => jo.id === jid);
            if (!j.allowSplit) {
                alert("Can not split " + j.JobNo + ".");
                return;
            }

            DispatchData.splitJob(j.id, FirstName).then(function (response) {
                $scope.getJobList().then(function () {
                    var refreshedJob = $scope.jobList.find(jo => jo.id === j.id);
                    $scope.selectJob(refreshedJob);
                    $timeout(function () {
                        $("#jobList tr[data-jobid='" + j.id + "']").addClass("active");

                        var $parentDiv = $("#jobList tr[data-jobid='" + j.id + "']").parents(".box-content");
                        var goTop = $("#jobList tr[data-jobid='" + j.id + "']").offset().top;


                        try {
                            goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 28;
                            $parentDiv.scrollTop(goTop);

                        } catch (e) {
                            //ignore
                        }
                    }, 1000);


                });
            });



        };

        //////////////////////////////
        //  PALLET CONTROLS //
        /////////////////////////////
        $scope.palletMenu = [
            // NEW IMPLEMENTATION
            {
                text: "Delete",
                click: function ($itemScope, $event, modelValue, text, $li) {
                    //$scope.items.splice($itemScope.$index, 1);

                    var index = $scope.currentJob.PalletInfo.indexOf($itemScope.pallet);
                    $scope.currentJob.PalletInfo.splice(index, 1);

                    //LOCK WITH CURRENT USER

                }
            }
        ];


        $scope.newPallet = function () {

            $scope.gather.form = {
                id: "newPallet",
                tpl: "multi",
                title: "Add Pallet",
                fields: [
                    {
                        "name": "amount",
                        "label": "# of pallets...",
                        "colSize": "6"
                    },
                    {
                        "name": "weight",
                        "label": "Weight (KG)",
                        "colSize": "6"
                    },
                    {
                        "name": "length",
                        "label": "Length (m)",
                        "colSize": "6"
                    },
                    {
                        "name": "depth",
                        "label": "Depth (m)",
                        "colSize": "6"
                    },
                    {
                        "name": "height",
                        "label": "Height (m)",
                        "colSize": "6"
                    },
                    {
                        "name": "pu",
                        "label": "PU...",
                        "colSize": "6"
                    },
                    {
                        "name": "do",
                        "label": "DO...",
                        "colSize": "6"
                    },
                    {
                        "name": "dgclass",
                        "label": "DG Class...",
                        "colSize": "6"
                    },
                    {
                        "name": "notes",
                        "label": "Notes...",
                        "colSize": "12",
                        "type": "textarea"
                    }
                ],
                onSubmit: function () {

                    var newP = {};

                    $scope.gather.form.fields.forEach(function (field) {
                        if (field.name === "amount") {
                            newP["Quantity"] = field.value;
                        }
                        if (field.name === "weight") {
                            newP["Weight"] = field.value;
                        }
                        if (field.name === "length") {
                            newP["Length"] = field.value;
                        }
                        if (field.name === "depth") {
                            newP["Depth"] = field.value;
                        }
                        if (field.name === "height") {
                            newP["Height"] = field.value;
                        }
                        if (field.name === "pu") {
                            newP["PU"] = field.value;
                        }
                        if (field.name === "do") {
                            newP["DO"] = field.value;
                        }
                        if (field.name === "dgclass") {
                            newP["DGClass"] = field.value;
                        }
                        if (field.name === "notes") {
                            newP["Notes"] = field.value;
                        }

                    });

                    var callData = {
                        "call": "addPallet",
                        "palletData": newP,
                        "jobID": $scope.currentJob.ID
                    };

                    DispatchData.doAPI(callData).then(function (data) {

                        console.log(data);

                        if (data.response === "Success") {

                            newP["ID"] = data.submitID;
                            if (!$scope.currentJob.PalletInfo) {
                                $scope.currentJob.PalletInfo = [];
                            }
                            $scope.currentJob.PalletInfo.push(newP);

                        } else {

                            console.log("Critical Error");

                        }

                    });

                },
                submitValue: "Add Pallet"
            };
            $scope.gather.showForm();

        };

        $scope.currentPallet = "";

        $scope.editPallet = function (pallet) {

            $scope.currentPallet = pallet;

            $scope.gather.form = {
                id: "editPallet",
                title: "Edit Pallet",
                tpl: "multi",
                fields: [
                    {
                        "name": "amount",
                        "label": "# of pallets",
                        "colSize": "6",
                        "value": pallet.Quantity
                    },
                    {
                        "name": "weight",
                        "label": "Weight (KG)",
                        "colSize": "6",
                        "value": pallet.Weight
                    },
                    {
                        "name": "length",
                        "label": "Length (m)",
                        "colSize": "6",
                        "value": pallet.Length
                    },
                    {
                        "name": "depth",
                        "label": "Depth (m)",
                        "colSize": "6",
                        "value": pallet.Depth
                    },
                    {
                        "name": "height",
                        "label": "Height (m)",
                        "colSize": "6",
                        "value": pallet.Height
                    },
                    {
                        "name": "pu",
                        "label": "PU",
                        "colSize": "6",
                        "value": pallet.PU
                    },
                    {
                        "name": "do",
                        "label": "DO",
                        "colSize": "6",
                        "value": pallet.DO
                    },
                    {
                        "name": "dgclass",
                        "label": "DG Class",
                        "colSize": "6",
                        "value": pallet.DGClass
                    },
                    {
                        "name": "notes",
                        "label": "Notes",
                        "colSize": "12",
                        "type": "textarea",
                        "value": pallet.Notes
                    }
                ],
                onSubmit: function () {

                    var newP = {};

                    $scope.gather.form.fields.forEach(function (field) {
                        if (field.name === "amount") {
                            newP["Quantity"] = field.value;
                        }
                        if (field.name === "weight") {
                            newP["Weight"] = field.value;
                        }
                        if (field.name === "length") {
                            newP["Length"] = field.value;
                        }
                        if (field.name === "depth") {
                            newP["Depth"] = field.value;
                        }
                        if (field.name === "height") {
                            newP["Height"] = field.value;
                        }
                        if (field.name === "pu") {
                            newP["PU"] = field.value;
                        }
                        if (field.name === "do") {
                            newP["DO"] = field.value;
                        }
                        if (field.name === "dgclass") {
                            newP["DGClass"] = field.value;
                        }
                        if (field.name === "notes") {
                            newP["Notes"] = field.value;
                        }
                    });

                    newP["ID"] = $scope.currentPallet.ID;

                    var callData = {
                        "call": "editPallet",
                        "palletData": newP,
                        "palletID": $scope.currentPallet.ID,
                        "jobID": $scope.currentJob.ID
                    };

                    DispatchData.doAPI(callData).then(function (data) {

                        console.log(data);

                        if (data.response === "Success") {


                            for (var key in $scope.currentPallet) {
                                $scope.currentPallet[key] = newP[key];

                            }


                        } else {

                            console.log("Critical Error");

                        }

                    });

                },
                submitValue: "Edit Pallet"
            };
            $scope.gather.showForm();

        };


        //ACTIVATE DROP
        $scope.activateDrop = function () {
            setTimeout(function () {

                $(document).ready(function (event) {
                    $(".droppable-row").droppable({
                        classes: {
                            "ui-droppable-hover": "active"
                        },
                        drop: function (event, ui) {
                            //$(this).addClass("active");


                            //STOP DROPPABLE FIRING OUTSIDE ITS CONTAINER & HIDDEN
                            var parent = $(this).parents(".box");
                            var parentOffset = parent.offset();
                            var parentTop = parentOffset.top;
                            var parentBottom = parentTop + parent.outerHeight();

                            var row = $(this);
                            var rowOffset = row.offset();
                            var rowTop = rowOffset.top;
                            var rowBottom = rowTop + row.outerHeight();

                            if (rowTop < parentBottom && rowBottom > parentTop) {

                                //YAY ITS VISABLE
                                $(this).css({ "background-color": "#c6dfad" });
                                $(this).animate({ backgroundColor: "inherit" },
                                    300,
                                    function () {
                                        $(this).removeAttr("style");
                                    });
                                $scope.dispatchJobs($(this).attr("data-courier").replace(/[^\d.-]/g, ''));
                                $scope.getClearListsData();

                            }


                        }
                    });
                });
            },
                0);
        };

        ////////////////////////////
        // POTENTIAL COURIERS
        ////////////////////////////

        $scope.getPotentialCouriers = function () {

            $("#box-potentialCouriers .loading").show();
            DispatchData.getPotentialCouriers($scope.selectedJobs).then(function (data) {
                $scope.potentialCouriers = data;

                //Set headings
                setTimeout(function () { sizeHeadings($("#potentialCouriers").parents(".column")); }, 1000);
                setTimeout(function () { sizeHeadings($("#potentialCouriers").parents(".column")); }, 2000);

                $("#box-potentialCouriers .loading").fadeOut();

                $scope.activateDrop();

            });

        };



        // Search Courier GPS
        $scope.searchCourier = function () {
            $("#box-currentWork").find(".loading").show();
            $("#box-map").find(".loading").show();
            var ac = $scope.pickCouriers.find(c => c.id === $scope.courier.gpsCourier);
            console.log(ac);
            if (ac === undefined) {
                $("#box-currentWork").find(".loading").fadeOut();
                $("#box-map").find(".loading").show();
                alert("courier not found");
                return;
            }
            $scope.currentWorkSelection = " for Courier " + ac.id + " " + ac.name;
            //$scope.currentCourier = courier;

            $scope.currentSelection = " for Courier " + ac.id + " " + ac.name;
            $scope.getCurrentJobs(ac.courierID);
            //DispatchData.getJobsCurrent(ac.courierID, false).then(function (data) {
            //    $("#box-currentWork").find(".loading").fadeOut();
            //    $scope.jobsCurrentList = data;
            //    if (data.length > 0) {
            //        displayRoutePoints(data);
            //    } else {
            //        DispatchData.getCourierPosition(ac.id).then(function (posData) {
            //            displayCourierPositionOnly(posData.latitude, posData.longitude);
            //        });
            //    }
            //    setTimeout(function () { sizeHeadings($("#currentWork").parents(".column")); }, 1000);
            //    setTimeout(function () { sizeHeadings($("#currentWork").parents(".column")); }, 2000);
            //});
        };

        // Select the courier
        $scope.selectCourier = function (courier) {


            $("#box-jobDetail").find(".loading").show();
            $("#box-map").find(".loading").show();

            //$scope.getGroupedJobs(courier);
            //$scope.groupJobsSelection = " for Courier " + courier.courier;
            $scope.getCurrentJobs(courier.courierID);
            $scope.currentWorkSelection = " for Courier " + courier.courier;

            //SHOW MAP
            //$scope.currentJob = null;
            $scope.currentCourier = courier;

            $scope.currentSelection = " for Courier " + courier.courier;

            setTimeout(function () {
                $(document).ready(function (event) {
                    $("#box-jobDetail").find(".loading").fadeOut();
                    $("#box-map").find(".loading").fadeOut();
                });
            },
                100);


        };

        ////////////////////////////
        // GROUPED JOBS
        ////////////////////////////

        $scope.getGroupedJobs = function (jobs, courier) {

            $("#box-jobGroups").find(".loading").show();

            DispatchData.getJobsGrouped().then(function (data) {

                $("#box-jobGroups").find(".loading").fadeOut();

                $scope.jobGroups = data;

                setTimeout(function () { sizeHeadings($("#jobGroups").parents(".column")); }, 1000);
                setTimeout(function () { sizeHeadings($("#jobGroups").parents(".column")); }, 2000);

            });

        };

        ////////////////////////////
        // CURRENT JOBS
        ////////////////////////////

        $scope.getCurrentJobs = function (courierId) {

            $("#box-currentWork").find(".loading").show();
            var code = $scope.pickCouriers.find(x => x.courierID === courierId).id;
            DispatchData.getJobsCurrent(courierId, $scope.jobFilters.status === "done").then(function (data) {
                $("#box-currentWork").find(".loading").fadeOut();
                if ($scope.currentJob !== null && $scope.currentJob.courier !== code) {
                    $scope.currentJob = null;
                }
                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    displayRoutePoints(data);
                } else {
                    DispatchData.getCourierPosition(code).then(function (posData) {
                        displayCourierPositionOnly(posData.latitude, posData.longitude);
                    });
                }
                $scope.activateDrop();
                setTimeout(function () { sizeHeadings($("#currentWork").parents(".column")); }, 1000);
                setTimeout(function () { sizeHeadings($("#currentWork").parents(".column")); }, 2000);
            });

        };

        var filtersObject = null;
        if (Modernizr.localstorage) {
            filtersObject = JSON.parse(localStorage.getItem("disp-filters-" + ContactID));
        }
        $scope.jobFilters = filtersObject || { "status": "nda", "area": "main1", "order": "remain", "asc": "asc" };
        var f = ".top-bar .btn-group .btn." + $scope.jobFilters.status;
        $(f).addClass("topBarActive");
        var areas = $scope.jobFilters.area.split(',');
        for (var i = 0; i < areas.length; i++) {
            f = ".top-bar .btn-group .btn." + areas[i];
            $(f).addClass("topBarActive");
        }

        $scope.sort["jobList"] = "remain";
        $scope.setFilters = function (data) {
            setTimeout(function () {
                if (data.status) {
                    $scope.jobFilters.status = data.status;
                }


                if (data.area) {
                    var selected = $("#area-group > .btn.topBarActive").length;
                    if (selected > 1) {
                        $scope.jobFilters.area += "," + data.area;
                    }
                    else {
                        $scope.jobFilters.area = data.area;
                    }

                }

                if (data.order) {
                    $scope.jobFilters.order = data.order;
                }

                $scope.getData();
            }, 300);
        };

        $scope.selectJobDetail = function (job) {
            $scope.currentJob = job;
        };

        //Select Job
        $scope.selectJob = function (job, clear) {

            setTimeout(function () {

                $scope.selectedJobs = [];

                $(".activeTable .active").each(function () {

                    //$(this).hide();
                    $(this).find(".selectjob").click();

                    $scope.selectedJobs.push($scope.jobForDispatch.ID);

                });

                $scope.currentJob = job;
                $scope.$apply();

                console.log(job);
                if (clear === true) {
                    DispatchData.getActiveCouriers().then(function (data) {
                        $scope.pickCouriers = data;
                    });
                    $scope.jobGroups = false;
                    $scope.jobsCurrentList = false;
                    $scope.getPotentialCouriers();
                    $scope.potentialCouriersSelection = " for Job " + job.JobNo;
                    $scope.getGroupedJobs();
                    $scope.groupJobsSelection = " for Job " + job.JobNo;
                    $scope.currentWorkSelection = "";


                }
                $scope.currentCourier = null;
                $scope.currentSelection = " for Job " + job.JobNo;
                if (job.courier !== null) {
                    $scope.selectCourier(job.courierData);
                } else {
                    var jobs = [job];
                    displayRoutePoints(jobs);
                }

            },
                0);


        };

        $scope.setCurrentWorkMenu = function () {
            var multiple = $(".activeTable .active").length > 1;

            var menu = [
                {
                    text: "Restore",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        $scope.restoreJobsFromCurrentWindow();
                    }
                }
            ];

            return menu;
        };

        $scope.setJobsMenu = function () {
            var multiple = $(".activeTable .active").length > 1;
            var lastCourier = null;
            var sameCourier = true;
            $(".activeTable .active").each(function () {
                var j = $scope.jobList.find(jo => jo.id === $(this).data("jobid"));
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
            var multipleMenu = [
                {
                    text: "Dispatch Selected",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        $scope.dispatchJobsForm();
                    }
                },
                {
                    text: "Re-dispatch Selected",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        //$scope.items.splice($itemScope.$index, 1);
                    }
                }
            ];
            if (sameCourier) {
                multipleMenu.push(
                    {
                        text: "Restore Selected",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            $scope.restoreJobs();
                        }
                    }
                );
            }

            if ((sameCourier && lastCourier === null)) {

                multipleMenu =
                    [
                        {
                            text: "Dispatch Selected",
                            click: function ($itemScope, $event, modelValue, text, $li) {
                                $scope.dispatchJobsForm();
                            }

                        }
                    ];
            }


            var fullMenu =
                [
                    {
                        text: "Dispatch",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            $scope.dispatchJobsForm();
                        }
                    }

                    //{
                    //    text: "Split Job",
                    //    click: function ($itemScope, $event, modelValue, text, $li) {
                    //        //$scope.items.splice($itemScope.$index, 1);
                    //        $scope.splitJob();
                    //    }
                    //}
                ];

            if (lastCourier !== null) {
                multipleMenu.shift();
                multipleMenu.shift();
                fullMenu.shift();
                fullMenu.push(
                    {
                        text: "Restore",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            $scope.restoreJobs();
                        }
                    }
                );
            }
            return multiple ? multipleMenu : fullMenu;
        };

        $scope.getAvailableCourierLocation = function () {
            if (!$scope.allCouriers.display) {
                map.clearLabels();
                map.clearFlags();
                return;
            }
            var areas = $scope.jobFilters.area.split(",");
            var channels = [];
            var trucks = false;
            for (var i = 0; i < areas.length; i++) {
                switch (areas[i]) {
                    case "main1":
                        if (!channels.includes(1)) {
                            channels.push(1);
                        }
                        break;
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
                    // code block
                }
            }
            DispatchData.getAvailableCourierLocation(map.getBounds().getSouthWest().lng(), map.getBounds().getSouthWest().lat(), map.getBounds().getNorthEast().lng(), map.getBounds().getNorthEast().lat())
                .then(function (returnData) {
                    displayAvailableCouriers(returnData, $scope.currentCourier === false ? 0 : $scope.currentCourier.courier.split(" ")[0].trim(), channels, trucks);
                });
        };

        $scope.courierMenu = [
            // NEW IMPLEMENTATION
            {
                text: "Dispatch Selected",
                click: function ($itemScope, $event, modelValue, text, $li) {
                    //$scope.selected = $itemScope.item.name;
                    $scope.dispatchJobs($itemScope.courier.courier);
                }
            }
        ];

        $scope.getJobList = function () {
            if (Modernizr.localstorage) {
                localStorage.setItem("disp-filters-" + ContactID, JSON.stringify($scope.jobFilters));
            }
            return DispatchData.getJobsFilter($scope.jobFilters).then(function (data) {
                $scope.jobList = data;

                setTimeout(function () {
                    $("#box-jobsList .loading").fadeOut();
                    sizeHeadings($("#jobList").parents(".column"));
                    $scope.getAvailableCourierLocation();
                }, 100);

            });
        };

        $scope.getData = function () {

            ///////////////////////////////
            // JOB LIST
            ///////////////////////////////

            //Get Job Data

            $("#box-jobsList").find(".loading").show();
            $scope.jobList = [];
            $scope.currentJob = false;
            $scope.potentialCouriers = false;
            $scope.jobGroups = false;
            $scope.jobsCurrentList = false;
            $scope.currentCourier = false;



            $scope.getClearListsData = function () {
                DispatchData.getClearLists().then(function (data) {
                    $scope.clearLists = data;
                    setTimeout(function () { $("#clearLists .loading").fadeOut(); }, 0);
                    console.log($scope.clearLists);
                    $scope.activateDrop();
                });
            };

            $scope.getClearListsData();


            DispatchData.getActiveCouriers().then(function (data) {
                $scope.pickCouriers = data;
            });

            DispatchData.getSuburbList().then(function (data) {
                $scope.pickSuburbs = data;
            });

            ////////////////////////////
            // COURIER MOVEMENTS THROUGH
            ////////////////////////////
            $("#box-couriersMoveThrough").find(".loading").show();


            DispatchData.getCouriersThrough().then(function (data) {
                $scope.couriersThrough = data;


                $scope.couriersThroughMenu = [
                    // NEW IMPLEMENTATION
                    {
                        text: "Delete",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            //$scope.selected = $itemScope.item.name;
                            $(".rightActiveTable .active").fadeOut();
                        }
                    }
                ];
                $scope.activateDrop();
                setTimeout(function () { $("#box-couriersMoveThrough").find(".loading").fadeOut(); }, 100);


                setTimeout(function () { sizeHeadings($("#couriersThrough").parents(".column")); }, 1000);
                setTimeout(function () { sizeHeadings($("#couriersThrough").parents(".column")); }, 2000);

            });


            ////////////////////////////
            // COURIER MOVEMENTS PICKED UP
            ////////////////////////////

            $("#box-courierMovePickedUp").find(".loading").show();

            DispatchData.getCouriersPicked().then(function (data) {
                $scope.couriersPicked = data;

                $scope.couriersPickedMenu = [
                    // NEW IMPLEMENTATION
                    {
                        text: "Hold",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            //$scope.selected = $itemScope.item.name;


                            var callData = {
                                "call": "holdCourier",
                                "courier": $itemScope.courier
                            };

                            DispatchData.doAPI(callData).then(function (data) {

                                console.log(data);

                                if (data.response === "Success") {

                                    $(".rightActiveTable .active").css({ "background-color": "#c6dfad" });

                                    $(".rightActiveTable .active").animate({ backgroundColor: "inherit" },
                                        300,
                                        function () {
                                            $(this).removeAttr("style");
                                        });

                                } else {

                                    console.log("Critical Error");

                                }

                            });

                        }
                    },
                    {
                        text: "Head",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            //$scope.items.splice($itemScope.$index, 1);


                            var callData = {
                                "call": "headCourier",
                                "courier": $itemScope.courier
                            };

                            DispatchData.doAPI(callData).then(function (data) {

                                console.log(data);

                                if (data.response === "Success") {

                                    $(".rightActiveTable .active").css({ "background-color": "#c6dfad" });

                                    $(".rightActiveTable .active").animate({ backgroundColor: "inherit" },
                                        300,
                                        function () {
                                            $(this).removeAttr("style");
                                        });

                                } else {

                                    console.log("Critical Error");

                                }

                            });

                        }
                    },
                    {
                        text: "Delete",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            $(".rightActiveTable .active").fadeOut();
                        }
                    }
                ];

                setTimeout(function () {
                    $(document).ready(function (event) {
                        $("#box-courierMovePickedUp").find(".loading").fadeOut();
                    });
                },
                    100);

                setTimeout(function () { sizeHeadings($("#couriersPicked").parents(".column")); }, 1000);
                setTimeout(function () { sizeHeadings($("#couriersPicked").parents(".column")); }, 2000);

            });


            ////////////////////////////
            // COURIER MOVEMENTS CLEAR
            ////////////////////////////
            $("#box-courierMoveClear").find(".loading").show();
            DispatchData.getCouriersClear().then(function (data) {
                $scope.couriersClear = data;

                $scope.couriersClearMenu = [
                    // NEW IMPLEMENTATION
                    {
                        text: "Hold",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            //$scope.selected = $itemScope.item.name;


                            var callData = {
                                "call": "holdCourier",
                                "courier": $itemScope.courier
                            }

                            DispatchData.doAPI(callData).then(function (data) {

                                console.log(data);
                                //YAY ITS VISABLE

                                if (data.response === "Success") {

                                    $(".rightActiveTable .active").css({ "background-color": "#c6dfad" });

                                    $(".rightActiveTable .active").animate({ backgroundColor: "inherit" },
                                        300,
                                        function () {
                                            $(this).removeAttr("style");
                                        });

                                } else {

                                    console.log("Critical Error");

                                }

                            });

                        }
                    },
                    {
                        text: "Move",
                        click: function ($itemScope, $event, modelValue, text, $li) {

                            var callData = {
                                "call": "moveCourier",
                                "courier": $itemScope.courier
                            };

                            DispatchData.doAPI(callData).then(function (data) {

                                console.log(data);

                                if (data.response === "Success") {

                                    $(".rightActiveTable .active").css({ "background-color": "#c6dfad" });

                                    $(".rightActiveTable .active").animate({ backgroundColor: "inherit" },
                                        300,
                                        function () {
                                            $(this).removeAttr("style");
                                        });

                                } else {

                                    console.log("Critical Error");

                                }

                            });

                        }
                    },
                    {
                        text: "Delete",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            //$scope.items.splice($itemScope.$index, 1);
                            $(".rightActiveTable .active").fadeOut();
                        }
                    }
                ];

                setTimeout(function () {
                    $(document).ready(function (event) {
                        $("#box-courierMoveClear").find(".loading").fadeOut();
                    });
                },
                    100);

                setTimeout(function () { sizeHeadings($("#couriersClear").parents(".column")); }, 1000);
                setTimeout(function () { sizeHeadings($("#couriersClear").parents(".column")); }, 2000);

            });


            ////////////////////////////
            // AREA LIST
            ////////////////////////////

            $("#box-areaList").find(".loading").show();
            DispatchData.getAreaList().then(function (data) {
                $scope.areaList = data;

                setTimeout(function () {
                    $(document).ready(function (event) {
                        $("#box-areaList").find(".loading").fadeOut();
                    });
                },
                    100);

                setTimeout(function () { sizeHeadings($("#areaList").parents(".column")); }, 1000);
                setTimeout(function () { sizeHeadings($("#areaList").parents(".column")); }, 2000);

            });

            ////////////////////////////
            // JobUpdates
            ////////////////////////////

            // $("#box-jobUpdates").find(".loading").show();
            /* DispatchData.getJobUpdates().then(function (data) {
                 $scope.jobUpdates = data;
 
                 $scope.jobUpdatesMenu = [
                     // NEW IMPLEMENTATION
                     {
                         text: "Dismiss",
                         click: function ($itemScope, $event, modelValue, text, $li) {
 
                             var callData = {
                                 "call": "dismissSupport",
                                 "support": $itemScope.support
                             };
 
                             DispatchData.doAPI(callData).then(function (data) {
                                 console.log(data);
 
                                 if (data.response === "Success") {
 
                                     $(".rightActiveTable .active").fadeOut();
 
                                 } else {
 
                                     console.log("Critical Error");
 
                                 }
 
                             });
 
                         }
                     },
                     {
                         text: "Support",
                         click: function ($itemScope, $event, modelValue, text, $li) {
                             //$scope.items.splice($itemScope.$index, 1);
 
 
                             //BRING UP CURRENT EVENT FORM TO ENTER A SUPPORT
 
                         }
                     }
                 ];
 
 
                 setTimeout(function () {
                     $(document).ready(function (event) {
                         $("#box-jobUpdates").find(".loading").fadeOut();
                     });
                 },
                     100);
 
 
                 setTimeout(function () { sizeHeadings($("#jobUpdates").parents(".column")); }, 1000);
                 setTimeout(function () { sizeHeadings($("#jobUpdates").parents(".column")); }, 2000);
 
 
             });
 
             ////////////////////////////
             // SUPPORTS
             ////////////////////////////
 
            // $("#box-supports").find(".loading").show();
             DispatchData.getSupports().then(function (data) {
                 $scope.supports = data;
 
 
                 $scope.supportMenu = [
                     // NEW IMPLEMENTATION
                     {
                         text: "Complete",
                         click: function ($itemScope, $event, modelValue, text, $li) {
 
                             var callData = {
                                 "call": "dismissSupport",
                                 "support": $itemScope.support
                             };
 
                             DispatchData.doAPI(callData).then(function (data) {
 
                                 console.log(data);
 
                                 if (data.response === "Success") {
 
                                     $(".rightActiveTable .active").fadeOut();
 
                                 } else {
 
                                     console.log("Critical Error");
 
                                 }
 
                             });
 
                         }
                     },
                     {
                         text: "Lock",
                         click: function ($itemScope, $event, modelValue, text, $li) {
                             //$scope.items.splice($itemScope.$index, 1);
 
 
                             //LOCK WITH CURRENT USER
 
                         }
                     }
                 ];
 
 
                 setTimeout(function () {
                     $(document).ready(function (event) {
                         $("#box-supports").find(".loading").fadeOut();
                     });
                 },
                     100);
 
 
                 setTimeout(function () { sizeHeadings($("#getSupports").parents(".column")); }, 1000);
                 setTimeout(function () { sizeHeadings($("#getSupports").parents(".column")); }, 2000);
             });
             */

            ////////////////////////////
            // LATE CALLS
            ////////////////////////////

            $("#box-lateCalls").find(".loading").show();
            DispatchData.getLateCalls().then(function (data) {
                $scope.lateCalls = data;


                $scope.lateCallsMenu = [
                    // NEW IMPLEMENTATION
                    {
                        text: "Complete",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            //$scope.selected = $itemScope.item.name;


                            var callData = {
                                "call": "dismissSupport",
                                "support": $itemScope.support
                            };

                            DispatchData.doAPI(callData).then(function (data) {

                                console.log(data);

                                if (data.response === "Success") {

                                    $(".rightActiveTable .active").fadeOut();

                                } else {

                                    console.log("Critical Error");

                                }

                            });

                        }
                    },
                    {
                        text: "Lock",
                        click: function ($itemScope, $event, modelValue, text, $li) {
                            //$scope.items.splice($itemScope.$index, 1);


                            //LOCK WITH CURRENT USER

                        }
                    }
                ];

                setTimeout(function () {
                    $(document).ready(function (event) {
                        $("#box-lateCalls").find(".loading").fadeOut();
                    });
                },
                    100);

                setTimeout(function () { sizeHeadings($("#getLastCalls").parents(".column")); }, 1000);
                setTimeout(function () { sizeHeadings($("#getLastCalls").parents(".column")); }, 2000);
            });

            ///////////////////////////
            // JOB DETAIL
            //////////////////////////
            $scope.formatDate = function (dateString) {
                //console.log(dateString);
                //return new Date("1988/08/21" + dateString);
            };

            return $scope.getJobList();
        };


        $scope.getData();

        /////////////////////////
        // JOB DETAILS
        /////////////////////////


        $scope.detailAddressMenu = [
            // NEW IMPLEMENTATION
            {
                text: "Update GPS",
                click: function ($itemScope, $event, modelValue, text, $li) {
                    //$scope.selected = $itemScope.item.name;

                    console.log($event.currentTarget.attributes["data-field"].nodeValue);

                    $scope.updateGPS($event.currentTarget.attributes["data-field"].nodeValue);

                }
            }
        ];

        NgMap.getMap().then(function (map) {
            $scope.map = map;
            $scope.marker = map.markers[0];
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
                    var mappedSub = $scope.pickSuburbs.find(obj => obj.text === locn.Address.District || obj.alias === locn.Address.District);
                    if (mappedSub !== undefined) {
                        console.log(mappedSub);
                        $('#our_suburb').val(mappedSub.id).trigger('change');
                    }
                    else {
                        $('#our_suburb').val(null).trigger('change');
                    }


                    $scope.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                    $scope.gpsForm.data.long = locn.DisplayPosition.Longitude;
                    $scope.gpsForm.data.address = locn.Address.HouseNumber + " " + locn.Address.Street;
                    var ll = new google.maps.LatLng(locn.DisplayPosition.Latitude, locn.DisplayPosition.Longitude);
                    $scope.map.setCenter(ll);
                    $scope.marker.setPosition(ll);

                });
            });

            var suburbOptions = {
                minimumInputLength: 1,
                data: $scope.pickSuburbs
            };

            $("#our_suburb").select2(suburbOptions);

        };

        //$scope.onMapReady();


        $scope.setSplitJobMeetingPoint = function () {

            var lat;
            var long;
            var q;
            if ($scope.currentJob.deliveryLongitude) {

                lat = $scope.currentJob.deliveryLatitude;
                long = $scope.currentJob.deliveryLongitude;
                q = $("#gpsMap").attr("data-src") + lat + "," + long;
            } else {
                lat = "";
                long = "";
                q = $("#gpsMap").attr("data-src") + encodeURIComponent($scope.currentJob.toAddress);
            }

            console.log($scope.currentJob.pickupLatitude);
            console.log(q);
            $("#gpsMap").attr("src", q);

            $scope.gpsForm = {
                "data": {
                    "address": $scope.currentJob.toAddress,
                    "lat": lat,
                    "long": long
                },
                submit: function (location) {

                    var job = $scope.currentJob;
                    if ($scope.gpsForm.data.our_suburb === undefined) {
                        alert("You must pick one of our suburbs to map this address to");
                        return $scope.gpsFormPromise;
                    }

                    job.toAddress = $scope.gpsForm.data.address;
                    job.toSuburbID = parseInt($scope.gpsForm.data.our_suburb);
                    var callData = {
                        "call": "updateSplitJobData",
                        "lat": $scope.gpsForm.data.lat,
                        "long": $scope.gpsForm.data.long,
                        "toSuburbId": job.toSuburbID,
                        "toAddress": job.toAddress,
                        "jobID": $scope.currentJob.id
                    };
                    //TODO
                    DispatchData.updateSplitJobAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long).then(function (response) {
                        DispatchData.reRateJobData(callData.jobID).then(function (response) {

                        });
                    });
                    //Set Toaddress/tosuburb/togps of Child Job 1
                    //Set Fromaddress/Fromsuburb/Fromgps of Child Job 2
                    // Rate Split Jobs Parent STP
                    //DES_stpJob_ColsolidateMarsInformation
                    //DES_stpJob_DisplayInDespatch parentJobID
                    //Close Form and Refresh, scroll to child jobs



                },
                cancel: function () {
                    $(".gpsForm").hide(0);
                },
                placeChanged: function (place) {
                    if (place !== null) {
                        $scope.place = place;
                    } else {
                        $scope.place = this.getPlace();
                    }

                    $scope.gpsForm.address = $scope.place.formatted_address;
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
                    //GeoCoder.geocode({ location: latlng })
                    //    .then(function (result) {
                    //        $scope.marker.setPosition(latlng);
                    //        $scope.gpsForm.placeChanged(result[0]);
                    //    });
                },
                markerDragend: function () {
                    //Geo coder for drag marker
                    var location = $scope.marker.getPosition();
                    $.getJSON("https://reverse.geocoder.api.here.com/6.2/reversegeocode.json", {
                        app_id: "bBPfh2x8Cauun3ygLMAx",
                        app_code: "yjfwTdkin_R2rGXYTrwWVg",
                        mode: "retrieveAddresses",
                        prox: location.lat().toString() + "," + location.lng().toString() + "," + "250"
                    }).done(function (data) {
                        var locn = data.Response.View[0].Result[0].Location;
                        $scope.gpsForm.data.address = locn.Address.Label;
                        console.log("Suburb = " + locn.Address.District);
                        console.log("PostCode = " + locn.Address.PostalCode);
                        $("#suburb").val(locn.Address.District);
                        var mappedSub = $scope.pickSuburbs.find(obj => obj.text === locn.Address.District || obj.alias === locn.Address.District);
                        if (mappedSub !== undefined) {
                            console.log(mappedSub);
                            $('#our_suburb').val(mappedSub.id).trigger('change');
                        }
                        else {
                            $('#our_suburb').val(null).trigger('change');
                        }


                        $scope.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                        $scope.gpsForm.data.long = locn.DisplayPosition.Longitude;
                    });

                }
            };



            $(".gpsForm").show(0, function () {
                $scope.onMapReady();
                //var auckland = { lat: -36.8804466, lng: 174.6117981 };
                //$scope.heremaps.setCenter(auckland);
                $scope.markers = [];
                //$scope.heremaps.updateMarkers($scope.markers, true);
                //$scope.heremaps.refresh();
                //$scope.heremaps.setZoom(10);
                setTimeout(function () {
                    $('#location').select2('open');
                    var search = $('#location').data('select2').dropdown.$search;
                    if ($scope.gpsForm.data.address.indexOf(',') > 0) {
                        search.val($scope.gpsForm.data.address.split(',')[1].split());
                    } else {
                        search.val($scope.gpsForm.data.address);
                    }
                    search.trigger("input");
                }, 200);

            });



            $scope.copyGpsAddress = function () {
                $('#location').select2('open');
                var search = $('#location').data('select2').dropdown.$search;
                if ($scope.gpsForm.data.address.indexOf(',') > 0) {
                    search.val($scope.gpsForm.data.address.split(',')[1].split());
                } else {
                    search.val($scope.gpsForm.data.address);
                }
                search.trigger("input");
            };


        };

        $scope.updateGPS = function (field) {

            var lat;
            var long;
            var q;
            if (field === "toAddress") {


                if ($scope.currentJob.deliveryLongitude) {

                    lat = $scope.currentJob.deliveryLatitude;
                    long = $scope.currentJob.deliveryLongitude;
                    q = $("#gpsMap").attr("data-src") + lat + "," + long;
                } else {
                    lat = "";
                    long = "";
                    q = $("#gpsMap").attr("data-src") + encodeURIComponent($scope.currentJob.toAddress);
                }
            } else {

                if ($scope.currentJob.PickUpLongitude) {
                    lat = $scope.currentJob.pickUpLatitude;
                    long = $scope.currentJob.pickUpLongitude;
                    q = $("#gpsMap").attr("data-src") + lat + "," + long;
                } else {
                    lat = "";
                    long = "";
                    q = $("#gpsMap").attr("data-src") + encodeURIComponent($scope.currentJob.fromAddress);
                }
            }

            console.log($scope.currentJob.pickupLatitude);
            console.log(q);
            $("#gpsMap").attr("src", q);

            $scope.gpsForm = {
                "data": {
                    "address": $scope.currentJob[field],
                    "lat": lat,
                    "long": long
                },
                submit: function (location) {

                    var job = $scope.currentJob;
                    if ($scope.gpsForm.data.our_suburb === undefined) {
                        alert("You must pick one of our suburbs to map this address to");
                        return $scope.gpsFormPromise;
                    }

                    if (field === "toAddress") {
                        job.toAddress = $scope.gpsForm.data.address;
                        if (job.toSuburbID.toString() !== $scope.gpsForm.data.our_suburb) {
                            //ToDo create change event
                            DispatchData.addPriceSuburbChangeEvent(job.jobNo, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
                        }
                        job.toSuburbID = parseInt($scope.gpsForm.data.our_suburb);
                    }
                    else {
                        job.fromAddress = $scope.gpsForm.data.address;
                        if (job.fromSuburbID.toString() !== $scope.gpsForm.data.our_suburb) {
                            //ToDo create change event
                            DispatchData.addPriceSuburbChangeEvent(job.jobNo, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
                        }
                        job.fromSuburbID = parseInt($scope.gpsForm.data.our_suburb);
                    }
                    var pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 || job.fromSuburbID === 112 && job.toSuburbID === 112 || job.fromSuburbID === 480 && job.toSuburbID === 480;


                    //ToDo - set ucjbCBD true??
                    if (job.size.id === 4 && (job.speedID === 41 || job.speedID === 42 || job.speedID === 43 || job.speedID === 44 || job.speedID === 46 || job.speedID === 51 || job.speedID === 52)) {
                        //Truck Job
                        return DispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(function (itemSummary) {
                            DispatchData.rateTruckJob(job.clientID, job.fromSuburbID, job.toSuburbID, itemSummary.weight, job.size.id, job.speedID, itemSummary.quantity, job.booked, itemSummary.pickUp, itemSummary.dropOff,
                                job.privateRes, itemSummary.overSize, itemSummary.overWeight, itemSummary.dgClass, job.truckStartTime || moment().format("YYYY-MM-DDThh:mm:ss"), job.truckHours || 2).then(function (truckRate) {
                                    console.log(truckRate);
                                    if (truckRate !== job.charge) {
                                        DispatchData.addPriceSuburbChangeEvent(job.jobNo, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
                                    }

                                    var callData = {
                                        "call": "updateJobData",
                                        "addressField": field,
                                        "lat": $scope.gpsForm.data.lat,
                                        "long": $scope.gpsForm.data.long,
                                        "fromSuburbId": job.fromSuburbID,
                                        "toSuburbId": job.toSuburbID,
                                        "fromAddress": job.fromAddress,
                                        "toAddress": job.toAddress,
                                        "rate": truckRate,
                                        "jobID": $scope.currentJob.id,
                                        "CBD": pedal
                                    };
                                    console.log(callData);
                                    if (field === "toAddress") {
                                        return DispatchData.updateDeliveryAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long, callData.CBD, Number(callData.rate.replace(/[^0-9.-]+/g, ""))).then(function () {
                                            $(".gpsForm").hide(0);
                                            var j = $scope.currentJob;
                                            $scope.getData().then(function () {
                                                var refreshedJob = $scope.jobList.find(jo => jo.id === j.id);
                                                $scope.selectJob(refreshedJob);
                                                $timeout(function () {
                                                    $("#jobList tr[data-jobid='" + j.id + "']").addClass("active");

                                                    var $parentDiv = $("#jobList tr[data-jobid='" + j.id + "']").parents(".box-content");
                                                    var goTop = $("#jobList tr[data-jobid='" + j.id + "']").offset().top;


                                                    try {
                                                        goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 28;
                                                        $parentDiv.scrollTop(goTop);

                                                    } catch (e) {
                                                        //ignore
                                                    }
                                                }, 1000);
                                            });

                                        });
                                    }
                                });
                        });


                    }
                    else {
                        return DispatchData.rateJob(job.clientID, job.fromSuburbID, job.toSuburbID, job.speedID, pedal, job.van, job.return, job.weight, job.size.id, true, job.direct, job.acceptedJobTypeID,
                            job.ourRef || '', job.refA || '', job.refB || '', job.items, job.booked).then(function (rate) {
                                console.log(rate);
                                if (rate !== job.charge) {
                                    DispatchData.addPriceSuburbChangeEvent(job.jobNo, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
                                }

                                var callData = {
                                    "call": "updateJobData",
                                    "addressField": field,
                                    "lat": $scope.gpsForm.data.lat,
                                    "long": $scope.gpsForm.data.long,
                                    "fromSuburbId": job.fromSuburbID,
                                    "toSuburbId": job.toSuburbID,
                                    "fromAddress": job.fromAddress,
                                    "toAddress": job.toAddress,
                                    "rate": rate,
                                    "jobID": $scope.currentJob.id,
                                    "CBD": pedal
                                };
                                console.log(callData);
                                if (field === "toAddress") {
                                    return DispatchData.updateDeliveryAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long, callData.CBD, Number(callData.rate.replace(/[^0-9.-]+/g, ""))).then(function () {
                                        $(".gpsForm").hide(0);
                                        var j = $scope.currentJob;
                                        $scope.getData().then(function () {
                                            var refreshedJob = $scope.jobList.find(jo => jo.id === j.id);
                                            $scope.selectJob(refreshedJob);
                                            $timeout(function () {
                                                $("#jobList tr[data-jobid='" + j.id + "']").addClass("active");

                                                var $parentDiv = $("#jobList tr[data-jobid='" + j.id + "']").parents(".box-content");
                                                var goTop = $("#jobList tr[data-jobid='" + j.id + "']").offset().top;


                                                try {
                                                    goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 28;
                                                    $parentDiv.scrollTop(goTop);

                                                } catch (e) {
                                                    //ignore
                                                }
                                            }, 1000);
                                        });
                                    });
                                }

                            });

                    }




                },
                cancel: function () {
                    $(".gpsForm").hide(0);
                },
                placeChanged: function (place) {
                    if (place !== null) {
                        $scope.place = place;
                    } else {
                        $scope.place = this.getPlace();
                    }

                    $scope.gpsForm.address = $scope.place.formatted_address;
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
                    //GeoCoder.geocode({ location: latlng })
                    //    .then(function (result) {
                    //        $scope.marker.setPosition(latlng);
                    //        $scope.gpsForm.placeChanged(result[0]);
                    //    });
                },
                markerDragend: function () {
                    //Geo coder for drag marker
                    var location = $scope.marker.getPosition();
                    $.getJSON("https://reverse.geocoder.api.here.com/6.2/reversegeocode.json", {
                        app_id: "bBPfh2x8Cauun3ygLMAx",
                        app_code: "yjfwTdkin_R2rGXYTrwWVg",
                        mode: "retrieveAddresses",
                        prox: location.lat().toString() + "," + location.lng().toString() + "," + "250"
                    }).done(function (data) {
                        var locn = data.Response.View[0].Result[0].Location;
                        $scope.gpsForm.data.address = locn.Address.Label;
                        console.log("Suburb = " + locn.Address.District);
                        console.log("PostCode = " + locn.Address.PostalCode);
                        $("#suburb").val(locn.Address.District);
                        var mappedSub = $scope.pickSuburbs.find(obj => obj.text === locn.Address.District || obj.alias === locn.Address.District);
                        if (mappedSub !== undefined) {
                            console.log(mappedSub);
                            $('#our_suburb').val(mappedSub.id).trigger('change');
                        }
                        else {
                            $('#our_suburb').val(null).trigger('change');
                        }


                        $scope.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                        $scope.gpsForm.data.long = locn.DisplayPosition.Longitude;
                    });

                }
            };



            $(".gpsForm").show(0, function () {
                $scope.onMapReady();
                //var auckland = { lat: -36.8804466, lng: 174.6117981 };
                //$scope.heremaps.setCenter(auckland);
                $scope.markers = [];
                //$scope.heremaps.updateMarkers($scope.markers, true);
                //$scope.heremaps.refresh();
                //$scope.heremaps.setZoom(10);
                setTimeout(function () {
                    $('#location').select2('open');
                    var search = $('#location').data('select2').dropdown.$search;
                    if ($scope.gpsForm.data.address.indexOf(',') > 0) {
                        search.val($scope.gpsForm.data.address.split(',')[1].split());
                    } else {
                        search.val($scope.gpsForm.data.address);
                    }
                    search.trigger("input");
                }, 200);

            });



            $scope.copyGpsAddress = function () {
                $('#location').select2('open');
                var search = $('#location').data('select2').dropdown.$search;
                if ($scope.gpsForm.data.address.indexOf(',') > 0) {
                    search.val($scope.gpsForm.data.address.split(',')[1].split());
                } else {
                    search.val($scope.gpsForm.data.address);
                }
                search.trigger("input");
            };


        };


        $scope.editDetailField = function (fieldName, label, value, jobID, type, options) {

            if (type === "time" || type === "date") {

                if (!(value instanceof Date)) {
                    value = new Date(value);
                }


            }


            $scope.gather.form = {
                id: "editField",
                title: (fieldName === "Notes" ? "Add " : "Edit ") + label,
                fields: [
                    {
                        "name": fieldName,
                        "label": label + "...",
                        "value": value,
                        "jobID": jobID,
                        "type": type,
                        "options": options
                    }
                ],
                onSubmit: function () {
                    var job = $scope.currentJob;
                    var pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 || job.fromSuburbID === 112 && job.toSuburbID === 112 || job.fromSuburbID === 480 && job.toSuburbID === 480;
                    var callData = {
                        "call": "updateDetailField",
                        "field": $scope.gather.form.fields[0].name,
                        "value": $scope.gather.form.fields[0].value,
                        "jobID": $scope.gather.form.fields[0].jobID
                    };

                    if (callData.field === "Notes") {
                        return DispatchData.addNote(job.id, callData.value, FirstName);
                    }

                    if (fieldName === "Size") {
                        callData.value = $scope.gather.form.fields[0].value.id;
                    }
                    if (fieldName === "Size") {
                        job[callData.field.toLowerCase()] = $scope.gather.form.fields[0].value;
                    } else {
                        job[callData.field.toLowerCase()] = callData.value;
                    }
                    if (job.size.id === 4 && (job.speedID === 41 || job.speedID === 42 || job.speedID === 43 || job.speedID === 44 || job.speedID === 46 || job.speedID === 51 || job.speedID === 52)) {
                        //Truck Job
                        return DispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(function (itemSummary) {
                            DispatchData.rateTruckJob(job.clientID, job.fromSuburbID, job.toSuburbID, itemSummary.weight, job.size.id, job.speedID, itemSummary.quantity, job.booked, itemSummary.pickUp, itemSummary.dropOff,
                                job.privateRes, itemSummary.overSize, itemSummary.overWeight, itemSummary.dgClass, job.truckStartTime || moment().format("YYYY-MM-DDThh:mm:ss"), job.truckHours || 2).then(function (truckRate) {
                                    console.log(truckRate);
                                    if (truckRate !== job.charge) {
                                        DispatchData.addPriceSuburbChangeEvent(job.jobNo, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
                                    }
                                    return DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, Number(truckRate.replace(/[^0-9.-]+/g, ""))).then(function (response) {
                                        if (response.data === "OK") {
                                            if (fieldName === "Size") {
                                                $scope.currentJob[callData.field.toLowerCase()] = $scope.gather.form.fields[0].value;
                                            } else {
                                                $scope.currentJob[callData.field.toLowerCase()] = callData.value;
                                            }


                                        }
                                        return response;
                                    });
                                });
                        });
                    }
                    else {
                        return DispatchData.rateJob(job.clientID, job.fromSuburbID, job.toSuburbID, job.speedID, pedal, job.van, job.return, job.weight, job.size.id, true, job.direct, job.acceptedJobTypeID,
                            job.ourRef || '', job.refA || '', job.refB || '', job.items, job.booked).then(function (rate) {
                                console.log(rate);
                                if (rate !== job.charge) {
                                    DispatchData.addPriceSuburbChangeEvent(job.jobNo, job.clientID, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
                                }
                                return DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, Number(rate.replace(/[^0-9.-]+/g, ""))).then(function (response) {
                                    if (response.data === "OK") {
                                        if (fieldName === "Size") {
                                            $scope.currentJob[callData.field.toLowerCase()] = $scope.gather.form.fields[0].value;
                                        } else {
                                            $scope.currentJob[callData.field.toLowerCase()] = callData.value;
                                        }


                                    }
                                    return response;
                                });
                            });
                    }


                    //$scope.updateDetailField($scope.gather.form.fields[0].jobID, $scope.gather.form.fields[0].name, $scope.gather.form.fields[0].value);

                },
                submitValue: "Update Field"
            };
            $scope.gather.showForm();

        };


        $scope.addEvent = function () {

            var time = new Date();
            time.setSeconds(0);
            time.setMilliseconds(0);

            $scope.eventForm = {
                "data": {
                    "jobNum": $scope.currentJob.JobNo,
                    "client": $scope.currentJob.Client,
                    "date": new Date(),
                    "time": time
                },
                submit: function () {

                },
                cancel: function () {
                    $(".eventForm").hide(0);
                }
            };

            $(".eventForm").show(0);


        };

    }]);


