function CSController($scope, jdSvc, uCSData, $state, $stateParams, $filter, $parse, hotkeys,
                      $location, $q, NgMap, GeoCoder, $mdDialog, greetingService, $document,
                      $timeout, loadingService, dispatchJobService, toastrService) {
    const self = this;

    $scope.isAdmin = (ClientInternal === "True");
    $scope.mapSetting = {
        "allCouriers": false,
        "allRuns": false
    };

    $scope.userName = FirstName;
    $scope.dateSearchRange = 1; // Set to fortnight
    $scope.DEFAULT_DATE_FORMAT = "dd/MM/yyyy";

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
    $scope.name = "POD";

    self.jdSvc = jdSvc;
    self.dispatchJobService = dispatchJobService;

    self.greetUser = function () {
        greetingService.greetUser(FirstName);
    }

    $scope.updateGPS = function (currentJob, field, fromRightClick) {
        jdSvc.updateGPS(currentJob, field, fromRightClick);
    };

    self.selectAndDispatchJob = (event, job) => {
        const confirm = $mdDialog.prompt()
            .title("Despatch To Courier")
            .textContent('Select courier to despatch job to.')
            .ariaLabel("courier to dispatch too")
            .targetEvent(event)
            .required(true)
            .ok("Despatch")
            .cancel('Cancel');

        $mdDialog.show(confirm).then(courierNumber => {
            try {
                dispatchJobService.dispatchJob(courierNumber, job).then(() => {
                    $scope.selectJobDetail(job.id);
                    toastrService.showSuccessToast(`Job despatched to courier ${courierNumber} successfully`);
                });
            } catch (error) {
                toastrService.showErrorToast(error.message);
            }
        }, () => {
            // User clicked cancel
        });
    }

    self.createNewJob = function (event) {
        // Dialog
        $mdDialog.show({
            controller: CreateJobDialogController,
            controllerAs: 'ctrl',
            parent: angular.element($document.body),
            targetEvent: event,
            templateUrl: "app/components/common/createJobDialog/createJobDialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                staffId: ContactID,
                despatcherName: FirstName
            },
        }).then(newJobId => {
            // Refresh data
            $scope.refreshData(true);

            // Then load the new job
            $scope.selectJobDetail(newJobId);
            console.log('Dialog closed!')
        });
    }

    self.interCourierCharge = function (event) {
        $mdDialog.show({
            controller: InterCourierChargeDialogController,
            controllerAs: 'ctrl',
            parent: angular.element($document.body),
            targetEvent: event,
            templateUrl: "app/components/common/interCourierChargeDialog/interCourierChargeDialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                staffId: ContactID,
            },
        }).then(() => {
            console.log("Inter-courier Charge Added!")
        }).then(() => "Inter-courier Charge Canceled!");
    }

    $scope.gather = {
        submit() {
            angular.element(".gatherForm").css("display", "none");
            $scope.gather.form.onSubmit().then(() => {
                if (self.currentJob) {
                    self.currentJob.bulkJob ? $scope.selectBulkJobDetail(self.currentJob.id) : self.currentJob.preBook ? $scope.selectPreBookDetail(self.currentJob.id) : $scope.selectJobDetail(self.currentJob.id);
                }
            });
        },
        cancel: () => angular.element(".gatherForm").css("display", "none"),
        showForm: () => {
            angular.element(".gatherForm").css("display", "block");
            $timeout(() => angular.element(".gatherForm .focusMe").focus(), 100);
        },
        submitValue: "Save"
    };

    $scope.gather = {
        submit: function () {
            angular.element(".gatherForm").hide();
            $scope.gather.form.onSubmit().then(function (response) {
                if (self.currentJob) {
                    self.currentJob.bulkJob ? $scope.selectBulkJobDetail(self.currentJob.id) : self.currentJob.preBook ? $scope.selectPreBookDetail(self.currentJob.id) : $scope.selectJobDetail(self.currentJob.id);
                }
            });
        },
        cancel: function () {
            angular.element(".gatherForm").hide();
        },
        showForm: function () {
            angular.element(".gatherForm").show(0, function () {
                $timeout(function () {
                    angular.element(".gatherForm .focusMe").focus();
                }, 100);
            });
        },
        submitValue: "Save"
    };

    jdSvc.setGather($scope.gather);

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
            "tpl": "app/components/CS/tpls/pickDate.tpl",
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
            "tpl": "app/components/home/tpls/jobDetail.tpl?v=3.0",
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

    self.layouts = layoutsObject || defaultLayout;


    const now = new Date();
    let sevenDaysBefore = new Date();
    sevenDaysBefore.setDate(now.getDate() - 7);
    let sevenDaysAfter = new Date();
    sevenDaysAfter.setDate(now.getDate() + 7);

    $scope.pickDateService = {
        "client": '',
        "courier": "",
        "date": now,
        "from_date": sevenDaysBefore,
        "to_date": sevenDaysAfter,
        "followupClient": "All",
        "includeClosed": true
    };

    $scope.followupClient = {
        name: "All"
    };

    var layoutToUse = angular.copy(self.layouts[0].layout);

    if (!$scope.isAdmin) {
        //layoutToUse.columns[0].boxes.splice(0, 1);
        //layoutToUse.columns.splice(2, 1);
    }

    self.layout = layoutToUse;
    self.currentLayoutName = self.layouts[0].name;

    self.deleteLayout = function (i) {
        self.layouts.splice(i, 1);
        if (Modernizr.localstorage) {
            localStorage.setItem("layoutsCS-" + ContactID, JSON.stringify(self.layouts));
        }
    }

    self.setLastActiveLayoutName = function (layoutName) {
        if (Modernizr.localstorage) {
            localStorage.setItem("lastActiveLayoutCS-" + ContactID, layoutName);
        }
    };

    self.loadLayout = function (i) {
        self.currentLayoutName = self.layouts[i].name;
        self.layout = angular.copy(self.layouts[i].layout);

        // save layout as last active
        self.setLastActiveLayoutName(self.currentLayoutName);

        $timeout($scope.initFilters, 1000);
    };

    self.saveLayout = function () {
        angular.forEach(self.layout.columns,
            function (column, colKey) {
                column.width = angular.element("#co-" + column.id).css("flex-basis");
                angular.forEach(column.boxes,
                    function (box, boxKey) {
                        box.height = angular.element("#box-" + box.name).css("flex-basis");
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

                var layoutName = angular.element("#saveLayout").find("input").val();

                var callData = {
                    "call": "saveLayout",
                    "layoutName": layoutName,
                    "layout": self.layout
                };


                if (Modernizr.localstorage) {
                    self.layouts = self.layouts.concat(
                        {
                            name: layoutName,
                            layout: angular.copy(self.layout)
                        });
                    localStorage.setItem("layoutsCS-" + ContactID, JSON.stringify(self.layouts));

                    // save last active layout
                    self.setLastActiveLayoutName(layoutName);
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

    self.openSearch = function (boxID) {

        if (angular.element("#box-" + boxID).find(".box-search").hasClass("open")) {

            angular.element("#box-" + boxID).find(".box-search input").fadeOut(function () {

                angular.element("#box-" + boxID).find(".box-search").removeClass("open");
                angular.element("#box-" + boxID).find(".box-search").animate({"width": "31px"}, 500);

            });

        } else {

            angular.element("#box-" + boxID).find(".box-search").animate({"width": "200px"}, 500, function () {
                angular.element("#box-" + boxID).find(".box-search").addClass("open");
                angular.element("#box-" + boxID).find(".box-search input").fadeIn();
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
            angular.element(".gatherForm").hide();
            angular.element(".eventForm").hide();
        }
    });

    hotkeys.add({
        combo: 'ctrl+a',
        description: 'Select All',
        allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
        callback: function () {
            angular.element(".activeTable").find(".clickable-row").addClass("active");
            $scope.showRun();
        }
    });

    hotkeys.add({
        combo: 'enter',
        description: 'Submit gather form',
        allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
        callback: function () {
            if (angular.element(".gatherForm").is(":visible") === true) {
                $timeout($scope.gather.submit(), 0);
            }
            if (event.srcElement.id === "Wild" || event.srcElement.id === "Job") {
                $scope.refreshAllData(true);
            }

        }
    });

    $scope.createForm = (fieldName, fieldType) => ({
        id: "chooseDate",
        title: "Choose Date",
        fields: [
            {
                name: fieldName,
                type: fieldType
            }
        ],
        onSubmit: () => $scope.onFormSubmit(fieldName),
        submitValue: "Choose"
    });

    $scope.onFormSubmit = (dateKey) => {
        $scope.gather.cancel();
        const {[dateKey]: pdsDate, [dateKey]: scopeDate} = $scope;

        if (scopeDate !== pdsDate) {
            $scope[dateKey] = pdsDate;
            dateChanged = true;
        }

        // $scope.refreshData(true);
    };

    $scope.chooseFromDate = () => {
        $scope.gather.form = $scope.createForm("fromdatepicker", "fromdatepicker");
        $scope.gather.showForm();
    };

    $scope.chooseToDate = () => {
        $scope.gather.form = $scope.createForm("todatepicker", "todatepicker");
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

    self.unlockJob = function () {
        return jdSvc
            .unlockJob(self.currentJob);
    };

    self.lockJob = function () {
        return jdSvc
            .lockJob(self.currentJob);
    };

    self.unSplitJob = function () {
        const confirm = $mdDialog.confirm()
            .title('Un-Split Job?')
            .textContent('Are you sure you wish to un-split this job?')
            .ok('Yes')
            .cancel('No');

        $mdDialog.show(confirm).then(function () {
            uCSData.unSplitJob(self.currentJob.id).then(function (msg) {
                if ((msg || "").length > 2) {
                    const alert = $mdDialog.alert()
                        .title('Error')
                        .textContent(msg)
                        .ok('Close');

                    $mdDialog.show(alert);
                }
            });
        }, function () {
            // user clicked 'No'
        });
    };

    $scope.restoreJob = function (job) {
        angular.element("#box-jobDetail").find(".loading").show();
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

    self.swapPOD = function () {
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
            onSubmit: function (event) {
                return uCSData.validateSwapPOD($scope.gather.form.fields[0].value).then(function (data) {
                    if (!data) {
                        $mdDialog.show(
                            $mdDialog.alert()
                                .clickOutsideToClose(true)
                                .title('Invalid Job')
                                .textContent('This job is invalid.')
                                .ok('OK')
                        ).then(_ => console.log("Alert closed."));
                    } else {
                        const secondJobId = data;
                        const firstJobId = self.currentJob.id;

                        const confirm = $mdDialog.confirm()
                            .title('Swap Delivery Info?')
                            .textContent(`Are you sure you wish to swap delivery info between ${self.currentJob.jobNo} and ${$scope.gather.form.fields[0].value}?`)
                            .ariaLabel('Lucky day')
                            .targetEvent(event)
                            .ok('Yes')
                            .cancel('No');

                        $mdDialog.show(confirm).then(() => uCSData.swapPOD(self.currentJob.jobNo, $scope.gather.form.fields[0].value).then(_ => {

                            $mdDialog.show(
                                $mdDialog.alert()
                                    .clickOutsideToClose(true)
                                    .title('Successful')
                                    .textContent('POD Swap Completed Successfully')
                                    .ok('OK')
                            ).then(_ => console.log("Alert closed."));

                            alert("POD Swap Completed Successfully");
                            uCSData.reSendJobs(secondJobId);
                            uCSData.reAssignJobs(firstJobId).then(_ => {
                                uCSData.reSendJobs(firstJobId).then(_ => {
                                    $scope.refreshData(true);
                                });
                            });
                        }), () => {
                            console.log("POD Swap Canceled");
                        });
                    }
                });

            },
            submitValue: "Submit"
        };

        $scope.gather.showForm();
    }

    self.sendPOD = function () {
        if (!self.currentJob.podPhoto) {
            $mdDialog.show(
                $mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('No Photo')
                    .textContent('Sorry no photo for this job.')
                    .ok('OK')
            ).then(_ => console.log("Alert closed."));
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
                uCSData.sendPOD(self.currentJob.id, $scope.gather.form.fields[0].value).then(data => {
                });

                $mdDialog.show(
                    $mdDialog.alert()
                        .clickOutsideToClose(true)
                        .title('Email Sent')
                        .textContent('POD email has been sent')
                        .ok('OK')
                ).then(_ => console.log("Alert closed."));

                alert("Email sent!");
            },
            submitValue: "Send"
        };
        $scope.gather.showForm();
    }

    $scope.refreshAllData = function (wait) {
        // Empty search criteria
        console.log($scope.pickDateService);

        if (($scope.pickDateService.client || "") === "" &&
            ($scope.pickDateService.courier || "") === "" &&
            ($scope.pickDateService.job || "") === "" &&
            ($scope.pickDateService.wild || "") === "") {

            $mdDialog.show(
                $mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Missing Criteria')
                    .textContent('Please provide more detailed search criteria.')
                    .ok('Understood')
            ).then(() => {
                console.log("Search operation cancelled due to insufficient criteria.")
            });
            return;
        }

        loadingService.showLoader();

        Promise.all([
            $scope.refreshData(wait),
            $scope.refreshBulkData(wait),
            $scope.refreshPreBookData(wait)
        ]).then(function () {
            loadingService.closeLoader();
        }).catch(function () {
            loadingService.closeLoader();
        });
    }

    $scope.refreshData = function (wait) {
        const $jobList = angular.element("#jobList");
        let goTop = $jobList.offset().top;
        const $parentDiv = $jobList.parents(".box-content");

        try {
            goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 31;
            $parentDiv.scrollTop(goTop);
        } catch (e) {
            //ignore
        }

        let dateChanged = false;
        if ($scope.currentFromDate !== $scope.pickDateService.from_date) {

            $scope.currentFromDate = $scope.pickDateService.from_date;
            dateChanged = true;
        }
        if ($scope.currentToDate !== $scope.pickDateService.to_date) {

            $scope.currentToDate = $scope.pickDateService.to_date;
            dateChanged = true;
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
            function (data) {
                //var filteredData = $filter('filter')(data, $scope.searchBox);
                $scope.jobList = data.item2;
                $scope.totalCount = data.item1;
                $timeout(function () {
                    sizeHeadings(angular.element("#jobList").parents(".column"));

                }, 1000);

            });


    };

    $scope.refreshBulkData = function (wait) {

        var goTop = angular.element("#bulkJobList").offset().top;
        var $parentDiv = angular.element("#bulkJobList").parents(".box-content");

        try {
            goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 31;
            $parentDiv.scrollTop(goTop);
        } catch (e) {
            //ignore
        }

        var dateChanged = false;
        if ($scope.currentFromDate !== $scope.pickDateService.from_date) {

            $scope.currentFromDate = $scope.pickDateService.from_date;
            dateChanged = true;
        }
        if ($scope.currentToDate !== $scope.pickDateService.to_date) {

            $scope.currentToDate = $scope.pickDateService.to_date;
            dateChanged = true;
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
                $timeout(function () {
                    sizeHeadings(angular.element("#bulkJobList").parents(".column"));

                }, 1000);

            });

    };

    $scope.refreshPreBookData = function (wait) {
        const pbList = angular.element("#pbList");
        let goTop = pbList.offset().top;
        const $parentDiv = pbList.parents(".box-content");

        try {
            goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 31;
            $parentDiv.scrollTop(goTop);
        } catch (e) {
            //ignore
        }

        var dateChanged = false;
        if ($scope.currentFromDate !== $scope.pickDateService.from_date) {

            $scope.currentFromDate = $scope.pickDateService.from_date;
            dateChanged = true;
        }
        if ($scope.currentToDate !== $scope.pickDateService.to_date) {

            $scope.currentToDate = $scope.pickDateService.to_date;
            dateChanged = true;
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
                $timeout(function () {
                    sizeHeadings(angular.element("#pbList").parents(".column"));
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

        angular.element("#box-jobsList").find(".loading").show();
        $scope.jobList = group.jobs;
        $timeout(function () {
            sizeHeadings(angular.element("#jobList").parents(".column"));
        }, 1000);
        angular.element("#box-jobsList .loading").fadeOut();


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
        angular.element("#box-jobDetail").find(".loading").show();
        uCSData.getJobDetail(id).then(function (data) {
            self.currentJob = data;
            angular.element("#box-jobDetail").find(".loading").hide();
            $scope.currentSelection = " for Job " + jn;
        });
    }

    /**
     * @param {number} jobId
     */
    $scope.selectJobDetail = function (jobId) {
        $scope.scanList = [];
        console.log("select Job  " + jobId);
        clearTimeout($scope.myTimer);

        angular.element("#box-jobDetail").find(".loading").show();

        uCSData.getJobDetail(jobId).then(function (data) {
            self.currentJob = data;
            jdSvc.setJob(self.currentJob);
            angular.element("#box-jobDetail").find(".loading").hide();
            $scope.currentSelection = " for Job " + data.jobNo;
            var jobs = [];
            jobs.push(self.currentJob);
            displayRoutePointsOnly(jobs, true);
            setMapBounds();
            map.setZoom(14);
            if (self.currentJob.rootParentID) {
                uCSData.getRelatedJobs(self.currentJob.rootParentID, self.currentJob.clientID).then(function (data) {
                    //data = data.filter(item => item.id !== self.currentJob.id);
                    self.currentJob.relatedJobs = data;
                });
            }
            angular.element("#box-scanList").find(".loading").show();
            uCSData.getScanDetail(moment(self.currentJob.bookedDate), self.currentJob.jobNo).then(function (data) {
                $scope.scanList = data;

                $timeout(function () {
                    sizeHeadings(angular.element("#scanList").parents(".column"));
                    angular.element("#box-scanList").find(".loading").fadeOut();
                }, 200);
            });

            if (self.currentJob.courier && self.currentJob.completedTime) {
                angular.element("#box-map").find(".loading").show();
                uCSData.getCourierRoute(self.currentJob.courier, moment(self.currentJob.completedTime).subtract(5, 'm'), moment(self.currentJob.completedTime).add(5, 'm')).then(function (data) {
                    var flightPathCoordinates = [];

                    angular.element("#box-map").find(".loading").fadeOut();
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
        //angular.element("#jobList").find(".active").removeClass("active");
        clearTimeout($scope.myTimer);
        //$scope.currentEvent = event;

        angular.element("#box-jobDetail").find(".loading").show();

        uCSData.getPreBookDetail(id).then(function (data) {
            self.currentJob = data;
            jdSvc.setJob(self.currentJob);
            angular.element("#box-jobDetail").find(".loading").hide();
            $scope.currentSelection = " for Job " + data.jobNo;
            console.log(self.currentJob.days);
            var freq = self.currentJob.days.slice(8, 9).trimEnd() === "" ? "0" : self.currentJob.days.slice(8, 9);
            console.log(freq);
            jdSvc.combos.frequency = [jdSvc.pickFrequency[freq]];
            console.log(jdSvc.combos.frequency);
            var hol = self.currentJob.days.slice(9, 10).trimEnd() === "" ? "0" : self.currentJob.days.slice(9, 10);
            console.log(hol);
            jdSvc.combos.holidays = [jdSvc.pickHolidays[hol]];
            console.log(jdSvc.combos.holidays);
            var selectedDays = [];
            var days = self.currentJob.days.slice(0, 7);
            for (let i = 0; i < days.length; i++) {
                if (days[i] === '1') {
                    selectedDays.push(jdSvc.pickDays[i]);
                }
            }
            console.log(selectedDays);
            jdSvc.combos.days = selectedDays;
            var jobs = [];
            jobs.push(self.currentJob);
            displayRoutePointsOnly(jobs, true);
            setMapBounds();
            map.setZoom(14);
            uCSData.getScanDetail(moment(self.currentJob.bookedDate), self.currentJob.jobNo).then(function (data) {
                $scope.scanList = data;

                $timeout(function () {
                    sizeHeadings(angular.element("#scanList").parents(".column"));
                    angular.element("#box-scanList").find(".loading").fadeOut();
                }, 200);
            });
        });


    };

    //Select Bulk Job
    $scope.selectBulkJobDetail = function (id) {
        $scope.scanList = [];
        console.log("select Bulk Job  " + id);
        //angular.element("#jobList").find(".active").removeClass("active");
        clearTimeout($scope.myTimer);
        //$scope.currentEvent = event;

        angular.element("#box-jobDetail").find(".loading").show();

        uCSData.getBulkJobDetail(id).then(function (data) {
            self.currentJob = data;
            jdSvc.setJob(self.currentJob);
            angular.element("#box-jobDetail").find(".loading").hide();
            $scope.currentSelection = " for Bulk Job " + data.jobNo;
            var jobs = [];
            jobs.push(self.currentJob);
            displayRoutePointsOnly(jobs, true);
            setMapBounds();
            map.setZoom(14);
            uCSData.getScanDetail(moment(self.currentJob.bookedDate), self.currentJob.jobNo).then(function (data) {
                $scope.scanList = data;

                $timeout(function () {
                    sizeHeadings(angular.element("#scanList").parents(".column"));
                    angular.element("#box-scanList").find(".loading").fadeOut();
                }, 200);
            });
        });


    };

    jdSvc.setSelectJobDetail($scope.selectJobDetail);
    jdSvc.setSelectBulkJobDetail($scope.selectBulkJobDetail);

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

    // New Material Autocompletes
    $scope.clientSelectedItem = $scope.pickDateService.client;
    $scope.courierSelectedItem = $scope.pickDateService.client;
    $scope.clientSearchText = '';
    $scope.courierSearchText = '';

    $scope.clientQuerySearch = function (searchText) {
        return uCSData.getActiveClients(searchText);
    };

    $scope.selectedClientChange = function (item) {
        if (!item) {
            $scope.pickDateService.client = null;
        }
        $scope.pickDateService.client = item.id;
    };

    $scope.courierQuerySearch = function (searchText) {
        return uCSData.getActiveCouriersSearch(searchText);
    };

    $scope.selectedCourierChange = function (item) {
        if (!item) {
            $scope.pickDateService.courier = null;
        }
        $scope.pickDateService.courier = item.id;
    };

    uCSData.getActiveCouriers().then(data => {
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

    $scope.highlightEvent = function () {
        angular.element("#jobList .active").each(function () {
            angular.element(this).removeClass("active");
        });
        //loop actives

        $timeout(function () {
            $scope.selectedEvents = [];
            angular.element("#jobList .active").each(function () {
                var eventIndex = angular.element(this).data("index");
                var event = $scope.jobList[eventIndex];
                $scope.selectedEvents.push(event);
            });
            //$scope.$apply();
        }, 10);


        $timeout(function () {
            sizeHeadings(angular.element("#jobList").parents(".column"));
        }, 1000);

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
                            angular.element("#box-jobList").find(".loading").show();
                            angular.element("#box-map").find(".loading").show();
                            var userName = angular.element("#gather-editName").val();
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
            locals: {dataToPass: currentEvent},
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
        self.currentJob = job;
        $mdDialog.show({
            locals: {dataToPass: undefined},
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
        console.log(self.currentJob);
        console.log(dataToPass);
        $scope.book = {};

        $scope.book.courier = self.currentJob.courierCode;
        $scope.book.job = self.currentJob.jobNumber;

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


            angular.element(".wait").show();
            processEventBooking();


        }

        function processEventBooking() {

            var event = {
                "dataType": "json",
                "BulkJobID": self.currentJob.bulkJobID,
                "CourierID": self.currentJob.courierID,
                "Name": `${ClientName}-${$scope.book.name}`,
                "Notes": $scope.book.notes,
                "Internal": $scope.isAdmin ? !$scope.book.internal : 0,
                "ClientCreated": !$scope.isAdmin,
                "ClientFollowup": $scope.book.account !== "UCL" ? 1 : 0,
                "EventDate": $scope.pickDateService.date,
                "ClientID": self.currentJob.clientID
            };

            uCSData.createEvent(event, $scope.isAdmin ? $scope.book.notify : true)
                .then(function (returnData) {
                    if ((returnData === undefined ||
                        returnData !== "OK")) {
                        alert("Sorry, create event failed");
                        angular.element(".wait").hide();
                        $scope.cancel();
                    } else {
                        angular.element(".wait").hide();
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


    // Load custom layout
    $scope.init = function () {
        if (Modernizr.localstorage) {
            const storedLayouts = localStorage.getItem("layoutsCS-" + ContactID);
            const lastActiveLayoutName = localStorage.getItem("lastActiveLayoutCS-" + ContactID);

            if (storedLayouts) {
                self.layouts = JSON.parse(storedLayouts);

                if (lastActiveLayoutName) {
                    const lastActiveLayoutIndex = self.layouts.findIndex(l => l.name === lastActiveLayoutName);

                    // if the last active layout is found among stored layouts
                    if (lastActiveLayoutIndex !== -1) {
                        self.loadLayout(lastActiveLayoutIndex);
                    }
                }
            }
        }
    };

    // Call the init function when the controller loads
    $scope.init();

    /**
     * @param {number} dateRangeOption
     */
    $scope.onSearchRangeChange = (dateRangeOption) => {
        try {
            let now = new Date();
            now.setHours(0, 0, 0, 0);

            let firstDayOfMonth = new Date();
            firstDayOfMonth.setDate(1);
            firstDayOfMonth.setHours(0, 0, 0, 0);

            let lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            lastDayOfMonth.setHours(0, 0, 0, 0);

            let oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            oneWeekAgo.setHours(0, 0, 0, 0);

            let oneWeekAhead = new Date();
            oneWeekAhead.setDate(now.getDate() + 7);
            oneWeekAhead.setHours(0, 0, 0, 0);

            switch (dateRangeOption) {
                case '1':
                    $scope.pickDateService.from_date = oneWeekAgo;
                    $scope.pickDateService.to_date = oneWeekAhead;
                    break;
                case '2':
                    $scope.pickDateService.from_date = now;
                    $scope.pickDateService.to_date = now;
                    break;
                case '3':
                    $scope.pickDateService.from_date = firstDayOfMonth;
                    $scope.pickDateService.to_date = lastDayOfMonth;
                    break;
                case '4':
                    // This option is empty as ng-if is used on the page to show custom date range options
                    break;
            }
        } catch (error) {
            console.log("Error: ", error);
        }
    };

    // Default to today
    $scope.onSearchRangeChange($scope.dateSearchRange);
}

angular.module('uDispatch').controller('CSControl', ['$scope', 'JobDetailService', 'uCSData', "$state",
    "$stateParams", "$filter", '$parse', "hotkeys", "$location", "$q", 'NgMap', 'GeoCoder', '$mdDialog',
    'greetingService', '$document', '$timeout', 'loadingService', 'dispatchJobService', 'toastrService', CSController]);

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
