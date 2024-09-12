angular.module('uDispatch').controller('CSControl', [
    '$scope',
    'JobDetailService',
    'uCSData',
    "$state",
    "$stateParams",
    "$filter",
    '$parse',
    "$location",
    "$q",
    'NgMap',
    'GeoCoder',
    '$mdDialog',
    'greetingService',
    '$document',
    '$timeout',
    'loadingService',
    'dispatchJobService',
    'toastrService',
    'moment',
    'DispatchData',
    'versionUrl',
    ($scope, jdSvc, uCSData, $state, $stateParams, $filter, $parse, $location, $q, NgMap, GeoCoder, $mdDialog, greetingService, $document, $timeout, loadingService, dispatchJobService, toastrService, moment, DispatchData, versionUrl) => {
        $scope.isAdmin = (ClientInternal === "True");
        $scope.mapSetting = {
            "allCouriers": false, "allRuns": false
        };

        $scope.userName = FirstName;
        $scope.jobDetailFabIsOpen = false;
        $scope.dateSearchRange = 1; // Set to fortnight
        $scope.DEFAULT_DATE_FORMAT = "dd/MM/yyyy";

        //$scope.selectedJobs = [];

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
        $scope.dispatchJobService = dispatchJobService;

        $scope.jobQuery = {
            order: 'booked', limit: 50, page: 1
        };

        $scope.bulkJobQuery = {
            order: 'booked', limit: 50, page: 1
        };

        $scope.preBookQuery = {
            order: 'booked', limit: 50, page: 1
        };

        $scope.jobPromise = null;
        $scope.bulkJobPromise = null;
        $scope.preBookPromise = null;

        $scope.greetUser = () => {
            return greetingService.greetUser(FirstName);
        }

        /**
         * @param {Job} currentJob
         * @param {string} field
         * @param {boolean} fromRightClick
         */
        $scope.updateGPS = (currentJob, field, fromRightClick) => {
            jdSvc.updateGPS(currentJob, field, fromRightClick);
        };

        /**
         * @param  {$event}  $event
         * @param  {Job}  job
         */
        $scope.selectAndDispatchJob = ($event, job) => {
            const dispatchDialog = $mdDialog.prompt()
                .title("Dispatch To Courier")
                .textContent('Enter the courier number to dispatch job to')
                .placeholder("Courier Number")
                .ariaLabel("courier to dispatch too")
                .targetEvent($event)
                .required(true)
                .ok("Dispatch")
                .cancel('Cancel');

            return $mdDialog.show(dispatchDialog).then(courierNumber => {
                return dispatchJobService.dispatchJob(courierNumber, job)
                    .then(() => {
                        $scope.selectJob(job);
                        toastrService.showSuccessToast('Job dispatched to courier ' + courierNumber);
                    })
                    .catch(error => {
                        console.log(error);
                    });
            }, () => {
                // User clicked cancel
            });
        }

        /**
         * @param  {$event}  $event
         */
        $scope.createNewJob = $event => {
            // Dialog
            $mdDialog.show({
                controller: 'CreateJobDialogController',
                controllerAs: 'ctrl',
                parent: angular.element($document.body),
                targetEvent: $event,
                templateUrl: "app/components/dialogs/create-job-dialog/create-job-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    staffId: ContactID, despatcherName: FirstName
                },
                bindToController: true
            }).then(newJobId => {
                // Refresh data
                $scope.refreshData(true);

                // Then load the new job
                $scope.selectJobDetail(newJobId);
                console.log('Dialog closed!')
            });
        }

        /**
         * @param  {$event}  $event
         * @param  {Job}  job
         */
        $scope.showAdditionalServicesMenu = ($event, job) => {

            DispatchData.hasClientItemsAvailable(job.clientId, job.speedId).then(isClientItemsAvailable => {
                loadingService.closeLoader();

                if (!isClientItemsAvailable) {
                    return $mdDialog.show($mdDialog.alert()
                        .clickOutsideToClose(true)
                        .title('No Additional Services')
                        .targetEvent($event)
                        .textContent('No additional services has been set up for this client. Please add a service through Admin Manager and try again.')
                        .ok('OK'));
                }

                // Show additional services dialog
                return $mdDialog.show({
                    controller: 'AdditionalServicesDialogController',
                    controllerAs: "ctrl",
                    templateUrl: "app/components/dialogs/additional-services-dialog/additional-services-dialog.html",
                    parent: angular.element($document.body),
                    targetEvent: $event,
                    clickOutsideToClose: false,
                    fullscreen: true,
                    locals: {
                        job
                    },
                    bindToController: true
                });
            }).catch(error => {
                console.log(error.message);
            });
        }

        /**
         * @param  {$event}  $event
         */
        $scope.interCourierCharge = $event => {
            $mdDialog.show({
                controller: 'InterCourierChargeDialog',
                controllerAs: 'ctrl',
                parent: angular.element($document.body),
                targetEvent: $event,
                templateUrl: "app/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    staffId: ContactID,
                },
                bindToController: true
            }).then(() => {
                console.log("Inter-courier Charge Added!")
            }).then(() => "Inter-courier Charge Canceled!");
        }

        $scope.gather = {
            submit() {
                angular.element(".gatherForm").css("display", "none");
                $scope.gather.form.onSubmit().then(() => {
                    if ($scope.currentJob) {
                        $scope.currentJob.bulkJob ? $scope.selectBulkJobDetail($scope.currentJob.id) : $scope.currentJob.preBook ? $scope.selectPreBookDetail($scope.currentJob.id) : $scope.selectJobDetail($scope.currentJob.id);
                    }
                });
            }, cancel: () => angular.element(".gatherForm").css("display", "none"), showForm: () => {
                angular.element(".gatherForm").css("display", "block");
                $timeout(() => angular.element(".gatherForm .focusMe").focus(), 100);
            }, submitValue: "Save"
        };

        $scope.gather = {
            submit: () => {
                angular.element(".gatherForm").hide();
                $scope.gather.form.onSubmit().then(response => {
                    if ($scope.currentJob) {
                        $scope.currentJob.bulkJob ? $scope.selectBulkJobDetail($scope.currentJob.id) : $scope.currentJob.preBook ? $scope.selectPreBookDetail($scope.currentJob.id) : $scope.selectJobDetail($scope.currentJob.id);
                    }
                });
            }, cancel: () => {
                angular.element(".gatherForm").hide();
            }, showForm: () => {
                angular.element(".gatherForm").show(0, () => {
                    $timeout(() => {
                        angular.element(".gatherForm .focusMe").focus();
                    }, 100);
                });
            }, submitValue: "Save"
        };

        jdSvc.setGather($scope.gather);

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

        $scope.boxes = {
            "pickDate": {
                "title": "Filters", "tpl": versionUrl("app/components/CS/tpls/pickDate.tpl"), "showSearch": 0
            },

            "jobList": {
                "title": "Live Job Data",
                "tpl": versionUrl("app/components/CS/tpls/jobList.tpl"),
                "showSearch": 1,
                "model": "jobList",
                "headings": [{
                    "label": "Created", "name": "created"
                }, {
                    "label": "ID", "name": "bulkEventID"
                }, {
                    "label": "Job #", "name": "jobNumber"
                }, {
                    "label": "Courier", "name": "courierCode"
                }, {
                    "label": "Created By", "name": "name"
                }, {
                    "label": "Followup By", "name": "clientFollowup"
                }, {
                    "label": "Client Visible", "name": "clientVisible"
                }, {
                    "label": "Closed By", "name": "closedByName"
                }, {
                    "label": "Notes", "name": "notes"
                }


                ]
            }, "bulkJobList": {
                "title": "Bulk Job Data",
                "tpl": versionUrl("app/components/CS/tpls/bulkJobList.tpl"),
                "showSearch": 1,
                "model": "bulkJobList",
                "headings": [{
                    "label": "Created", "name": "created"
                }, {
                    "label": "ID", "name": "bulkEventID"
                }, {
                    "label": "Job #", "name": "jobNumber"
                }, {
                    "label": "Courier", "name": "courierCode"
                }, {
                    "label": "Created By", "name": "name"
                }, {
                    "label": "Followup By", "name": "clientFollowup"
                }, {
                    "label": "Client Visible", "name": "clientVisible"
                }, {
                    "label": "Closed By", "name": "closedByName"
                }, {
                    "label": "Notes", "name": "notes"
                }


                ]
            }, "pbList": {
                "title": "PreBook Data",
                "tpl": versionUrl("app/components/CS/tpls/pbList.tpl"),
                "showSearch": 1,
                "showRefresh": 1,
                "model": "pbList",
                "headings": [{
                    "label": "Booked", "name": "booked"
                }, {
                    "label": "Speed", "name": "speed"
                }, {
                    "label": "Job #", "name": "jobNumber"
                }, {
                    "label": "Client", "name": "clientCode"
                }, {
                    "label": "From", "name": "froAddress"
                }, {
                    "label": "To", "name": "toAddress"
                }, {
                    "label": "Code", "name": "code"
                }, {
                    "label": "Send", "name": "send"
                }, {
                    "label": "Void", "name": "void"
                }
                ]
            }, "jobDetail": {
                "title": "Detail",
                "tpl": versionUrl("app/components/common/tpls/jobDetail.tpl"),
                "showSearch": 0,
                "showDetailButtons": 1
            }, "scanList": {
                "title": "Scan Detail",
                "tpl": versionUrl("app/components/CS/tpls/scanList.tpl"),
                "showSearch": 0,
                "model": "scanList",
                "headings": [{
                    "label": "Time", "name": "scanDateTime"
                }, {
                    "label": "Scan Type", "name": "scanDetail"
                }, {
                    "label": "Courier", "name": "courier"
                }]
            }, "map": {
                "title": "Google Map", "tpl": versionUrl("app/components/CS/tpls/map.tpl"), "showSearch": 0
            }

        };

        ///////////////////////////////
        // LAYOUT
        ///////////////////////////////
        let layoutsObject = null;
        if (Modernizr.localstorage) {
            layoutsObject = JSON.parse(localStorage.getItem("layoutsCS-" + ContactID));
        }

        const defaultLayout = [{
            name: "Default", layout: {
                "columns": [{
                    "id": "col1", "width": "350px", "boxes": [{

                        "name": "pickDate"
                    }]
                }, {
                    "id": "col2", "width": "1350px", "boxes": [{

                        "name": "jobList", "height": "550px"
                    }, {

                        "name": "bulkJobList", "height": "225px"
                    }, {

                        "name": "pbList", "height": "225px"
                    }]
                },

                    {
                        "id": "col3", "boxes": [{
                            "name": "jobDetail", "height": "550px"
                        }, {
                            "name": "scanList", "height": "225px"
                        }, {
                            "name": "map"
                        }]
                    }]
            }
        }];

        if (layoutsObject !== null) {
            layoutsObject[0] = defaultLayout[0];
        }

        $scope.layouts = layoutsObject || defaultLayout;


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

        $scope.layout = angular.copy($scope.layouts[0].layout);
        $scope.currentLayoutName = $scope.layouts[0].name;

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
                    localStorage.setItem("layoutsCS-" + ContactID, JSON.stringify($scope.layouts));
                }
            }, () => console.log("Delete layout canceled!"));
        }

        /**
         * @param {string} layoutName
         */
        $scope.setLastActiveLayoutName = layoutName => {
            if (Modernizr.localstorage) {
                localStorage.setItem("lastActiveLayoutCS-" + ContactID, layoutName);
            }
        };

        /**
         * @param {number} index
         */
        $scope.loadLayout = index => {
            $scope.currentLayoutName = $scope.layouts[index].name;
            $scope.layout = angular.copy($scope.layouts[index].layout);

            // save layout as last active
            $scope.setLastActiveLayoutName($scope.currentLayoutName);

            $timeout($scope.initFilters, 1000);
        };

        $scope.saveLayout = () => {
            angular.forEach($scope.layout.columns, (column, colKey) => {
                column.width = angular.element("#co-" + column.id).css("flex-basis");
                angular.forEach(column.boxes, (box, boxKey) => {
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

        $scope.jobRecordSearchText = "";

        /**
         *
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


        $scope.filterRegion = region => {
            const sr = $scope.pickRegions.find(obj => {

                return obj.id === region.id;

            });
            $scope.pickDateService.regions = [];
            $scope.pickDateService.regions.push(sr);
            $scope.refreshData(true);
            $scope.refreshBulkData(true);
            $scope.refreshPreBookData(true);
        };

        $scope.unlockJob = () => jdSvc
            .unlockJob($scope.currentJob);

        $scope.lockJob = () => jdSvc
            .lockJob($scope.currentJob);

        $scope.unSplitJob = () => {
            const confirm = $mdDialog.confirm()
                .title('Un-Split Job?')
                .textContent('Are you sure you wish to un-split this job?')
                .ok('Yes')
                .cancel('No');

            $mdDialog.show(confirm).then(() => {
                uCSData.unSplitJob($scope.currentJob.id).then(msg => {
                    if ((msg || "").length > 2) {
                        const alert = $mdDialog.alert()
                            .title('Error')
                            .textContent(msg)
                            .ok('Close');

                        $mdDialog.show(alert);
                    }
                });
            }, () => {
                // user clicked 'No'
            });
        };

        /**
         * @param {Job} job
         */
        $scope.restoreJob = job => {
            angular.element("#box-jobDetail").find(".loading").show();
            let callData = {
                "call": "restoreJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
            };

            let foundCourier = null;
            const jn = job.jobNo;

            uCSData.addRestoreEvent(jn, job.clientId, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
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

        /**
         * @param {$event} $event
         */
        $scope.swapPOD = $event => {
            const jobNumberPrompt = $mdDialog.prompt()
                .title('Enter the other job number')
                .textContent('Please enter the Job Number to swap the POD.')
                .placeholder('Job Number')
                .ariaLabel('Job Number')
                .initialValue('')
                .targetEvent($event)
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
                        .ariaLabel('Lucky day')
                        .targetEvent($event)
                        .ok('Yes')
                        .cancel('No');

                    $mdDialog.show(confirmSwap).then(() => {
                        uCSData.swapPOD($scope.currentJob.jobNo, jobNumber).then(() => {

                            $mdDialog.show($mdDialog.alert()
                                .clickOutsideToClose(true)
                                .title('Successful')
                                .textContent('POD Swap Completed Successfully')
                                .ok('OK'));

                            uCSData.reSendJobs(secondJobId).then(() => {
                                uCSData.reAssignJobs(firstJobId).then(() => {
                                    uCSData.reSendJobs(firstJobId).then(() => {
                                        $scope.refreshData(true);
                                    });
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
         * @param {$event} $event
         */
        $scope.sendPOD = $event => {
            if (!$scope.currentJob.podPhoto) {
                $mdDialog.show($mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('No Photo')
                    .textContent('Sorry no photo for this job.')
                    .ok('OK')).then(_ => console.log("Alert closed."));
                return;
            }

            const confirm = $mdDialog.prompt()
                .title('Email the photo POD')
                .textContent('Please enter an email address to send the POD.')
                .placeholder('Email Address')
                .ariaLabel('Email Address')
                .targetEvent($event)
                .required(true)
                .ok('Send')
                .cancel('Cancel');

            $mdDialog.show(confirm).then(email => {
                uCSData.sendPOD($scope.currentJob.id, email).then(() => {
                    $mdDialog.show($mdDialog.alert()
                        .clickOutsideToClose(true)
                        .title('Email Sent')
                        .textContent('POD email has been sent')
                        .ok('OK'))
                });
            }, () => {
                // action when cancel is clicked
            });
        }

        $scope.refreshAllData = () => {
            if (($scope.pickDateService.client || "") === "" && ($scope.pickDateService.courier || "") === "" && ($scope.pickDateService.job || "") === "" && ($scope.pickDateService.wild || "") === "") {

                $mdDialog.show($mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Missing Criteria')
                    .textContent('Please provide more detailed search criteria.')
                    .ok('Understood'));
                return;
            }

            return $q.all([$scope.refreshData(), $scope.refreshBulkData(), $scope.refreshPreBookData()]);
        };

        $scope.refreshData = () => {
            $scope.jobPromise = uCSData.getPodJobs($scope.pickDateService.courier, $scope.pickDateService.client, ($scope.pickDateService.wild || ""), ($scope.pickDateService.job || ""), moment($scope.pickDateService.from_date), moment($scope.pickDateService.to_date), $scope.jobQuery.page, $scope.jobQuery.limit).then(data => {
                $scope.jobList = data.item2;
                $scope.totalCount = data.item1;
            });

            return $scope.jobPromise;
        };

        $scope.refreshBulkData = () => {
            $scope.bulkJobPromise = uCSData.searchBulkJobs($scope.pickDateService.courier, $scope.pickDateService.client, ($scope.pickDateService.job || ""), ($scope.pickDateService.wild || ""), moment($scope.pickDateService.from_date), moment($scope.pickDateService.to_date), $scope.bulkJobQuery.page, $scope.bulkJobQuery.limit).then(data => {
                $scope.bulkJobList = data.item2;
                $scope.bulkTotalCount = data.item1;
            });

            return $scope.bulkJobPromise;
        };

        $scope.refreshPreBookData = () => {
            $scope.preBookPromise = uCSData.searchPreBookJobs($scope.pickDateService.courier, $scope.pickDateService.client, ($scope.pickDateService.wild || ""), ($scope.pickDateService.job || ""), moment($scope.pickDateService.from_date), moment($scope.pickDateService.to_date), $scope.preBookQuery.page, $scope.preBookQuery.limit).then(data => {
                $scope.pbList = data.item2;
                $scope.pbTotalCount = data.item1;
            });

            return $scope.preBookPromise;
        };

        /**
         * @param {number} lat
         * @param {number} lng
         */
        $scope.selectJobData = (lat, lng) => {
            const toCompare = [];

            angular.forEach($scope.runBuilder, (job, key) => {
                toCompare.push([key, job.toLat, job.toLng]);
            });

            const closestIndex = closestLocation(lat, lng, toCompare);

            return $scope.runBuilder[closestIndex[0]];
        };

        /**
         * @param {Job} job
         */
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
            angular.element("#box-jobsList").find(".loading").show();
            $scope.jobList = group.jobs;
            $timeout(() => {
                sizeHeadings(angular.element("#jobList").parents(".column"));
            }, 1000);
            angular.element("#box-jobsList .loading").fadeOut();
        };

        /**
         * @param {number} sizeId
         */
        $scope.sizeName = sizeId => {
            if (!sizeId) {
                return "";
            }
            const sn = $scope.options.detail.size.find(obj => {

                return obj.id === sizeId;

            });
            return sn === undefined ? "" : sn.label;
        };

        /**
         * @param {number} jobId
         * @param {string} jobNumber
         */
        $scope.loadRelatedJobDetail = (jobId, jobNumber) => {
            angular.element("#box-jobDetail").find(".loading").show();
            uCSData.getJobDetail(jobId).then(data => {
                $scope.currentJob = data;
                angular.element("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + jobNumber;
            });
        }

        /**
         * @param {number} jobId
         */
        $scope.selectJobDetail = jobId => {
            $scope.scanList = [];
            console.log("select Job  " + jobId);
            clearTimeout($scope.myTimer);

            angular.element("#box-jobDetail").find(".loading").show();

            uCSData.getJobDetail(jobId).then(data => {
                $scope.currentJob = data;
                jdSvc.setJob($scope.currentJob);
                angular.element("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Job " + data.jobNo;
                const jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true);
                setMapBounds();
                map.setZoom(14);
                if ($scope.currentJob.rootParentID) {
                    uCSData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientId).then(data => {
                        $scope.currentJob.relatedJobs = data;
                    });
                }
                angular.element("#box-scanList").find(".loading").show();
                uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(data => {
                    $scope.scanList = data;

                    $timeout(() => {
                        sizeHeadings(angular.element("#scanList").parents(".column"));
                        angular.element("#box-scanList").find(".loading").fadeOut();
                    }, 200);
                });

                if ($scope.currentJob.courier && $scope.currentJob.completedTime) {
                    angular.element("#box-map").find(".loading").show();
                    uCSData.getCourierRoute($scope.currentJob.courier, moment($scope.currentJob.completedTime).subtract(5, 'm'), moment($scope.currentJob.completedTime).add(5, 'm')).then(data => {
                        const flightPathCoordinates = [];

                        angular.element("#box-map").find(".loading").fadeOut();
                        if (data.length === 0) {
                            return;
                        }
                        for (let i = 0; i < data.length; i++) {
                            const coordinatePair = new google.maps.LatLng(data[i].latitude, data[i].longitude);
                            flightPathCoordinates.push(coordinatePair);
                        }
                        const flightPathPoly = new google.maps.Polyline({
                            path: flightPathCoordinates, strokeColor: "#FF0000", strokeOpacity: 1.0, strokeWeight: 2
                        });

                        const flightPath = flightPathPoly.getPath();

                        const pathValues = [];
                        for (let i = 0; i < flightPath.getLength(); i++) {
                            pathValues.push(flightPath.getAt(i).toUrlValue());
                        }

                        $.get('https://roads.googleapis.com/v1/snapToRoads', {
                            interpolate: true, key: googleMapsApiKey, path: pathValues.join('|')
                        }, data => {
                            const snappedCoordinates = [];
                            for (let i = 0; i < data.snappedPoints.length; i++) {
                                const latlng = new google.maps.LatLng(data.snappedPoints[i].location.latitude, data.snappedPoints[i].location.longitude);
                                snappedCoordinates.push(latlng);
                            }
                            const snappedFlightPath = new google.maps.Polyline({
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

        /**
         * @param  {number} prebookJobId
         */
        $scope.selectPreBookDetail = prebookJobId => {
            $scope.scanList = [];
            console.log("select pre book Job  " + prebookJobId);
            clearTimeout($scope.myTimer);

            angular.element("#box-jobDetail").find(".loading").show();

            uCSData.getPreBookDetail(prebookJobId).then(data => {
                $scope.currentJob = data;
                jdSvc.setJob($scope.currentJob);
                angular.element("#box-jobDetail").find(".loading").hide();
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
                const selectedDays = [];
                const days = $scope.currentJob.days.slice(0, 7);
                for (let i = 0; i < days.length; i++) {
                    if (days[i] === '1') {
                        selectedDays.push(jdSvc.pickDays[i]);
                    }
                }
                console.log(selectedDays);
                jdSvc.combos.days = selectedDays;
                const jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true);
                setMapBounds();
                map.setZoom(14);
                uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(data => {
                    $scope.scanList = data;

                    $timeout(() => {
                        sizeHeadings(angular.element("#scanList").parents(".column"));
                        angular.element("#box-scanList").find(".loading").fadeOut();
                    }, 200);
                });
            });
        };

        //Select Bulk Job
        /**
         * @param {number} bulkJobId
         */
        $scope.selectBulkJobDetail = bulkJobId => {
            $scope.scanList = [];
            console.log("select Bulk Job  " + bulkJobId);
            clearTimeout($scope.myTimer);

            angular.element("#box-jobDetail").find(".loading").show();

            uCSData.getBulkJobDetail(bulkJobId).then(data => {
                $scope.currentJob = data;
                jdSvc.setJob($scope.currentJob);
                angular.element("#box-jobDetail").find(".loading").hide();
                $scope.currentSelection = " for Bulk Job " + data.jobNo;
                const jobs = [];
                jobs.push($scope.currentJob);
                displayRoutePointsOnly(jobs, true);
                setMapBounds();
                map.setZoom(14);
                uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo).then(data => {
                    $scope.scanList = data;

                    $timeout(() => {
                        sizeHeadings(angular.element("#scanList").parents(".column"));
                        angular.element("#box-scanList").find(".loading").fadeOut();
                    }, 200);
                });
            });
        };

        jdSvc.setSelectJobDetail($scope.selectJobDetail);
        jdSvc.setSelectBulkJobDetail($scope.selectBulkJobDetail);

        /**
         * @param {number} page
         * @param {number} limit
         */
        $scope.jobPageChanged = (page, limit) => {
            $scope.jobQuery.page = page;
            $scope.jobQuery.limit = limit;
            $scope.refreshData();
        };

        /**
         * @param {number} page
         * @param {number} limit
         */
        $scope.bulkJobPageChanged = (page, limit) => {
            $scope.bulkJobQuery.page = page;
            $scope.bulkJobQuery.limit = limit;
            $scope.refreshBulkData();
        };

        /**
         * @param {number} page
         * @param {number} limit
         */
        $scope.preBookPageChanged = (page, limit) => {
            $scope.preBookQuery.page = page;
            $scope.preBookQuery.limit = limit;
            $scope.refreshPreBookData();
        };

        /**
         * @param {number} index
         */
        $scope.changeBulkPageSize = index => {
            $scope.bulkPageIndex = index;
            $scope.bulkPageSizeSelected = index;
            $scope.refreshBulkData();
        };

        /**
         * @param {number} index
         */
        $scope.pbPageChanged = index => {
            $scope.pbPageIndex = index;
            $scope.refreshPreBookData();
        };

        /**
         * @param {number} index
         */
        $scope.changePBPageSize = index => {
            $scope.pbPageIndex = index;
            $scope.pbPageSizeSelected = index;
            $scope.refreshPreBookData();
        };

        /**
         * @param {number} index
         */
        $scope.bulkPageChanged = index => {
            $scope.bulkPageIndex = index;
            $scope.refreshBulkData();
        };

        /**
         * @param {number} index
         */
        $scope.changePageSize = index => {
            $scope.pageIndex = index;
            $scope.pageSizeSelected = index;
            $scope.refreshData();
        };

        // New Material Autocompletes
        $scope.clientSelectedItem = $scope.pickDateService.client;
        $scope.courierSelectedItem = $scope.pickDateService.client;
        $scope.clientSearchText = '';
        $scope.courierSearchText = '';

        /**
         * @param {string} searchText
         */
        $scope.clientQuerySearch = (searchText) => uCSData.getActiveClients(searchText);

        /**
         * @param {Suggestion} item
         */
        $scope.selectedClientChange = item => {
            if (!item) {
                $scope.pickDateService.client = null;
                return;
            }

            $scope.pickDateService.client = item.id;
            $scope.refreshAllData(true);
        };

        /**
         * @param {string} searchText
         */
        $scope.courierQuerySearch = (searchText) => uCSData.getActiveCouriersSearch(searchText);

        /**
         * @param {Suggestion} item
         */
        $scope.selectedCourierChange = item => {
            if (!item) {
                $scope.pickDateService.courier = null;
                return;
            }

            $scope.pickDateService.courier = item.id;
            $scope.refreshAllData(true);
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
            $timeout(() => {
                $scope.selectedEvents = $scope.selected || [];
            }, 10);
        };

        $scope.jobListMenu = [{
            text: "Close Event", click: ($itemScope, $event, modelValue, text, $li) => {

                $scope.gather.form = {
                    id: "closeEvent", title: "Close Event?", fields: [{
                        "name": "editName", "label": "Edit your name", "value": ""
                    }], onSubmit: () => {
                        angular.element("#box-jobList").find(".loading").show();
                        angular.element("#box-map").find(".loading").show();
                        const userName = angular.element("#gather-editName").val();
                        uCSData.closeEvent($itemScope.event.bulkEventID, userName).then(() => {
                            $scope.refreshData(1, true);
                        });
                    }, submitValue: "Close Event"
                };

                $scope.gather.showForm();
            }
        }];

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
            };

            function afterShowAnimation(scope, element, options) {
                const e = document.getElementById("event-notes");
                resetCursor(e);
            };

            $mdDialog.show({
                locals: {dataToPass: currentEvent},
                controller: $scope.eventDialogController,
                scope: $scope,
                preserveScope: true,
                templateUrl: "app/components/CS/tpls/createEvent.html?v=1.13",
                parent: angular.element($document.body),
                clickOutsideToClose: true,
                onComplete: afterShowAnimation
            });
        };

        /**
         * @param {Job} job
         */
        $scope.createJobEvent = (job) => {
            $scope.currentJob = job;
            $mdDialog.show({
                locals: {dataToPass: undefined},
                controller: $scope.eventDialogController,
                scope: $scope,
                preserveScope: true,
                templateUrl: "app/components/CS/tpls/createEvent.html?v=1.13",
                parent: angular.element($document.body),
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
                $scope.book.notes = (" - " + moment().format("DD/MM/YY HH:mm") + " " + ClientName + "\r\n" + dataToPass.notes);
                $scope.book.reply = true;
                $scope.book.closeEventId = dataToPass.bulkEventID;
            } else {
                $scope.book.reply = false;
                $scope.book.closeEventId = undefined;
            }

            $scope.hide = () => {
                $mdDialog.hide();
            };

            $scope.cancel = () => {
                $mdDialog.cancel();
            };

            $scope.answer = answer => {
                $mdDialog.hide(answer);
            };

            $scope.createEvent = () => {
                const error = $scope.bookForm.$error;

                angular.forEach(error.required, field => {
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
                    "clientId": $scope.currentJob.clientId
                };

                uCSData.createEvent(event, $scope.isAdmin ? $scope.book.notify : true)
                    .then(returnData => {
                        if ((returnData === undefined || returnData !== "OK")) {
                            $mdDialog.show($mdDialog.alert()
                                .clickOutsideToClose(true)
                                .title('Error')
                                .textContent('Sorry, create event failed')
                                .ok('OK'));

                            angular.element(".wait").hide();
                            $scope.cancel();
                        } else {
                            angular.element(".wait").hide();
                            $scope.cancel();
                            if ($scope.book.reply) {
                                uCSData.closeEvent($scope.book.closeEventId, event.Name).then(() => {
                                    $scope.refreshData(true, true);
                                });
                            }

                            $mdDialog.show($mdDialog.alert()
                                .clickOutsideToClose(true)
                                .title('Success')
                                .textContent('Event Created')
                                .ok('OK'));
                        }

                        $scope.refreshData(true, true);
                    });
            }
        };


        $scope.addEventNote = (eventId, type, options) => {

            $scope.gather.form = {
                id: "addNote", title: "Add Event Note ", fields: [{
                    "name": "notes",
                    "label": "Notes" + "...",
                    "value": "",
                    "eventID": eventId,
                    "type": type,
                    "options": options
                }], onSubmit: () => {
                    uCSData.addEventNote($scope.gather.form.fields[0].eventID, $scope.gather.form.fields[0].value).then(data => {
                        if (data.response === "Success") {
                            $scope.currentEvent = data.bulkEvent;
                            const ci = $scope.jobList.findIndex(obj => {
                                return obj.bulkEventID === data.bulkEvent.bulkEventID;
                            });

                            $scope.jobList[ci] = data.bulkEvent;
                        } else {

                            $mdDialog.show($mdDialog.alert()
                                .clickOutsideToClose(true)
                                .title('Alert')
                                .textContent(data.response)
                                .ok('OK'));
                        }
                    });

                }, submitValue: "Add Note"
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

        // Default to fortnight
        $scope.onSearchRangeChange($scope.dateSearchRange);
    }
]);

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

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {*[]} locations
 */
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
