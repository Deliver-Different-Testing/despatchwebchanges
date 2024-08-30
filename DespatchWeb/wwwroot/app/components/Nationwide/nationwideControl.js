function NationwideController($scope, jdSvc, NWData, $state,
                              $filter, $parse, hotkeys, NgMap, $q, $timeout, greetingService,
                              $mdDialog, $document, $window, toastrService, DispatchData, moment) {
    const ctrl = this;

    $scope.isInternal = (ClientInternal === "True");
    ctrl.jdSvc = jdSvc;
    $scope.name = "Nationwide";
    ctrl.jobDetailFabIsOpen = false;
    ctrl.courierListFabIsOpen = false;

    ctrl.greetUser = function () {
        return greetingService.greetUser($scope.userName);
    }

    $scope.updateGPS = function (currentJob, field, fromRightClick) {
        ctrl.jdSvc.updateGPS(currentJob, field, fromRightClick);
    };

    jdSvc.setSelectJobDetail(function () {
        const j = ctrl.currentJob;
        jdSvc.setJob(ctrl.currentJob);
        $scope.getData().then(() => {
            if (j === null || j === undefined || j === false) {
                return;
            }

            let refreshedJob = $scope.jobList.find(jo => jo.id === j.id);
            if (refreshedJob) {
                $scope.selectJob(refreshedJob);
                $timeout(() => {
                        angular.element(`#jobList tr[data-jobid='${j.id}']`).addClass("active");

                        const parentDiv = angular.element(`#jobList tr[data-jobid='${j.id}'].box-content`);
                        let goTop = angular.element(`#jobList tr[data-jobid='${j.id}']`).prop('offsetTop');

                        try {
                            goTop = goTop - parentDiv.prop('offsetTop') + parentDiv.prop('scrollTop') - 28;
                            parentDiv.prop('scrollTop', goTop);

                        } catch (e) {
                            //ignore
                        }
                    },
                    1000);
            } else {
                refreshedJob = $scope.jobListDelivery.find(jo => jo.id === j.id);
                if (refreshedJob) {
                    $scope.selectJob(refreshedJob);
                    $timeout(() => {
                            angular.element(`#jobListDelivery tr[data-jobid='${j.id}']`).addClass("active");

                            const parentDiv = angular.element(`#jobListDelivery tr[data-jobid='${j.id}'].box-content`);
                            let goTop = angular.element(`#jobListDelivery tr[data-jobid='${j.id}']`).prop('offsetTop');

                            try {
                                goTop = goTop - parentDiv.prop('offsetTop') + parentDiv.prop('scrollTop') - 28;
                                parentDiv.prop('scrollTop', goTop);

                            } catch (e) {
                                //ignore
                            }
                        },
                        1000);
                } else {
                    refreshedJob = $scope.jobListPOD.find(jo => jo.id === j.id);
                    if (refreshedJob) {
                        $scope.selectJob(refreshedJob);
                        $timeout(function () {
                                angular.element(`#jobListPOD tr[data-jobid='${j.id}']`).addClass("active");

                                const parentDiv = angular.element(`#jobListPOD tr[data-jobid='${j.id}'].box-content`);
                                let goTop = angular.element(`#jobListPOD tr[data-jobid='${j.id}']`).prop('offsetTop');

                                try {
                                    goTop = goTop - parentDiv.prop('offsetTop') + parentDiv.prop('scrollTop') - 28;
                                    parentDiv.prop('scrollTop', goTop);

                                } catch (e) {
                                    //ignore
                                }
                            },
                            1000);
                    } else {
                        refreshedJob = $scope.jobListReprice.find(jo => jo.id === j.id);
                        if (refreshedJob) {
                            $scope.selectJob(refreshedJob);
                            $timeout(function () {
                                    angular.element(`#jobListReprice tr[data-jobid='${j.id}']`).addClass("active");

                                    const parentDiv = angular.element(`#jobListReprice tr[data-jobid='${j.id}'].box-content`);
                                    let goTop = angular.element(`#jobListReprice tr[data-jobid='${j.id}']`).prop('offsetTop');

                                    try {
                                        goTop = goTop - parentDiv.prop('offsetTop') + parentDiv.prop('scrollTop') - 28;
                                        parentDiv.prop('scrollTop', goTop);

                                    } catch (e) {
                                        //ignore
                                    }
                                },
                                1000);
                        }
                    }
                }
            }
        });
    });

    ctrl.jobRecordSearchText = "";

    /**
     * @param {string} searchText
     */
    ctrl.jobRecordSearch = searchText => {
        return $scope.jobList
            .filter(job => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
            .map(job => ({id: job.id, text: job.jobNo}));
    }

    /**
     * @param {number} selectedJobId
     */
    ctrl.JobRecordSelected = selectedJobId => {
        const selectedJob = $scope.jobList.find(job => job.id === selectedJobId);
        $scope.selectJob(selectedJob);
    }


    $scope.gather = {
        submit: function () {
            return $scope.gather.form.onSubmit().then(function (response) {
                //console.log("pointer 3");

                angular.element('.gatherForm').css('display', 'none');
                //var j = self.currentJob;
                $scope.getData().then(function () {
                    //if (j === null || j === undefined || j === false) {
                    //    return;
                    //}

                    //var refreshedJob = $scope.jobList.find(jo => jo.id === j.id);
                    //$scope.selectJob(refreshedJob);
                    //$timeout(function () {
                    //    angular.element("#jobList tr[data-jobid='" + j.id + "']").addClass("active");

                    //    var $parentDiv = angular.element("#jobList tr[data-jobid='" + j.id + "']").parents(".box-content");
                    //    var goTop = angular.element("#jobList tr[data-jobid='" + j.id + "']").offset().top;


                    //    try {
                    //        goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 28;
                    //        $parentDiv.scrollTop(goTop);

                    //    } catch (e) {
                    //        //ignore
                    //    }
                    //}, 1000);

                });

            });

        },
        cancel: function () {
            angular.element('.gatherForm').css('display', 'none');
        },
        showForm: function () {
            angular.element(".gatherForm").show(0,
                () => {
                    $timeout(() => {
                        angular.element(".gatherForm .focusMe").focus();
                    }, 100);
                });
        },
        submitValue: "Save",
        cancelValue: "Cancel"
    };

    ctrl.jdSvc.setGather($scope.gather);
    $scope.allCouriers = {display: false, includeUA: false};
    $scope.mapZoom = {display: true};

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
    $scope.markers = [];
    $scope.truckCourierStatus = [];
    $scope.getJobStyle = function (assigned) {
        const normal =
            {
                "font-weight": "normal"

            }, bold =
            {
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
            "title": "New Jobs",
            "tpl": "app/components/Nationwide/tpls/jobList.tpl?v3.1",
            "showSearch": 1,
            "showRefresh": 1
        },
        "jobsListPOD": {
            "title": "Awaiting POD",
            "tpl": "app/components/Nationwide/tpls/jobListPOD.tpl?v3.1",
            "showSearch": 1,
            "showRefresh": 1
        },
        "jobsListDelivery": {
            "title": "Book Delivery",
            "tpl": "app/components/Nationwide/tpls/jobListDelivery.tpl?v3.1",
            "showSearch": 1,
            "showRefresh": 1
        },
        "jobsListReprice": {
            "title": "Reprice",
            "tpl": "app/components/Nationwide/tpls/jobListReprice.tpl?v3.1",
            "showSearch": 1,
            "showRefresh": 1
        },
        "jobDetail": {
            "title": "Detail",
            "tpl": "app/components/common/tpls/jobDetail.tpl?v3.1",
            "showSearch": 0,
            "showRefresh": 0,
            "showDetailButtons": 1
        },
        "potentialCouriers": {
            "title": "Potential Couriers",
            "tpl": "app/components/home/tpls/potentialCouriers.tpl?v3.1",
            "showSearch": 1
        },
        "currentWork": {
            "title": "Current Work",
            "tpl": "app/components/home/tpls/currentWork.tpl?v3.1",
            "showSearch": 1,
            "showRefresh": 0
        },
        "couriersMoveThrough": {
            "title": "Couriers Movement Through List",
            "tpl": "app/components/home/tpls/couriersMovementThroughList.tpl?v3.1",
            "showSearch": 1,
            "showRefresh": 0
        },
        "courierMovePickedUp": {
            "title": "Couriers Movement Picked Up Run",
            "tpl": "app/components/home/tpls/couriersMovementPickedUp.tpl?v3.1",
            "showSearch": 1,
            "showRefresh": 0
        },
        "courierMoveClear": {
            "title": "Couriers Movement Clear List",
            "tpl": "app/components/home/tpls/couriersMovementClearList.tpl?v3.1",
            "showSearch": 1,
            "showRefresh": 0
        },
        "areaList": {
            "title": "Area List",
            "tpl": "app/components/home/tpls/areaList.tpl?v3.1",
            "showSearch": 0,
            "showRefresh": 0
        },
        "jobUpdates": {
            "title": "Job Updates",
            "tpl": "app/components/home/tpls/jobUpdates.tpl?v3.1",
            "showSearch": 0,
            "showRefresh": 0
        },
        "supports": {
            "title": "Supports",
            "tpl": "app/components/home/tpls/supports.tpl?v3.1",
            "showSearch": 0,
            "showRefresh": 0
        },
        "lateCalls": {
            "title": "Late Calls",
            "tpl": "app/components/home/tpls/lateCalls.tpl?v3.1",
            "showSearch": 0,
            "showRefresh": 0
        },
        "map": {
            "title": "Google Map",
            "tpl": "app/components/Nationwide/tpls/map.tpl?v3.1",
            "showSearch": 0,
            "showRefresh": 1
        },
        "clearLists": {
            "title": "Clear Lists",
            "tpl": "app/components/home/tpls/clearLists.tpl?v3.1",
            "showSearch": 0,
            "showRefresh": 0
        }
    };
    $scope.pickService = {
        "clients": [],
        "settings": {
            "enableSearch": true,
            "selectedToTop": true,
            "closeOnBlur": true,
            "closeOnSelect": true,
            "buttonClasses": "topBarActive btn-sm btn-clients"
        }
    };
    $scope.pickClients = [];
    $scope.pickEventTypes = [];

    ///////////////////////////////
    // LAYOUT
    ///////////////////////////////
    var layoutsObject = null;
    if (Modernizr.localstorage) {
        layoutsObject = JSON.parse(localStorage.getItem("layoutsNW-" + ContactID));
        $scope.mapZoom = JSON.parse(localStorage.getItem("mapZoomNW-" + ContactID)) || {display: true};
    }
    var defaultLayout = [
        {
            name: "Default",
            layout: {
                "columns": [
                    {
                        "id": "col1",
                        "width": "800px",
                        "boxes": [
                            {
                                "name": "jobsList",
                                "height": "500px"
                            },
                            {
                                "name": "jobsListPOD"
                            }

                        ]
                    },
                    {
                        "id": "col2",
                        "width": "800px",
                        "boxes": [
                            {
                                "name": "jobsListDelivery",
                                "height": "500px"
                            },
                            {
                                "name": "jobsListReprice"
                            }
                        ]
                    },
                    {
                        "id": "col3",
                        "width": "600px",
                        "boxes": [
                            {
                                "name": "jobDetail",
                                "height": "500px"
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

    ctrl.layouts = layoutsObject || defaultLayout;
    $scope.userName = FirstName;
    ctrl.currentLayoutName = "default";
    $scope.truckMode = "On";
    $scope.supportChannel = "All";

    $scope.groupJobsSelection = "";
    $scope.currentWorkSelection = "";
    $scope.potentialCouriersSelection = "";

    ctrl.storeMapZoomDisplay = function () {
        if (Modernizr.localstorage) {
            localStorage.setItem("mapZoomNW-" + ContactID, JSON.stringify($scope.mapZoom));
        }
    }

    ctrl.layout = angular.copy(ctrl.layouts[0].layout);

    ctrl.deleteLayout = function (index) {
        const deleteConfirm = $mdDialog.confirm()
            .title('Delete Layout?')
            .textContent('Are you sure you would like to delete this layout?')
            .ariaLabel('delete layout')
            .ok('Delete')
            .cancel('Cancel');

        $mdDialog.show(deleteConfirm).then(() => {
            ctrl.layouts.splice(index, 1);
            if (Modernizr.localstorage) {
                localStorage.setItem("layoutsNW-" + ContactID, JSON.stringify(ctrl.layouts));
            }
        }, () => {
            console.log("Delete layout canceled!");
        });
    }

    $scope.setLastActiveLayoutName = function (layoutName) {
        if (Modernizr.localstorage) {
            localStorage.setItem("lastActiveLayoutNW-" + ContactID, layoutName);
        }
    };

    ctrl.loadLayout = function (i) {
        ctrl.currentLayoutName = ctrl.layouts[i].name;
        ctrl.layout = angular.copy(ctrl.layouts[i].layout);

        // save layout as last active
        $scope.setLastActiveLayoutName(ctrl.currentLayoutName);

        $timeout($scope.getData, 1000);
    };

    ctrl.saveLayout = function () {
        angular.forEach(ctrl.layout.columns,
            (column, colKey) => {
                column.width = angular.element("#co-" + column.id).css("flex-basis");
                angular.forEach(column.boxes,
                    function (box, boxKey) {
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
                ctrl.layouts = ctrl.layouts.concat(
                    {
                        name: layoutName,
                        layout: angular.copy(ctrl.layout)
                    });
                localStorage.setItem("layoutsNW-" + ContactID, JSON.stringify(ctrl.layouts));

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

    $scope.attention = function (job) {

        var temp = "";

        if (job.direct) {
            temp += "DIRECT ";
        }
        //else {
        //    if (job.speedID !== job.notifiedJobTypeID && job.notifiedJobTypeID !== -1) {
        //        temp += "ASAP ";
        //    }
        //}
        if (job.van) {
            temp += "VAN ";
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
        activate: function (e, ui) {
            var box = angular.element("#" + ui.item.context.id);
            var parent = box.parent();
            parent.find(".box").each(function () {
                angular.element(this).attr("data-height", angular.element(this).height() + "px");
            });
        },
        update: function (e, ui) {
            $timeout(function () {
                var box = angular.element("#" + ui.item.context.id);
                var parent = box.parent();
                parent.find(".box").each(function () {
                    angular.element(this).css({"flex-basis": angular.element(this).attr("data-height")});
                });
                parent.find(".box").last().css({"flex-basis": "0"});
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
        const boxID = boxName + '-' + index;
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
                angular.element(".chat").animate({"width": "31px"}, 500);
            });
        } else {
            angular.element(".chat").animate({"width": "250px"}, 500, function () {
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
        callback: function () {
            if (angular.element(".activeTable .active").length > 0) {
                $scope.dispatchJobsForm();
            }
        }
    });

    hotkeys.add({
        combo: "esc",
        description: "Close gather screen",
        allowIn: ["INPUT", "SELECT", "TEXTAREA"],
        callback: function (event, hk) {
            angular.element('.gatherForm').css('display', 'none');
            angular.element(".eventForm").hide();
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
            if (angular.element(".gatherForm").is(":visible") === true) {
                $timeout($scope.gather.submit(), 0);
            }
            if (event.srcElement.id === "gps") {
                $scope.searchCourier(event.srcElement.value);
            }
        }
    });

    ctrl.unlockJob = function () {
        return ctrl.jdSvc
            .unlockJob(ctrl.currentJob);

    };

    ctrl.lockJob = function () {
        return ctrl.jdSvc
            .lockJob(ctrl.currentJob);

    };

    $scope.selectClearList = function (id, event, area) {
        angular.element("#area-group .btn").removeClass("topBarActive");
        angular.element(".clearLists-list-title").removeClass("listActive");
        angular.element(event.currentTarget).addClass("listActive");
        $scope.getClearListEnvelope(id);
        $scope.setFilters({'area': area});
    };

    $scope.selectForDispatch = function (job) {
        console.log("In SelectForDispatch");
        $scope.jobForDispatch = job;
    };


    $scope.voidJobForm = function (jobNumber, jobId) {
        $scope.gather.form = {
            id: "voidJob",
            title: `Void Job ${jobNumber}?`,
            fields: [
                {
                    "name": "notes",
                    "label": "Add Note...",
                    "type": "textarea",
                    "value": ""
                }
            ],
            onSubmit: function () {
                return NWData.addNote(jobId, $scope.gather.form.fields[0].value, FirstName, false).then(function () {
                    return NWData.voidJob(jobId);

                });
            },
            submitValue: "Confirm"
        };
        $scope.gather.showForm();

    };

    $scope.sendSMS = function (courierId, message) {
        return NWData.sendSMS(courierId, ContactID, FirstName, message);
    };

    $scope.otherEventForm = function (jobNumber) {

        var time = new Date();
        time.setSeconds(0);
        time.setMilliseconds(0);

        $scope.eventForm = {
            "data": {
                "jobNum": ctrl.currentJob.jobNo,
                "client": ctrl.currentJob.client,
                "event": "Other",
                "date": new Date(),
                "time": time
            },
            submit: function () {
                return NWData.addOtherEvent(ctrl.currentJob.jobNo, ctrl.currentJob.clientID, ctrl.currentJob.contactName, ContactID, ctrl.currentJob.courierData.courierID, ctrl.currentJob.id, ctrl.currentJob.jobType, FirstName, $scope.eventForm.data.notes).then(function () {
                    angular.element(".eventForm").hide();
                });
            },
            cancel: function () {
                angular.element(".eventForm").hide(0);
            }
        };

        angular.element(".eventForm").show(0);


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
    }

    $scope.getStatusClass = function (job) {
        //[txtJobDone].[Value] = 0 And[txtFollowupTime].[Value] < Now() And[ucjbSpeed] In(6, 7, 21)
        var n = new Date();
        if (!job.done && Date.parse(job.followupTime) < n && (job.speedID === 6 || job.speedID === 7 || job.speedID === 21)) {
            return "O";
        }
        //[txtJobDone].[Value]=0 And [txtFollowupTime].[Value]<Now() And [ucjbSpeed] In (11,23)
        else if (!job.done && Date.parse(job.followupTime) < n && (job.speedID === 11 || job.speedID === 23)) {
            return "B";
        }
        //[txtJobDone].[Value]=0 And [txtFollowupTime].[Value]<Now()
        else if (!job.done && Date.parse(job.followupTime) < n) {
            return "G";
        } else return "";
    }

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
                return $scope.dispatchJobs(angular.element("#gather-courierNumber").val());
            },
            submitValue: "Dispatch"
        };
        $scope.gather.showForm();

    };

    $scope.dispatchDroppedMarkerToClosestCourier = function (lat, lng, flags, carMarker, jobNumber) {
        if (flags.length === 0 && carMarker === null) {
            $scope.showConfirm = function () {
                const confirm = $mdDialog.confirm()
                    .title('Dispatch Invalid')
                    .textContent('Could not find courier for Dispatch')
                    .ok('Close')
                    .cancel('Cancel');

                $mdDialog.show(confirm).then(() => {
                    const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                    displayPickupPoints(unDispatchedData, true, null);
                    ctrl.getAvailableCourierLocation();
                }, () => {
                    // This will be executed if the user cancels the dialog.
                    // Handle the cancel action here
                });
            };
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
        var foundCourier = $scope.pickCouriers.find(c => c.courierID === closestCourier.courierId);

        var dispTo = closestCourier.code;
        if (closestIndex[0] !== 9999) {
            if (foundCourier !== undefined) {
                if (foundCourier.code === undefined) {
                    dispTo = foundCourier.label;
                } else {
                    dispTo = dispTo + ' ' + foundCourier.code;
                }

            }
        }

        let dialog = $mdDialog.confirm()
            .title('Dispatch Job ' + jobNumber)
            .textContent('Dispatch to <strong>' + dispTo + '</strong>?')
            .ok('Yes')
            .cancel('No');

        $mdDialog.show(dialog).then(() => {
            let j = $scope.jobList.find(jo => jo.jobNo === jobNumber);
            const jn = j.jobNo;

            if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                $mdDialog.show(
                    $mdDialog.alert()
                        .textContent(`DG job ${jn} can not be despatched to courier ${courier} - doesn't have DGLicense.`)
                        .ok('OK')
                );
                return;
            }
            if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                $mdDialog.show(
                    $mdDialog.alert()
                        .textContent(`Courier ${courier} doesn't have a DGLicense or license has expired.`)
                        .ok('OK')
                );
                return;
            }

            let jobs = [];
            jobs.push(j.id);
            return NWData.allocateJobs(foundCourier.courierID, ContactID, jobs).then(response => {
                $scope.getData().then(() => {
                    angular.element("#box-map").find(".loading").show();
                    $scope.courier = {gpsCourier: foundCourier.id};
                    $scope.searchCourier();
                });
            });
        }, function () {
            let unDespatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
            displayPickupPoints(unDespatchedData, true, null);
            ctrl.getAvailableCourierLocation();
        });
        //return closestJob;

    };

    $scope.selectAllContent = function ($event) {
        $event.target.select();
    };

    $scope.latePickup = function (minsAway, j, obj) {
        console.log("current = " + j.lp);
        console.log("param minsAway = " + minsAway);
        console.log(obj);
        $scope.lateCall(minsAway, 1, j, true);

    }

    $scope.lateDelivery = function (minsAway, j, obj) {
        console.log("current = " + j.ld);
        console.log("param minsAway = " + minsAway);
        console.log(obj);
        $scope.lateCall(minsAway, 2, j, true);

    }

    /////////////////////////////////////
    // LATE CALLS
    /////////////////////////////////////
    $scope.lateCall = function (lateTime, lateType, j, calc) {
        return NWData.lateCall(lateType, lateTime, j.minutes, j.pickupTime, j.alertLatePickup, j.deliveryTime, j.alertLateDelivery, j.jobNo, j.clientID, j.contactName, ContactID, j.time, j.id, j.jobType, j.speed, j.notify || j.speed, FirstName, calc).then(function (response) {
            $scope.getData().then(function () {


            });
            return response;
        });
    };

    ////////////////////////////////////////
    // DISPATCH THE JOBS FROM NEW WINDOW PANE
    ///////////////////////////////////////
    $scope.dispatchJobsFromNew = function (courier) {
        var foundCourier = $scope.pickCouriers.find(c => c.id === courier);
        if (foundCourier === undefined) {
            $mdDialog.show(
                $mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Error')
                    .textContent('Invalid Courier')
                    .ok('OK')
            );

            return;
        }

        var callData = {
            "call": "dispatchJobs",
            "courier": courier,
            "jobs": []
        };

        var reset = function () {
            angular.element(".activeTable .active").each(function () {
                var j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                j.courier = null;
            });
        };

        angular.element("#jobList .active").each(function () {
            var j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
            var jn = j.jobNo;
            if (j.courierData.courierID !== null) {
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Notice').textContent('Restore ' + jn + ' prior to despatching to another courier').ok('OK'));
                reset();
                return;
            }
            //if (!j.allowDispatch) {
            //    alert("Can not despatch " + jn + " until all other child jobs have been despatched.");
            //    reset();
            //    return;
            //}
            if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`DG job ${jn} can not be despatched to courier ${courier} - doesn't have DGLicense.`).ok('OK'));
                reset();
                return;
            }
            if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                reset();
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`DG job ${jn} can not be despatched to courier ${courier} - doesn't have DGLicense.`).ok('OK'));
                return;
            }

            if (j.dgClass !== null && j.dgClass > 0) {
                NWData.addFollowupEvent(jn, j.clientID, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
            }

            callData.jobs.push(angular.element(this).attr("data-jobid"));
        });

        return NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(function (response) {
            $scope.getData().then(function () {
                //angular.element("#box-jobDetail").find(".loading").show();
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();
                $timeout(function () {
                    angular.element("#jobList tr").first().find(".dispatchField").focus();
                }, 200);

            });
            return response;
        });


    };

    ////////////////////////////////////////
    // DISPATCH THE JOBS FROM POD WINDOW PANE
    ///////////////////////////////////////
    $scope.dispatchJobsFromPOD = function (courier) {
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
            angular.element(".activeTable .active").each(function () {
                var j = $scope.jobListPOD.find(jo => jo.id === angular.element(this).data("jobid"));
                j.courier = null;
            });
        };

        angular.element("#jobListPOD .active").each(function () {
            var j = $scope.jobListPOD.find(jo => jo.id === angular.element(this).data("jobid"));
            var jn = j.jobNo;
            if (j.courierData.courierID !== null) {
                $mdDialog.show(
                    $mdDialog.alert()
                        .textContent(`Restore ${jn} prior to despatching to another courier.`)
                        .ok('OK')
                );
                reset();
                return;
            }
            if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                $mdDialog.show(
                    $mdDialog.alert()
                        .textContent(`DG job ${jn} can not be despatched to courier ${courier} - doesn't have DGLicense.`)
                        .ok('OK')
                );
                reset();
                return;
            }
            if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                reset();
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Notice').textContent(`Courier ${courier} doesn't have a DGLicense or license has expired.`).ok('OK'));
                return;
            }

            if (j.dgClass !== null && j.dgClass > 0) {
                NWData.addFollowupEvent(jn, j.clientID, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
            }

            callData.jobs.push(angular.element(this).attr("data-jobid"));
        });

        return NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(function (response) {
            $scope.getData().then(() => {
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();
                $timeout(() => {
                    angular.element("#jobListPOD tr").first().find(".dispatchField").focus();
                }, 200);

            });
            return response;
        });


    };

    $scope.dispatchJobsFromPotentialCouriers = function (courier) {
        var foundCourier = $scope.pickCouriers.find(c => c.id === courier);
        if (foundCourier === undefined) {
            $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent('Invalid Courier').ok('OK'));
            return;
        }

        var callData = {
            "call": "dispatchJobs",
            "courier": courier,
            "jobs": []
        };

        var reset = function () {
            angular.element("#jobList .active").each(function () {
                var j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                j.courier = null;
            });
        };

        angular.element("#jobList .active").each(function () {
            var j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
            var jn = j.jobNo;
            if (j.courierData.courierID !== null) {
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Notice').textContent(`Restore ${jn} prior to despatching to another courier`).ok('OK'));
                reset();
                return;
            }

            if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`DG job ${jn} cannot be dispatched to courier ${courier} - doesn't have DGLicense.`).ok('OK'));
                reset();
                return;
            }
            if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                reset();
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`Courier ${courier} doesn't have a DGLicense or license has expired.`).ok('OK'));
                return;
            }

            if (j.dgClass !== null && j.dgClass > 0) {
                NWData.addFollowupEvent(jn, j.clientID, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
            }

            callData.jobs.push(angular.element(this).attr("data-jobid"));
        });

        return NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(function (response) {
            $scope.getData().then(function () {
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();


            });
            return response;
        });
    };

    ////////////////////////////////////////
    // RESTORE JOB FROM NEW WINDOW PANE
    ///////////////////////////////////////
    $scope.restoreJobsFromNew = function () {

        var callData = {
            "call": "restoreJobs",
            "jobs": [],
            "splitJobs": [],
            "jobNos": [],
            "courierID": null
        };

        var foundCourier = null;

        angular.element("#jobList .active").each(function () {
            var j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
            var jn = j.jobNo;
            NWData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
            if (callData.courierID === null) {
                callData.courierID = j.courierData.courierID;
                foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
            }
            if (j.displaySplitJobDetail) {
                callData.splitJobs.push(angular.element(this).data("jobid"));
            } else {
                callData.jobs.push(angular.element(this).attr("data-jobid"));
            }
        });

        if (callData.splitJobs.length > 0) {
            NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs);
        }
        if (callData.jobs.length > 0) {
            NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
        }


        $scope.getData().then(function () {
            //angular.element("#box-jobDetail").find(".loading").show();
            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            $scope.searchCourier();


        });


    };

    ////////////////////////////////////////
    // RESTORE JOB FROM POD WINDOW PANE
    ///////////////////////////////////////
    $scope.restoreJobsFromPOD = function () {

        var callData = {
            "call": "restoreJobs",
            "jobs": [],
            "splitJobs": [],
            "jobNos": [],
            "courierID": null
        };

        var foundCourier = null;

        angular.element("#jobListPOD .active").each(function () {
            var j = $scope.jobListPOD.find(jo => jo.id === angular.element(this).data("jobid"));
            var jn = j.jobNo;
            NWData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
            if (callData.courierID === null) {
                callData.courierID = j.courierData.courierID;
                foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
            }
            if (j.displaySplitJobDetail) {
                callData.splitJobs.push(angular.element(this).data("jobid"));
            } else {
                callData.jobs.push(angular.element(this).attr("data-jobid"));
            }
        });

        if (callData.splitJobs.length > 0) {
            NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs);
        }
        if (callData.jobs.length > 0) {
            NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
        }


        $scope.getData().then(function () {
            //angular.element("#box-jobDetail").find(".loading").show();
            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            $scope.searchCourier();


        });


    };

    ////////////////////////////////////////
    // RESTORE JOB FROM BOOK DELIVERY WINDOW PANE
    ///////////////////////////////////////
    $scope.restoreJobsFromDelivery = function () {

        var callData = {
            "call": "restoreJobs",
            "jobs": [],
            "splitJobs": [],
            "jobNos": [],
            "courierID": null
        };

        var foundCourier = null;

        angular.element("#jobListDelivery .active").each(function () {
            var j = $scope.jobListDelivery.find(jo => jo.id === angular.element(this).data("jobid"));
            var jn = j.jobNo;
            NWData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
            if (callData.courierID === null) {
                callData.courierID = j.courierData.courierID;
                foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
            }
            if (j.displaySplitJobDetail) {
                callData.splitJobs.push(angular.element(this).data("jobid"));
            } else {
                callData.jobs.push(angular.element(this).attr("data-jobid"));
            }
        });

        if (callData.splitJobs.length > 0) {
            NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs);
        }
        if (callData.jobs.length > 0) {
            NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
        }


        $scope.getData().then(function () {
            //angular.element("#box-jobDetail").find(".loading").show();
            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            $scope.searchCourier();


        });


    };

    ////////////////////////////////////////
    // REDESPATCHED JOB
    ///////////////////////////////////////
    $scope.reAllocateJobs = function () {

        var callData = {
            "call": "redespatchJobs",
            "jobs": [],
            "splitJobs": [],
            "jobNos": [],
            "courierID": null
        };


        var foundCourier = null;

        angular.element("#jobList .active").each(function () {
            var j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
            var jn = j.jobNo;
            foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
            callData.jobs.push(angular.element(this).attr("data-jobid"));
        });

        if (callData.jobs.length > 0) {
            NWData.reAllocateJobs(foundCourier.courierID, ContactID, callData.jobs);
        }

        $scope.getData().then(function () {
            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            $scope.searchCourier();


        });


    };

    $scope.resendJobs = function () {

        var callData = {
            "call": "redespatchJobs",
            "jobs": [],
            "splitJobs": [],
            "jobNos": [],
            "courierID": null
        };


        angular.element("#jobList .active").each(function () {
            var j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
            foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
            callData.jobs.push(angular.element(this).attr("data-jobid"));
        });

        if (callData.jobs.length > 0) {
            NWData.resendJobs(callData.jobs);
        }

        $scope.getData().then(function () {
            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            $scope.searchCourier();
        });
    };

    ctrl.restoreAll = function () {
        let dialog = $mdDialog.confirm()
            .title('Restore All Jobs')
            .textContent('Are you sure you wish to restore all jobs for ' + $scope.currentCourier.courier)
            .ok('Yes')
            .cancel('No');

        $mdDialog.show(dialog).then(() => {
            let callData = {
                "call": "restoreJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };

            let foundCourier = null;

            angular.element("#currentWork tr.droppable-row").each(() => {
                let j = $scope.jobsCurrentList.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
                NWData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
                if (callData.courierID === null) {
                    callData.courierID = j.courierData.courierID;
                    foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
                }
                if (j.displaySplitJobDetail) {
                    callData.splitJobs.push(angular.element(this).data("jobid"));
                } else {
                    callData.jobs.push(angular.element(this).attr("data-jobid"));
                }
            });

            if (callData.splitJobs.length > 0) {
                NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs);
            }
            if (callData.jobs.length > 0) {
                NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
            }

            $timeout(() => {
                $scope.getCurrentJobs(foundCourier.courierID);
                $scope.getData();
            }, 1000);
        }, function () {
            // Actions to perform when 'No' is clicked.
        });
    };

    ctrl.redispatchAll = function () {
        let dialog = $mdDialog.confirm()
            .title('Restore All Jobs')
            .textContent('Are you sure you wish to redispatch all jobs for ' + $scope.currentCourier.courier)
            .ok('Yes')
            .cancel('No');

        $mdDialog.show(dialog).then(() => {
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
                foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID);
            });

            if (callData.jobs.length > 0) {
                NWData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
            }

            $scope.getData().then(function () {
                angular.element("#box-map").find(".loading").show();
                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();
            });
        }, function () {
            // Actions to perform when 'No' is clicked.
        });
    };

    ctrl.resendAll = function () {
        let dialog = $mdDialog.confirm()
            .title('Resend All Jobs')
            .textContent('Are you sure you wish to resend all jobs for ' + $scope.currentCourier.courier)
            .ok('Yes')
            .cancel('No');

        $mdDialog.show(dialog).then(() => {
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
                foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID);
            });

            if (callData.jobs.length > 0) {
                NWData.resendAllJobs(callData.courierID);
            }

            $scope.getData().then(() => {
                angular.element("#box-map").find(".loading").show();
                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();
            });
        }, function () {
            // Actions to perform when 'No' is clicked.
        });
    };

    $scope.reAllocateJobsFromCurrentWindow = function () {

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
            foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID);
        });


        if (callData.jobs.length > 0) {
            NWData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
        }

        $scope.getData().then(function () {
            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
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
            foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID);
        });


        if (callData.jobs.length > 0) {
            NWData.resendJobs(callData.jobs);
        }

        $scope.getData().then(function () {
            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
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


        var foundCourier = null;

        angular.element("#currentWork .active").each(function () {
            var j = $scope.jobsCurrentList.find(jo => jo.id === angular.element(this).data("jobid"));
            var jn = j.jobNo;
            NWData.addRestoreEvent(jn, j.clientID, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
            if (callData.courierID === null) {
                callData.courierID = j.courierData.courierID;
                foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
            }
            if (j.displaySplitJobDetail) {
                callData.splitJobs.push(angular.element(this).data("jobid"));
            } else {
                callData.jobs.push(angular.element(this).attr("data-jobid"));
            }
        });

        if (callData.splitJobs.length > 0) {
            NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs);
        }
        if (callData.jobs.length > 0) {
            NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
        }

        $timeout(function () {
            $scope.getCurrentJobs(foundCourier.courierID);
            $scope.getData();
        }, 1000);


    };

    //////////////////////////////
    //  SPLIT JOB //
    /////////////////////////////
    $scope.splitJob = function () {
        var jid;
        jid = angular.element(".activeTable .active").first().data("jobid");
        var j = $scope.jobList.find(jo => jo.id === jid);
        if (!j.allowSplit) {
            $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`Cannot split ${j.JobNo}.`).ok('OK'));
            return;
        }

        NWData.splitJob(j.id, FirstName).then(function (response) {
            $scope.getData().then(function () {
                var refreshedJob = $scope.jobList.find(jo => jo.id === j.id);
                $scope.selectJob(refreshedJob);
                $timeout(function () {
                    angular.element("#jobList tr[data-jobid='" + j.id + "']").addClass("active");

                    var $parentDiv = angular.element("#jobList tr[data-jobid='" + j.id + "']").parents(".box-content");
                    var goTop = angular.element("#jobList tr[data-jobid='" + j.id + "']").offset().top;

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

                var index = ctrl.currentJob.PalletInfo.indexOf($itemScope.pallet);
                ctrl.currentJob.PalletInfo.splice(index, 1);

                //LOCK WITH CURRENT USER

            }
        }
    ];


    //ACTIVATE DROP
    $scope.activateDrop = function () {
        $timeout(function () {

                $document.on('ready', function (event) {
                    angular.element(".droppable-row").droppable({
                        classes: {
                            "ui-droppable-hover": "active"
                        },
                        drop: function (event, ui) {
                            //angular.element(this).addClass("active");


                            //STOP DROPPABLE FIRING OUTSIDE ITS CONTAINER & HIDDEN
                            var parent = angular.element(this).parents(".box");
                            var parentOffset = parent.offset();
                            var parentTop = parentOffset.top;
                            var parentBottom = parentTop + parent.outerHeight();

                            var row = angular.element(this);
                            var rowOffset = row.offset();
                            var rowTop = rowOffset.top;
                            var rowBottom = rowTop + row.outerHeight();

                            if (rowTop < parentBottom && rowBottom > parentTop) {

                                //YAY ITS VISABLE
                                angular.element(this).css({"background-color": "#c6dfad"});
                                angular.element(this).animate({backgroundColor: "inherit"},
                                    300,
                                    function () {
                                        angular.element(this).removeAttr("style");
                                    });
                                $scope.dispatchJobs(angular.element(this).attr("data-courier").replace(/[^\d.-]/g, ''));
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

    $scope.getPotentialCouriers = function (jobId) {

        angular.element("#box-potentialCouriers .loading").show();
        NWData.getPotentialCouriers(jobId).then(function (data) {
            $scope.potentialCouriers = data;

            //Set headings
            $timeout(function () {
                sizeHeadings(angular.element("#potentialCouriers").parents(".column"));
            }, 1000);
            $timeout(function () {
                sizeHeadings(angular.element("#potentialCouriers").parents(".column"));
            }, 2000);

            angular.element("#box-potentialCouriers .loading").fadeOut();

            $scope.activateDrop();

        });

    };


    // Search Courier GPS
    $scope.searchCourier = function () {
        angular.element("#box-currentWork").find(".loading").show();
        angular.element("#box-map").find(".loading").show();
        var ac = $scope.pickCouriers.find(c => c.id === $scope.courier.gpsCourier);
        console.log(ac);
        if (ac === undefined) {
            angular.element("#box-currentWork").find(".loading").fadeOut();
            angular.element("#box-map").find(".loading").show();
            $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent('Courier not found.').ok('OK'));
            return;
        }
        $scope.currentWorkSelection = " for Courier " + ac.id + " " + ac.name;
        $scope.currentCourier = {
            courierID: ac.courierID,
            courier: ac.label
        };

        $scope.currentSelection = " for Courier " + ac.id + " " + ac.name;
        $scope.getCurrentJobs(ac.courierID);
        //NWData.getJobsCurrent(ac.courierID, false).then(function (data) {
        //    angular.element("#box-currentWork").find(".loading").fadeOut();
        //    $scope.jobsCurrentList = data;
        //    if (data.length > 0) {
        //        displayRoutePoints(data);
        //    } else {
        //        NWData.getCourierPosition(ac.id).then(function (posData) {
        //            displayCourierPositionOnly(posData.latitude, posData.longitude);
        //        });
        //    }
        //    $timeout(function () { sizeHeadings(angular.element("#currentWork").parents(".column")); }, 1000);
        //    $timeout(function () { sizeHeadings(angular.element("#currentWork").parents(".column")); }, 2000);
        //});
    };

    // Select the courier
    $scope.selectCourier = function (courier) {


        angular.element("#box-jobDetail").find(".loading").show();
        angular.element("#box-map").find(".loading").show();
        if (courier.courier === undefined) {
            courier.courier = courier.code + ' ' + courier.firstName;
        }
        console.log(courier);
        //$scope.getGroupedJobs(courier);
        //$scope.groupJobsSelection = " for Courier " + courier.courier;
        $scope.getCurrentJobs(courier.courierID);
        $scope.currentWorkSelection = " for Courier " + courier.courier;

        //SHOW MAP
        //self.currentJob = null;
        $scope.currentCourier = courier;

        //$scope.currentSelection = " for Courier " + + courier.courier;

        $timeout(function () {
                $document.on('ready', function (event) {
                    angular.element("#box-jobDetail").find(".loading").fadeOut();
                    angular.element("#box-map").find(".loading").fadeOut();
                });
            },
            100);

        NWData.truckCourierStatus(courier.courierID).then(function (result) {
            $scope.truckCourierStatus = result.data;
        });
    };

    $scope.refreshTruckCourierStatus = function () {
        NWData.truckCourierStatus($scope.currentCourier.courierID).then(function (result) {
            $scope.truckCourierStatus = result.data;
        });
    };

    $scope.selectMapCourier = function (courier) {
        angular.element("#box-jobDetail").find(".loading").show();
        angular.element("#box-map").find(".loading").show();

        angular.element("#box-currentWork").find(".loading").show();
        var foundCourier = $scope.pickCouriers.find(x => x.courierID === courier.courierID);
        $scope.currentCourier = {
            courierID: foundCourier.courierID,
            courier: foundCourier.label
        };
        NWData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done").then(function (data) {
            angular.element("#box-currentWork").find(".loading").fadeOut();

            $scope.jobsCurrentList = data;
            if (data.length > 0) {
                displayRoutePointsOnly(data, false, $scope.mapZoom.display);
            }
            $scope.activateDrop();
            $timeout(function () {
                sizeHeadings(angular.element("#currentWork").parents(".column"));
            }, 1000);
            $timeout(function () {
                sizeHeadings(angular.element("#currentWork").parents(".column"));
            }, 2000);
        });
        $scope.currentWorkSelection = " for Courier " + courier.label;


        $timeout(function () {
            $document.on('ready', function (event) {
                angular.element("#box-jobDetail").find(".loading").fadeOut();
                angular.element("#box-map").find(".loading").fadeOut();
            });
        }, 100);

        NWData.truckCourierStatus(courier.courierID).then(function (data) {
            $scope.truckCourierStatus = data;
        });

    };

    $scope.selectPotentialCourier = function (courier) {
        angular.element("#box-jobDetail").find(".loading").show();
        angular.element("#box-map").find(".loading").show();
        if (courier.courier === undefined) {
            courier.courier = courier.code + ' ' + courier.firstName;
        }

        if ($scope.jobList.length > 0) {
            var jid = angular.element("#jobList .active").last().data("jobid");
            var currentJob = $scope.jobList.find(jo => jo.id === jid);
            var undespatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
            displayPickupPoints(undespatchedData, true, currentJob);
        }

        angular.element("#box-currentWork").find(".loading").show();
        var code = $scope.pickCouriers.find(x => x.courierID === courier.courierID).id;
        NWData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done").then(function (data) {
            angular.element("#box-currentWork").find(".loading").fadeOut();
            if (ctrl.currentJob !== null && ctrl.currentJob.courier !== code) {
                ctrl.currentJob = null;
            }
            $scope.jobsCurrentList = data;
            if (data.length > 0) {
                displayRoutePoints(data, false, $scope.mapZoom.display);
            } else {
                NWData.getCourierPosition(code).then(function (posData) {
                    displayCourierPositionOnly(posData.latitude, posData.longitude);
                });
            }
            $scope.activateDrop();
            $timeout(function () {
                sizeHeadings(angular.element("#currentWork").parents(".column"));
            }, 1000);
            $timeout(function () {
                sizeHeadings(angular.element("#currentWork").parents(".column"));
            }, 2000);
            ctrl.getAvailableCourierLocation();
        });
        $scope.currentWorkSelection = " for Courier " + courier.courier;

        $scope.currentCourier = courier;

        //$scope.currentSelection = " for Courier " + + courier.courier;

        $timeout(function () {
            $document.on('ready', function (event) {
                angular.element("#box-jobDetail").find(".loading").fadeOut();
                angular.element("#box-map").find(".loading").fadeOut();
                //        var jid = angular.element("#jobList .active").last().data("jobid");
                //        var job = $scope.jobList.find(jo => jo.id === jid);
                //        var jobs = [job];
                //        displayRoutePoints(jobs, false);
            });
        }, 100);


    };

    ////////////////////////////
    // GROUPED JOBS
    ////////////////////////////

    $scope.getGroupedJobs = function (jobs, courier) {

        angular.element("#box-jobGroups").find(".loading").show();

        NWData.getJobsGrouped().then(function (data) {

            angular.element("#box-jobGroups").find(".loading").fadeOut();

            $scope.jobGroups = data;

            $timeout(function () {
                sizeHeadings(angular.element("#jobGroups").parents(".column"));
            }, 1000);
            $timeout(function () {
                sizeHeadings(angular.element("#jobGroups").parents(".column"));
            }, 2000);

        });

    };

    ////////////////////////////
    // CURRENT JOBS
    ////////////////////////////

    $scope.getCurrentJobs = function (courierId) {

        angular.element("#box-currentWork").find(".loading").show();
        var foundCourier = $scope.pickCouriers.find(x => x.courierID === courierId);
        var code = foundCourier !== undefined ? $scope.pickCouriers.find(x => x.courierID === courierId).id : "";
        NWData.getJobsCurrent(courierId, $scope.jobFilters.status === "done").then(function (data) {
            angular.element("#box-currentWork").find(".loading").fadeOut();
            /*
            if (self.currentJob !== undefined && self.currentJob !== null && self.currentJob.courier !== code) {
                self.currentJob = null;
            }
            */
            $scope.jobsCurrentList = data;
            if (data.length > 0) {
                displayRoutePoints(data, true, $scope.mapZoom.display);
            } else {
                NWData.getCourierPosition(code).then(function (posData) {
                    displayCourierPositionOnly(posData.latitude, posData.longitude);
                });
            }
            $scope.activateDrop();
            $timeout(function () {
                sizeHeadings(angular.element("#currentWork").parents(".column"));
            }, 1000);
            $timeout(function () {
                sizeHeadings(angular.element("#currentWork").parents(".column"));
            }, 2000);
        });

    };

    var filtersObject = null;
    if (Modernizr.localstorage) {
        filtersObject = JSON.parse(localStorage.getItem("dispNW-filters-" + ContactID));
    }
    $scope.jobFilters = filtersObject || {"status": "all", "area": "mainfu", "order": "", "asc": "asc"};
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
        $scope.setFilters(data);
    };

    $scope.setFilters = function (data) {
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

            if (data.order) {
                $scope.jobFilters.order = data.order;
            }

            $scope.getData();
        }, 300);
    };

    $scope.selectJobDetail = function (job) {
        ctrl.currentJob = job;
        $scope.currentSupport = null;
        $scope.potentialCouriers = false;
        $scope.potentialCouriersSelection = " for Job " + job.jobNo;
    };

    $scope.selectSupportJobDetail = function (support) {
        console.log("select Job  " + support.jobId);

        $scope.currentSupport = support;
        angular.element("#box-jobDetail").find(".loading").show();

        NWData.getJobDetail(support.jobId).then(function (data) {
            ctrl.currentJob = data;
            angular.element("#box-jobDetail").find(".loading").hide();
            $scope.currentSelection = " for Job " + support.jobNumber;
            var jobs = [];
            jobs.push(ctrl.currentJob);
            displayRoutePointsOnly(jobs, true, $scope.mapZoom.display);

            if ($scope.mapZoom.display) {
                setMapBounds();
                map.setZoom(12);
            }

        });


    };

    $scope.loadRelatedJobDetail = function (id, jn) {
        angular.element("#box-jobDetail").find(".loading").show();
        NWData.getJobDetail(id).then(function (data) {
            ctrl.currentJob = data;
            angular.element("#box-jobDetail").find(".loading").hide();
            $scope.currentSelection = " for Job " + jn;
        });
    }

    $scope.selectJob = function (job, clear) {
        $timeout(function () {
            processActiveTable();
            initializeJob(job);
            updateData(job, clear);
            angular.element("#box-jobDetail .loading").css('display', 'none');
        }, 0);
    };

    function processActiveTable() {
        $scope.selectedJobs = [];
        $scope.currentSupport = null;
        angular.element(".activeTable .active").each(function () {
            //angular.element(this).hide();
            angular.element(this).find(".selectjob").click();
            $scope.selectedJobs.push($scope.jobForDispatch.ID);
        });
        console.log("selectJob");
    }

    function initializeJob(job) {
        ctrl.currentJob = job;
        $scope.$apply();
        console.log(job);
        jdSvc.setJob(ctrl.currentJob);
    }

    function updateData(job, clear) {
        NWData.getActiveCouriers().then(function (data) {
            $scope.pickCouriers = data;
        });
        if (job.rootParentID) {
            NWData.getRelatedJobs(job.rootParentID, job.clientID).then(function (data) {
                //data = data.filter(item => item.id !== job.id);
                ctrl.currentJob.relatedJobs = data;
            });
        }
        if (clear === true && job.courier === null) {
            processClearSettings(job);
            displayRoutePoints([job], false, $scope.mapZoom.display);
        } else {
            $scope.potentialCouriers = false;
            $scope.selectCourier(job.courierData);
        }
        $scope.currentCourier = null;
        $scope.currentSelection = " for Job " + job.jobNo;
        var undespatchedData = $scope.jobList.filter(function (x) {
            return x.courierData.courierID === null;
        });
        displayPickupPoints(undespatchedData, true, job);
    }

    function processClearSettings(job) {
        clearSettings(job);
        $scope.getGroupedJobs();
        $scope.potentialCouriersSelection = " for Job " + job.jobNo;
        $scope.groupJobsSelection = " for Job " + job.jobNo;
        $scope.currentWorkSelection = "";
    }

    function clearSettings(job) {
        $scope.getPotentialCouriers(job.id);
        $scope.jobGroups = false;
        $scope.jobsCurrentList = false;
    }

    $scope.setCurrentWorkMenu = function () {
        var multiple = angular.element(".activeTable .active").length > 1;

        return [
            {
                text: "Restore",
                click: function ($itemScope, $event, modelValue, text, $li) {
                    $scope.restoreJobsFromCurrentWindow();
                }
            },
            {
                text: "Redispatch",
                click: function ($itemScope, $event, modelValue, text, $li) {
                    $scope.reAllocateJobsFromCurrentWindow();
                }
            },
            {
                text: "Resend",
                click: function ($itemScope, $event, modelValue, text, $li) {
                    $scope.resendJobsFromCurrentWindow();
                }
            }

        ];
    };


    $scope.fromColumnClick = function (evt) {
        switch (evt.which) {
            case 1:
                // this is left click
                break;
            case 2:
                // in case you need some middle click things
                break;
            case 3:
                // this is right click
                waitingDialog.show();
                $timeout(function () {
                    ctrl.jdSvc.updateGPS(ctrl.currentJob, 'fromAddress', true);
                }, 100);

                break;
            default:
                console.log("you have a strange mouse!");
                break;

        }
        return false;
    };

    $scope.toColumnClick = function (evt) {
        switch (evt.which) {
            case 1:
                // this is left click
                break;
            case 2:
                // in case you need some middle click things
                break;
            case 3:
                // this is right click
                waitingDialog.show();
                $timeout(function () {
                    ctrl.jdSvc.updateGPS(ctrl.currentJob, 'toAddress', true);
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
                    var dueTime = moment(ctrl.currentJob.booked).add(ctrl.currentJob.lp || ctrl.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');
                    var items = [];
                    for (var i = 1; i < 37; i++) {
                        if (parseInt(dueTime) < (i * 5))
                            items.push({"id": (i * 5), "text": ((i * 5).toString() + " mins away")});
                    }

                    $scope.lateForm = {
                        "data": {
                            "jobNum": ctrl.currentJob.jobNo,
                            "client": ctrl.currentJob.client,
                            "dueMins": dueTime,
                            "choose": ""
                        },
                        submit: function () {
                            var pickupETAValue = parseInt($scope.lateForm.choose.value);
                            var dueMins = moment(ctrl.currentJob.booked).add(ctrl.currentJob.lp || ctrl.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');

                            if (ctrl.currentJob.lp !== pickupETAValue) {
                                var window = ctrl.currentJob.lp || ctrl.currentJob.pickupTime;
                                var lateMins = pickupETAValue - dueMins + window;
                                ctrl.currentJob.lp = lateMins;
                                console.log(lateMins);
                                $scope.lateCall(lateMins, 1, ctrl.currentJob, false);
                                $scope.lateForm.data = null;
                                angular.element("#AwayMins").select2().empty();
                                angular.element("#AwayMins").select2('destroy');
                                angular.element(".lateForm").hide(0)
                            }
                        },
                        cancel: function () {
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

    $scope.speedColumnClick = function (evt) {
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
                    ctrl.jdSvc.speedClick(ctrl.currentJob);
                    $scope.$apply();
                }, 400);

                break;
            default:
                console.log("you have a strange mouse!");
                break;

        }
        return false;
    };

    $scope.clientColumnClick = function (evt) {
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
                    ctrl.jdSvc.clientClick(ctrl.currentJob);
                    $scope.$apply();
                }, 400);

                break;
            default:
                console.log("you have a strange mouse!");
                break;

        }
        return false;
    };

    $scope.notifyColumnClick = function (evt) {
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
                    ctrl.jdSvc.notifyClick(ctrl.currentJob);
                    $scope.$apply();
                }, 400);

                break;
            default:
                console.log("you have a strange mouse!");
                u
                break;

        }
        return false;
    };

    $scope.setEventsMenu = function () {
        var fullMenu =
            [
                {
                    text: "Void Job",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        $scope.voidJobForm(ctrl.currentJob.jobNo, ctrl.currentJob.id);
                    }
                },

                {
                    text: "Add Event - Other",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        $scope.otherEventForm(ctrl.currentJob.jobNo);
                    }
                }
            ];
        return fullMenu;
    };

    $scope.setJobsMenu = function () {
        var multiple = angular.element(".activeTable .active").length > 1;
        var lastCourier = null;
        var sameCourier = true;
        angular.element(".activeTable .active").each(function () {
            var j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
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
                },
                {
                    text: "Redispatch Selected",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        $scope.reAllocateJobs();
                    }
                },
                {
                    text: "Resend Selected",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        $scope.resendJobs();
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
                },
                {
                    text: "Redispatch",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        $scope.reAllocateJobs();
                    }
                },
                {
                    text: "Resend",
                    click: function ($itemScope, $event, modelValue, text, $li) {
                        $scope.resendJobs();
                    }
                }
            );
        }
        return multiple ? multipleMenu : fullMenu;
    };

    ctrl.setTruckMode = function (mode) {
        $scope.truckMode = mode;
        $scope.getData();
    };

    ctrl.setSupportChannel = function (channel) {
        $scope.supportChannel = channel;
        $scope.getSupports();
    };

    ctrl.getAvailableCourierLocation = function () {
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
        NWData.getAvailableCourierLocation(map.getBounds().getSouthWest().lng(), map.getBounds().getSouthWest().lat(), map.getBounds().getNorthEast().lng(), map.getBounds().getNorthEast().lat())
            .then(function (returnData) {
                displayAvailableCouriers(returnData, $scope.currentCourier === false || $scope.currentCourier === null ? 0 : $scope.currentCourier.courier.split(" ")[0].trim(), channels, trucks, $scope.truckMode, $scope.allCouriers.includeUA);
            });
    };

    $scope.courierMenu = [
        // NEW IMPLEMENTATION
        {
            text: "Dispatch Selected",
            click: function ($itemScope, $event, modelValue, text, $li) {
                //$scope.selected = $itemScope.item.name;
                $scope.dispatchJobs($itemScope.courier.courier || $itemScope.courier.code);
            }
        }
    ];

    $scope.potentialCourierMenu = [
        {
            text: "Dispatch Selected",
            click: function ($itemScope, $event, modelValue, text, $li) {
                //$scope.selected = $itemScope.item.name;
                $scope.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
            }
        }
    ];

    $scope.getJobList = function () {
        if (Modernizr.localstorage) {
            localStorage.setItem("dispNW-filters-" + ContactID, JSON.stringify($scope.jobFilters));
        }
        var selectedClients = $scope.pickService.clients.map(a => a.id);

        NWData.getNationwideJobsPOD($scope.jobFilters, selectedClients, $scope.isInternal).then(function (data) {
            $scope.jobListPOD = data;

            $timeout(function () {
                angular.element("#box-jobsListPOD .loading").fadeOut();
                sizeHeadings(angular.element("#jobListPOD").parents(".column"));

            }, 200);

        });

        NWData.getNationwideJobsNew($scope.jobFilters, selectedClients, $scope.isInternal).then(function (data) {
            $scope.jobList = data;

            $timeout(function () {
                angular.element("#box-jobsList .loading").fadeOut();
                sizeHeadings(angular.element("#jobList").parents(".column"));

            }, 200);

        });

        NWData.getNationwideJobsReprice($scope.jobFilters, selectedClients, $scope.isInternal).then(function (data) {
            $scope.jobListReprice = data;

            $timeout(function () {
                angular.element("#box-jobsListReprice .loading").fadeOut();
                sizeHeadings(angular.element("#jobListReprice").parents(".column"));

            }, 200);

        });

        return NWData.getNationwideJobsBookDelivery($scope.jobFilters, selectedClients, $scope.isInternal).then(function (data) {
            $scope.jobListDelivery = data;

            $timeout(function () {
                angular.element("#box-jobsListDelivery .loading").fadeOut();
                sizeHeadings(angular.element("#jobListDelivery").parents(".column"));

                ctrl.getAvailableCourierLocation();
            }, 200);

        });
    };

    $scope.closeSupport = function (support) {
        NWData.closeSupport(support.eventId, ContactID).then(function (data) {
            $scope.getSupports();
            $scope.currentSupport = null;
        });
    }

    $scope.lockSupport = function (support) {
        console.log(support);
        if (support.lockedBy === Dispatcher) {
            NWData.unLockSupport(support.eventId, Dispatcher).then(function (data) {
                $scope.getSupports();
            });
        } else {
            NWData.lockSupport(support.eventId, Dispatcher).then(function (data) {
                $scope.getSupports();
            });
        }
    }

    $scope.getSupports = function () {
        ////////////////////////////
        // SUPPORTS
        ////////////////////////////
        angular.element("#box-supports").find(".loading").show();
        return NWData.getSupports($scope.supportChannel).then(function (data) {
            $scope.supports = data;


            $scope.supportMenu = [
                // NEW IMPLEMENTATION
                {
                    text: "Complete",
                    click: function ($itemScope, $event, modelValue, text, $li) {

                        $scope.closeSupport($itemScope.support);

                    }
                },
                {
                    text: "Toggle Lock",
                    click: function ($itemScope, $event, modelValue, text, $li) {

                        $scope.lockSupport($itemScope.support);


                    }
                }
            ];


            $timeout(function () {
                    $document.on('ready', function (event) {
                        angular.element("#box-supports").find(".loading").fadeOut();
                        if ($scope.currentSupport) {
                            angular.element("#supports tr[data-id='" + $scope.currentSupport.eventId + "']").addClass("active");
                        }
                    });

                },
                100);


            $timeout(function () {
                sizeHeadings(angular.element("#supports").parents(".column"));
            }, 1000);
            $timeout(function () {
                sizeHeadings(angular.element("#supports").parents(".column"));
            }, 2000);
        });
    }

    $scope.getClientContacts = function () {
        NWData.getClientContacts(ContactID).then(function (data) {
            $scope.pickClients = data;
        });
    };

    $scope.getEventTypes = function () {
        NWData.getEventTypes().then(function (data) {
            $scope.pickEventTypes = data;
        });
    };


    $scope.getData = function () {

        ///////////////////////////////
        // JOB LIST
        ///////////////////////////////

        //Get Job Data

        angular.element("#box-jobsList").find(".loading").show();
        $scope.jobList = [];
        $scope.jobListPOD = [];
        ctrl.currentJob = false;
        $scope.potentialCouriers = false;
        $scope.jobGroups = false;
        $scope.jobsCurrentList = false;
        $scope.currentCourier = false;


        NWData.getActiveCouriers().then(function (data) {
            $scope.pickCouriers = data;
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

    if (!$scope.isInternal) {
        $scope.getClientContacts();
    }

    $scope.getEventTypes();

    $scope.getData();
    //$document.everyTime("10s", "SP", function () { $scope.getSupports(); });

    // on first focus (bubbles up to document), open the menu
    $document.on('focus', '.select2-selection.select2-selection--single', function (e) {
        angular.element(this).closest(".select2-container").siblings('select:enabled').select2('open');
    });

    // steal focus during close - only capture once and stop propogation
    angular.element('select.select2').on('select2:closing', function (e) {
        angular.element(e.target).data("select2").$selection.one('focus focusin', function (e) {
            e.stopPropagation();
        });
    });

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

                ctrl.jdSvc.updateGPS(ctrl.currentJob, $event.currentTarget.attributes["data-field"].nodeValue);

            }
        }
    ];

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
                            return {id: obj.locationId, text: obj.label.split(", ").reverse().join(", ")};
                        })
                    };
                }
            },
            escapeMarkup: function (markup) {
                return markup;
            }
        };

        angular.element("#location").select2(options).on("select2:select", function (e) {
            $.getJSON("https://geocoder.cit.api.here.com/6.2/geocode.json", {
                app_id: "bBPfh2x8Cauun3ygLMAx",
                app_code: "yjfwTdkin_R2rGXYTrwWVg",
                locationId: e.params.data.id
            }).done(function (data) {
                var locn = data.Response.View[0].Result[0].Location;
                console.log("Suburb = " + locn.Address.District);
                console.log("PostCode = " + locn.Address.PostalCode);
                angular.element("#suburb").val(locn.Address.District);
                var mappedSub = ctrl.jdSvc.pickSuburbs.find(obj => obj.text === locn.Address.District || obj.alias === locn.Address.District);
                if (mappedSub !== undefined) {
                    console.log(mappedSub);
                    angular.element('#our_suburb').val(mappedSub.id).trigger('change');
                } else {
                    angular.element('#our_suburb').val(null).trigger('change');
                }


                ctrl.jdSvc.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                ctrl.jdSvc.gpsForm.data.long = locn.DisplayPosition.Longitude;
                ctrl.jdSvc.gpsForm.data.address = locn.Address.Label;
                var ll = new google.maps.LatLng(locn.DisplayPosition.Latitude, locn.DisplayPosition.Longitude);
                $scope.map.setCenter(ll);
                $scope.marker.setPosition(ll);

            });
        });

        var suburbOptions = {
            minimumInputLength: 1,
            data: ctrl.jdSvc.pickSuburbs
        };

        angular.element("#our_suburb").select2(suburbOptions);

        waitingDialog.hide();
    };

    ctrl.closeSupport = support => {
        DispatchData.closeSupport(support.eventId, ContactID).then(data => {
            $scope.getSupports();
            $scope.currentSupport = null;
        });
    }

    ctrl.createEvent = function (event, job) {
        $mdDialog.show({
            controller: AddEventDialogController,
            controllerAs: "ctrl",
            templateUrl: "app/components/dialogs/add-event-dialog/add-event-dialog.html",
            parent: angular.element($document.body),
            targetEvent: event,
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                job: job,
                dispatherName: FirstName,
                contactId: ContactID
            }
        }).then(() => {
            $scope.getData().then(() => {
                console.log('Pallet Dialog closed!');
            });
        });
    };

    ctrl.truckLoadingStatus = function (event) {
        $mdDialog.show({
            controller: TruckCourierStatusDialogController,
            controllerAs: 'ctrl',
            parent: angular.element($document.body),
            targetEvent: event,
            templateUrl: "app/components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                data: $scope.truckCourierStatus[0],
            },
        }).then(() => {
            // Dialog Closed
        });
    };

    ctrl.courierSearchText = "";
    /**
     * @param {string} searchText
     */
    ctrl.courierSearch = async searchText => {
        try {
            const url = "/courier/AllActiveSearch";
            return await DispatchData.autocompleteSearch(searchText, url);
        } catch (error) {
            toastrService.showErrorToast(error.message);
        }
    }

    ctrl.selectedCourierChange = function (courier) {
        if (courier === undefined) {
            ctrl.selectedCourier = null;
            $scope.currentCourier = null;
        } else {
            this.updateCourierData(courier.id, courier.text);
        }
    };

    // Load custom layout
    ctrl.init = function () {
        if (Modernizr.localstorage) {
            const storedLayouts = localStorage.getItem("layoutsNW-" + ContactID);
            const lastActiveLayoutName = localStorage.getItem("lastActiveLayoutNW-" + ContactID);

            if (storedLayouts) {
                ctrl.layouts = JSON.parse(storedLayouts);
                if (lastActiveLayoutName) {
                    const lastActiveLayoutIndex = ctrl.layouts.findIndex(l => l.name === lastActiveLayoutName);

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

    let keyIsDown = {};
    let mouseDown = 0;

    function disabledEventPropagation(e) {
        if (e.keyCode === 68 && e.ctrlKey) {
            if (e.stopPropagation) {
                e.stopPropagation();
            } else if ($window.event) {
                $window.event.cancelBubble = true;
            }
        }
    }

    function sizeHeadings(ele) {
        angular.element("body").find(".box").each(function () {
            const box = angular.element(this);
            box.find(".table-headings thead tr th").each(function (index) {
                const newWidth = box.find(".table tbody tr td").eq(index).outerWidth();
                angular.element(this).outerWidth(newWidth);
            });
            box.find(".table-headings table").width(box.find(".table").width());
        });

        const height = angular.element("#box-clearLists").find(".box-content").height() - 30;

        angular.element(".clearLists-list").each(function () {
            const newHeight = angular.element(this).data("height") * height / 100;
            angular.element(this).height(newHeight);
        });
    }

    function overrideKeyboardEvent(e) {
        switch (e.type) {
            case "keydown":
                if (!keyIsDown[e.keyCode]) {
                    keyIsDown[e.keyCode] = true;
                    // do key down stuff here
                    if (e.keyCode === 82 && e.ctrlKey) {
                        //location.reload();
                    }
                    if (e.keyCode === 113) {
                        let sc = angular.element('box-jobDetail').scope();

                        sc.gather.form = {
                            id: "smsCustomer",
                            title: "Enter your Message (160 chars)",
                            fields: [
                                {
                                    "name": "editMessage",
                                    "label": "Message",
                                    "type": "sms",
                                    "value": ""
                                },
                                {
                                    "name": "courier",
                                    "label": "Courier",
                                    "type": "select2"
                                }
                            ],
                            onSubmit: function () {
                                console.log(sc.gather.form.fields[1]);
                                const foundCourier = sc.pickCouriers.find(c => c.id === sc.gather.form.fields[1].value);
                                return sc.sendSMS(foundCourier.courierID, sc.gather.form.fields[0].value).then(data => {
                                    sc.gather.cancel();
                                    alert("Message Sent");
                                });


                            },
                            submitValue: "Send Message"
                        };

                        sc.gather.showForm();


                        $timeout(() => {
                            sc.$apply();

                            const statusOptions = {
                                minimumInputLength: 0,
                                data: sc.pickCouriers,
                                placeholder: "Start typing to choose courier..."
                            };

                            angular.element(".gatherForm #gather-courier").select2(statusOptions);
                            angular.element(".gatherForm #gather-courier").select2('open');


                        }, 200);
                    }
                }
                break;
            case "keyup":
                delete (keyIsDown[e.keyCode]);
                // do key up stuff here
                break;
            default:
                break;
        }
        disabledEventPropagation(e);
        if (e.keyCode === 68 && e.ctrlKey) {
            e.preventDefault();
            return false;
        }
    }

    $document.on('keydown', '.dispatchField, .lateCallField', function (event) {
        if (event.keyCode === 13) {
            angular.element(this).parents(".clickable-row").addClass("doing");
        }
    });

    $document.on('click', '.top-bar .btn-group .btn', function (event) {
        if (!event.ctrlKey) {
            angular.element(this).parent().find('.topBarActive').removeClass('topBarActive');
        }

        angular.element(this).addClass('topBarActive');
    });


    $document.on('ready', function () {
        const favicon = document.getElementById("favicon");
        favicon.setAttribute("href", "/Nationwide.ico");
        let isDown = false;   // Tracks status of mouse button

        $document.on('mousedown', function () {
            isDown = true;      // When mouse goes down, set isDown to true
        })
            .on('mouseup', function () {
                isDown = false;    // When mouse goes up, set isDown to false
            });

        $document.on("mouseenter", ".activeTable .clickable-row", function (event) {
            if (event.ctrlKey) {
                if (isDown) {        // Only change css if mouse is down
                    angular.element(this).addClass("active");
                    angular.element(this).siblings(".test").click();
                }
            }
        });
    });

    $document.on('mousedown', '.clickable-row', function (event) {
        let jobNo;
        let group;
        if (angular.element(".activeTable .clickable-row.active").length > 1) {
            jobNo = angular.element(".activeTable .clickable-row.active").length + " Jobs";
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

                    $timeout(() => {
                        if (mouseDown === 1) {
                            angular.element("#draggingItems").show();
                            angular.element("#draggingItems").html(jobNo);

                            angular.element("#draggingItems").css({"top": event.pageY - 25, "left": event.pageX - 50});
                            angular.element("#draggingItems").draggable();
                            angular.element("#draggingItems").trigger(event);
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
            if (angular.element(this).hasClass("active")) {
            } else {
                const group = angular.element(this).parents(".table-rows").attr("data-group");

                angular.element('*[data-group="' + group + '"]').each(function () {
                    angular.element(this).find('.active').removeClass('active');
                });
                angular.element(this).addClass('active');
            }
        }
    });

    $document.on("mouseup", function (ev) {
        angular.element("#draggingItems").hide();
        mouseDown = 0;
    });

    $document.on("keydown", function (e) {
        const code = (e.keyCode ? e.keyCode : e.which);
        if (code === 40) {
            angular.element(".activeTable").find(".active").removeClass("active").next().addClass("active").mouseup().click();
        } else if (code === 38) {
            angular.element(".activeTable").find(".active").removeClass("active").prev().addClass("active").mouseup().click();
        }
    });


    $document.onkeydown = overrideKeyboardEvent;
    $document.onkeyup = overrideKeyboardEvent;
}

angular
    .module("uDispatch").controller("NationwideControl",
    ["$scope",
        'JobDetailService',
        "NWData",
        "$state",
        "$filter",
        "$parse",
        "hotkeys",
        "NgMap",
        "$q",
        "$timeout",
        "greetingService",
        "$mdDialog",
        "$document",
        "$window",
        "toastrService",
        "DispatchData",
        "moment",
        NationwideController]);


function Deg2Rad(deg) {
    return deg * Math.PI / 180;
}

function PythagorasEquirectangular(lat1, lon1, lat2, lon2) {
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
        const dif = PythagorasEquirectangular(latitude, longitude, locations[index][1], locations[index][2]);
        if (dif < minDifference) {
            closest = index;
            minDifference = dif;
        }
    }

    // return the nearest location
    return (locations[closest]);
}
