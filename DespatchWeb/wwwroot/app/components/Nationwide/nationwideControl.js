angular.module("uDispatch").controller("NationwideControl", [
    "$scope",
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
    "versionUrl",
    ($scope, jdSvc, NWData, $state,
     $filter, $parse, hotkeys, NgMap, $q, $timeout, greetingService,
     $mdDialog, $document, $window, toastrService, DispatchData, moment, versionUrl) => {
        $scope.isInternal = (ClientInternal === "True");
        $scope.jdSvc = jdSvc;
        $scope.name = "Nationwide";
        $scope.jobDetailFabIsOpen = false;
        $scope.courierListFabIsOpen = false;

        $scope.greetUser = () => greetingService.greetUser($scope.userName)

        $scope.updateGPS = (currentJob, field, fromRightClick) => {
            $scope.jdSvc.updateGPS(currentJob, field, fromRightClick);
        };

        jdSvc.setSelectJobDetail(() => {
            const j = $scope.currentJob;
            jdSvc.setJob($scope.currentJob);
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
                            $timeout(() => {
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
                                $timeout(() => {
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


        $scope.gather = {
            submit: () => $scope.gather.form.onSubmit().then(response => {

                angular.element('.gatherForm').css('display', 'none');
                $scope.getData().then(() => {
                    console.log('Get Data Complete');
                });

            }),
            cancel: () => {
                angular.element('.gatherForm').css('display', 'none');
            },
            showForm: () => {
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

        $scope.jdSvc.setGather($scope.gather);
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
        $scope.getJobStyle = assigned => {
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
                "tpl": versionUrl("app/components/Nationwide/tpls/jobList.tpl"),
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListPOD": {
                "title": "Awaiting POD",
                "tpl": versionUrl("app/components/Nationwide/tpls/jobListPOD.tpl"),
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListDelivery": {
                "title": "Action Required",
                "tpl": versionUrl("app/components/Nationwide/tpls/jobListDelivery.tpl"),
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListReprice": {
                "title": "Reprice",
                "tpl": versionUrl("app/components/Nationwide/tpls/jobListReprice.tpl"),
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
                "tpl": versionUrl("app/components/Nationwide/tpls/map.tpl"),
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
        let layoutsObject = null;
        if (Modernizr.localstorage) {
            layoutsObject = JSON.parse(localStorage.getItem("layoutsNW-" + ContactID));
            $scope.mapZoom = JSON.parse(localStorage.getItem("mapZoomNW-" + ContactID)) || {display: true};
        }
        const defaultLayout = [
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
        $scope.currentLayoutName = "default";
        $scope.truckMode = "On";
        $scope.supportChannel = "All";

        $scope.groupJobsSelection = "";
        $scope.currentWorkSelection = "";
        $scope.potentialCouriersSelection = "";

        $scope.storeMapZoomDisplay = () => {
            if (Modernizr.localstorage) {
                localStorage.setItem("mapZoomNW-" + ContactID, JSON.stringify($scope.mapZoom));
            }
        }

        $scope.layout = angular.copy($scope.layouts[0].layout);

        $scope.deleteLayout = index => {
            const deleteConfirm = $mdDialog.confirm()
                .title('Delete Layout?')
                .textContent('Are you sure you would like to delete this layout?')
                .ariaLabel('delete layout')
                .ok('Delete')
                .cancel('Cancel');

            $mdDialog.show(deleteConfirm).then(() => {
                $scope.layouts.splice(index, 1);
                if (Modernizr.localstorage) {
                    localStorage.setItem("layoutsNW-" + ContactID, JSON.stringify($scope.layouts));
                }
            }, () => {
                console.log("Delete layout canceled!");
            });
        }

        $scope.setLastActiveLayoutName = layoutName => {
            if (Modernizr.localstorage) {
                localStorage.setItem("lastActiveLayoutNW-" + ContactID, layoutName);
            }
        };

        $scope.loadLayout = i => {
            $scope.currentLayoutName = $scope.layouts[i].name;
            $scope.layout = angular.copy($scope.layouts[i].layout);

            // save layout as last active
            $scope.setLastActiveLayoutName($scope.currentLayoutName);

            $timeout($scope.getData, 1000);
        };

        $scope.saveLayout = () => {
            angular.forEach($scope.layout.columns,
                (column, colKey) => {
                    column.width = angular.element("#co-" + column.id).css("flex-basis");
                    angular.forEach(column.boxes,
                        (box, boxKey) => {
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
                    $scope.layouts = $scope.layouts.concat(
                        {
                            name: layoutName,
                            layout: angular.copy($scope.layout)
                        });
                    localStorage.setItem("layoutsNW-" + ContactID, JSON.stringify($scope.layouts));

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

        $scope.attention = job => {

            let temp = "";

            if (job.direct) {
                temp += "DIRECT ";
            }
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
            activate: (e, ui) => {
                const box = angular.element("#" + ui.item.context.id);
                const parent = box.parent();
                parent.find(".box").each(function () {
                    angular.element(this).attr("data-height", angular.element(this).height() + "px");
                });
            },
            update: (e, ui) => {
                $timeout(() => {
                    const box = angular.element("#" + ui.item.context.id);
                    const parent = box.parent();
                    parent.find(".box").each(function () {
                        angular.element(this).css({"flex-basis": angular.element(this).attr("data-height")});
                    });
                    parent.find(".box").last().css({"flex-basis": "0"});
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
                if (angular.element(".activeTable .active").length > 0) {
                    $scope.dispatchJobsForm();
                }
            }
        });

        hotkeys.add({
            combo: "esc",
            description: "Close gather screen",
            allowIn: ["INPUT", "SELECT", "TEXTAREA"],
            callback: (event, hk) => {
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
            callback: (event, hk) => {
                if (angular.element(".gatherForm").is(":visible") === true) {
                    $timeout($scope.gather.submit(), 0);
                }
                if (event.srcElement.id === "gps") {
                    $scope.searchCourier(event.srcElement.value);
                }
            }
        });

        $scope.unlockJob = () => $scope.jdSvc
            .unlockJob($scope.currentJob);

        $scope.lockJob = () => $scope.jdSvc
            .lockJob($scope.currentJob);

        $scope.selectClearList = (id, event, area) => {
            angular.element("#area-group .btn").removeClass("topBarActive");
            angular.element(".clearLists-list-title").removeClass("listActive");
            angular.element(event.currentTarget).addClass("listActive");
            $scope.getClearListEnvelope(id);
            $scope.setFilters({'area': area});
        };

        $scope.selectForDispatch = job => {
            console.log("In SelectForDispatch");
            $scope.jobForDispatch = job;
        };


        $scope.voidJobForm = (jobNumber, jobId) => {
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
                onSubmit: () => NWData.addNote(jobId, $scope.gather.form.fields[0].value, FirstName, false).then(() => NWData.voidJob(jobId)),
                submitValue: "Confirm"
            };
            $scope.gather.showForm();

        };

        $scope.sendSMS = (courierId, message) => NWData.sendSMS(courierId, ContactID, FirstName, message);

        $scope.otherEventForm = jobNumber => {

            const time = new Date();
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
                submit: () => NWData.addOtherEvent($scope.currentJob.jobNo, $scope.currentJob.clientId, $scope.currentJob.contactName, ContactID, $scope.currentJob.courierData.courierID, $scope.currentJob.id, $scope.currentJob.jobType, FirstName, $scope.eventForm.data.notes).then(() => {
                    angular.element(".eventForm").hide();
                }),
                cancel: () => {
                    angular.element(".eventForm").hide(0);
                }
            };

            angular.element(".eventForm").show(0);


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

        $scope.getStatusClass = job => {
            //[txtJobDone].[Value] = 0 And[txtFollowupTime].[Value] < Now() And[ucjbSpeed] In(6, 7, 21)
            const n = new Date();
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
        $scope.dispatchJobsForm = () => {
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
                onSubmit: () => $scope.dispatchJobs(angular.element("#gather-courierNumber").val()),
                submitValue: "Dispatch"
            };
            $scope.gather.showForm();

        };

        $scope.dispatchDroppedMarkerToClosestCourier = (lat, lng, flags, carMarker, jobNumber) => {
            if (flags.length === 0 && carMarker === null) {
                $scope.showConfirm = () => {
                    const confirm = $mdDialog.confirm()
                        .title('Dispatch Invalid')
                        .textContent('Could not find courier for Dispatch')
                        .ok('Close')
                        .cancel('Cancel');

                    $mdDialog.show(confirm).then(() => {
                        const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                        displayPickupPoints(unDispatchedData, true, null);
                        $scope.getAvailableCourierLocation();
                    }, () => {
                        // This will be executed if the user cancels the dialog.
                        // Handle the cancel action here
                    });
                };
                return;
            }
            console.log(jobNumber);

            const toCompare = [];

            angular.forEach(flags, (f, key) => {
                toCompare.push([key, f.position.lat(), f.position.lng()]);
            });

            if (carMarker !== null) {
                toCompare.push([9999, carMarker.position.lat(), carMarker.position.lng()]);
            }

            const closestIndex = closestLocation(lat, lng, toCompare);
            const closestCourier = closestIndex[0] === 9999 ? carMarker : flags[closestIndex[0]];
            const foundCourier = $scope.pickCouriers.find(c => c.courierID === closestCourier.courierId);

            let dispTo = closestCourier.code;
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
            }, () => {
                let unDespatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                displayPickupPoints(unDespatchedData, true, null);
                $scope.getAvailableCourierLocation();
            });
            //return closestJob;

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
        $scope.lateCall = (lateTime, lateType, j, calc) => NWData.lateCall(lateType, lateTime, j.minutes, j.pickupTime, j.alertLatePickup, j.deliveryTime, j.alertLateDelivery, j.jobNo, j.clientId, j.contactName, ContactID, j.time, j.id, j.jobType, j.speed, j.notify || j.speed, FirstName, calc).then(response => {
            $scope.getData().then(() => {


            });
            return response;
        });

        ////////////////////////////////////////
        // DISPATCH THE JOBS FROM NEW WINDOW PANE
        ///////////////////////////////////////
        $scope.dispatchJobsFromNew = courier => {
            const foundCourier = $scope.pickCouriers.find(c => c.id === courier);
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

            const callData = {
                "call": "dispatchJobs",
                "courier": courier,
                "jobs": []
            };

            const reset = () => {
                angular.element(".activeTable .active").each(() => {
                    const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                    j.courier = null;
                });
            };

            angular.element("#jobList .active").each(function () {
                const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
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
                    NWData.addFollowupEvent(jn, j.clientId, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
                }

                callData.jobs.push(angular.element(this).attr("data-jobid"));
            });

            return NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(response => {
                $scope.getData().then(() => {
                    //angular.element("#box-jobDetail").find(".loading").show();
                    angular.element("#box-map").find(".loading").show();

                    $scope.courier = {gpsCourier: foundCourier.id};
                    $scope.searchCourier();
                    $timeout(() => {
                        angular.element("#jobList tr").first().find(".dispatchField").focus();
                    }, 200);

                });
                return response;
            });


        };

        ////////////////////////////////////////
        // DISPATCH THE JOBS FROM POD WINDOW PANE
        ///////////////////////////////////////
        $scope.dispatchJobsFromPOD = courier => {
            const foundCourier = $scope.pickCouriers.find(c => c.id === courier);
            if (foundCourier === undefined) {
                alert("Invalid Courier");
                return;
            }

            const callData = {
                "call": "dispatchJobs",
                "courier": courier,
                "jobs": []
            };

            const reset = () => {
                angular.element(".activeTable .active").each(() => {
                    const j = $scope.jobListPOD.find(jo => jo.id === angular.element(this).data("jobid"));
                    j.courier = null;
                });
            };

            angular.element("#jobListPOD .active").each(function () {
                const j = $scope.jobListPOD.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
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
                    NWData.addFollowupEvent(jn, j.clientId, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
                }

                callData.jobs.push(angular.element(this).attr("data-jobid"));
            });

            return NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(response => {
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

        $scope.dispatchJobsFromPotentialCouriers = courier => {
            const foundCourier = $scope.pickCouriers.find(c => c.id === courier);
            if (foundCourier === undefined) {
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent('Invalid Courier').ok('OK'));
                return;
            }

            const callData = {
                "call": "dispatchJobs",
                "courier": courier,
                "jobs": []
            };

            const reset = () => {
                angular.element("#jobList .active").each(() => {
                    const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                    j.courier = null;
                });
            };

            angular.element("#jobList .active").each(function () {
                const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
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
                    NWData.addFollowupEvent(jn, j.clientId, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
                }

                callData.jobs.push(angular.element(this).attr("data-jobid"));
            });

            return NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(response => {
                $scope.getData().then(() => {
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
        $scope.restoreJobsFromNew = () => {

            const callData = {
                "call": "restoreJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };

            let foundCourier = null;

            angular.element("#jobList .active").each(function () {
                const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
                NWData.addRestoreEvent(jn, j.clientId, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
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


            $scope.getData().then(() => {
                //angular.element("#box-jobDetail").find(".loading").show();
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();


            });


        };

        ////////////////////////////////////////
        // RESTORE JOB FROM POD WINDOW PANE
        ///////////////////////////////////////
        $scope.restoreJobsFromPOD = () => {

            const callData = {
                "call": "restoreJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };

            let foundCourier = null;

            angular.element("#jobListPOD .active").each(function () {
                const j = $scope.jobListPOD.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
                NWData.addRestoreEvent(jn, j.clientId, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
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


            $scope.getData().then(() => {
                //angular.element("#box-jobDetail").find(".loading").show();
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();


            });


        };

        ////////////////////////////////////////
        // RESTORE JOB FROM BOOK DELIVERY WINDOW PANE
        ///////////////////////////////////////
        $scope.restoreJobsFromDelivery = () => {

            const callData = {
                "call": "restoreJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };

            let foundCourier = null;

            angular.element("#jobListDelivery .active").each(function () {
                const j = $scope.jobListDelivery.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
                NWData.addRestoreEvent(jn, j.clientId, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
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


            $scope.getData().then(() => {
                //angular.element("#box-jobDetail").find(".loading").show();
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();


            });


        };

        ////////////////////////////////////////
        // REDESPATCHED JOB
        ///////////////////////////////////////
        $scope.reAllocateJobs = () => {

            const callData = {
                "call": "redespatchJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };


            let foundCourier = null;

            angular.element("#jobList .active").each(function () {
                const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
                foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
                callData.jobs.push(angular.element(this).attr("data-jobid"));
            });

            if (callData.jobs.length > 0) {
                NWData.reAllocateJobs(foundCourier.courierID, ContactID, callData.jobs);
            }

            $scope.getData().then(() => {
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();


            });


        };

        $scope.resendJobs = () => {

            const callData = {
                "call": "redespatchJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };


            angular.element("#jobList .active").each(function () {
                const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
                callData.jobs.push(angular.element(this).attr("data-jobid"));
            });

            if (callData.jobs.length > 0) {
                NWData.resendJobs(callData.jobs);
            }

            $scope.getData().then(() => {
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();
            });
        };

        $scope.restoreAll = () => {
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
                    NWData.addRestoreEvent(jn, j.clientId, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
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
            }, () => {
                // Actions to perform when 'No' is clicked.
            });
        };

        $scope.redispatchAll = () => {
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

                $scope.getData().then(() => {
                    angular.element("#box-map").find(".loading").show();
                    $scope.courier = {gpsCourier: foundCourier.id};
                    $scope.searchCourier();
                });
            }, () => {
                // Actions to perform when 'No' is clicked.
            });
        };

        $scope.resendAll = () => {
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
            }, () => {
                // Actions to perform when 'No' is clicked.
            });
        };

        $scope.reAllocateJobsFromCurrentWindow = () => {

            const callData = {
                "call": "redespatchJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": $scope.currentCourier.courierID
            };

            let foundCourier = null;
            angular.element("#currentWork .active").each(function () {
                callData.jobs.push(angular.element(this).attr("data-jobid"));
                foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID);
            });


            if (callData.jobs.length > 0) {
                NWData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
            }

            $scope.getData().then(() => {
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();


            });


        };

        $scope.resendJobsFromCurrentWindow = () => {

            const callData = {
                "call": "resendJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": $scope.currentCourier.courierID
            };

            let foundCourier = null;
            angular.element("#currentWork .active").each(function () {
                callData.jobs.push(angular.element(this).attr("data-jobid"));
                foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID);
            });


            if (callData.jobs.length > 0) {
                NWData.resendJobs(callData.jobs);
            }

            $scope.getData().then(() => {
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                $scope.searchCourier();


            });


        };

        $scope.restoreJobsFromCurrentWindow = () => {

            const callData = {
                "call": "restoreJobs",
                "jobs": [],
                "splitJobs": [],
                "jobNos": [],
                "courierID": null
            };


            let foundCourier = null;

            angular.element("#currentWork .active").each(function () {
                const j = $scope.jobsCurrentList.find(jo => jo.id === angular.element(this).data("jobid"));
                const jn = j.jobNo;
                NWData.addRestoreEvent(jn, j.clientId, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
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


        };

        //////////////////////////////
        //  SPLIT JOB //
        /////////////////////////////
        $scope.splitJob = () => {
            let jid;
            jid = angular.element(".activeTable .active").first().data("jobid");
            const j = $scope.jobList.find(jo => jo.id === jid);
            if (!j.allowSplit) {
                $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`Cannot split ${j.JobNo}.`).ok('OK'));
                return;
            }

            NWData.splitJob(j.id, FirstName).then(response => {
                $scope.getData().then(() => {
                    const refreshedJob = $scope.jobList.find(jo => jo.id === j.id);
                    $scope.selectJob(refreshedJob);
                    $timeout(() => {
                        angular.element("#jobList tr[data-jobid='" + j.id + "']").addClass("active");

                        const $parentDiv = angular.element("#jobList tr[data-jobid='" + j.id + "']").parents(".box-content");
                        let goTop = angular.element("#jobList tr[data-jobid='" + j.id + "']").offset().top;

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
                click: ($itemScope, $event, modelValue, text, $li) => {
                    //$scope.items.splice($itemScope.$index, 1);

                    const index = $scope.currentJob.PalletInfo.indexOf($itemScope.pallet);
                    $scope.currentJob.PalletInfo.splice(index, 1);

                    //LOCK WITH CURRENT USER

                }
            }
        ];


        //ACTIVATE DROP
        $scope.activateDrop = () => {
            $timeout(() => {

                    $document.on('ready', event => {
                        angular.element(".droppable-row").droppable({
                            classes: {
                                "ui-droppable-hover": "active"
                            },
                            drop: function (event, ui) {
                                //angular.element(this).addClass("active");


                                //STOP DROPPABLE FIRING OUTSIDE ITS CONTAINER & HIDDEN
                                const parent = angular.element(this).parents(".box");
                                const parentOffset = parent.offset();
                                const parentTop = parentOffset.top;
                                const parentBottom = parentTop + parent.outerHeight();

                                const row = angular.element(this);
                                const rowOffset = row.offset();
                                const rowTop = rowOffset.top;
                                const rowBottom = rowTop + row.outerHeight();

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

        $scope.getPotentialCouriers = jobId => {

            angular.element("#box-potentialCouriers .loading").show();
            NWData.getPotentialCouriers(jobId).then(data => {
                $scope.potentialCouriers = data;

                //Set headings
                $timeout(() => {
                    sizeHeadings(angular.element("#potentialCouriers").parents(".column"));
                }, 1000);
                $timeout(() => {
                    sizeHeadings(angular.element("#potentialCouriers").parents(".column"));
                }, 2000);

                angular.element("#box-potentialCouriers .loading").fadeOut();

                $scope.activateDrop();

            });

        };


        // Search Courier GPS
        $scope.searchCourier = () => {
            angular.element("#box-currentWork").find(".loading").show();
            angular.element("#box-map").find(".loading").show();
            const ac = $scope.pickCouriers.find(c => c.id === $scope.courier.gpsCourier);
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
        };

        // Select the courier
        $scope.selectCourier = courier => {


            angular.element("#box-jobDetail").find(".loading").show();
            angular.element("#box-map").find(".loading").show();
            if (courier.courier === undefined) {
                courier.courier = courier.code + ' ' + courier.firstName;
            }
            console.log(courier);
            $scope.getCurrentJobs(courier.courierID);
            $scope.currentWorkSelection = " for Courier " + courier.courier;

            //SHOW MAP
            $scope.currentCourier = courier;

            $timeout(() => {
                    $document.on('ready', event => {
                        angular.element("#box-jobDetail").find(".loading").fadeOut();
                        angular.element("#box-map").find(".loading").fadeOut();
                    });
                },
                100);

            NWData.truckCourierStatus(courier.courierID).then(result => {
                $scope.truckCourierStatus = result.data;
            });
        };

        $scope.refreshTruckCourierStatus = () => {
            NWData.truckCourierStatus($scope.currentCourier.courierID).then(result => {
                $scope.truckCourierStatus = result.data;
            });
        };

        $scope.selectMapCourier = courier => {
            angular.element("#box-jobDetail").find(".loading").show();
            angular.element("#box-map").find(".loading").show();

            angular.element("#box-currentWork").find(".loading").show();
            const foundCourier = $scope.pickCouriers.find(x => x.courierID === courier.courierID);
            $scope.currentCourier = {
                courierID: foundCourier.courierID,
                courier: foundCourier.label
            };
            NWData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done").then(data => {
                angular.element("#box-currentWork").find(".loading").fadeOut();

                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    displayRoutePointsOnly(data, false, $scope.mapZoom.display);
                }
                $scope.activateDrop();
                $timeout(() => {
                    sizeHeadings(angular.element("#currentWork").parents(".column"));
                }, 1000);
                $timeout(() => {
                    sizeHeadings(angular.element("#currentWork").parents(".column"));
                }, 2000);
            });
            $scope.currentWorkSelection = " for Courier " + courier.label;


            $timeout(() => {
                $document.on('ready', event => {
                    angular.element("#box-jobDetail").find(".loading").fadeOut();
                    angular.element("#box-map").find(".loading").fadeOut();
                });
            }, 100);

            NWData.truckCourierStatus(courier.courierID).then(data => {
                $scope.truckCourierStatus = data;
            });

        };

        $scope.selectPotentialCourier = courier => {
            angular.element("#box-jobDetail").find(".loading").show();
            angular.element("#box-map").find(".loading").show();
            if (courier.courier === undefined) {
                courier.courier = courier.code + ' ' + courier.firstName;
            }

            if ($scope.jobList.length > 0) {
                const jid = angular.element("#jobList .active").last().data("jobid");
                const currentJob = $scope.jobList.find(jo => jo.id === jid);
                const undespatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                displayPickupPoints(undespatchedData, true, currentJob);
            }

            angular.element("#box-currentWork").find(".loading").show();
            const code = $scope.pickCouriers.find(x => x.courierID === courier.courierID).id;
            NWData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done").then(data => {
                angular.element("#box-currentWork").find(".loading").fadeOut();
                if ($scope.currentJob !== null && $scope.currentJob.courier !== code) {
                    $scope.currentJob = null;
                }
                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    displayRoutePoints(data, false);
                } else {
                    NWData.getCourierPosition(code).then(posData => {
                        displayCourierPositionOnly(posData.latitude, posData.longitude);
                    });
                }
                $scope.activateDrop();
                $timeout(() => {
                    sizeHeadings(angular.element("#currentWork").parents(".column"));
                }, 1000);
                $timeout(() => {
                    sizeHeadings(angular.element("#currentWork").parents(".column"));
                }, 2000);
                $scope.getAvailableCourierLocation();
            });
            $scope.currentWorkSelection = " for Courier " + courier.courier;

            $scope.currentCourier = courier;

            $timeout(() => {
                $document.on('ready', event => {
                    angular.element("#box-jobDetail").find(".loading").fadeOut();
                    angular.element("#box-map").find(".loading").fadeOut();
                });
            }, 100);


        };

        ////////////////////////////
        // GROUPED JOBS
        ////////////////////////////

        $scope.getGroupedJobs = (jobs, courier) => {

            angular.element("#box-jobGroups").find(".loading").show();

            NWData.getJobsGrouped().then(data => {

                angular.element("#box-jobGroups").find(".loading").fadeOut();

                $scope.jobGroups = data;

                $timeout(() => {
                    sizeHeadings(angular.element("#jobGroups").parents(".column"));
                }, 1000);
                $timeout(() => {
                    sizeHeadings(angular.element("#jobGroups").parents(".column"));
                }, 2000);

            });

        };

        ////////////////////////////
        // CURRENT JOBS
        ////////////////////////////

        $scope.getCurrentJobs = courierId => {

            angular.element("#box-currentWork").find(".loading").show();
            const foundCourier = $scope.pickCouriers.find(x => x.courierID === courierId);
            const code = foundCourier !== undefined ? $scope.pickCouriers.find(x => x.courierID === courierId).id : "";
            NWData.getJobsCurrent(courierId, $scope.jobFilters.status === "done").then(data => {
                angular.element("#box-currentWork").find(".loading").fadeOut();
                /*
                if (self.currentJob !== undefined && self.currentJob !== null && self.currentJob.courier !== code) {
                    self.currentJob = null;
                }
                */
                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    displayRoutePoints(data, true);
                } else {
                    NWData.getCourierPosition(code).then(posData => {
                        displayCourierPositionOnly(posData.latitude, posData.longitude);
                    });
                }
                $scope.activateDrop();
                $timeout(() => {
                    sizeHeadings(angular.element("#currentWork").parents(".column"));
                }, 1000);
                $timeout(() => {
                    sizeHeadings(angular.element("#currentWork").parents(".column"));
                }, 2000);
            });

        };

        let filtersObject = null;
        if (Modernizr.localstorage) {
            filtersObject = JSON.parse(localStorage.getItem("dispNW-filters-" + ContactID));
        }
        $scope.jobFilters = filtersObject || {"status": "all", "area": "mainfu", "order": "", "asc": "asc"};
        var f = ".top-bar .btn-group .btn." + $scope.jobFilters.status;
        angular.element(f).addClass("topBarActive");
        const areas = $scope.jobFilters.area.split(',');
        for (var i = 0; i < areas.length; i++) {
            f = ".top-bar .btn-group .btn." + areas[i];
            angular.element(f).addClass("topBarActive");
        }

        $scope.sort["jobList"] = "remain";

        $scope.setFiltersFromTopBar = data => {
            angular.element('.clearLists-list-title').removeClass('listActive');
            $scope.setFilters(data);
        };

        $scope.setFilters = data => {
            $timeout(() => {
                if (data.status) {
                    $scope.jobFilters.status = data.status;
                }


                if (data.area) {
                    const selected = angular.element("#area-group > .btn.topBarActive").length;
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

        $scope.selectJobDetail = job => {
            $scope.currentJob = job;
            $scope.currentSupport = null;
            $scope.potentialCouriers = false;
            $scope.potentialCouriersSelection = " for Job " + job.jobNo;
        };

        $scope.selectSupportJobDetail = support => {
            console.log("select Job  " + support.jobId);

            $scope.currentSupport = support;
            angular.element("#box-jobDetail").find(".loading").show();

            NWData.getJobDetail(support.jobId).then(data => {
                $scope.currentJob = data;
                angular.element("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + support.jobNumber;
                const jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true, $scope.mapZoom.display);

                if ($scope.mapZoom.display) {
                    setMapBounds();
                    map.setZoom(12);
                }

            });


        };

        $scope.loadRelatedJobDetail = (id, jn) => {
            angular.element("#box-jobDetail").find(".loading").show();
            NWData.getJobDetail(id).then(data => {
                $scope.currentJob = data;
                angular.element("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + jn;
            });
        }

        $scope.selectJob = (job, clear) => {
            $timeout(() => {
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
            $scope.currentJob = job;
            $scope.$apply();
            console.log(job);
            jdSvc.setJob($scope.currentJob);
        }

        function updateData(job, clear) {
            NWData.getActiveCouriers().then(data => {
                $scope.pickCouriers = data;
            });
            if (job.rootParentID) {
                NWData.getRelatedJobs(job.rootParentID, job.clientId).then(data => {
                    //data = data.filter(item => item.id !== job.id);
                    $scope.currentJob.relatedJobs = data;
                });
            }
            if (clear === true && job.courier === null) {
                processClearSettings(job);
                displayRoutePoints([job], false);
            } else {
                $scope.potentialCouriers = false;
                $scope.selectCourier(job.courierData);
            }
            $scope.currentCourier = null;
            $scope.currentSelection = " for Job " + job.jobNo;
            const undespatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
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

        $scope.setCurrentWorkMenu = () => {
            const multiple = angular.element(".activeTable .active").length > 1;

            return [
                {
                    text: "Restore",
                    click: ($itemScope, $event, modelValue, text, $li) => {
                        $scope.restoreJobsFromCurrentWindow();
                    }
                },
                {
                    text: "Redispatch",
                    click: ($itemScope, $event, modelValue, text, $li) => {
                        $scope.reAllocateJobsFromCurrentWindow();
                    }
                },
                {
                    text: "Resend",
                    click: ($itemScope, $event, modelValue, text, $li) => {
                        $scope.resendJobsFromCurrentWindow();
                    }
                }

            ];
        };


        $scope.fromColumnClick = evt => {
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
                    $timeout(() => {
                        $scope.jdSvc.updateGPS($scope.currentJob, 'fromAddress', true);
                    }, 100);

                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.toColumnClick = evt => {
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
                    $timeout(() => {
                        $scope.jdSvc.updateGPS($scope.currentJob, 'toAddress', true);
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
                    $timeout(() => {
                        const dueTime = moment($scope.currentJob.booked).add($scope.currentJob.lp || $scope.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');
                        const items = [];
                        for (let i = 1; i < 37; i++) {
                            if (parseInt(dueTime) < (i * 5))
                                items.push({"id": (i * 5), "text": ((i * 5).toString() + " mins away")});
                        }

                        $scope.lateForm = {
                            "data": {
                                "jobNum": $scope.currentJob.jobNo,
                                "client": $scope.currentJob.client,
                                "dueMins": dueTime,
                                "choose": ""
                            },
                            submit: () => {
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
                            },
                            cancel: () => {
                                $scope.lateForm.data = null;
                                angular.element("#AwayMins").select2().empty();
                                angular.element("#AwayMins").select2('destroy');
                                angular.element(".lateForm").hide(0);
                            }
                        };
                        $scope.$apply();
                        angular.element(".lateForm").show(0);

                        $timeout(() => {

                            const dueOptions = {
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

        $scope.speedColumnClick = $event => {
            switch ($event.which) {
                case 1:
                    // this is left click
                    break;
                case 2:
                    // in case you need some middle click things
                    break;
                case 3:
                    // this is right click
                    $timeout(() => {
                        $scope.jdSvc.speedClick($event, $scope.currentJob);
                        $scope.$apply();
                    }, 400);

                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.clientColumnClick = $event => {
            switch ($event.which) {
                case 1:
                    // this is left click
                    break;
                case 2:
                    // in case you need some middle click things
                    break;
                case 3:
                    // this is right click
                    $timeout(() => {
                        $scope.jdSvc.clientClick($event, $scope.currentJob);
                        $scope.$apply();
                    }, 400);

                    break;
                default:
                    console.log("you have a strange mouse!");
                    break;

            }
            return false;
        };

        $scope.notifyColumnClick = $event => {
            switch ($event.which) {
                case 1:
                    // this is left click
                    break;
                case 2:
                    // in case you need some middle click things
                    break;
                case 3:
                    // this is right click
                    $timeout(() => {
                        $scope.jdSvc.notifyClick($event, $scope.currentJob);
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

        $scope.setEventsMenu = () => {
            return [
                {
                    text: "Void Job",
                    click: ($itemScope, $event, modelValue, text, $li) => {
                        $scope.voidJobForm($scope.currentJob.jobNo, $scope.currentJob.id);
                    }
                },

                {
                    text: "Add Event - Other",
                    click: ($itemScope, $event, modelValue, text, $li) => {
                        $scope.otherEventForm($scope.currentJob.jobNo);
                    }
                }
            ];
        };

        $scope.setJobsMenu = () => {
            const multiple = angular.element(".activeTable .active").length > 1;
            let lastCourier = null;
            let sameCourier = true;
            angular.element(".activeTable .active").each(() => {
                const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
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
            let multipleMenu = [
                {
                    text: "Dispatch Selected",
                    click: ($itemScope, $event, modelValue, text, $li) => {
                        $scope.dispatchJobsForm();
                    }
                },
                {
                    text: "Re-dispatch Selected",
                    click: ($itemScope, $event, modelValue, text, $li) => {
                        //$scope.items.splice($itemScope.$index, 1);
                    }
                }
            ];
            if (sameCourier) {
                multipleMenu.push(
                    {
                        text: "Restore Selected",
                        click: ($itemScope, $event, modelValue, text, $li) => {
                            $scope.restoreJobs();
                        }
                    },
                    {
                        text: "Redispatch Selected",
                        click: ($itemScope, $event, modelValue, text, $li) => {
                            $scope.reAllocateJobs();
                        }
                    },
                    {
                        text: "Resend Selected",
                        click: ($itemScope, $event, modelValue, text, $li) => {
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
                            click: ($itemScope, $event, modelValue, text, $li) => {
                                $scope.dispatchJobsForm();
                            }

                        }
                    ];
            }


            const fullMenu =
                [
                    {
                        text: "Dispatch",
                        click: ($itemScope, $event, modelValue, text, $li) => {
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
                        click: ($itemScope, $event, modelValue, text, $li) => {
                            $scope.restoreJobs();
                        }
                    },
                    {
                        text: "Redispatch",
                        click: ($itemScope, $event, modelValue, text, $li) => {
                            $scope.reAllocateJobs();
                        }
                    },
                    {
                        text: "Resend",
                        click: ($itemScope, $event, modelValue, text, $li) => {
                            $scope.resendJobs();
                        }
                    }
                );
            }
            return multiple ? multipleMenu : fullMenu;
        };

        $scope.setTruckMode = mode => {
            $scope.truckMode = mode;
            $scope.getData();
        };

        $scope.setSupportChannel = channel => {
            $scope.supportChannel = channel;
            $scope.getSupports();
        };

        $scope.getAvailableCourierLocation = () => {
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
                .then(returnData => {
                    displayAvailableCouriers(returnData, $scope.currentCourier === false || $scope.currentCourier === null ? 0 : $scope.currentCourier.courier.split(" ")[0].trim(), channels, trucks, $scope.truckMode, $scope.allCouriers.includeUA);
                });
        };

        $scope.courierMenu = [
            // NEW IMPLEMENTATION
            {
                text: "Dispatch Selected",
                click: ($itemScope, $event, modelValue, text, $li) => {
                    //$scope.selected = $itemScope.item.name;
                    $scope.dispatchJobs($itemScope.courier.courier || $itemScope.courier.code);
                }
            }
        ];

        $scope.potentialCourierMenu = [
            {
                text: "Dispatch Selected",
                click: ($itemScope, $event, modelValue, text, $li) => {
                    //$scope.selected = $itemScope.item.name;
                    $scope.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
                }
            }
        ];

        $scope.getJobList = () => {
            if (Modernizr.localstorage) {
                localStorage.setItem("dispNW-filters-" + ContactID, JSON.stringify($scope.jobFilters));
            }
            const selectedClients = $scope.pickService.clients.map(a => a.id);

            NWData.getNationwideJobsPOD($scope.jobFilters, selectedClients, $scope.isInternal).then(data => {
                $scope.jobListPOD = data;

                $timeout(() => {
                    angular.element("#box-jobsListPOD .loading").fadeOut();
                    sizeHeadings(angular.element("#jobListPOD").parents(".column"));

                }, 200);

            });

            NWData.getNationwideJobsNew($scope.jobFilters, selectedClients, $scope.isInternal).then(data => {
                $scope.jobList = data;

                $timeout(() => {
                    angular.element("#box-jobsList .loading").fadeOut();
                    sizeHeadings(angular.element("#jobList").parents(".column"));

                }, 200);

            });

            NWData.getNationwideJobsReprice($scope.jobFilters, selectedClients, $scope.isInternal).then(data => {
                $scope.jobListReprice = data;

                $timeout(() => {
                    angular.element("#box-jobsListReprice .loading").fadeOut();
                    sizeHeadings(angular.element("#jobListReprice").parents(".column"));

                }, 200);

            });

            return NWData.getNationwideJobsBookDelivery($scope.jobFilters, selectedClients, $scope.isInternal).then(data => {
                $scope.jobListDelivery = data;

                $timeout(() => {
                    angular.element("#box-jobsListDelivery .loading").fadeOut();
                    sizeHeadings(angular.element("#jobListDelivery").parents(".column"));

                    $scope.getAvailableCourierLocation();
                }, 200);

            });
        };

        $scope.closeSupport = support => {
            NWData.closeSupport(support.eventId, ContactID).then(data => {
                $scope.getSupports();
                $scope.currentSupport = null;
            });
        }

        $scope.lockSupport = support => {
            console.log(support);
            if (support.lockedBy === Dispatcher) {
                NWData.unLockSupport(support.eventId, Dispatcher).then(data => {
                    $scope.getSupports();
                });
            } else {
                NWData.lockSupport(support.eventId, Dispatcher).then(data => {
                    $scope.getSupports();
                });
            }
        }

        $scope.getSupports = () => {
            ////////////////////////////
            // SUPPORTS
            ////////////////////////////
            angular.element("#box-supports").find(".loading").show();
            return NWData.getSupports($scope.supportChannel).then(data => {
                $scope.supports = data;


                $scope.supportMenu = [
                    // NEW IMPLEMENTATION
                    {
                        text: "Complete",
                        click: ($itemScope, $event, modelValue, text, $li) => {

                            $scope.closeSupport($itemScope.support);

                        }
                    },
                    {
                        text: "Toggle Lock",
                        click: ($itemScope, $event, modelValue, text, $li) => {

                            $scope.lockSupport($itemScope.support);


                        }
                    }
                ];


                $timeout(() => {
                        $document.on('ready', event => {
                            angular.element("#box-supports").find(".loading").fadeOut();
                            if ($scope.currentSupport) {
                                angular.element("#supports tr[data-id='" + $scope.currentSupport.eventId + "']").addClass("active");
                            }
                        });

                    },
                    100);


                $timeout(() => {
                    sizeHeadings(angular.element("#supports").parents(".column"));
                }, 1000);
                $timeout(() => {
                    sizeHeadings(angular.element("#supports").parents(".column"));
                }, 2000);
            });
        }

        $scope.getClientContacts = () => {
            NWData.getClientContacts(ContactID).then(data => {
                $scope.pickClients = data;
            });
        };

        $scope.getEventTypes = () => {
            NWData.getEventTypes().then(data => {
                $scope.pickEventTypes = data;
            });
        };


        $scope.getData = () => {

            ///////////////////////////////
            // JOB LIST
            ///////////////////////////////

            //Get Job Data

            angular.element("#box-jobsList").find(".loading").show();
            $scope.jobList = [];
            $scope.jobListPOD = [];
            $scope.currentJob = false;
            $scope.potentialCouriers = false;
            $scope.jobGroups = false;
            $scope.jobsCurrentList = false;
            $scope.currentCourier = false;


            NWData.getActiveCouriers().then(data => {
                $scope.pickCouriers = data;
            });

            ///////////////////////////
            // JOB DETAIL
            //////////////////////////
            $scope.formatDate = dateString => {
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
        angular.element('select.select2').on('select2:closing', e => {
            angular.element(e.target).data("select2").$selection.one('focus focusin', e => {
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
                click: ($itemScope, $event, modelValue, text, $li) => {
                    //$scope.selected = $itemScope.item.name;

                    console.log($event.currentTarget.attributes["data-field"].nodeValue);

                    $scope.jdSvc.updateGPS($scope.currentJob, $event.currentTarget.attributes["data-field"].nodeValue);

                }
            }
        ];

        NgMap.getMap().then(map => {
            $scope.map = map;
            $scope.marker = map.markers[0];
            $scope.onMapReady();
        });

        $scope.onMapReady = () => {
            //$scope.heremaps = heremaps;

            const options = {
                minimumInputLength: 1,
                ajax: {
                    url: 'https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json',
                    delay: 250,
                    dataType: "json",
                    data: params => ({
                        query: params.term,
                        app_id: "bBPfh2x8Cauun3ygLMAx",
                        app_code: "yjfwTdkin_R2rGXYTrwWVg",
                        beginHighlight: "<b>",
                        endHighlight: "</b>",
                        country: "NZL"
                    }),
                    processResults: data => ({
                        results: $.map(data.suggestions, obj => ({
                            id: obj.locationId,
                            text: obj.label.split(", ").reverse().join(", ")
                        }))
                    })
                },
                escapeMarkup: markup => markup
            };

            angular.element("#location").select2(options).on("select2:select", e => {
                $.getJSON("https://geocoder.cit.api.here.com/6.2/geocode.json", {
                    app_id: "bBPfh2x8Cauun3ygLMAx",
                    app_code: "yjfwTdkin_R2rGXYTrwWVg",
                    locationId: e.params.data.id
                }).done(data => {
                    const locn = data.Response.View[0].Result[0].Location;
                    console.log("Suburb = " + locn.Address.District);
                    console.log("PostCode = " + locn.Address.PostalCode);
                    angular.element("#suburb").val(locn.Address.District);
                    const mappedSub = $scope.jdSvc.pickSuburbs.find(obj => obj.text === locn.Address.District || obj.alias === locn.Address.District);
                    if (mappedSub !== undefined) {
                        console.log(mappedSub);
                        angular.element('#our_suburb').val(mappedSub.id).trigger('change');
                    } else {
                        angular.element('#our_suburb').val(null).trigger('change');
                    }

                    $scope.jdSvc.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                    $scope.jdSvc.gpsForm.data.long = locn.DisplayPosition.Longitude;
                    $scope.jdSvc.gpsForm.data.address = locn.Address.Label;
                    const ll = new google.maps.LatLng(locn.DisplayPosition.Latitude, locn.DisplayPosition.Longitude);
                    $scope.map.setCenter(ll);
                    $scope.marker.setPosition(ll);
                });
            });

            const suburbOptions = {
                minimumInputLength: 1,
                data: $scope.jdSvc.pickSuburbs
            };

            angular.element("#our_suburb").select2(suburbOptions);

            waitingDialog.hide();
        };

        $scope.closeSupport = support => {
            DispatchData.closeSupport(support.eventId, ContactID).then(data => {
                $scope.getSupports();
                $scope.currentSupport = null;
            });
        }

        $scope.createEvent = ($event, job) => {
            $mdDialog.show({
                controller: 'AddEventDialogController',
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
                },
                bindToController: true
            }).then(() => {
                $scope.getData().then(() => {
                    console.log('Pallet Dialog closed!');
                });
            });
        };

        $scope.truckLoadingStatus = event => {
            $mdDialog.show({
                controller: 'TruckCourierStatusDialogController',
                controllerAs: 'ctrl',
                parent: angular.element($document.body),
                targetEvent: event,
                templateUrl: versionUrl("app/components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    data: $scope.truckCourierStatus[0],
                },
                bindToController: true
            }).then(() => {
                // Dialog Closed
            });
        };

        $scope.courierSearchText = "";
        /**
         * @param {string} searchText
         */
        $scope.courierSearch = async searchText => {
            try {
                const url = "/courier/AllActiveSearch";
                return await DispatchData.autocompleteSearch(searchText, url);
            } catch (error) {
                toastrService.showErrorToast(error.message);
            }
        }

        $scope.selectedCourierChange = function (courier) {
            if (courier === undefined) {
                $scope.selectedCourier = null;
                $scope.currentCourier = null;
            } else {
                this.updateCourierData(courier.id, courier.text);
            }
        };

        // Load custom layout
        $scope.init = () => {
            if (Modernizr.localstorage) {
                const storedLayouts = localStorage.getItem("layoutsNW-" + ContactID);
                const lastActiveLayoutName = localStorage.getItem("lastActiveLayoutNW-" + ContactID);

                if (storedLayouts) {
                    $scope.layouts = JSON.parse(storedLayouts);
                    if (lastActiveLayoutName) {
                        const lastActiveLayoutIndex = $scope.layouts.findIndex(l => l.name === lastActiveLayoutName);

                        // if the last active layout is found among stored layouts
                        if (lastActiveLayoutIndex !== -1) {
                            $scope.loadLayout(lastActiveLayoutIndex);
                        }
                    }
                }
            }
        };

        // Call the init function when the controller loads
        $scope.init();

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
                                onSubmit: () => {
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


        $document.on('ready', () => {
            const favicon = document.getElementById("favicon");
            favicon.setAttribute("href", "/Nationwide.ico");
            let isDown = false;   // Tracks status of mouse button

            $document.on('mousedown', () => {
                isDown = true;      // When mouse goes down, set isDown to true
            })
                .on('mouseup', () => {
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

                                angular.element("#draggingItems").css({
                                    "top": event.pageY - 25,
                                    "left": event.pageX - 50
                                });
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

        $document.on("mouseup", ev => {
            angular.element("#draggingItems").hide();
            mouseDown = 0;
        });

        $document.on("keydown", e => {
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
]);


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
