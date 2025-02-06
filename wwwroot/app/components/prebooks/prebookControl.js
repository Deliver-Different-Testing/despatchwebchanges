import app from "../../app";

app.controller("PBControl", ["$scope", "JobDetailService", "uPBData", "$state", "$filter", "$mdDialog", "$timeout",
    "$window", "$mdSidenav", "greetingService", "APP_CONFIG",
        ($scope, jdSvc, uPBData, $state, $filter, $mdDialog, $timeout,
         $window, $mdSidenav, greetingService, APP_CONFIG) => {
            $scope.isAdmin = (ClientInternal === "True");
            $scope.mapSetting = {
                "allCouriers": false, "allRuns": false
            };

            // New map
            $scope.mapCenter = APP_CONFIG.US_Customer ?
                {lat: 39.8283, lng: -98.5795} : // US center
                {lat: -36.8485, lng: 174.7633}; // Auckland, NZ
            $scope.mapZoom = 8;
            $scope.jobs = [];

            $scope.jdSvc = jdSvc;

            /**
             * Toggles the sidenav.
             */
            $scope.toggleSidenav = () => {
                $mdSidenav("right").toggle();
            };

            $scope.selectedPrebooks = [];

            $scope.greeting = greetingService.greetUser(FirstName);

            $scope.searchBox = "";
            $scope.selectedEvents = [];
            $scope.maxSize = 5;     // Limit number for pagination display number.
            $scope.totalCount = 0;  // Total number of items in all pages. initialize as a zero
            $scope.pageIndex = 1;   // Current page number. First page is 1.-->
            $scope.pageSizeSelected = 50; // Maximum number of items per page.

            /**
             * @param {Job} currentJob
             * @param {string} field
             * @param {boolean} fromRightClick
             */
            $scope.updateGPS = (currentJob, field, fromRightClick) => {
                jdSvc.updateGPS(currentJob, field, fromRightClick);
            };

            $scope.jobQuery = {
                order: "booked", limit: 50, page: 1
            };

            $scope.jobList = []; // Your original data
            $scope.filteredData = []; // Holds filtered and sorted data
            $scope.pagedData = []; // Holds the current page of data
            $scope.searchText = "";
            $scope.promise = null; // This will hold our loading promise

            $scope.updateTable = () => {
                // Apply search filter
                let orderedData = $filter("filter")($scope.jobList, $scope.searchText);

                // Apply sorting
                orderedData = $filter("orderBy")(orderedData, $scope.jobQuery.order);

                $scope.filteredData = orderedData;

                // Apply pagination
                const start = ($scope.jobQuery.page - 1) * $scope.jobQuery.limit;
                $scope.pagedData = orderedData.slice(start, start + $scope.jobQuery.limit);
            };

            /**
             * @param {number} page
             * @param {number} limit
             */
            $scope.onPaginate = (page, limit) => {
                $scope.jobQuery.page = page;
                $scope.jobQuery.limit = limit;
                $scope.updateTable();
            };

            $scope.$watchGroup(["$scope.searchText", "$scope.jobQuery.order"], () => {
                $scope.jobQuery.page = 1; // Reset to first page
                $scope.updateTable();
            });

            /**
             * @param {string} boxName
             * @param {number} index
             */
            $scope.openSearch = (boxName, index) => {
                if (!$scope.showInput) {
                    $scope.showInput = {};
                }
                $scope.showInput[boxName + "-" + index] = !$scope.showInput[boxName + "-" + index];
                $scope.jobRecordSearchText = "";
                $scope.selectedJobRecord = null;
            };

            $scope.jobRecordSearchText = "";

            /**
             * @param {string} searchText
             */
            $scope.jobRecordSearch = searchText => {
                console.log(searchText);
                if (!searchText) {
                    return [];
                }

                searchText = searchText.toLowerCase();

                return $scope.jobList
                    .filter(job => job.jobNo.toLowerCase().indexOf(searchText) !== -1)
                    .map(job => ({
                        text: job.jobNo, id: job.id
                    }));
            };


            /**
             * @param {number} selectedJobId
             */
            $scope.JobRecordSelected = selectedJobId => {
                return $scope.selectJobDetail(selectedJobId);
            }

            $scope.gather = {
                submit: async () => {
                    try {
                        angular.element(".gatherForm").hide();
                        const response = await $scope.gather.form.onSubmit();
                        await $scope.selectJobDetail($scope.currentJob.id);
                    } catch (error) {
                        console.error("Error submitting gather form:", error);
                        // Show an error message to the user
                        $mdDialog.show(
                            $mdDialog.alert()
                                .title("Error")
                                .textContent("An error occurred while submitting the form. Please try again.")
                                .ok("OK")
                        );
                    }
                },

                cancel: () => {
                    try {
                        angular.element(".gatherForm").hide();
                    } catch (error) {
                        console.error("Error cancelling gather form:", error);
                    }
                },

                showForm: () => {
                    console.log("Prebook gather form showForm");
                    try {
                        angular.element(".gatherForm").show(0, () => {
                            $timeout(() => {
                                const focusElement = angular.element(".gatherForm .focusMe");
                                if (focusElement.length) {
                                    focusElement.focus();
                                } else {
                                    console.warn("Focus element not found in gather form");
                                }
                            }, 100);
                        });
                    } catch (error) {
                        console.error("Error showing gather form:", error);
                    }
                },

                submitValue: "Save"
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
                "jobList": {
                    "title": "Prebooks List",
                    "icon": "list_alt",
                    "templateUrl": "app/components/prebooks/partials/pbList.html",
                    "showSearch": 1,
                    "showRefresh": 1,
                    "model": "jobList",
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
                    "icon": "assignment",
                    "templateUrl": "app/components/prebooks/partials/preBookDetail.html",
                    "showSearch": 0,
                    "showDetailButtons": 1
                }, "map": {
                    "title": "Map",
                    "icon": "pin_drop",
                    "templateUrl": "app/components/prebooks/partials/map.html",
                    "showSearch": 0
                }
            };

            ///////////////////////////////
            // LAYOUT
            ///////////////////////////////
            $scope.layouts = [{
                name: "Default", layout: {
                    "columns": [
                        {
                            "id": "col1", "width": "70%", "boxes": [{
                                "name": "jobList"
                            }]
                        },
                        {
                            "id": "col2", "width": "30%", "boxes": [{
                                "name": "jobDetail", "height": "950px"
                            }, {
                                "name": "map"
                            }]
                        }
                    ]
                }
            }];

            $scope.layout = angular.copy($scope.layouts[0].layout);

            /**
             * @param {Number} index
             */
            $scope.loadLayout = (index) => {
                $scope.layout = angular.copy($scope.layouts[index].layout, () => {
                    $timeout(sizeHeadings(), 1000);
                });
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
                    const box = angular.element(`#${ui.item.context.id}`);
                    const parent = box.parent();
                    parent.find(".box").each(function () {
                        angular.element(this).attr("data-height", angular.element(this).height() + "px");
                    });
                },
                update: (e, ui) => {
                    $timeout(() => {
                        const box = angular.element(`#${ui.item.context.id}`);
                        const parent = box.parent();
                        parent.find(".box").each(function () {
                            angular.element(this).css({"flex-basis": angular.element(this).attr("data-height")});
                        });
                        parent.find(".box").last().css({"flex-basis": "0"});
                    }, 0);
                }
            };

            $scope.goToRunViewer = () => {
                console.log("goToRunViewer.");
                $state.go("home");
            };

            //Column Sorting
            $scope.sort = [];
            $scope.orderList = (list, prop) => {
                if ($scope.sort[list] !== prop) {
                    $scope.sort[list] = prop;
                    $scope[list] = $filter("orderBy")($scope[list], prop);
                } else {
                    $scope.sort[list] = `d-${prop}`;
                    $scope[list] = $filter("orderBy")($scope[list], `-${prop}`);
                }
            };

            $scope.refreshData = () => {
                $scope.promise = uPBData.getPreBookJobs().then(data => {
                    $scope.jobList = data;
                    $scope.updateTable();
                    return $scope.jobList;
                });
            };

            $scope.onOrderChange = order => {
                $scope.query.order = order;
                $scope.updateTable();
                return $scope.refreshData();
            };

            $scope.showItems = job => {
                if (job.clientCode !== "Other") {

                    if ($scope.cancelledSelected) {
                        return true;
                    } else {
                        return job.status !== "Cancelled";
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

            $scope.sizeName = sizeId => {
                if (!sizeId) {
                    return "";
                }
                const sn = $scope.options.detail.size.find(obj => {

                    return obj.id === sizeId;

                });
                return sn === undefined ? "" : sn.label;
            };

            $scope.selectJobDetail = async (id) => {
                console.log(`Selecting Job ${id}`);

                try {
                    const loadingElement = angular.element("#box-jobDetail").find(".loading");
                    loadingElement.show();

                    const data = await uPBData.getJobDetail(id);
                    $scope.currentJob = data;
                    await jdSvc.setJob($scope.currentJob);

                    $scope.currentSelection = ` for Job ${data.jobNo}`;
                    console.log($scope.currentJob.days);

                    // Handle prebook specific data
                    const days = $scope.currentJob.days;
                    const freq = days.slice(8, 9).trim() || "0";
                    const hol = days.slice(9, 10).trim() || "0";

                    jdSvc.combos.frequency = [jdSvc.pickFrequency[freq]];
                    jdSvc.combos.holidays = [jdSvc.pickHolidays[hol]];

                    jdSvc.combos.days = days.slice(0, 7)
                        .split("")
                        .reduce((acc, day, index) => day === "1" ? [...acc, jdSvc.pickDays[index]] : acc, []);

                    // Update map with just this job
                    if ($scope.currentJob.pickupAddress?.latitude && $scope.currentJob.pickupAddress?.longitude) {
                        $scope.mapCenter = {
                            lat: $scope.currentJob.pickupAddress.latitude,
                            lng: $scope.currentJob.pickupAddress.longitude
                        };
                        $scope.jobs = [$scope.currentJob];
                    }

                } catch (error) {
                    console.error("Error selecting job detail:", error);
                } finally {
                    loadingElement.hide();
                }
            };
            $scope.pageChanged = i => {
                $scope.jobQuery.page = i;
                $scope.updateTable();
            };

            $scope.changePageSize = i => {
                $scope.jobQuery.page = 1;
                $scope.jobQuery.limit = i;
                $scope.updateTable();
            };


            jdSvc.setSelectJobDetail($scope.selectJobDetail);

            /**
             * Voids all selected prebook jobs
             * @param {number[]} jobIds - Array of job IDs to void
             */
            $scope.voidAllSelectPrebookJobs = async (jobIds) => {
                const selectedPrebookCount = jobIds.length;

                const confirmMessage =
                    `This will void TODAY's copy of all ${selectedPrebookCount} selected prebooks, ` +
                    `but not cancel them for good. Please confirm that you wish to do this?`;

                const confirm = $mdDialog.confirm()
                    .title("Accelerate Prebooks")
                    .textContent(confirmMessage)
                    .ok("Yes")
                    .cancel("No");

                try {
                    await $mdDialog.show(confirm);

                    // User clicked 'Yes'
                    const voidJobs = jobIds.map(jobId =>
                        uPBData.voidPrebookJob(jobId, FirstName, ContactID)
                    );

                    await Promise.all(voidJobs);

                    $scope.currentJob = null;
                    await $scope.refreshData();

                    // Optionally, show a success message
                    $mdDialog.show(
                        $mdDialog.alert()
                            .title("Success")
                            .textContent(`Successfully voided ${selectedPrebookCount} prebook(s).`)
                            .ok("OK")
                    );
                } catch (error) {
                    if (error === undefined) {
                        console.log("User Canceled");
                    } else {
                        console.log("Error voiding prebook jobs:", error);

                        // Show an error dialog to the user
                        $mdDialog.show(
                            $mdDialog.alert()
                                .title("Error")
                                .textContent("An error occurred while voiding the prebook jobs. Please try again.")
                                .ok("OK")
                        );
                    }
                    // If error is falsy, it means the user clicked 'No', so we do nothing
                }
            };


            /**
             * Voids a single prebook job
             * @param {number} jobId - ID of the job to void
             */
            $scope.voidPrebookJob = async (jobId) => {
                const confirmMessage =
                    "This will void TODAY'S copy of this prebook but not cancel it for good. " +
                    "Please confirm that you wish to do this?";

                const confirm = $mdDialog.confirm()
                    .title("Void Prebook")
                    .textContent(confirmMessage)
                    .ok("Yes")
                    .cancel("No");

                try {
                    await $mdDialog.show(confirm);

                    // User clicked 'Yes'
                    await uPBData.voidPrebookJob(jobId, FirstName, ContactID);

                    $scope.currentJob = null;
                    await $scope.refreshData();

                    // Show a success message
                    await $mdDialog.show(
                        $mdDialog.alert()
                            .title("Success")
                            .textContent("The prebook job has been successfully voided for today.")
                            .ok("OK")
                    );
                } catch (error) {
                    if (error === undefined) {
                        console.log("User Canceled");
                    } else {
                        console.log("Error voiding prebook job:", error);

                        // Show an error dialog to the user
                        await $mdDialog.show(
                            $mdDialog.alert()
                                .title("Error")
                                .textContent("An error occurred while voiding the prebook job. Please try again.")
                                .ok("OK")
                        );
                    }
                    // If error is falsy, it means the user clicked 'No', so we do nothing
                }
            };

            /**
             * Sends all selected prebook jobs to the live dispatch screen
             * @param {number[]} jobIds - Array of job IDs to send
             */
            $scope.sendAllSelectPrebookJobs = async (jobIds) => {
                const selectedPrebookCount = jobIds.length;

                const confirmMessage =
                    `This will send all ${selectedPrebookCount} selected prebooks to the live dispatch screen now. ` +
                    `Please confirm that you wish to do this?`;

                const confirm = $mdDialog.confirm()
                    .title("Accelerate Prebooks")
                    .textContent(confirmMessage)
                    .ok("Yes")
                    .cancel("No");

                try {
                    await $mdDialog.show(confirm);

                    // User clicked 'Yes'
                    const sendJobs = jobIds.map(jobId => uPBData.sendPrebookJob(jobId));
                    await Promise.all(sendJobs);

                    $scope.currentJob = null;
                    await $scope.refreshData();

                    // Show a success message
                    await $mdDialog.show(
                        $mdDialog.alert()
                            .title("Success")
                            .textContent(`Successfully sent ${selectedPrebookCount} prebook(s) to the live dispatch screen.`)
                            .ok("OK")
                    );
                } catch (error) {
                    if (error === undefined) {
                        console.log("User Canceled");
                    } else {
                        console.log("Error sending prebook jobs:", error);

                        // Show an error dialog to the user
                        await $mdDialog.show(
                            $mdDialog.alert()
                                .title("Error")
                                .textContent("An error occurred while sending the prebook jobs. Please try again.")
                                .ok("OK")
                        );
                    }
                }
            };

            /**
             * Sends a single prebook job to the live dispatch screen
             * @param {number} jobId - ID of the job to send
             */
            $scope.sendPrebookJob = async (jobId) => {
                const confirmMessage =
                    "This will send this prebook to the live dispatch screen now. " +
                    "Please confirm that you wish to do this?";

                const confirm = $mdDialog.confirm()
                    .title("Accelerate Prebook")
                    .textContent(confirmMessage)
                    .ok("Yes")
                    .cancel("No");

                try {
                    await $mdDialog.show(confirm);

                    // User clicked 'Yes'
                    await uPBData.sendPrebookJob(jobId);

                    $scope.currentJob = null;
                    await $scope.refreshData();

                    // Show a success message
                    await $mdDialog.show(
                        $mdDialog.alert()
                            .title("Success")
                            .textContent("The prebook job has been successfully sent to the live dispatch screen.")
                            .ok("OK")
                    );
                } catch (error) {
                    if (error === undefined) {
                        console.log("User Canceled");
                    } else {
                        console.log("Error sending prebook job:", error);

                        // Show an error dialog to the user
                        await $mdDialog.show(
                            $mdDialog.alert()
                                .title("Error")
                                .textContent("An error occurred while sending the prebook job. Please try again.")
                                .ok("OK")
                        );
                    }
                }
            };

            $scope.refreshData();

            $scope.highlightEvent = () => {
                angular.element("#jobList .active").each(function () {
                    angular.element(this).removeClass("active");
                });

                $timeout(() => {
                    $scope.selectedEvents = [];
                    angular.element("#jobList .active").each(function () {
                        const eventIndex = angular.element(this).data("index");
                        const event = $scope.jobList[eventIndex];
                        $scope.selectedEvents.push(event);
                    });
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
                            uPBData.closeEvent($itemScope.event.bulkEventID, userName).then(() => {
                                $scope.refreshData(1, true);
                            });


                        }, submitValue: "Close Event"
                    };

                    $scope.gather.showForm();
                }
            }];
        }]);
