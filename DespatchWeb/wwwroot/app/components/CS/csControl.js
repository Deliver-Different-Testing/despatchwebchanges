angular
    .module('uDispatch')
    .controller('CSControl',
        ['$document', '$filter', '$location', '$mdDialog', '$ngConfirm', '$parse', '$q', '$scope', '$state', '$stateParams', '$timeout', 'GeoCoder', 'JobDetailService', 'NgMap', 'greetingService', 'hotkeys', 'uCSData',
            function ($document, $filter, $location, $mdDialog, $ngConfirm, $parse, $q, $scope, $state, $stateParams, $timeout, GeoCoder, jdSvc, NgMap, greetingService, hotkeys, uCSData) {
                $scope.isAdmin = ClientInternal === "True";
                $scope.mapSetting = {
                    "allCouriers": false,
                    "allRuns": false
                };

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
                $scope.jdSvc = jdSvc;

                $scope.greetUser = () => greetingService.greetUser($scope.userName);

                $scope.updateGPS = (currentJob, field, fromRightClick) => {
                    $scope.jdSvc.updateGPS(currentJob, field, fromRightClick);
                };

                $scope.createNewJob = function (event) {
                    // Dialog
                    $mdDialog.show({
                        controller: CreateJobDialog,
                        controllerAs: 'ctrl',
                        parent: angular.element(document.body),
                        targetEvent: event,
                        templateUrl: "app/components/common/createJobDialog/createJobDialog.html",
                        clickOutsideToClose: false,
                        fullscreen: true,
                        locals: {
                            staffId: ContactID
                        },
                    }).then(newJobId => {
                        $scope.selectJobDetail(newJobId);
                        console.log('Dialog closed!')
                    });
                }

                $scope.gather = {
                    submit() {
                        angular.element(document.querySelector(".gatherForm")).css("display", "none");
                        $scope.gather.form.onSubmit().then(response => {
                            if ($scope.currentJob) {
                                $scope.currentJob.bulkJob ? $scope.selectBulkJobDetail($scope.currentJob.id) : $scope.currentJob.preBook ? $scope.selectPreBookDetail($scope.currentJob.id) : $scope.selectJobDetail($scope.currentJob.id);
                            }
                        });
                    },
                    cancel: () => angular.element(document.querySelector(".gatherForm")).css("display", "none"),
                    showForm: () => {
                        angular.element(document.querySelector(".gatherForm")).css("display", "block");
                        $timeout(() => angular.element(document.querySelector(".gatherForm .focusMe")).focus(), 100);
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

                $scope.layouts = layoutsObject || defaultLayout;
                $scope.userName = FirstName;


                $scope.pickDateService = {
                    "client": '',
                    "courier": "",
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

                $scope.deleteLayout = (event, index) => {
                    const deleteConfirm = $mdDialog.confirm()
                        .title('Delete Layout?')
                        .textContent('Are you sure you would like to delete this layout?')
                        .ariaLabel('delete layout')
                        .targetEvent(event)
                        .ok('Delete')
                        .cancel('Cancel');

                    $mdDialog.show(deleteConfirm).then(() => {
                        $scope.layouts.splice(index, 1);
                        if (Modernizr.localstorage) {
                            localStorage.setItem("layoutsCS-" + ContactID, JSON.stringify($scope.layouts));
                        }
                    }, () => console.log("Delete layout canceled!"));
                };

                $scope.setLastActiveLayoutName = layoutName => {
                    if (Modernizr.localstorage) {
                        localStorage.setItem("lastActiveLayoutCS-" + ContactID, layoutName);
                    }
                };

                $scope.loadLayout = index => {
                    $scope.currentLayoutName = $scope.layouts[index].name;
                    $scope.layout = angular.copy($scope.layouts[index].layout);

                    // save layout as last active
                    $scope.setLastActiveLayoutName($scope.currentLayoutName);

                    $timeout($scope.initFilters, 1000);
                };

                $scope.saveLayout = event => {
                    angular.forEach($scope.layout.columns,
                        (column, colKey) => {
                            column.width = angular.element(document.querySelector("#co-" + column.id)).css("flex-basis");
                            angular.forEach(column.boxes,
                                (box, boxKey) => {
                                    box.height = angular.element(document.querySelector("#box-" + box.name)).css("flex-basis");
                                });
                        });

                    const saveLayoutPrompt = $mdDialog.prompt()
                        .title('Save Layout')
                        .textContent('Please enter a name for this layout.')
                        .ariaLabel('Layout name')
                        .targetEvent(event)
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
                            localStorage.setItem("layoutsCS-" + ContactID, JSON.stringify($scope.layouts));

                            // save last active layout
                            $scope.setLastActiveLayoutName(layoutName);
                        }

                        const deferred = $q.defer();
                        deferred.resolve({
                            data: "OK"
                        });
                        return deferred.promise;
                    }, () => console.log("Save Layout Cancelled!"));
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
                        const box = angular.element(document.querySelector("#" + ui.item.context.id));
                        const parent = box.parent();
                        angular.element(parent).find(".box").each(() => angular.element(this).attr('data-height', angular.element(this).prop('offsetHeight') + 'px'));
                    },
                    update: function (e, ui) {
                        return $timeout(() => {
                            const box = angular.element(document.querySelector("#" + ui.item.context.id));
                            const parent = box.parent();
                            angular.element(parent).find(".box").each(() => angular.element(this).css({"flex-basis": angular.element(this).attr("data-height")}));
                            angular.element(parent).find(".box").last().css({"flex-basis": "0"});
                        });
                    }
                };

                $scope.openSearch = boxID => {
                    let boxSearchElement = angular.element(document.querySelector("#box-" + boxID)).find(".box-search");

                    if (boxSearchElement.hasClass("open")) {
                        boxSearchElement.find("input").fadeOut(() => {
                            boxSearchElement.removeClass("open");
                            boxSearchElement.animate({"width": "31px"}, 500);
                        });
                    } else {
                        boxSearchElement.animate({"width": "200px"}, 500, () => {
                            boxSearchElement.addClass("open");
                            boxSearchElement.find("input").fadeIn();
                        });
                    }
                };

                $scope.goToRunViewer = () => {
                    console.log("goToRunViewer.");
                    $state.go('home');
                };

                //Column Sorting
                $scope.sort = [];
                $scope.orderList = (list, prop) => {


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
                    callback: () => {
                        angular.element(document.querySelector(".gatherForm")).css("display", "none");
                        angular.element(document.querySelector(".eventForm")).css('display', 'none');
                    }
                });

                hotkeys.add({
                    combo: 'ctrl+a',
                    description: 'Select All',
                    allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
                    callback: () => {
                        angular.element(document.querySelector(".activeTable")).find(".clickable-row").addClass("active");
                        $scope.showRun();
                    }
                });

                hotkeys.add({
                    combo: 'enter',
                    description: 'Submit gather form',
                    allowIn: ['INPUT', 'SELECT', 'TEXTAREA'],
                    callback: () => {
                        if (angular.element(document.querySelector(".gatherForm")).css('display') !== 'none') {
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

                $scope.onFormSubmit = dateKey => {
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


                $scope.filterRegion = region => {
                    var sr = $scope.pickRegions.find(obj => obj.id === region.id);
                    $scope.pickDateService.regions = [];
                    $scope.pickDateService.regions.push(sr);
                    $scope.refreshData(true);
                    $scope.refreshBulkData(true);
                    $scope.refreshPreBookData(true);
                };

                $scope.unlockJob = () => $scope.jdSvc
                    .unlockJob($scope.currentJob);

                $scope.lockJob = () => $scope.jdSvc
                    .lockJob($scope.currentJob);

                $scope.unSplitJob = () =>
                    $ngConfirm({
                        title: 'Un-Split Job?',
                        content: 'Are you sure you wish to un-split this job?',
                        scope: $scope,
                        buttons: {

                            Yes: {
                                btnClass: 'btn-green',
                                action: (scope, button) =>
                                    uCSData.unSplitJob($scope.currentJob.id).then(msg => {
                                        if ((msg || "").length > 2) {
                                            $ngConfirm({
                                                title: 'Error',
                                                content: msg,
                                                scope: $scope,
                                                buttons: {

                                                    Close: {
                                                        btnClass: 'btn-red',
                                                        action: (scope, button) => {

                                                        }
                                                    }

                                                }
                                            });
                                        }
                                    })
                            },
                            No: {
                                btnClass: 'btn-red',
                                action: (scope, button) => {

                                }
                            }

                        }
                    });

                $scope.restoreJob = job => {
                    angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'block');
                    const callData = {
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
                        uCSData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs).then(() => $scope.selectJobDetail(job.id));
                    }
                    if (callData.jobs.length > 0) {
                        uCSData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs).then(() => $scope.selectJobDetail(job.id));
                    }


                };

                $scope.dispatchJobs = (courier, job) => {
                    var foundCourier = $scope.pickCouriers.find(c => c.id === courier);
                    if (foundCourier === undefined) {
                        $ngConfirm({
                            title: 'Courier Offline',
                            content: 'Dispatch anyway?',
                            scope: $scope,
                            buttons: {

                                Yes: {
                                    btnClass: 'btn-green',
                                    action: (scope, button) => {
                                        foundCourier = $scope.pickAllCouriers.find(c => c.id === courier);
                                        //console.log(foundCourier);
                                        return $scope.dispatchJobsContinue(courier, foundCourier, true, job);
                                    }


                                },
                                No: {
                                    btnClass: 'btn-red',
                                    action: (scope, button) => {

                                    }
                                }
                            }
                        });
                        return;
                    }

                    return $scope.dispatchJobsContinue(courier, foundCourier, false, job);
                };

                $scope.dispatchJobsContinue = (courier, foundCourier, offline, job) => {
                    var callData = {
                        "call": "dispatchJobs",
                        courier,
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

                    callData.jobs.push(job.id);

                    return uCSData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs).then(response => {
                        angular.element(document.querySelectorAll('input.pod-DispatchField')).forEach(item => {
                            if (getComputedStyle(item).display !== 'none') {
                                item.value = "";
                            }
                        });
                        $scope.selectJobDetail(job.id);
                        return response;
                    });

                };

                $scope.swapPOD = () => {
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
                        onSubmit: event => uCSData.validateSwapPOD($scope.gather.form.fields[0].value).then(data => {
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
                                const firstJobId = $scope.currentJob.id;

                                const confirm = $mdDialog.confirm()
                                    .title('Swap Delivery Info?')
                                    .textContent(`Are you sure you wish to swap delivery info between ${$scope.currentJob.jobNo} and ${$scope.gather.form.fields[0].value}?`)
                                    .ariaLabel('Lucky day')
                                    .targetEvent(event)
                                    .ok('Yes')
                                    .cancel('No');

                                $mdDialog.show(confirm).then(() => uCSData.swapPOD($scope.currentJob.jobNo, $scope.gather.form.fields[0].value).then(_ => {

                                    $mdDialog.show(
                                        $mdDialog.alert()
                                            .clickOutsideToClose(true)
                                            .title('Successful')
                                            .textContent('POD Swap Completed Successfully')
                                            .ok('OK')
                                    ).then(_ => console.log("Alert closed."));

                                    $ngConfirm("POD Swap Completed Successfully");
                                    uCSData.reSendJobs(secondJobId);
                                    uCSData.reAssignJobs(firstJobId).then(_ => uCSData.reSendJobs(firstJobId).then(_ => $scope.refreshData(true)));
                                }), () => console.log("POD Swap Canceled"));
                            }
                        }),
                        submitValue: "Submit"
                    };

                    $scope.gather.showForm();
                };

                $scope.sendPOD = () => {
                    if (!$scope.currentJob.podPhoto) {
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
                        onSubmit: () => {
                            uCSData.sendPOD($scope.currentJob.id, $scope.gather.form.fields[0].value).then(data => {
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
                };

                $scope.refreshAllData = wait => {
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
                        ).then(() => console.log("Search operation cancelled due to insufficient criteria."));
                        return;
                    }

                    $scope.refreshData(wait);
                    $scope.refreshBulkData(wait);
                    $scope.refreshPreBookData(wait);
                };

                $scope.refreshData = wait => {
                    const jobList = angular.element(document.querySelector("#jobList"));
                    let goTop = jobList[0].offsetTop;
                    const parentDiv = jobList.parent(".box-content");

                    try {
                        goTop = goTop - parentDiv[0].offsetTop + parentDiv[0].scrollTop - 31;
                        parentDiv[0].scrollTop = goTop;
                    } catch (e) {
                        //ignore
                    }
                    angular.element(document.querySelector("#box-jobList")).find(".loading").css('display', 'block');

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
                    uCSData.getPodJobs($scope.pickDateService.courier,
                        $scope.pickDateService.client,
                        $scope.pickDateService.wild || "",
                        $scope.pickDateService.job || "",
                        moment($scope.currentFromDate),
                        moment($scope.currentToDate),
                        $scope.pageIndex,
                        $scope.pageSizeSelected).then(
                        data => {
                            $scope.jobList = data.item2;
                            $scope.totalCount = data.item1;
                            angular.element(document.querySelector("#box-jobList")).find(".loading").css('display', 'none');
                            $timeout(() => sizeHeadings(angular.element(document.querySelector("#jobList")).parent(".column")), 1000);
                        });
                };

                $scope.refreshBulkData = wait => {
                    const bulkJobList = angular.element(document.querySelector("#bulkJobList"));
                    let goTop = bulkJobList[0].offsetTop;
                    const parentDiv = bulkJobList.parent(".box-content");

                    try {
                        goTop = goTop - parentDiv[0].offsetTop + parentDiv[0].scrollTop - 31;
                        parentDiv[0].scrollTop = goTop;
                    } catch (e) {
                        //ignore
                    }
                    angular.element(document.querySelector("#box-bulkJobList")).find(".loading").css('display', 'block');

                    let dateChanged = false;
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
                        $scope.pickDateService.job || "",
                        $scope.pickDateService.wild || "",
                        moment($scope.currentFromDate),
                        moment($scope.currentToDate),
                        $scope.bulkPageIndex,
                        $scope.bulkPageSizeSelected).then(
                        data => {
                            $scope.bulkJobList = data.item2;
                            $scope.bulkTotalCount = data.item1;
                            angular.element(document.querySelector("#box-bulkJobList")).find(".loading").css('display', 'none');
                            $timeout(() => sizeHeadings(angular.element(document.querySelector("#bulkJobList")).parent(".column")), 1000);
                        });
                };

                $scope.refreshPreBookData = wait => {
                    const pbList = angular.element(document.querySelector("#pbList"));
                    let goTop = pbList[0].offsetTop;
                    const parentDiv = pbList.parent(".box-content");

                    try {
                        goTop = goTop - parentDiv[0].offsetTop + parentDiv[0].scrollTop - 31;
                        parentDiv[0].scrollTop = goTop;
                    } catch (e) {
                        //ignore
                    }
                    angular.element(document.querySelector("#box-pbList")).find(".loading").css('display', 'block');


                    let dateChanged = false;
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
                        $scope.pickDateService.wild || "",
                        $scope.pickDateService.job || "",
                        moment($scope.currentFromDate),
                        moment($scope.currentToDate),
                        $scope.pbPageIndex,
                        $scope.pbPageSizeSelected).then(
                        data => {
                            $scope.pbList = data.item2;
                            $scope.pbTotalCount = data.item1;
                            angular.element(document.querySelector("#box-pbList")).find(".loading").css('display', 'none');

                            $timeout(() => sizeHeadings(angular.element(document.querySelector("#pbList")).parent(".column")), 1000);
                        });
                };

                $scope.selectJobData = (lat, lng) => {
                    const toCompare = [];
                    angular.forEach($scope.runBuilder, (job, key) => toCompare.push([key, job.toLat, job.toLng]));

                    const closestIndex = closestLocation(lat, lng, toCompare);
                    return $scope.runBuilder[closestIndex[0]];
                };


                $scope.showItems = job => {
                    if (job.clientCode !== "Other") {

                        if ($scope.cancelledSelected) {
                            return true;
                        } else {
                            return job.Status !== "Cancelled";
                        }
                    } else {
                        return false;
                    }
                };


                /////////////////////////////////

                $scope.showJobs = group => {
                    angular.element(document.querySelector("#box-jobsList")).find(".loading").css('display', 'block');
                    $scope.jobList = group.jobs;

                    $timeout(() => sizeHeadings(angular.element(document.querySelector("#jobList")).parent(".column")), 1000);

                    angular.element(document.querySelector("#box-jobsList .loading")).css('display', 'none');
                };

                $scope.sizeName = sizeId => {
                    if (!sizeId) {
                        return "";
                    }
                    const sn = $scope.options.detail.size.find(obj => obj.id === sizeId);
                    return sn === undefined ? "" : sn.label;
                };

                $scope.loadRelatedJobDetail = (id, jn) => {
                    angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'block');
                    uCSData.getJobDetail(id).then(data => {
                        $scope.currentJob = data;
                        angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'none');
                        $scope.currentSelection = " for Job " + jn;
                    });
                };

                //Select Job
                $scope.selectJobDetail = id => {
                    $scope.scanList = [];
                    console.log("select Job  " + id);
                    clearTimeout($scope.myTimer);

                    angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'block');

                    uCSData.getJobDetail(id).then(data => {
                        $scope.currentJob = data;
                        jdSvc.setJob($scope.currentJob);
                        angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'none');
                        $scope.currentSelection = " for Job " + data.jobNo;
                        let jobs = [];
                        jobs.push($scope.currentJob);
                        displayRoutePointsOnly(jobs, true);
                        setMapBounds();
                        map.setZoom(14);
                        if ($scope.currentJob.rootParentID) {
                            uCSData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientID).then(data => {
                                $scope.currentJob.relatedJobs = data;
                            });
                        }
                        angular.element(document.querySelector("#box-scanList")).find(".loading").css('display', 'block');
                        uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(data => {
                            $scope.scanList = data;

                            $timeout(() => {
                                sizeHeadings(angular.element(document.querySelector("#scanList")).parent(".column"));
                                angular.element(document.querySelector("#box-scanList")).find(".loading").css('display', 'none');
                            }, 200);
                        });

                        if ($scope.currentJob.courier && $scope.currentJob.completedTime) {
                            angular.element(document.querySelector("#box-map")).find(".loading").css('display', 'block');
                            uCSData.getCourierRoute($scope.currentJob.courier, moment($scope.currentJob.completedTime).subtract(5, 'm'), moment($scope.currentJob.completedTime).add(5, 'm')).then(data => {
                                let i;
                                let flightPathCoordinates = [];

                                angular.element(document.querySelector("#box-map")).find(".loading").css('display', 'none');
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
                                for (i = 0; i < flightPath.getLength(); i++) {
                                    pathValues.push(flightPath.getAt(i).toUrlValue());
                                }

                                $.get('https://roads.googleapis.com/v1/snapToRoads', {
                                    interpolate: true,
                                    key: googleMapsApiKey,
                                    path: pathValues.join('|')
                                }, data => {
                                    var snappedCoordinates = [];
                                    for (var i = 0; i < data.snappedPoints.length; i++) {
                                        var latlng = new google.maps.LatLng(
                                            data.snappedPoints[i].location.latitude,
                                            data.snappedPoints[i].location.longitude);
                                        snappedCoordinates.push(latlng);
                                    }
                                    var snappedFlightPath = new google.maps.Polyline({
                                        map,
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

                $scope.selectPreBookDetail = id => {
                    $scope.scanList = [];
                    console.log("select pre book Job  " + id);
                    clearTimeout($scope.myTimer);

                    angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'block');

                    uCSData.getPreBookDetail(id).then(data => {
                        $scope.currentJob = data;
                        jdSvc.setJob($scope.currentJob);
                        angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'none');
                        $scope.currentSelection = " for Job " + data.jobNo;
                        console.log($scope.currentJob.days);
                        const freq = $scope.currentJob.days.slice(8, 9).trimEnd() === "" ? "0" : $scope.currentJob.days.slice(8, 9);
                        console.log(freq);
                        jdSvc.combos.frequency = [jdSvc.pickFrequency[freq]];
                        console.log(jdSvc.combos.frequency);
                        const hol = $scope.currentJob.days.slice(9, 10).trimEnd() === "" ? "0" : $scope.currentJob.days.slice(9, 10);
                        console.log(hol);
                        jdSvc.combos.holidays = [jdSvc.pickHolidays[hol]];
                        console.log(jdSvc.combos.holidays);
                        let selectedDays = [];
                        let days = $scope.currentJob.days.slice(0, 7);
                        for (let i = 0; i < days.length; i++) {
                            if (days[i] === '1') {
                                selectedDays.push(jdSvc.pickDays[i]);
                            }
                        }
                        console.log(selectedDays);
                        jdSvc.combos.days = selectedDays;
                        let jobs = [];
                        jobs.push($scope.currentJob);
                        displayRoutePointsOnly(jobs, true);
                        setMapBounds();
                        map.setZoom(14);
                        uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(data => {
                            $scope.scanList = data;

                            $timeout(() => {
                                sizeHeadings(angular.element(document.querySelector("#scanList")).parent(".column"));
                                angular.element(document.querySelector("#box-scanList")).find(".loading").css('display', 'none');
                            }, 200);
                        });
                    });


                };

                //Select Bulk Job
                $scope.selectBulkJobDetail = function (id) {
                    $scope.scanList = [];
                    console.log("select Bulk Job  " + id);
                    clearTimeout($scope.myTimer);

                    angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'block');

                    uCSData.getBulkJobDetail(id).then(data => {
                        $scope.currentJob = data;
                        jdSvc.setJob($scope.currentJob);
                        angular.element(document.querySelector("#box-jobDetail")).find(".loading").css('display', 'none');
                        $scope.currentSelection = " for Bulk Job " + data.jobNo;
                        let jobs = [];
                        jobs.push($scope.currentJob);
                        displayRoutePointsOnly(jobs, true);
                        setMapBounds();
                        map.setZoom(14);
                        uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(data => {
                            $scope.scanList = data;

                            $timeout(() => {
                                sizeHeadings(angular.element(document.querySelector("#scanList")).parent(".column"));
                                angular.element(document.querySelector("#box-scanList")).find(".loading").css('display', 'none');
                            }, 200);
                        });
                    });
                };

                $scope.jdSvc.setSelectJobDetail($scope.selectJobDetail);
                $scope.jdSvc.setSelectBulkJobDetail($scope.selectBulkJobDetail);

                //This method is calling from pagination number
                $scope.pageChanged = i => {
                    $scope.pageIndex = i;
                    $scope.refreshData();
                };

                //This method is calling from dropDown
                $scope.changeBulkPageSize = i => {
                    $scope.bulkPageIndex = i;
                    $scope.bulkPageSizeSelected = i;
                    $scope.refreshBulkData();
                };

                //This method is calling from pagination number
                $scope.pbPageChanged = i => {
                    $scope.pbPageIndex = i;
                    $scope.refreshPreBookData();
                };

                $scope.changePBPageSize = i => {
                    $scope.pbPageIndex = i;
                    $scope.pbPageSizeSelected = i;
                    $scope.refreshPreBookData();
                };

                //This method is calling from pagination number
                $scope.bulkPageChanged = i => {
                    $scope.bulkPageIndex = i;
                    $scope.refreshBulkData();
                };

                //This method is calling from dropDown
                $scope.changePageSize = i => {
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

                $scope.clientQuerySearch = searchText => uCSData.getActiveClients(searchText);

                $scope.selectedClientChange = item => {
                    if (!item) {
                        $scope.pickDateService.client = null;
                    }
                    $scope.pickDateService.client = item.id;
                };

                $scope.courierQuerySearch = searchText => uCSData.getActiveCouriersSearch(searchText);

                $scope.selectedCourierChange = item => {
                    if (!item) {
                        $scope.pickDateService.courier = null;
                    }
                    $scope.pickDateService.courier = item.id;
                };

                uCSData.getActiveCouriers().then(data => {
                    $scope.pickCouriers = data;
                });

                uCSData.getAllCouriers().then(data => {
                    $scope.pickAllCouriers = data;
                });

                NgMap.getMap().then(map => {
                    $scope.map = map;
                    $scope.marker = map.markers[0];
                    $scope.onMapReady();
                });

                $scope.highlightEvent = () => {
                    angular.element(document.querySelectorAll("#jobList .active")).removeClass("active");

                    $timeout(() => {
                        $scope.selectedEvents = [];
                        angular.element(document.querySelectorAll("#jobList .active")).forEach(el => {
                            const eventIndex = angular.element(el).data("index");
                            const event = $scope.jobList[eventIndex];
                            $scope.selectedEvents.push(event);
                        });
                    }, 10);

                    $timeout(() => sizeHeadings(angular.element(document.querySelector("#jobList")).parent(".column")), 1000);
                };

                $scope.jobListMenu =
                    [
                        {
                            text: "Close Event",
                            click: ($itemScope, $event, modelValue, text, $li) => {

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
                                    onSubmit: () => {
                                        angular.element(document.querySelector("#box-jobList")).find(".loading").css("display", "block");
                                        angular.element(document.querySelector("#box-map")).find(".loading").css('display', 'block');

                                        const userName = angular.element(document.querySelector("#gather-editName")).val();

                                        uCSData.closeEvent($itemScope.event.bulkEventID, userName).then(() => $scope.refreshData(1, true));
                                    },
                                    submitValue: "Close Event"
                                };

                                $scope.gather.showForm();

                            }
                        }
                    ];

                $scope.reply = currentEvent => {
                    function resetCursor(txtElement) {
                        if (txtElement.setSelectionRange) {
                            txtElement.focus();
                            txtElement.setSelectionRange(0, 0);
                        } else if (txtElement.createTextRange) {
                            let range = txtElement.createTextRange();
                            range.moveStart('character', 0);
                            range.select();
                        }
                    }

                    function afterShowAnimation(scope, element, options) {
                        const e = $document.getElementById("event-notes");
                        resetCursor(e);
                    }

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

                $scope.createJobEvent = (job, $event) => {
                    $scope.currentJob = job;
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

                $scope.eventDialogController = ($scope, $mdDialog, dataToPass) => {
                    console.log($scope.currentJob);
                    console.log(dataToPass);
                    $scope.book = {};

                    $scope.book.courier = $scope.currentJob.courierCode;
                    $scope.book.job = $scope.currentJob.jobNumber;

                    if (dataToPass !== undefined) {
                        $scope.book.notes = " - " + moment().format("DD/MM/YY HH:mm") + " " + ClientName + "\r\n" + dataToPass.notes;
                        $scope.book.reply = true;
                        $scope.book.closeEventId = dataToPass.bulkEventID;
                    } else {
                        $scope.book.reply = false;
                        $scope.book.closeEventId = undefined;
                    }

                    $scope.hide = () => $mdDialog.hide();

                    $scope.cancel = () => $mdDialog.cancel();

                    $scope.answer = answer => $mdDialog.hide(answer);

                    $scope.createEvent = () => {
                        var error = $scope.bookForm.$error;

                        angular.forEach(error.required, field => {
                            if (field.$invalid) {
                                field.$touched = true;
                            }
                        });

                        if ((error.required || []).length > 0) {
                            return;
                        }


                        angular.element(document.querySelector(".wait")).css("display", "block");
                        processEventBooking();


                    };

                    function processEventBooking() {
                        const event = {
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
                            .then(returnData => {
                                if (returnData === undefined ||
                                    returnData !== "OK") {
                                    alert("Sorry, create event failed");
                                    angular.element(document.querySelector(".wait")).css("display", "block");
                                    $scope.cancel();
                                } else {
                                    angular.element(document.querySelector(".wait")).css("display", "block");
                                    $scope.cancel();
                                    if ($scope.book.reply) {
                                        uCSData.closeEvent($scope.book.closeEventId, event.Name).then(() => $scope.refreshData(true, true));
                                    }

                                    alert("Event Created!");
                                }

                                $scope.refreshData(true, true);
                            });
                    }
                };


                $scope.addEventNote = (eventId, type, options) => {
                    $scope.gather.form = {
                        id: "addNote",
                        title: "Add Event Note ",
                        fields: [
                            {
                                "name": "notes",
                                "label": "Notes" + "...",
                                "value": "",
                                "eventID": eventId,
                                type,
                                options
                            }
                        ],
                        onSubmit: () =>
                            uCSData.addEventNote($scope.gather.form.fields[0].eventID, $scope.gather.form.fields[0].value).then(data => {

                                if (data.response === "Success") {
                                    $scope.currentEvent = data.bulkEvent;
                                    var ci = $scope.jobList.findIndex(obj => obj.bulkEventID === data.bulkEvent.bulkEventID);
                                    $scope.jobList[ci] = data.bulkEvent;
                                    //  $scope.$apply();
                                    //alert(field + "Note added successfully!");

                                } else {

                                    alert(data.response);

                                }

                            }),
                        submitValue: "Add Note"
                    };
                    $scope.gather.showForm();

                };


                // Load custom layout
                $scope.init = () => {
                    if (Modernizr.localstorage) {
                        const storedLayouts = localStorage.getItem("layoutsCS-" + ContactID);
                        const lastActiveLayoutName = localStorage.getItem("lastActiveLayoutCS-" + ContactID);

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

                $scope.onSearchRangeChange = selectedDateRange => {
                    const now = moment().format("YYYY-MM-DD");
                    const firstDayOfMonth = moment().startOf('month').format("YYYY-MM-DD");
                    const lastDayOfMonth = moment().endOf('month').format("YYYY-MM-DD");
                    const oneWeekAgo = moment().subtract(1, 'weeks').format("YYYY-MM-DD");
                    const oneWeekAhead = moment().add(1, 'weeks').format("YYYY-MM-DD");

                    switch (selectedDateRange) {
                        case '2':
                            $scope.currentFromDate = now;
                            $scope.currentToDate = now;
                            break;
                        case '1':
                            $scope.currentFromDate = oneWeekAgo;
                            $scope.currentToDate = oneWeekAhead;
                            break;
                        case '3':
                            $scope.currentFromDate = firstDayOfMonth;
                            $scope.currentToDate = lastDayOfMonth;
                            break;
                        case '4':
                            // This option is empty as ng-if is used on the page to show custom date range options
                            break;
                    }
                };

                // Default to today
                $scope.onSearchRangeChange($scope.dateSearchRange);
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
    var y = lat2 - lat1;
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
    var closestLocation = locations[closest];
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
