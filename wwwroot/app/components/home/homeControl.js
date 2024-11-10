angular.module("uDispatch")
    .controller("HomeControl", ['$document', "$filter", 'greetingService', "JobDetailService", "$mdDialog", "$parse", "$q", "$scope", "$state", "$window", "$timeout", 'toastrService', "DispatchData", "uCSData", "dispatchJobService", "moment", "Upload", "bytesFilter", "versionUrl", "hotkeys", "APP_CONFIG", "JobTableService", "materialSidenavService", "AppPages", "$rootScope",
        ($document, $filter, greetingService, JobDetailService, $mdDialog, $parse, $q, $scope, $state, $window, $timeout, toastrService, DispatchData, uCSData, dispatchJobService, moment, Upload, bytesFilter, versionUrl, hotkeys, APP_CONFIG, JobTableService, materialSidenavService, AppPages, $rootScope) => {
            // Initialize variables and scope properties
            function initializeVariables() {
                $scope.name = "Home";
                $scope.isInternal = (ClientInternal === "True");
                $scope.jdSvc = JobDetailService;
                $scope.jobTableService = JobTableService;
                $scope.queryParams = JobTableService.createQuery();
                $scope.isUsCustomer = APP_CONFIG.US_Customer;
                $scope.selectedCourier = null;

                // Loading States
                initWidgetLoadingStates();

                $scope.courierSearchText = "";
                $scope.jobRecordSearchText = "";
                $scope.dispatchCourierSearchTest = "";

                $scope.jobDetailFabIsOpen = false;
                $scope.courierListFabIsOpen = false;
                $scope.isCheckingAttachments = false;
                $scope.hasAttachedFile = false;
                $scope.areas = [];
                $scope.selectedAreas = [];
                $scope.filters = [
                    {value: 'new', label: 'New', active: false},
                    {value: 'nda', label: 'NDA', active: false},
                    {value: 'active', label: 'Active', active: false},
                    {value: 'done', label: 'Done', active: false},
                    {value: 'all', label: 'All', active: true}  // default active filter
                ];

                $scope.selectedFilter = 'all'; // default value

                $scope.pickAllCouriers = [];
                $scope.selected = [];
                $scope.jobList = [];
                $scope.supports = [];

                $scope.driverLocations = [];
                $scope.markers = [];
                $scope.truckCourierStatus = [];

                $scope.getJobStyle = assigned => {
                    const normal = {
                        "font-weight": "normal"
                    };

                    const bold = {
                        "font-weight": "bold"
                    };

                    if (assigned) {
                        return bold;
                    } else {
                        return normal;
                    }
                };

                $scope.normalStyle = "{'font-weight:normal'}";

                $scope.boxes = {
                    "jobsList": {
                        "title": "Jobs List",
                        "templateUrl": versionUrl("app/components/home/partials/jobList.html"),
                        "showSearch": 1,
                        "showRefresh": 1
                    }, "jobDetail": {
                        "title": "Detail",
                        "templateUrl": versionUrl("app/components/common/partials/jobDetail.html"),
                        "showSearch": 0,
                        "showRefresh": 0,
                        "showDetailButtons": 1
                    }, "potentialCouriers": {
                        "title": "Potential Couriers",
                        "templateUrl": versionUrl("app/components/home/partials/potentialCouriers.html"),
                        "showSearch": 1
                    }, "currentWork": {
                        "title": "Current Work",
                        "templateUrl": versionUrl("app/components/home/partials/currentWork.html"),
                        "showSearch": 1,
                        "showRefresh": 0
                    }, "couriersMoveThrough": {
                        "title": "Couriers Movement Through List",
                        "templateUrl": versionUrl("app/components/home/partials/couriersMovementThroughList.html"),
                        "showSearch": 1,
                        "showRefresh": 0
                    }, "courierMovePickedUp": {
                        "title": "Couriers Movement Picked Up Run",
                        "templateUrl": versionUrl("app/components/home/partials/couriersMovementPickedUp.html"),
                        "showSearch": 1,
                        "showRefresh": 0
                    }, "courierMoveClear": {
                        "title": "Couriers Movement Clear List",
                        "templateUrl": versionUrl("app/components/home/partials/couriersMovementClearList.html"),
                        "showSearch": 1,
                        "showRefresh": 0
                    }, "areaList": {
                        "title": "Area List",
                        "templateUrl": versionUrl("app/components/home/partials/areaList.html"),
                        "showSearch": 0,
                        "showRefresh": 0
                    }, "jobUpdates": {
                        "title": "Job Updates",
                        "templateUrl": versionUrl("app/components/home/partials/jobUpdates.html"),
                        "showSearch": 0,
                        "showRefresh": 0
                    }, "supports": {
                        "title": "Supports",
                        "templateUrl": versionUrl("app/components/home/partials/supports.html"),
                        "showSearch": 0,
                        "showRefresh": 0
                    }, "lateCalls": {
                        "title": "Late Calls",
                        "templateUrl": versionUrl("app/components/home/partials/lateCalls.html"),
                        "showSearch": 0,
                        "showRefresh": 0
                    }, "map": {
                        "title": "Google Map",
                        "templateUrl": versionUrl("app/components/home/partials/map.html"),
                        "showSearch": 0,
                        "showRefresh": 1
                    }, "driverLocations": {
                        "title": "Driver Locations",
                        "templateUrl": versionUrl("app/components/home/partials/driverLocations.html"),
                        "showSearch": 0,
                        "showRefresh": 0
                    }
                };

                $scope.dispatchState = {
                    processing: false,
                    selectedJobs: new Set()
                };

                $scope.pickService = {
                    "clients": [], "channel": [], "channelTexts": {
                        buttonDefaultText: "Select Channel..."
                    }, "channelEvents": {
                        "onSelectionChanged": async () => {
                            try {
                                const temp = $scope.pickService.channel.map(el => el.label);
                                await $scope.setSupportChannel(String(temp) || "All");
                            } catch (error) {
                                console.log('Error in onSelectionChanged:', error);
                            }
                        }
                    }, "settings": {
                        "enableSearch": true,
                        "selectedToTop": true,
                        "closeOnBlur": true,
                        "closeOnSelect": true,
                        "buttonClasses": "topBarActive btn-sm btn-clients"
                    }
                };

                $scope.pickClients = [];
                $scope.pickChannels = [{
                    "id": "1", "label": "City"
                }, {
                    "id": "2", "label": "Main"
                }, {
                    "id": "3", "label": "Trucks"
                }];

                // Set up table headers
                initTableHeaders();

                $scope.courierMenu = [{
                    text: "Dispatch Selected",
                    click: async ($itemScope) => {
                        try {
                            const courierId = $itemScope.courier.courier || $itemScope.courier.code;
                            await dispatchJobs(courierId);
                            console.log('Dispatch Selected completed successfully');
                        } catch (error) {
                            console.log('Error in Dispatch Selected:', error);
                        }
                    }
                }];

                $scope.potentialCourierMenu = [{
                    text: "Dispatch Selected",
                    async click($itemScope) {
                        try {
                            await dispatchJobService.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
                            console.log('Dispatch from Potential Couriers completed successfully');
                        } catch (error) {
                            console.log('Error in Dispatch from Potential Couriers:', error);
                        }
                    }
                }];
            }

            function initWidgetLoadingStates() {
                $scope.jobsLoading = false;
                $scope.driverLocationsLoading = true;
                $scope.supportsLoading = false;
                $scope.potentialCouriersLoading = false;
                $scope.currentListLoading = false;
            }

            function initTableHeaders() {
                $scope.jobListHeaders = [
                    {key: 'time', label: 'T'},
                    {key: 'speed', label: 'Speed'},
                    {key: 'notify', label: 'N'},
                    {key: 'vehicle', label: 'V'},
                    {key: 'jobNo', label: 'Job'},
                    {key: 'client', label: 'Client'},
                    {key: 'from', label: 'From'},
                    {key: 'to', label: 'To'},
                    {key: '', label: ''},
                    {key: 'remain', label: 'Remain'},
                    {key: 'status', label: 'S'}
                ];

                $scope.supportListHeaders = [
                    {key: 'time', label: 'Time'},
                    {key: 'courier', label: '#'},
                    {key: 'staff', label: 'Staff'},
                    {key: 'jobNum', label: 'Job #'},
                    {key: 'event', label: 'Event'},
                    {key: 'notes', label: 'Notes'},
                    {key: 'remain', label: 'Remain'},
                    {key: 'lockedBy', label: 'Locked by'}
                ];

                $scope.currentListHeaders = [
                    {key: 'time', label: 'T'},
                    {key: 'speed', label: 'Speed'},
                    {key: 'notify', label: 'N'},
                    {key: 'vehicle', label: 'V'},
                    {key: 'jobNo', label: 'Job'},
                    {key: 'client', label: 'Client'},
                    {key: 'from', label: 'From'},
                    {key: 'to', label: 'To'},
                    {key: '', label: ''},
                    {key: 'remain', label: 'Remain'},
                    {key: 'status', label: 'S'},
                    {key: 'lp', label: 'LP'},
                    {key: 'ld', label: 'LD'},
                    {key: 'runOrder', label: 'RO'},
                ];

                $scope.potentialCouriersHeaders = [
                    {key: 'courier', label: 'Courier'},
                    {key: 'rule', label: 'Rule#'},
                    {key: 'reason', label: 'Reason'}
                ];
            }

            // Layouts
            function initLayoutSystem($scope, ContactID) {
                // Initialize base layout
                $scope.layouts = [];
                $scope.defaultLayout = {
                    name: "Default",
                    layout: {
                        columns: [{
                            id: "col1",
                            width: "65%",
                            boxes: [
                                {name: "jobsList", height: "50%"},
                                {name: "jobDetail", height: "50%"}
                            ]
                        }, {
                            id: "col2",
                            width: "17.5%",
                            boxes: [
                                {name: "currentWork", height: "40%"},
                                {name: "potentialCouriers", height: "30%"},
                                {name: "supports", height: "30%"}
                            ]
                        }, {
                            id: "col3",
                            width: "17.5%",
                            boxes: [
                                {name: "driverLocations", height: "50%"},
                                {name: "map", height: "50%"}
                            ]
                        }]
                    }
                };

                // Load saved layouts or use default
                if (Modernizr.localstorage) {
                    try {
                        const storedLayouts = JSON.parse(localStorage.getItem(`layouts-${ContactID}`));
                        const lastActiveLayout = localStorage.getItem(`lastActiveLayout-${ContactID}`);

                        $scope.layouts = storedLayouts || [$scope.defaultLayout];
                        $scope.layouts[0] = $scope.defaultLayout; // Ensure default is always up-to-date

                        // Load last active layout or default
                        const layoutToLoad = lastActiveLayout ?
                            $scope.layouts.findIndex(l => l.name === lastActiveLayout) : 0;
                        loadLayout(layoutToLoad >= 0 ? layoutToLoad : 0);
                    } catch (error) {
                        $scope.layouts = [$scope.defaultLayout];
                        loadLayout(0);
                    }
                } else {
                    $scope.layouts = [$scope.defaultLayout];
                    loadLayout(0);
                }

                // Core layout functions
                function loadLayout(index) {
                    const layout = $scope.layouts[index] || $scope.layouts[0];
                    $scope.currentLayoutName = layout.name;
                    $scope.layout = angular.copy(layout.layout);

                    // Apply dimensions
                    $scope.layout.columns.forEach(column => {
                        const columnEl = angular.element(`#co-${column.id}`);
                        if (columnEl.length) {
                            columnEl.css('flex-basis', column.width);
                            column.boxes.forEach(box => {
                                const boxEl = angular.element(`#box-${box.name}`);
                                if (boxEl.length) {
                                    boxEl.css('flex-basis', box.height);
                                }
                            });
                        }
                    });

                    if (Modernizr.localstorage) {
                        localStorage.setItem(`lastActiveLayout-${ContactID}`, layout.name);
                    }
                }

                // Public interface
                $scope.loadLayout = loadLayout;

                $scope.saveLayout = () => {
                    $mdDialog.show($mdDialog.prompt()
                        .title('Save Layout')
                        .textContent('Please enter a name for this layout.')
                        .required(true)
                        .ok('Save')
                        .cancel('Cancel'))
                        .then(name => {
                            if (!name) return;

                            const currentLayout = {
                                name: name,
                                layout: {
                                    columns: $scope.layout.columns.map(col => ({
                                        ...col,
                                        width: angular.element(`#co-${col.id}`).css('flex-basis'),
                                        boxes: col.boxes.map(box => ({
                                            ...box,
                                            height: angular.element(`#box-${box.name}`).css('flex-basis')
                                        }))
                                    }))
                                }
                            };

                            $scope.layouts.push(currentLayout);

                            if (Modernizr.localstorage) {
                                localStorage.setItem(`layouts-${ContactID}`, JSON.stringify($scope.layouts));
                                localStorage.setItem(`lastActiveLayout-${ContactID}`, name);
                            }
                        });
                };

                $scope.deleteLayout = (index) => {
                    if (index === 0) return; // Prevent deleting default layout

                    $mdDialog.show($mdDialog.confirm()
                        .title('Delete Layout?')
                        .textContent('Are you sure you want to delete this layout?')
                        .ok('Delete')
                        .cancel('Cancel'))
                        .then(() => {
                            $scope.layouts.splice(index, 1);
                            if (Modernizr.localstorage) {
                                localStorage.setItem(`layouts-${ContactID}`, JSON.stringify($scope.layouts));
                            }
                            loadLayout(0);
                            toastrService.showSuccessToast("Layout deleted successfully");
                        });
                };

                // Auto-save changes
                $scope.$watch('layout', (newValue, oldValue) => {
                    if (newValue !== oldValue && $scope.currentLayoutName) {
                        const index = $scope.layouts.findIndex(l => l.name === $scope.currentLayoutName);
                        if (index !== -1) {
                            $scope.layouts[index].layout = angular.copy(newValue);
                            if (Modernizr.localstorage) {
                                localStorage.setItem(`layouts-${ContactID}`, JSON.stringify($scope.layouts));
                            }
                        }
                    }
                }, true);
            }

            /**
             * Object containing helper functions for the application.
             * @type {Object}
             */
            const helperFunctions = {
                /**
                 * Finds a courier by ID in the pickCouriers or pickAllCouriers arrays.
                 * @param {number} courierID - The ID of the courier to find.
                 * @returns {Object|undefined} The courier object if found, otherwise undefined.
                 */
                findCourier: (courierID) => {
                    if (!courierID) return null;
                    return $scope.pickCouriers.find(c => c?.courierID === courierID) ||
                        $scope.pickAllCouriers.find(c => c?.courierID === courierID);
                },

                /**
                 * Shows a loading indicator for a specified DOM element.
                 * @param {string} selector - The CSS selector for the loading element.
                 */
                showLoading: (selector) => {
                    angular.element(selector).css('display', 'block');
                },

                /**
                 * Hides a loading indicator for a specified DOM element.
                 * @param {string} selector - The CSS selector for the loading element.
                 */
                hideLoading: (selector) => {
                    angular.element(selector).css('display', 'none');
                }
            };

            /**
             * Toggles the sidenav.
             */
            $scope.toggleSidenav = () => materialSidenavService.toggle();

            /**
             * Greets the user using the greeting service.
             */
            $scope.greetUser = () => greetingService.greetUser(FirstName);

            /**
             * Loads page views and initializes the application state.
             * @returns {Promise<void>}
             */
            async function loadPageViews() {
                try {
                    $scope.areas = await DispatchData.getSelectedViews(ContactID, AppPages.Dispatch);

                    // Run functions sequentially to prevent race conditions
                    await initializeAreas();
                    await $scope.updateFilters("nda");
                    await fetchDriverLocations();
                } catch (error) {
                    console.error('Error fetching dispatch views:', error);
                    $scope.areas = [];
                    await initializeAreas();
                }
            }

            /**
             * Initializes areas and shows a dialog if no views are available.
             * @returns {Promise<void>}
             */
            async function initializeAreas() {
                if ($scope.areas && $scope.areas.length > 0) {
                    $scope.selectedAreas.push($scope.areas[0]);
                    $scope.$apply();
                }
            }

            /**
             * Updates filters based on the selected filter option.
             * @param {string} selectedFilter - The selected filter option.
             * @returns {Promise<void>}
             */
            $scope.updateFilters = async (selectedFilter) => {
                try {
                    // Set all filters to inactive
                    $scope.filters.forEach(filter => {
                        filter.active = false;
                    });

                    // Set the selected filter to active
                    const selectedFilterObj = $scope.filters.find(filter => filter.value === selectedFilter);
                    if (selectedFilterObj) {
                        selectedFilterObj.active = true;
                    }

                    await setFilters({'status': selectedFilter});

                    // Ensure Angular updates the UI
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                } catch (error) {
                    console.error('Error updating filters:', error);
                }
            };

            /**
             * Sets the active area in the driverLocations.
             * @param {Object} selectedArea - The area to set as active.
             */
            $scope.setActiveArea = selectedArea => {
                $scope.driverLocations.areas.forEach(area => {
                    area.isActive = (area === selectedArea);
                });
            };

            JobDetailService.setSelectJobDetail(async () => {
                const currentJob = $scope.currentJob;
                await JobDetailService.setJob($scope.currentJob);

                await $scope.getData();
                if (currentJob === null || currentJob === undefined || currentJob === false) {
                    return;
                }

                const refreshedJob = $scope.jobList.find(jo => jo.id === currentJob.id);
                await $scope.selectJob(refreshedJob);
                $timeout(() => {
                    angular.element("#jobList tr[data-jobid='" + currentJob.id + "']").addClass('active');

                    const element = angular.element("#jobList tr[data-jobid='" + currentJob.id + "']");
                    const parentDiv = element.parent().hasClass('box-content') ? element.parent() : element.parent().closest('.box-content');
                    let goTop = element[0].getBoundingClientRect().top;

                    try {
                        goTop = goTop - parentDiv.offset().top + parentDiv.scrollTop() - 28;
                        parentDiv.scrollTop(goTop);
                    } catch (e) {
                        //ignore
                    }
                }, 1000);
            });

            $scope.allCouriers = {display: false, includeUA: false};
            $scope.mapZoom = {display: true};
            $scope.supportSettings = {autoRefresh: true};

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

            $rootScope.$on('jobUpdated', (event, updatedJob) => {
                // Find the job in the list and update it
                const index = $scope.jobList.findIndex(job => job.id === updatedJob.id);
                if (index !== -1) {
                    $scope.jobList[index] = updatedJob;
                }

                // If it's the currently selected job, update that as well
                if ($scope.currentJob && $scope.currentJob.id === updatedJob.id) {
                    $scope.currentJob = updatedJob;
                }

                // Ensure the view is updated
                $scope.$apply();
            });


            $scope.truckMode = "On";
            $scope.supportChannel = JSON.parse(localStorage.getItem("support-channel-" + ContactID)) || "All";

            $scope.groupJobsSelection = "";
            $scope.currentWorkSelection = "";
            $scope.potentialCouriersSelection = "";

            $scope.storeMapZoomDisplay = () => {
                if (Modernizr.localstorage) {
                    localStorage.setItem("mapZoom-" + ContactID, JSON.stringify({display: $scope.autoZoomEnabled}));
                }
            };

            $scope.supportChannelChanged = () => {
                console.log($scope.pickService.channel);
            };

            $scope.onCourierSearchClick = ($event) => {
                if ($event.target.tagName === 'INPUT') {
                    document.getElementsByName('courierSearch')[0].value = '';
                    $scope.courierSearchTextv = '';
                }
            };

            /**
             * @param {Job} job
             */
            $scope.attention = job => {
                let temp = "";
                if (job.direct) temp += "DIRECT ";
                if (job.van) temp = "VAN ";
                if (job.truck || job.speedID === 45) temp += "TRUCK ";
                if (job.return) temp += "RTN ";
                if (job.size.id === 2 && !job.van && !job.truck && job.speedID !== 45) temp = "CAR " + temp;
                if (job.size.id === 5) temp = "Scoot " + temp;
                if (job.childNotes !== null && job.childNotes.length > 0) temp += job.childNotes;
                if (job.pickupFrom === 1) temp += "R "; else if (job.pickupFrom === 2) temp += "D ";
                if (job.saturdayDelivery) temp += "Sat Del";
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
                activate(e, ui) {
                    const box = angular.element("#" + ui.item.context.id);
                    const parent = box.parent();
                    const boxes = parent.children().filter((_, child) => angular.element(child).hasClass('box'));

                    angular.forEach(boxes, boxElement => {
                        let box = angular.element(boxElement);
                        box.attr("data-height", box.prop('offsetHeight') + "px");
                    });
                },
                update(e, ui) {
                    $timeout(() => {
                        const box = angular.element("#" + ui.item.context.id);
                        const parent = box.parent();
                        const boxes = parent.children().filter((_, child) => angular.element(child).hasClass('box'));

                        angular.forEach(boxes, boxElement => {
                            let box = angular.element(boxElement);
                            box.css({"flex-basis": box.attr("data-height")});
                        });

                        angular.element(boxes[boxes.length - 1]).css({"flex-basis": "0"});
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

            ///////////////////////////
            // HOTKEYS
            //////////////////////////
            hotkeys.add({
                combo: "ctrl+d",
                description: "Dispatch selected jobs",
                allowIn: ["INPUT", "SELECT", "TEXTAREA"],
                callback: () => {
                    if (angular.element(".activeTable .active").length > 0) {
                        dispatchJobsForm();
                    }
                }
            });

            /**
             * @param {Job} currentJob
             */
            $scope.unlockJob = currentJob => {
                return JobDetailService.unlockJob(currentJob);
            };

            /**
             * @param {Job} currentJob
             */
            $scope.lockJob = currentJob => {
                return JobDetailService.lockJob(currentJob);
            };

            /**
             * @param {DriverDestination} selectedClearlist
             */
            $scope.selectClearList = async (selectedClearlist) => {
                try {
                    const clearListId = selectedClearlist.id;

                    let areaGroupButtons = angular.element("#area-group .btn");
                    areaGroupButtons.removeClass("topBarActive");

                    let driverLocationsActive = angular.element("#driverLocations .listActive");
                    if (driverLocationsActive.length <= 1) {
                        const envelope = await $scope.getClearListEnvelope(clearListId);
                        console.log('Envelope:  ' + envelope);

                        const selectedClients = $scope.pickService.clients.map(a => a.id);
                        $scope.jobList = await DispatchData.getClearListJobs(
                            $scope.queryParams,
                            selectedClients,
                            $scope.isInternal,
                            $scope.selectedAreas,
                            envelope
                        );
                    }
                } catch (error) {
                    console.log('Error in selectClearList:', error);
                }
            };

            /**
             * Handles keyboard input for dispatch field
             * @param {Suggestion} selectedCourier - Selected courier to dispatch job to
             * @param {Object} job - Job object
             */
            $scope.handleDispatchSelection = async (selectedCourier, job) => {
                if ($scope.dispatchState.processing) {
                    console.log('Dispatch already in progress');
                    return;
                }

                if (selectedCourier === undefined) {
                    console.log('Unchecked Courier Selection Clicked!');
                    return;
                }

                try {
                    $scope.dispatchState.selectedJobs.add(job.id);
                    await dispatchJobs(selectedCourier.id);

                    $scope.dispatchState.selectedJobs.clear();
                } catch (error) {
                    console.error('Error in dispatch:', error);
                    $scope.dispatchState.selectedJobs.delete(job.id);
                }
            };

            /**
             * Handle clicks on dispatch field
             * @param {Event} event - Click event
             * @param {Object} job - Job object
             */
            $scope.handleDispatchFieldClick = (event, job) => {

                // Select the job
                $scope.selectForDispatch(job);
            };

            /**
             * @param {Job} job
             */
            $scope.selectForDispatch = (job) => {
                const jobId = job.id;

                if ($scope.dispatchState.selectedJobs.has(jobId)) {
                    $scope.dispatchState.selectedJobs.delete(jobId);
                    angular.element(`tr[data-jobid="${jobId}"]`).removeClass('active');
                } else {
                    $scope.dispatchState.selectedJobs.add(jobId);
                    angular.element(`tr[data-jobid="${jobId}"]`).addClass('active');
                }
            };

            /**
             * @param {Object} $event
             */
            $scope.swapPOD = async ($event) => {
                try {
                    const jobNumber = await promptForJobNumber($event);
                    const secondJobId = await validateSwapPOD(jobNumber);
                    if (!secondJobId) {
                        await showInvalidJobAlert();
                        return;
                    }

                    const firstJobId = $scope.currentJob.id;
                    await confirmSwapPOD($event, $scope.currentJob.jobNo, jobNumber);
                    await performSwapPOD($scope.currentJob.jobNo, jobNumber);
                    await showSuccessAlert();
                    await updateJobsAfterSwap(secondJobId, firstJobId);
                } catch (error) {
                    console.error("POD Swap Canceled or Error occurred", error);
                }
            };

            /**
             * @param {Object} $event
             */
            async function promptForJobNumber($event) {
                return $mdDialog.show($mdDialog.prompt()
                    .title('Enter the other job number')
                    .textContent('Please enter the Job Number to swap the POD.')
                    .placeholder('Job Number')
                    .ariaLabel('Job Number')
                    .targetEvent($event)
                    .required(true)
                    .ok('Submit')
                    .cancel('Cancel'));
            }

            /**
             * @param {String} jobNumber
             */
            async function validateSwapPOD(jobNumber) {
                return uCSData.validateSwapPOD(jobNumber);
            }

            async function showInvalidJobAlert() {
                await $mdDialog.show($mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Invalid Job')
                    .textContent('This job is invalid.')
                    .ok('OK'));
            }

            /**
             * @param {Object} event
             * @param {String} currentJobNo
             * @param {String} jobNumber
             */
            async function confirmSwapPOD(event, currentJobNo, jobNumber) {
                await $mdDialog.show($mdDialog.confirm()
                    .title('Swap Delivery Info?')
                    .textContent(`Are you sure you wish to swap delivery info between ${currentJobNo} and ${jobNumber}?`)
                    .targetEvent(event)
                    .ok('Yes')
                    .cancel('No'));
            }

            /**
             * @param {String} currentJobNo
             * @param {String} jobNumber
             */
            async function performSwapPOD(currentJobNo, jobNumber) {
                await uCSData.swapPOD(currentJobNo, jobNumber);
                toastrService.showSuccessToast("POD swapped successfully");
            }

            async function showSuccessAlert() {
                await $mdDialog.show($mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Successful')
                    .textContent('POD Swap Completed Successfully')
                    .ok('OK'));
            }

            /**
             * @param {number} secondJobId
             * @param {number} firstJobId
             */
            async function updateJobsAfterSwap(secondJobId, firstJobId) {
                await uCSData.reSendJobs(secondJobId);
                await uCSData.reAssignJobs(firstJobId);
                await uCSData.reSendJobs(firstJobId);
                await $scope.refreshData(true);
            }

            /**
             * @param {string} jobNumber
             * @param {number} jobId
             */
            $scope.voidJobForm = (jobNumber, jobId) => $mdDialog.show($mdDialog.prompt()
                .title("Void Job")
                .textContent("Add Note")
                .placeholder('Note')
                .ariaLabel('Void job')
                .required(true)
                .ok('Void')
                .cancel('Cancel'))
                .then(note => DispatchData.addNote(jobId, note, FirstName, false))
                .then(() => DispatchData.voidJob(jobId))
                .then(() => {
                    toastrService.showSuccessToast("Job voided successfully");
                    return $scope.getData();
                })
                .catch(error => {
                    console.error("Job void canceled or error occurred", error);
                });

            /**
             * @param {Object} $event
             * @param {Job} job
             */
            $scope.messageClick = ($event, job) => {
                const selectedCourierId = $scope.selectedCourier ? $scope.selectedCourier.id : job.courierData.courierID;

                $mdDialog.show({
                    controller: 'SendMessageDialogController',
                    controllerAs: 'ctrl',
                    parent: angular.element($document.body),

                    templateUrl: versionUrl('app/components/dialogs/send-message-dialog/send-message-dialog.html'),
                    clickOutsideToClose: true,
                    fullscreen: true,
                    locals: {
                        selectedCourierId, contactId: ContactID, dispatcherName: FirstName,
                    },
                    bindToController: true
                }).then(() => {
                    console.log('Dialog closed!');
                });
            };

            /**
             * @param {Object} $event
             * @param {Job} job
             */
            $scope.otherEventForm = ($event, job) => {
                $mdDialog.show({
                    controller: 'AddEventDialogController',
                    controllerAs: "ctrl",
                    templateUrl: versionUrl("app/components/dialogs/add-event-dialog/add-event-dialog.html"),
                    parent: angular.element($document.body),

                    clickOutsideToClose: true,
                    fullscreen: true,
                    locals: {
                        job: job, dispatcherName: FirstName, contactId: ContactID
                    },
                    bindToController: true
                }).then(() => {
                    console.log('Pallet Dialog closed!');
                });
            };

            $scope.getSupportColorClass = support => {
                switch (support.eventType) {
                    case 73:
                        return "Yel";
                    case 1:
                    case 2:
                        return "Gre";
                    default:
                        return "";
                }
            };

            /**
             * @param {number} lat
             * @param {number} lng
             * @param {Object} flags
             * @param {string} carMarker
             * @param {number} jobNumber
             */
            $scope.dispatchDroppedMarkerToClosestCourier = async (lat, lng, flags, carMarker, jobNumber) => {
                try {
                    if (flags.length === 0 && carMarker === null) {
                        await showNoAvailableCourierDialog();
                        return handleNoAvailableCourier();
                    }

                    const closestCourier = findClosestCourier(lat, lng, flags, carMarker);
                    const foundCourier = $scope.pickCouriers.find(c => c.courierID === closestCourier.courierId);

                    await confirmDispatch(jobNumber, closestCourier, foundCourier);
                    await handleDangerousGoodsCheck(foundCourier);
                    await dispatchJob(foundCourier, jobNumber);

                } catch (error) {
                    console.error('Dispatch cancelled or error occurred', error);
                    handleDispatchError();
                }
            };

            async function showNoAvailableCourierDialog() {
                await $mdDialog.show($mdDialog.confirm()
                    .title('Dispatch Invalid')
                    .textContent('Could not find courier for Dispatch')
                    .ok('Close')
                    .cancel());
            }

            function handleNoAvailableCourier() {
                const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                displayPickupPoints(unDispatchedData, true, null);
                return $scope.getAvailableCourierLocation();
            }

            /**
             * @param {number} lat
             * @param {number} lng
             * @param {Object} flags
             * @param {*} carMarker
             */
            function findClosestCourier(lat, lng, flags, carMarker) {
                const toCompare = flags.map((f, key) => [key, f.position.lat(), f.position.lng()]);
                if (carMarker !== null) {
                    toCompare.push([9999, carMarker.position.lat(), carMarker.position.lng()]);
                }

                const closestIndex = closestLocation(lat, lng, toCompare);
                return closestIndex[0] === 9999 ? carMarker : flags[closestIndex[0]];
            }

            /**
             * @param {number} jobNumber
             * @param {*} closestCourier
             * @param {*} foundCourier
             */
            async function confirmDispatch(jobNumber, closestCourier, foundCourier) {
                let dispatchToCourierCode = closestCourier.code;
                if (foundCourier !== undefined) {
                    dispatchToCourierCode = foundCourier.code === undefined ? foundCourier.label : `${dispatchToCourierCode} ${foundCourier.code}`;
                }

                await $mdDialog.show($mdDialog.confirm()
                    .title(`Dispatch Job ${jobNumber}`)
                    .textContent(`Dispatch to ${dispatchToCourierCode}?`)
                    .ok('Yes')
                    .cancel('No'));
            }

            async function handleDangerousGoodsCheck(foundCourier) {
                const job = $scope.jobList.find(jo => jo.jobNo === jobNumber);
                if (job.dgClass !== null && job.dgClass > 0) {
                    if (!foundCourier.dangerousGoods) {
                        throw new Error(`DG job ${job.jobNo} can not be despatched to courier ${foundCourier.code} - doesn't have DGLicense.`);
                    }

                    if (job.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days')) {
                        throw new Error(`Courier ${foundCourier.code} doesn't have a DGLicense or license has expired.`);
                    }

                    await DispatchData.addFollowupEvent(job.jobNo, job.clientId, job.contactName, ContactID, foundCourier.courierID, job.id, job.jobType, FirstName);
                }
            }

            /**
             * @param {*} foundCourier
             * @param {number} jobNumber
             */
            async function dispatchJob(foundCourier, jobNumber) {
                const job = $scope.jobList.find(jo => jo.jobNo === jobNumber);
                const jobs = [job.id];
                await DispatchData.allocateJobs(foundCourier.courierID, ContactID, jobs);
                await $scope.getData();

                $scope.courier = {gpsCourier: foundCourier.id};
                await $scope.searchCourier();
            }

            function handleDispatchError() {
                const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                displayPickupPoints(unDispatchedData, true, null);
                return $scope.getAvailableCourierLocation();
            }

            $scope.selectAllContent = $event => {
                $event.target.select();
            };

            /**
             * @param {Date} minsAway
             * @param{Job} job
             * @param {*} obj
             * @param {boolean} isPickup
             */
            $scope.lateOperation = (minsAway, job, obj, isPickup) => {
                const operationType = isPickup ? 'pickup' : 'delivery';
                const currentValue = isPickup ? job.lp : job.ld;
                const lateType = isPickup ? 1 : 2;

                console.log(`Current ${operationType} = ${currentValue}`);
                console.log(`Param minsAway = ${minsAway}`);
                console.log(obj);

                return $scope.lateCall(minsAway, lateType, job, true)
                    .then(() => {
                        console.log(`Late ${operationType} call completed successfully`);
                    })
                    .catch(error => {
                        console.error(`Error in late ${operationType} call:`, error);
                    });
            };

            /**
             * @param {Date} minsAway
             * @param {Job} job
             * @param {*} obj
             */
            $scope.latePickup = (minsAway, job, obj) => $scope.lateOperation(minsAway, job, obj, true);
            /**
             * @param {Date} minsAway
             * @param {Job} job
             * @param {*} obj
             */
            $scope.lateDelivery = (minsAway, job, obj) => $scope.lateOperation(minsAway, job, obj, false);

            /**
             * @param {Date} lateTime
             * @param {number} lateType
             * @param {Job} job
             * @param {boolean} calc
             */
            $scope.lateCall = async (lateTime, lateType, job, calc) => {
                try {
                    const response = await DispatchData.lateCall(
                        lateType,
                        lateTime,
                        job.minutes,
                        job.pickupTime,
                        job.alertLatePickup,
                        job.deliveryTime,
                        job.alertLateDelivery,
                        job.jobNo,
                        job.clientId,
                        job.contactName,
                        ContactID,
                        job.time,
                        job.id,
                        job.jobType,
                        job.speed,
                        job.notify || job.speed,
                        FirstName,
                        calc
                    );

                    await $scope.getData();
                    toastrService.showSuccessToast("Late call applied successfully");
                    return response;
                } catch (error) {
                    console.error("Error applying late call:", error);
                }
            };

            // Order list handler
            $scope.orderList = async (list, prop) => {
                const serverOrder = list === "jobList";
                if ($scope.sort[list] !== prop) {
                    $scope.sort[list] = prop;
                    $scope.queryParams.asc = "asc";
                } else {
                    $scope.sort[list] = "d-" + prop;
                    $scope.queryParams.asc = "desc";
                }

                if (!serverOrder) {
                    $scope[list] = $filter("orderBy")($scope[list], $scope.sort[list].startsWith('d-') ? '-' + prop : prop);
                }

                if (serverOrder) {
                    await setFilters({"order": prop});
                }
            };

            /**
             * Determines the CSS classes to apply to a job row
             * @param {Job} job - The job object
             * @returns {string} Space-separated list of CSS classes
             */
            $scope.jobClass = (job) => {
                if (!job) return '';

                const classes = [];

                // Add direct class if job is direct
                if (job.direct) {
                    classes.push('direct');
                }

                // Add chilled class for specific speed types
                const chilledSpeedTypes = ['CT', 'CTHIRE', 'FT', 'FTHIRE', 'HC', 'TC'];
                if (chilledSpeedTypes.includes(job.speed)) {
                    classes.push('chilled');
                }

                // Add G class if job is dispatched (has a courier assigned)
                if (job.courier || job.assignedCourier) {
                    classes.push('G');
                }

                return classes.join(' ');
            };

            /**
             * @param {Object} $event
             * @param {Job} job
             */
            $scope.handleRowClick = async ($event, job) => {
                // Ignore clicks on autocomplete fields
                if (!$event.target.closest('md-autocomplete')) {
                    try {
                        await $timeout(async () => {
                            await $scope.selectJob(job);

                            const autocompleteContainer = angular.element(`#input_${job.id}`);
                            const inputElement = autocompleteContainer[0].querySelector('input');

                            if (inputElement) {
                                inputElement.focus();

                                const focusEvent = new Event('focus');
                                inputElement.dispatchEvent(focusEvent);

                                if (inputElement.value) {
                                    inputElement.select();
                                }
                            }
                        });
                    } catch (error) {
                        console.error('Error in handleRowClick:', error);
                    }
                }
            };


            /**
             * @param {number} courierId
             */
            async function dispatchJobs(courierId) {
                if ($scope.dispatchState.processing) {
                    console.warn('Dispatch already in progress');
                    return;
                }

                const jobsToDispatch = getJobsToDispatch();

                if (!jobsToDispatch.length) {
                    console.warn('No jobs selected for dispatch');
                    return;
                }

                try {
                    $scope.dispatchState.processing = true;

                    // Validate courier number
                    const courier = await validateCourier(courierId);
                    if (!courier) {
                        console.error('Invalid courierId');
                    }

                    // Perform dispatch operation
                    await dispatchJobService.dispatchJobsByCourierId(courierId, jobsToDispatch);

                    // Clear selection state
                    $scope.dispatchState.selectedJobs.clear();

                    // If we have a current courier, update their job list
                    if ($scope.currentCourier) {
                        await getCurrentJobs($scope.currentCourier.courierID);
                    }

                    // Inform the user
                    toastrService.showSuccessToast(jobsToDispatch.length + " job(s) dispatched to " + courier.name)

                    // Update courier locations
                    await $scope.getAvailableCourierLocation();
                    await getJobList();
                } catch (error) {
                    console.error('Error dispatching jobs:', error);
                    throw error;
                } finally {
                    $scope.dispatchState.processing = false;
                    $scope.$apply();
                }
            }

            /**
             * @param {number} courierId
             */
            async function validateCourier(courierId) {
                // First check active couriers
                let courier = $scope.pickCouriers.find(c => c.courierID === courierId);

                // If not found in active, check all couriers
                if (!courier) {
                    courier = $scope.pickAllCouriers.find(c => c.courierID === courierId);
                }

                return courier;
            }

            function getJobsToDispatch() {
                return $scope.jobList
                    .filter(job => $scope.dispatchState.selectedJobs.has(job.id));
            }

            $scope.restoreJobs = async () => {
                const callData = initializeRestoreData();
                let foundCourier = null;

                const activeElements = angular.element('#jobList .active');
                for (const element of activeElements) {
                    const currentElement = angular.element(element);
                    const jobId = currentElement.data("jobid");
                    const job = $scope.jobList.find(jo => jo.id === jobId);

                    if (job) {
                        await processJobForRestore(job, callData);
                        foundCourier = findCourierForJob(job, callData);
                    }
                }

                await executeRestoreJobs(callData, foundCourier);
                await updateAfterRestore(foundCourier);
            };

            function initializeRestoreData() {
                return {
                    call: "restoreJobs", jobs: [], splitJobs: [], jobNos: [], courierID: null
                };
            }

            /**
             * @param {Job} job
             * @param {{call: string, splitJobs: *[], jobs: *[], courierID: null, jobNos: *[]}} callData
             */
            async function processJobForRestore(job, callData) {
                const jobNo = job.jobNo;
                await DispatchData.addRestoreEvent(jobNo, job.clientId, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);

                if (callData.courierID === null) {
                    callData.courierID = job.courierData.courierID;
                }

                if (job.displaySplitJobDetail) {
                    callData.splitJobs.push(job.id);
                } else {
                    callData.jobs.push(job.id);
                }
            }

            /**
             * @param {Job} job
             * @param {{call: string, splitJobs: *[], jobs: *[], courierID: null, jobNos: *[]}} callData
             */
            function findCourierForJob(job, callData) {
                return $scope.pickCouriers.find(c => c.courierID === callData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === callData.courierID);
            }

            async function executeRestoreJobs(callData, foundCourier) {
                const promises = [];

                if (callData.splitJobs.length > 0) {
                    promises.push(DispatchData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs));
                }
                if (callData.jobs.length > 0) {
                    promises.push(DispatchData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs));
                }

                await Promise.all(promises);
            }

            async function updateAfterRestore(foundCourier) {
                await $scope.getData();
                $scope.courier = {gpsCourier: foundCourier.id};
                await $scope.searchCourier();
            }


            $scope.reAllocateJobs = async () => {
                const callData = {
                    "call": "redespatchJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
                };

                let foundCourier = null;

                const activeElements = angular.element('#jobList .active');
                for (const element of activeElements) {
                    const currentElement = angular.element(element);
                    const jobId = currentElement.attr("data-jobid");
                    const job = $scope.jobList.find(jo => jo.id === jobId);
                    if (job) {
                        foundCourier = $scope.pickCouriers.find(c => c.courierID === job.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === job.courierData.courierID);
                        callData.jobs.push(jobId);
                    }
                }

                if (callData.jobs.length > 0) {
                    await DispatchData.reAllocateJobs(foundCourier.courierID, ContactID, callData.jobs);
                    toastrService.showSuccessToast("Jobs reallocated successfully");
                }

                await $scope.getData();
                angular.element('#box-map .loading').css('display', '');

                $scope.courier = {gpsCourier: foundCourier.id};
                await $scope.searchCourier();
            };

            $scope.resendJobs = async () => {
                const activeJobElements = angular.element("#jobList .active");
                const jobIds = activeJobElements.map((index, element) => angular.element(element).attr("data-jobid")).get();

                if (jobIds.length === 0) {
                    return;
                }

                try {
                    await DispatchData.resendJobs(jobIds);
                    toastrService.showSuccessToast("Jobs resent successfully");
                    await $scope.getData();

                    const lastJobElement = activeJobElements.last();
                    const lastJobId = lastJobElement.attr("data-jobid");
                    const lastJob = $scope.jobList.find(job => job.id === lastJobId);

                    const foundCourier = $scope.pickCouriers.find(c => c.courierID === lastJob.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === lastJob.courierData.courierID);

                    if (foundCourier) {
                        $scope.courier = {gpsCourier: foundCourier.id};
                        await $scope.searchCourier();
                    }

                    angular.element('#box-map .loading').css('display', '');
                } catch (error) {
                    console.log('Error updating data:', error);
                }
            };

            $scope.restoreAll = async $event => {
                let confirm = $mdDialog.confirm()
                    .title('Restore All Jobs')
                    .textContent('Are you sure you wish to restore all jobs for ' + $scope.currentCourier.courier)
                    .targetEvent($event)
                    .ok('Yes')
                    .cancel('No');

                try {
                    await $mdDialog.show(confirm);

                    let callData = {
                        "call": "restoreJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
                    };

                    let foundCourier = null;

                    angular.element("#currentWork tr.droppable-row").each(function () {
                        const j = $scope.jobsCurrentList.find(function (jo) {
                            return jo.id === angular.element(this).data("jobid")
                        });
                        const jn = j.jobNo;
                        DispatchData.addRestoreEvent(jn, j.clientId, j.contactName, ContactID, j.courierData.courierID, j.id, j.jobType, FirstName);
                        if (callData.courierID === null) {
                            callData.courierID = j.courierData.courierID;
                            foundCourier = $scope.pickCouriers.find(c => {
                                return c.courierID === j.courierData.courierID
                            }) || $scope.pickAllCouriers.find(c => c.courierID === j.courierData.courierID);
                        }
                        if (j.displaySplitJobDetail) {
                            callData.splitJobs.push(angular.element(this).data("jobid"));
                        } else {
                            callData.jobs.push(angular.element(this).attr("data-jobid"));
                        }
                    });

                    if (callData.splitJobs.length > 0) {
                        await DispatchData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs)
                        console.log('Restore split jobs complete');
                    }
                    if (callData.jobs.length > 0) {
                        await DispatchData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
                        console.log('Restore Jobs complete');
                    }

                    $timeout(() => {
                        getCurrentJobs(foundCourier.courierID);
                        $scope.getData();
                    }, 1000);
                } catch (error) {
                    if (error === undefined) {
                        console.log('User canceled dialog');
                    } else {
                        console.error('Error occured restoring jobs');
                    }
                }
            };

            /**
             * @param {Object}  $event
             */
            $scope.redispatchAll = async $event => {
                const confirm = $mdDialog.confirm()
                    .title('Restore All Jobs')
                    .textContent('Are you sure you wish to redispatch all jobs for ' + $scope.currentCourier.courier)
                    .targetEvent($event)
                    .ok('Yes')
                    .cancel('No');

                try {
                    await $mdDialog.show(confirm);
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
                        foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === callData.courierID);
                    });

                    if (callData.jobs.length > 0) {
                        await DispatchData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
                    }

                    await $scope.getData();
                    angular.element('#box-map .loading').css('display', '');
                    $scope.courier = {gpsCourier: foundCourier.id};
                    await $scope.searchCourier();
                } catch {
                    // Cancelled dialog.
                }
            };
            /**
             * @param  {Object}  $event
             */
            $scope.resendAll = async $event => {
                let confirm = $mdDialog.confirm()
                    .title('Resend All Jobs')
                    .textContent('Are you sure you wish to resend all jobs for ' + $scope.currentCourier.courier)
                    .targetEvent($event)
                    .ok('Yes')
                    .cancel('No');

                try {
                    await $mdDialog.show(confirm);
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
                        foundCourier = $scope.pickCouriers.find(c => {
                            return c.courierID === callData.courierID
                        }) || $scope.pickAllCouriers.find(c => {
                            return c.courierID === callData.courierID
                        });
                    });

                    if (callData.jobs.length > 0) {
                        await DispatchData.resendAllJobs(callData.courierID);
                    }

                    await $scope.getData();
                    angular.element('#box-map .loading').css('display', '');
                    $scope.courier = {gpsCourier: foundCourier.id};
                    await $scope.searchCourier();
                } catch {
                    // No action for 'No'
                }
            };

            $scope.reAllocateJobsFromCurrentWindow = async () => {
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
                    foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === callData.courierID);
                });

                try {
                    if (callData.jobs.length > 0) {
                        await DispatchData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
                    }

                    await $scope.getData();
                    angular.element('#box-map .loading').css('display', '');
                    $scope.courier = {gpsCourier: foundCourier.id};
                    await $scope.searchCourier();
                } catch (error) {
                    console.log('Error in reAllocateJobsFromCurrentWindow:', error);
                }
            };

            $scope.resendJobsFromCurrentWindow = async () => {
                const callData = {
                    "call": "resendJobs",
                    "jobs": [],
                    "splitJobs": [],
                    "jobNos": [],
                    "courierID": $scope.currentCourier.courierID
                };

                let foundCourier;

                const activeElements = angular.element("#currentWork .active");
                activeElements.each(function () {
                    callData.jobs.push(angular.element(this).attr("data-jobid"));
                });

                foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === callData.courierID);

                try {
                    if (callData.jobs.length > 0) {
                        const result = await DispatchData.resendJobs(callData.jobs);
                        console.log('Jobs resent successfully:', result);
                    } else {
                        console.log('No jobs to resend');
                    }

                    await $scope.getData();
                    angular.element('#box-map .loading').css('display', '');
                    $scope.courier = {gpsCourier: foundCourier.id};
                    await $scope.searchCourier();
                } catch (error) {
                    console.log('Error in resendJobsFromCurrentWindow:', error);
                }
            };

            $scope.restoreJobsFromCurrentWindow = async () => {
                const callData = {
                    call: "restoreJobs", jobs: [], splitJobs: [], jobNos: [], courierID: null
                };

                const activeElements = angular.element("#currentWork .active");

                try {
                    for (let element of activeElements) {
                        const jobIdElement = angular.element(element);
                        const jobId = jobIdElement.data("jobid");
                        const job = $scope.jobsCurrentList.find(jo => jo.id === jobId);

                        if (job) {
                            await addRestoreEvent(job);
                            updateCallData(callData, job, jobIdElement);
                        }
                    }

                    const foundCourier = findCourier(callData.courierID);
                    if (foundCourier) {
                        await restoreJobs(callData, foundCourier);
                    }

                    await $scope.getData();
                    angular.element('#box-map .loading').css('display', '');
                    $scope.courier = {gpsCourier: foundCourier.id};
                    await $scope.searchCourier();
                } catch (error) {
                    console.log('Error in restoreJobsFromCurrentWindow:', error);
                }
            };

            async function addRestoreEvent(job) {
                try {
                    await DispatchData.addRestoreEvent(job.jobNo, job.clientId, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);
                    console.log('Restore event added successfully');
                } catch (error) {
                    console.log('Error adding restore event:', error);
                    throw error;  // Propagate the error
                }
            }

            const updateCallData = (callData, job, jobIdElement) => {
                if (!callData.courierID) {
                    callData.courierID = job.courierData.courierID;
                }

                if (job.displaySplitJobDetail) {
                    callData.splitJobs.push(jobIdElement.data("jobid"));
                } else {
                    callData.jobs.push(jobIdElement.attr("data-jobid"));
                }
            };

            const findCourier = (job) => {
                if (!job) return null;
                return $scope.pickCouriers.find(c => c.courierID === job.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === job.courierData.courierID);
            };

            async function restoreJobs(callData, courier) {
                const promises = [];

                if (callData.splitJobs.length > 0) {
                    promises.push(DispatchData.restoreSplitJobs(courier.courierID, ContactID, callData.splitJobs));
                }
                if (callData.jobs.length > 0) {
                    promises.push(DispatchData.restoreJobs(courier.courierID, ContactID, callData.jobs));
                }

                try {
                    await Promise.all(promises);
                    toastrService.showSuccessToast("Jobs restored successfully");
                } catch (error) {
                    console.log('Error restoring jobs:', error);
                    throw error;
                }
            }

            /**
             * @param {Job} job
             */
            $scope.setFirstJob = async (job) => {
                try {
                    await $mdDialog.show($mdDialog.confirm()
                        .title('Set First Job?')
                        .textContent('Are you sure you wish to set this as the First Job?')
                        .ok('Yes')
                        .cancel('No'));
                    await DispatchData.setFirstJob(job.id, $scope.currentCourier.courierID);
                    await getCurrentJobs($scope.currentCourier.courierID);
                    toastrService.showSuccessToast("Job set as first job successfully");
                } catch (error) {
                    console.log('Action cancelled or error occurred:', error);
                }
            };

//////////////////////////////
//  SPLIT JOB //
/////////////////////////////
            /**
             * @param {Object} $event
             * @param {Job} job
             */
            $scope.splitJob = async ($event, job) => {
                if (!job.allowSplit) {
                    await showAlert('Unable to split job', `Can not split ${job.JobNo}.`);
                    return;
                }

                try {
                    const result = await showConfirm($event, 'Split Job?', 'Are you sure you wish to split this job?');
                    if (result) {
                        await DispatchData.splitJob(job.id, FirstName);
                        await $scope.setSplitJobMeetingPoint($event, job);
                    }
                } catch (error) {
                    if (error instanceof Error) {
                        console.log(error.message);
                    }
                    console.log("Splitting job failed:", error);
                }
            };

            /**
             * @param {string} title
             * @param {string} content
             */
            function showAlert(title, content) {
                return $mdDialog.show($mdDialog.alert()
                    .parent(angular.element($document.body))
                    .clickOutsideToClose(true)
                    .title(title)
                    .textContent(content)
                    .ariaLabel('Alert')
                    .ok("OK"));
            }

            /**
             * @param {Object} $event
             * @param {string} title
             * @param {string} content
             */
            function showConfirm($event, title, content) {
                const confirm = $mdDialog.confirm()
                    .title(title)
                    .textContent(content)
                    .ariaLabel('Confirm')
                    .targetEvent($event)
                    .ok('Yes')
                    .cancel('No');

                return $mdDialog.show(confirm);
            }

            $scope.palletMenu = [{
                text: "Delete", click($itemScope) {
                    const index = $scope.currentJob.PalletInfo.indexOf($itemScope.pallet);
                    $scope.currentJob.PalletInfo.splice(index, 1);
                }
            }];


            $scope.activateDrop = async () => {
                await $timeout(0);
                await new Promise(resolve => {
                    $document.ready(resolve);
                });

                angular.element(".droppable-row").droppable({
                    classes: {"ui-droppable-hover": "active"}, drop: async function (event, ui) {
                        const $this = angular.element(this);
                        await handleDroppedJob($this);
                    }
                });
            };

            async function handleDroppedJob($element) {
                const parentOffset = $element.parents(".box").offset();
                const rowOffset = $element.offset();

                if (isWithinDropZone(parentOffset, rowOffset, $element)) {
                    await animateDroppedJob($element);
                    await dispatchDroppedJob($element);
                }
            }

            function isWithinDropZone(parentOffset, rowOffset, $element) {
                const parentTop = parentOffset.top;
                const parentBottom = parentTop + $element.parents(".box").outerHeight();
                const rowTop = rowOffset.top;
                const rowBottom = rowTop + $element.outerHeight();

                return rowTop < parentBottom && rowBottom > parentTop;
            }

            async function animateDroppedJob($element) {
                $element.css({"background-color": "#c6dfad"});
                await new Promise(resolve => {
                    $element.animate({backgroundColor: "inherit"}, 300, () => {
                        $element.removeAttr("style");
                        resolve();
                    });
                });
            }

            async function dispatchDroppedJob($element) {
                const courierId = $element.attr("data-courier").replace(/[^\d.-]/g, '');

                try {
                    await dispatchJobs(courierId);
                    console.log('Dispatch complete');
                    await fetchDriverLocations();
                } catch (error) {
                    console.error('Error in drop handler:', error);
                }
            }


            /**
             * @param {number} jobId
             */
            $scope.getPotentialCouriers = async (jobId) => {
                try {
                    helperFunctions.showLoading('#box-potentialCouriers');
                    $scope.potentialCouriers = await DispatchData.getPotentialCouriers(jobId);

                    $timeout(sizeHeadings, 1000);
                    $timeout(sizeHeadings, 2000);

                    helperFunctions.hideLoading('#box-potentialCouriers');

                    await $scope.activateDrop();
                } catch (error) {
                    console.error('Error getting potential couriers:', error);
                    helperFunctions.hideLoading('#box-potentialCouriers');
                }
            };

            /**
             * Search for active couriers
             * @param {string} searchText
             */
            $scope.courierSearch = async (searchText) => {
                const url = "/courier/AllActiveSearch";
                try {
                    return await DispatchData.autocompleteSearch(searchText, url);
                } catch (error) {
                    console.error(error.message);
                    throw error;
                }
            };


            /**
             * @param {string} searchText
             */
            $scope.jobRecordSearch = searchText => {
                return $scope.jobList
                    .filter(job => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
                    .map(job => ({id: job.id, text: job.jobNo}));
            };

            /**
             * @param {number} selectedJobId
             */
            $scope.JobRecordSelected = async (selectedJobId) => {
                try {
                    const selectedJob = $scope.jobList.find(job => job.id === selectedJobId);
                    await $scope.selectJob(selectedJob);
                    console.log('Job selection complete');
                } catch (error) {
                    console.error('Error in JobRecordSelected:', error);
                }
            };

            /**
             * @param {number} courierId
             * @param {string} courierName
             */
            $scope.updateCourierData = async (courierId, courierName) => {
                $scope.currentWorkSelection = ` for Courier ${courierName}`;
                $scope.currentCourier = {courierID: courierId, courier: courierName};
                $scope.currentSelection = ` for Courier ${courierName}`;

                await getCurrentJobs(courierId);
                try {
                    const result = await DispatchData.truckCourierStatus(courierId);
                    $scope.truckCourierStatus = result.data;
                } catch (error) {
                    console.error('Error fetching truck courier status:', error);
                }
            };

            $scope.displayLoadingIndicators = () => {
                //loadingService.showLoader();
            };

            $scope.hideLoadingIndicators = () => {
                //loadingService.closeLoader();
            };

            $scope.selectedCourierChange = async courier => {
                if (courier === undefined) {
                    $scope.currentCourier = null;
                } else {
                    await $scope.updateCourierData(courier.id, courier.text);
                }
            };

            $scope.searchCourier = async ($event) => {
                try {
                    $scope.displayLoadingIndicators();
                    const foundCourier = $scope.pickAllCouriers.find(c => c.id === $scope.courier.gpsCourier);
                    console.log(foundCourier);
                    if (foundCourier === undefined) {
                        $scope.hideLoadingIndicators();
                        await showAlert('Attention', 'Courier not found.');
                        return;
                    }
                    await $scope.updateCourierData(foundCourier.id, foundCourier.name);
                } catch (error) {
                    console.error('Error searching courier:', error);
                } finally {
                    $scope.hideLoadingIndicators();
                }
            };

// Select the courier
            $scope.selectCourier = async (courier) => {
                const loadingElement = angular.element("#box-jobDetail .loading");
                const mapLoadingElement = angular.element('#box-map .loading');

                try {
                    helperFunctions.showLoading(loadingElement);
                    helperFunctions.showLoading(mapLoadingElement);

                    deactivateAllCouriers();
                    activateSelectedCourier(courier);

                    await updateCourierInfo(courier);
                    await fetchTruckCourierStatus(courier);

                    $scope.$apply();
                } catch (error) {
                    console.error('Error selecting courier:', error);
                } finally {
                    hideLoadingAfterTimeout(loadingElement, mapLoadingElement);
                }
            };

            function deactivateAllCouriers() {
                angular.forEach($scope.driverLocations.areas, (area) => {
                    ['top', 'middle', 'bottom'].forEach((section) => {
                        angular.forEach(area[section], (c) => {
                            c.isActive = false;
                        });
                    });
                });
            }

            function activateSelectedCourier(courier) {
                courier.isActive = true;
                if (!courier.courier) {
                    courier.courier = `${courier.code} ${courier.firstName}`;
                }
            }

            async function fetchTruckCourierStatus(courier) {
                if (!courier) {
                    return;
                }

                const result = await DispatchData.truckCourierStatus(courier.courierID);
                if (!result || !result.data) {
                    return;
                }

                // Save truck courier status if exists
                $scope.truckCourierStatus = result.data;
            }

            function hideLoadingAfterTimeout(loadingElement, mapLoadingElement) {
                $timeout(() => {
                    helperFunctions.hideLoading(loadingElement);
                    helperFunctions.hideLoading(mapLoadingElement);
                }, 100);
            }

            $scope.refreshTruckCourierStatus = async () => {
                try {
                    const result = await DispatchData.truckCourierStatus($scope.currentCourier.courierID);
                    $scope.truckCourierStatus = result.data;
                } catch (error) {
                    console.error('Error refreshing truck courier status:', error);
                }
            };


            $scope.selectMapCourier = async courier => {
                helperFunctions.showLoading("#box-jobDetail");
                helperFunctions.showLoading('#box-map');
                helperFunctions.showLoading("#box-currentWork");

                try {
                    const foundCourier = helperFunctions.findCourier(courier.courierID);
                    $scope.currentCourier = {
                        courierID: foundCourier.courierID, courier: foundCourier.label
                    };

                    await fetchAndDisplayCurrentJobs(courier.courierID);
                    await updateUIAfterCourierSelection(courier, foundCourier);
                } catch (error) {
                    console.error('An error occurred:', error);
                } finally {
                    hideLoadingElements();
                }
            };

            /**
             * @param {number} courierID
             */
            async function fetchAndDisplayCurrentJobs(courierID) {
                const data = await DispatchData.getJobsCurrent(courierID, $scope.jobFilters.status === "done");
                helperFunctions.hideLoading("#box-currentWork");

                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    displayRoutePointsOnly(data, false);
                }
                await $scope.activateDrop();
            }

            async function updateUIAfterCourierSelection(courier, foundCourier) {
                $scope.currentWorkSelection = ` for Courier ${courier.label}`;
                $scope.currentSelection = ` for Courier ${courier.label}`;

                $scope.truckCourierStatus = await DispatchData.truckCourierStatus(courier.courierID);

                $timeout(sizeHeadings, 1000);
                $timeout(sizeHeadings, 2000);
            }

            function hideLoadingElements() {
                $timeout(() => {
                    $document.ready(() => {
                        helperFunctions.hideLoading("#box-jobDetail");
                        helperFunctions.hideLoading("#box-map");
                    });
                }, 100);
            }

            $scope.clearCourierSearch = () => {
                $scope.jobsCurrentList = false;
                $scope.courier.gpsCourier = '';
                $scope.currentWorkSelection = '';
            }

            $scope.selectPotentialCourier = async (courier) => {
                try {
                    helperFunctions.showLoading('#box-jobDetail');
                    helperFunctions.showLoading('#box-map');

                    await updateCourierInfo(courier);
                    await displayJobsForCourier(courier);
                    await updateUIForPotentialCourier(courier);
                } catch (error) {
                    console.error('Error in selectPotentialCourier:', error);
                } finally {
                    hideLoadingElements();
                }
            };

            async function updateCourierInfo(courier) {
                if (courier.courier === undefined) {
                    courier.courier = `${courier.code} ${courier.firstName}`;
                }

                if ($scope.jobList.length > 0) {
                    const jid = angular.element("#jobList .active").last().data("jobid");
                    const currentJob = $scope.jobList.find(jo => jo.id === jid);
                    const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                    displayPickupPoints(unDispatchedData, true, currentJob);
                }
            }

            async function displayJobsForCourier(courier) {
                helperFunctions.showLoading('#box-currentWork');
                const code = $scope.pickCouriers.find(x => x.courierID === courier.courierID).id;
                const data = await DispatchData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done");
                helperFunctions.hideLoading('#box-currentWork');

                if ($scope.currentJob !== null && $scope.currentJob.courier !== code) {
                    $scope.currentJob = null;
                }

                $scope.jobsCurrentList = data;
                if (data.length > 0) {
                    displayRoutePoints(data, false, $scope.mapZoom.display);
                } else {
                    const posData = await DispatchData.getCourierPosition(code);
                    displayCourierPositionOnly(posData.latitude, posData.longitude);
                }
                await $scope.activateDrop();
            }

            async function updateUIForPotentialCourier(courier) {
                $timeout(sizeHeadings, 1000);
                $timeout(sizeHeadings, 2000);

                await $scope.getAvailableCourierLocation();

                $scope.currentWorkSelection = ` for Courier ${courier.courier}`;
                $scope.currentCourier = courier;
                $scope.currentSelection = ` for Courier ${courier.courier}`;
            }


            /**
             * @param {number} courierId
             */
            async function getCurrentJobs(courierId) {
                if (!courierId) {
                    console.warn('No courier ID provided');
                    return;
                }

                try {
                    await $timeout(() => {
                        $scope.currentListLoading = true;
                    });

                    const result = await dispatchJobService.getCurrentJobsForCourier(
                        courierId,
                        $scope.jobFilters?.status === "done"
                    );

                    await $timeout(() => {
                        if (result.courier) {
                            $scope.jobsCurrentList = result.jobs;

                            if (result.jobs.length > 0) {
                                displayRoutePoints(result.jobs, true, $scope.mapZoom.display);
                            } else if (result.position) {
                                displayCourierPositionOnly(
                                    result.position.latitude,
                                    result.position.longitude
                                );
                            }
                        }
                    });

                    await $scope.activateDrop();

                    // Handle headings updates
                    $timeout(() => sizeHeadings(), 1000);
                    $timeout(() => sizeHeadings(), 2000);

                } catch (error) {
                    console.error('Error getting current jobs:', error);
                    toastrService.showErrorToast('Error loading courier jobs');
                } finally {
                    await $timeout(() => {
                        $scope.currentListLoading = false;
                    });
                }
            }

            /**
             * @param {*} data
             */
            async function setFilters(data) {
                await $timeout(async () => {
                    if (data.status) {
                        $scope.queryParams.status = data.status;
                    } else {
                        const selectedStatus = Object.entries($scope.filters)
                            .filter(([key, value]) => value && key !== 'all')
                            .map(([key]) => key);

                        if (selectedStatus.length > 0) {
                            $scope.queryParams.status = selectedStatus.join(',');
                        } else if ($scope.filters.all) {
                            $scope.queryParams.status = 'all';
                        } else {
                            delete $scope.queryParams.status;
                        }
                    }

                    if (data.area) {
                        let selected = angular.element("#area-group > .btn.topBarActive").length;
                        if (selected > 1) {
                            $scope.queryParams.area += "," + data.area;
                        } else {
                            $scope.queryParams.area = data.area;
                        }
                    }

                    if (data.clearList) {
                        let clSelected = angular.element("#driverLocations").find('.listActive').length;
                        if (clSelected > 1) {
                            $scope.queryParams.area += "," + data.clearList;
                        } else {
                            $scope.queryParams.area = data.clearList;
                        }
                    }

                    if (data.order) {
                        $scope.queryParams.order = data.order;
                    }

                    await $scope.getData();
                }, 300);
            }

            $scope.selectJobDetail = async (job) => {
                $scope.currentJob = job;
                $scope.currentSupport = null;
                $scope.potentialCouriers = false;
                $scope.potentialCouriersSelection = ` for Job ${job.jobNo}`;
                $scope.currentSelection = ` for Job ${job.jobNo}`;

                await checkForAttachments(job.id);

                if (job.rootParentID) {
                    try {
                        job.relatedJobs = await DispatchData.getRelatedJobs(job.rootParentID, job.clientId);
                    } catch (error) {
                        console.error('Error getting related jobs:', error);
                    }
                }
            };

            /**
             * @param {number} jobId
             * @param {string} jobNumber
             */
            $scope.loadRelatedJobDetail = async (jobId, jobNumber) => {
                try {
                    const currentJob = await DispatchData.getJobDetail(jobId);

                    await $scope.selectJob(currentJob);
                    $scope.currentSelection = ` for Job ${jobNumber}`;
                } catch (error) {
                    console.error('Error loading related job detail:', error);
                }
            };

            $scope.selectSupportJobDetail = async (support) => {
                console.log(`select Job ${support.jobId}`);

                $scope.currentSupport = support;
                helperFunctions.showLoading("#box-jobDetail");

                try {
                    const data = await DispatchData.getJobDetail(support.jobId);
                    await $scope.selectJob(data);
                    $scope.currentJob = data;

                    helperFunctions.hideLoading("#box-jobDetail");
                    $scope.currentSelection = ` for Job ${support.jobNumber}`;
                    let jobs = [$scope.currentJob];
                    displayRoutePointsOnly(jobs, true, $scope.mapZoom.display);

                    if ($scope.mapZoom.display) {
                        setMapBounds();
                        map.setZoom(12);
                    }

                    if ($scope.currentJob.rootParentID) {
                        $scope.currentJob.relatedJobs = await DispatchData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientId);
                    }
                } catch (error) {
                    console.error('Error selecting support job detail:', error);
                    helperFunctions.hideLoading("#box-jobDetail");
                }
            };

            /**
             * @param {Job} job
             */
            $scope.selectJob = async (job) => {
                if (!job) return;

                await $timeout(async () => {
                    $scope.selectedJobs = [];
                    $scope.currentSupport = null;

                    clearActiveJobs();

                    console.log("selectJob");
                    $scope.currentJob = job;
                    $scope.$apply();
                    console.log(job);

                    await JobDetailService.setJob($scope.currentJob);
                    await checkForAttachments(job.id);

                    try {
                        $scope.pickCouriers = await DispatchData.getActiveCouriers();
                    } catch (error) {
                        console.error('Error getting active couriers:', error);
                    }

                    if ($scope.currentJob.rootParentID) {
                        try {
                            $scope.currentJob.relatedJobs = await DispatchData.getRelatedJobs($scope.currentJob.rootParentID, $scope.currentJob.clientId);
                        } catch (error) {
                            console.error('Error getting related jobs:', error);
                        }
                    }

                    try {
                        if (!job.courier && !job.assignedCourier) {
                            // Job is undispatched
                            await handleUndispatchedJob(job);
                        } else {
                            // Job is dispatched
                            $scope.potentialCouriers = false;
                            if (job.courierData) {
                                await $scope.selectCourier(job.courierData);

                                // Display route points for the single job
                                const jobs = [job];
                                if (isValidCoordinates(job.pickupAddress.latitude, job.pickupAddress.longitude) &&
                                    isValidCoordinates(job.deliveryAddress.latitude, job.deliveryAddress.longitude)) {
                                    displayRoutePointsOnly(jobs, true, $scope.mapZoom.display);

                                    // Create bounds that include pickup and delivery points
                                    const bounds = new google.maps.LatLngBounds();
                                    bounds.extend(new google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude));
                                    bounds.extend(new google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude));

                                    // If courier position is available, include it
                                    if (isValidCoordinates(job.courierData.latitude, job.courierData.longitude)) {
                                        bounds.extend(new google.maps.LatLng(job.courierData.latitude, job.courierData.longitude));
                                    }

                                    map.fitBounds(bounds);

                                    // Adjust zoom if too close
                                    const listener = google.maps.event.addListener(map, "idle", () => {
                                        if (map.getZoom() > 16) map.setZoom(16);
                                        google.maps.event.removeListener(listener);
                                    });
                                } else {
                                    console.warn('Invalid coordinates for job:', job);
                                    // Fallback to courier position if available
                                    if (isValidCoordinates(job.courierData.latitude, job.courierData.longitude)) {
                                        displayCourierPositionOnly(job.courierData.latitude, job.courierData.longitude);
                                    }
                                }
                            } else {
                                console.warn('Missing courier data for job:', job);
                            }
                        }

                        // Always update available courier locations after handling the job
                        await $scope.getAvailableCourierLocation();
                    } catch (error) {
                        console.error('An error occurred finding couriers:', error);
                    }

                    focusDispatchField();
                }, 0);
            };

            /**
             * Validates if coordinates are valid numbers and within reasonable bounds
             * @param {number} lat
             * @param {number} lng
             * @returns {boolean}
             */
            function isValidCoordinates(lat, lng) {
                return lat !== null && lng !== null &&
                    !isNaN(lat) && !isNaN(lng) &&
                    lat !== 0 && lng !== 0 &&
                    Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
            }

            function clearActiveJobs() {
                angular.element(".activeTable .active").each((_, el) => {
                    const jobRowElement = angular.element(el).find(".selectjob");
                    jobRowElement.click();

                    if ($scope.jobForDispatch && $scope.jobForDispatch.ID) {
                        $scope.selectedJobs.push($scope.jobForDispatch.ID);
                    }
                });
            }

            /**
             * @param {Job} job
             */
            async function handleUndispatchedJob(job) {
                $scope.jobGroups = false;
                await $scope.getPotentialCouriers(job.id);
                $scope.potentialCouriersSelection = ` for Job ${job.jobNo}`;
                $scope.currentCourier = null;
                $scope.currentSelection = ` for Job ${job.jobNo}`;

                const unDispatchedData = $scope.jobList.filter(x => !x?.courierData?.courierID);

                // Verify we have valid coordinates before displaying
                if (isValidCoordinates(job.pickupAddress.latitude, job.pickupAddress.longitude)) {
                    displayPickupPoints(unDispatchedData, true, job);

                    // Set bounds for pickup point
                    const bounds = new google.maps.LatLngBounds();
                    bounds.extend(new google.maps.LatLng(job.pickupAddress.latitude, job.pickupAddress.longitude));

                    // If delivery coordinates are valid, include them too
                    if (isValidCoordinates(job.deliveryLatitude, job.deliveryAddress.longitude)) {
                        bounds.extend(new google.maps.LatLng(job.deliveryAddress.latitude, job.deliveryAddress.longitude));
                    }

                    map.fitBounds(bounds);

                    // Adjust zoom if too close
                    const listener = google.maps.event.addListener(map, "idle", () => {
                        if (map.getZoom() > 16) map.setZoom(16);
                        google.maps.event.removeListener(listener);
                    });
                } else {
                    console.warn('Invalid pickup coordinates for job:', job);
                }
            }

            function focusDispatchField() {
                $timeout(() => {
                    const activeRow = angular.element(".activeTable .active");
                    if (activeRow.length) {
                        const dispatchField = activeRow.find(".dispatchField");
                        if (dispatchField.length) {
                            dispatchField[0].focus();
                        }
                    }
                }, 100);
            }

            $scope.setCurrentWorkMenu = () => [{
                text: "Restore", click: () => $scope.restoreJobsFromCurrentWindow()
                    .catch(error => {
                        console.log('Error in restoring jobs:', error);
                    })
            }, {
                text: "Redispatch", click: () => $scope.reAllocateJobsFromCurrentWindow()
                    .catch(error => {
                        console.log('Error in redispatching jobs:', error);
                    })
            }, {
                text: "Resend", click: () => $scope.resendJobsFromCurrentWindow()
                    .catch(error => {
                        console.log('Error in resending jobs:', error);
                    })
            }];

            $scope.fromColumnClick = (evt, job) => {
                switch (evt.which) {
                    case 1:
// this is left click
                        break;
                    case 2:
// in case you need some middle click things
                        break;
                    case 3:
// this is right click
                        $timeout(async () => {
                            await JobDetailService.editAddress(evt, job, 'fromAddress');
                        }, 100);
                        break;
                    default:
                        console.log("you have a strange mouse!");
                        break;

                }
                return false;
            };

            $scope.toColumnClick = ($event, job) => {
                switch ($event.which) {
                    case 1:
// this is left click
                        break;
                    case 2:
// in case you need some middle click things
                        break;
                    case 3:
// this is right click
                        $timeout(async () => {
                            await JobDetailService.editAddress($event, job, 'toAddress');
                        }, 100);
                        break;
                    default:
                        console.log("you have a strange mouse!");
                        break;

                }
                return false;
            };

            $scope.latePickColumnClick = $event => {
                switch ($event.which) {
                    case 1:
// this is left click
                        break;
                    case 2:
                        3
// in case you need some middle click things
                        break;
                    case 3:
// this is right click
                        $timeout(() => {
                            const dueTime = moment($scope.currentJob.booked).add($scope.currentJob.lp || $scope.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');
                            let items = [];
                            for (let i = 1; i < 37; i++) {
                                if (parseInt(dueTime) < (i * 5)) items.push({
                                    "id": (i * 5), "text": ((i * 5).toString() + " mins away")
                                });
                            }

                            $scope.lateForm = {
                                "data": {
                                    "jobNum": $scope.currentJob.jobNo,
                                    "client": $scope.currentJob.client,
                                    "dueMins": dueTime,
                                    "choose": ""
                                }, submit() {
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
                                }, cancel() {
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
                                    minimumInputLength: 0, data: items, placeholder: "Start typing to enter new time..."
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

            $scope.speedColumnClick = ($event, job) => {
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
                            JobDetailService.speedClick($event, job);
                            $scope.$apply();
                        }, 400);

                        break;
                    default:
                        console.log("you have a strange mouse!");
                        break;

                }
                return false;
            };

            $scope.clientColumnClick = ($event, job) => {
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
                            JobDetailService.clientClick($event, job);
                            $scope.$apply();
                        }, 400);

                        break;
                    default:
                        console.log("you have a strange mouse!");
                        break;

                }
                return false;
            };

            /**
             * @param {Object} $event
             * @param {Job} job
             */
            $scope.notifyColumnClick = ($event, job) => {
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
                            JobDetailService.notifyClick($event, job);
                            $scope.$apply();
                        }, 400);

                        break;
                    default:
                        console.log("you have a strange mouse!");
                        break;

                }
                return false;
            };

            /**
             * @param {Object} $event
             */
            $scope.setEventsMenu = ($event) => [{
                text: "Void Job", click: () => $scope.voidJobForm($scope.currentJob.jobNo, $scope.currentJob.id)
                    .then(() => {
                        console.log('Void Job completed successfully');
                    })
                    .catch(error => {
                        console.log('Error in Void Job:', error);
                    })
            }, {
                text: "Add Event - Other", click: () => {
                    $scope.otherEventForm($event, $scope.currentJob);
                }
            }, {
                text: "Split Job", click: () => $scope.splitJob($event, $scope.currentJob)
                    .then(() => {
                        console.log('Split Job completed successfully');
                    })
                    .catch(error => {
                        console.log('Error in Split Job:', error);
                    }), enabled: $itemScope => $itemScope.job.allowSplit
            }, {
                text: "Set First Job", click: () => $scope.setFirstJob($scope.currentJob)
                    .then(() => {
                        console.log('Set First Job completed successfully');
                    })
                    .catch(error => {
                        console.log('Error in Set First Job:', error);
                    })
            }];

            $scope.setJobsMenu = () => {
                const activeElements = angular.element(".activeTable .active");
                const multiple = activeElements.length > 1;
                let lastCourier = null;
                let sameCourier = true;

                activeElements.each(function () {
                    const jobId = angular.element(this).data("jobid");
                    const job = $scope.jobList.find(jo => jo.id === jobId);
                    if (lastCourier !== null && lastCourier !== job.courier) {
                        sameCourier = false;
                        return false; // break the loop
                    }
                    lastCourier = job.courier;
                });

                console.log(`same courier = ${sameCourier}, last courier = ${lastCourier}`);

                if (!sameCourier) {
                    return [];
                }

                /**
                 * @param {string} text
                 * @param {function(): Promise<void>} action
                 */
                function createMenuItem(text, action) {
                    return {
                        text: text, click: ($itemScope, $event) => $q.when(action($itemScope, $event))
                            .then(() => {
                                console.log(text + ' completed successfully');
                            })
                            .catch(error => {
                                console.log('Error in ' + text + ':', error);
                            })
                    };
                }

                let menu = [];

                if (lastCourier === null) {
                    menu.push(createMenuItem("Dispatch Selected", () => dispatchJobs(null)));
                } else {
                    menu = [createMenuItem("Restore", $scope.restoreJobs), createMenuItem("Redispatch", $scope.reAllocateJobs), createMenuItem("Resend", $scope.resendJobs)];

                    if (multiple) {
                        menu = menu.map(item => ({
                            ...item, text: `${item.text} Selected`
                        }));
                    }
                }

                if (multiple && lastCourier === null) {
                    menu.unshift(createMenuItem("Dispatch Selected", ($itemScope) => dispatchJobs($itemScope.courier.courier)));
                }

                return menu;
            };

            /**
             * @param {string} mode
             */
            $scope.setTruckMode = async (mode) => {
                $scope.truckMode = mode;
                await $scope.getData();
            };

            /**
             * @param {string} channel
             */
            $scope.setSupportChannel = async (channel) => {
                $scope.supportChannel = channel;
                if (Modernizr.localstorage) {
                    localStorage.setItem("support-channel-" + ContactID, JSON.stringify($scope.supportChannel));
                }

                await $scope.getSupports();
            };

            $scope.getAvailableCourierLocation = async () => {
                if (!$scope.allCouriers.display) {
                    map.clearLabels();
                    map.clearFlags();
                    return;
                }

                const areas = $scope.areas;
                const channels = [];
                let trucks = false;

                areas.forEach(area => {
                    switch (area) {
                        case "main1":
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
                            console.log("Default case reached");
                    }
                });

                if (map && map.getBounds()) {
                    const bounds = map.getBounds();
                    const southWestLng = bounds.getSouthWest().lng();
                    const southWestLat = bounds.getSouthWest().lat();

                    const northEastLng = bounds.getNorthEast().lng();
                    const northEastLat = bounds.getNorthEast().lat();

                    try {
                        const returnData = await DispatchData.getAvailableCourierLocation(southWestLng, southWestLat, northEastLng, northEastLat);
                        const courierId = $scope.currentCourier === false || $scope.currentCourier === null ? 0 : $scope.currentCourier.courier.split(" ")[0].trim();

                        displayAvailableCouriers(returnData, courierId, channels, trucks, $scope.truckMode, $scope.allCouriers.includeUA);
                    } catch (error) {
                        console.log('Error getting available courier location:', error);
                    }
                } else {
                    console.log('Map or map bounds not fully loaded or initialized');
                }
            };

            async function getJobList() {
                if ($scope.jobsLoading) {
                    return; // Prevent concurrent loads
                }

                await $timeout(() => {
                    $scope.jobsLoading = true;
                });

                try {
                    // Save filters to local storage if available
                    if (Modernizr.localstorage) {
                        localStorage.setItem(
                            "disp-filters-" + ContactID,
                            JSON.stringify($scope.queryParams)
                        );
                    }

                    const selectedClients = $scope.pickService.clients.map(a => a.id);

                    const result = await dispatchJobService.getJobListWithCourierData(
                        $scope.queryParams,
                        selectedClients,
                        $scope.isInternal,
                        $scope.selectedAreas
                    );

                    // Update scope with new data
                    await $timeout(async () => {
                        if (result.jobs?.length > 0) {
                            $scope.jobList = result.jobs;

                            sizeHeadings();

                            // Only display pickup points if we have undispatched jobs
                            if (result.undispatchedJobs.length > 0) {
                                displayPickupPoints(result.undispatchedJobs, true, null);
                            }

                            await $scope.getAvailableCourierLocation();
                        } else {
                            $scope.jobList = [];
                        }
                    });

                } catch (error) {
                    console.error('Error getting job list:', error);
                    toastrService.showErrorToast('Failed to get job list. Please try again.');

                    await $timeout(() => {
                        $scope.jobList = [];
                    });
                } finally {
                    await $timeout(() => {
                        $scope.jobsLoading = false;
                    });
                }
            }

            $scope.closeSupport = async (support) => {
                try {
                    await DispatchData.closeSupport(support.eventId, ContactID);
                    await $scope.getSupports();
                    $scope.currentSupport = null;
                    toastrService.showSuccessToast("Support ticket closed successfully");
                } catch (error) {
                    console.log('Error closing support:', error);
                }
            };

            $scope.lockSupport = async (support) => {
                console.log(support);
                try {
                    if (support.lockedBy === Dispatcher) {
                        await DispatchData.unLockSupport(support.eventId, Dispatcher);
                        toastrService.showSuccessToast("Support unlocked successfully");
                    } else {
                        await DispatchData.lockSupport(support.eventId, Dispatcher);
                        toastrService.showSuccessToast("Support locked successfully");
                    }
                    await $scope.getSupports();
                } catch (error) {
                    console.log('Error locking/unlocking support:', error);
                }
            };

            /**
             * @param {string} item
             */
            function SetSelectedChannels(item) {
                const sr = $scope.pickChannels.find(obj => obj.label === item);
                $scope.pickService.channel.push(sr);
            }

            $scope.getSupports = async () => {
                try {
                    $scope.supportsLoading = true;
                    const data = await DispatchData.getSupports($scope.supportChannel);

                    const first = $scope.supports === null || $scope.supports === undefined;

                    $scope.supports = data;

                    if (first) {
                        $scope.supportChannel.split(',').forEach(SetSelectedChannels);
                    }

                    $scope.supportMenu = [{
                        text: "Complete", click: ($itemScope) => {
                            $scope.closeSupport($itemScope.support);
                        }
                    }, {
                        text: "Toggle Lock", click: ($itemScope) => {
                            $scope.lockSupport($itemScope.support);
                        }
                    }, {
                        text: "Void Job", click: ($itemScope) => {
                            $scope.voidJobForm($itemScope.support.jobNumber, $itemScope.support.jobId);
                        }, enabled: ($itemScope) => {
                            return ($itemScope.support.jobId);
                        },
                    },];

                    $timeout(() => {
                        $document.ready(() => {
                            if ($scope.currentSupport) {
                                angular.element("#supports tr[data-id='" + $scope.currentSupport.eventId + "']").addClass("active");
                            }
                        });
                    }, 100);

                    $timeout(() => {
                        sizeHeadings();
                    }, 1000);

                    $timeout(() => {
                        sizeHeadings();
                    }, 2000);
                } catch (error) {
                    console.log('Error getting supports:', error);
                } finally {
                    $scope.supportsLoading = false;
                }
            };

            $scope.getClientContacts = async () => {
                try {
                    $scope.pickClients = await DispatchData.getClientContacts(ContactID);
                } catch (error) {
                    console.log('Error getting client contacts:', error);
                }
            };

            $scope.getData = async () => {
                try {
                    // Only reset current selections, not the full job list
                    $scope.currentJob = null;
                    $scope.jdSvc.currentJob = null;
                    $scope.potentialCouriers = null;
                    $scope.jobGroups = false;

                    if (!$scope.courier) {
                        $scope.currentCourier = null;
                    }

                    // Fetch data concurrently
                    const [activeCouriers, allCouriers] = await Promise.all([
                        DispatchData.getActiveCouriers(),
                        DispatchData.getAllCouriers()
                    ]);

                    $scope.pickCouriers = activeCouriers;
                    $scope.pickAllCouriers = allCouriers;

                    // Get job list only once - this function manages its own loading state
                    await getJobList();

                    // Apply any UI updates
                    if (!$scope.$$phase) {
                        $scope.$apply();
                    }
                } catch (error) {
                    console.error('Error in getData:', error);
                    console.log("An error occurred while loading data. Please refresh the page.");
                }
            };

            async function fetchDriverLocations() {
                $scope.driverLocationsLoading = true;

                $scope.getClearListEnvelope = async (clearListId) => {
                    try {
                        const data = await DispatchData.getDriverDestinationEnvelope(clearListId);
                        updateMapBounds(data);
                        await $scope.getAvailableCourierLocation();

                        return data;
                    } catch (error) {
                        console.error('Error getting clear list envelope:', error);
                    }
                };

                $scope.getDriverLocationsData = async () => {
                    try {
                        $scope.driverLocations = await DispatchData.getDriverLocations($scope.selectedAreas);
                        $timeout(() => {
                            angular.element("#driverLocations .loading").fadeOut();
                        }, 0);
                        console.log("Driver Locations: " + $scope.driverLocations);
                        await $scope.activateDrop();
                    } catch (error) {
                        console.error('Error getting clear lists data:', error);
                    }
                };

                await $scope.getDriverLocationsData();
                $scope.driverLocationsLoading = false;
                $scope.$apply();
            }

            /**
             * @param {ClearListEnvelope} data
             */
            function updateMapBounds(data) {
                const swll = new google.maps.LatLng(data.minimumLatitude, data.minimumLongitude);
                const nell = new google.maps.LatLng(data.maximumLatitude, data.maximumLongitude);
                map.fitBounds(new google.maps.LatLngBounds(swll, nell));
                map.setZoom(13);
            }

            async function fetchCouriers() {
                const [activeCouriers, allCouriers] = await Promise.all([DispatchData.getActiveCouriers(), DispatchData.getAllCouriers()]);
                $scope.pickCouriers = activeCouriers;
                $scope.pickAllCouriers = allCouriers;
            }

            if (!$scope.isInternal) {
                $scope.getClientContacts().then(() => console.log('Get Data Complete!'));
            }

            const runSupportsUpdate = () => {
                $scope.getSupports().then(() => {
                    $timeout(runSupportsUpdate, 60000);
                });
            };
            runSupportsUpdate();


            /**
             * @param {Object} $event
             * @param {Job} currentJob
             */
            $scope.setSplitJobMeetingPoint = async ($event, currentJob) => {
                /**
                 * @param {Job} job
                 */
                const getDeliveryLocation = (job) => ({
                    lat: job.deliveryLatitude || "", long: job.deliveryLongitude || ""
                });

                try {
                    const location = getDeliveryLocation(currentJob);
                    console.log("Retrieved job coordinates!");

                    const selectedSuburbs = await DispatchData.getSuburbList();
                    const dialogResult = await showEditAddressDialog($event, currentJob, selectedSuburbs, location);
                    await handleDialogResult(dialogResult, currentJob);
                } catch (error) {
                    console.log(error.message);
                } finally {
                    console.log("Split jobs process completed.");
                }
            };

            function showEditAddressDialog($event, currentJob, selectedSuburbs, location) {
                return $mdDialog.show({
                    controller: 'EditAddressDialogController',
                    controllerAs: 'ctrl',
                    templateUrl: versionUrl("app/components/dialogs/edit-address-dialog/edit-address-dialog.html"),
                    parent: angular.element($document.body),

                    clickOutsideToClose: false,
                    fullscreen: true,
                    locals: {
                        addressDetails: {
                            address: currentJob.toAddress,
                            lat: location.lat,
                            long: location.long,
                            suburb: currentJob.toSuburbName,
                            postCode: currentJob.postCode,
                        }, suburbOptions: selectedSuburbs, title: "Split Job Address and GPS", submitLabel: "Split Job",
                    },
                    bindToController: true
                });
            }

            async function handleDialogResult(addressDetails, currentJob) {
                if (!addressDetails) {
                    console.log("Split jobs canceled!");
                    return;
                }

                const updatedJob = {
                    ...currentJob, toAddress: addressDetails.address, toSuburbID: addressDetails.our_suburb,
                };

                const callData = {
                    jobID: updatedJob.id,
                    lat: addressDetails.lat,
                    long: addressDetails.long,
                    toSuburbId: updatedJob.toSuburbID,
                    toAddress: updatedJob.toAddress,
                };

                await DispatchData.updateSplitJobAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long);
                await DispatchData.reRateSplitJob(callData.jobID);
                await DispatchData.finishSplitJobProcess(callData.jobID, FirstName);
                await $scope.getData();

                toastrService.showSuccessToast("Job Successfully Split");
                console.log("Job splitting complete!");
                console.log('Dialog closed!');

                return getJobList();
            }

            $scope.addEvent = () => {
                let time = new Date();
                time.setSeconds(0);
                time.setMilliseconds(0);

                $scope.eventForm = {
                    "data": {
                        "jobNum": $scope.currentJob.jobNo,
                        "client": $scope.currentJob.client,
                        "event": "Other",
                        "date": new Date(),
                        "time": time
                    }, submit() {

                    }, cancel() {
                        angular.element('.eventForm').css('display', 'none');
                    }
                };

                angular.element('.eventForm').css('display', '');
            };

            /**
             * @param {Object}  $event
             */
            $scope.truckLoadingStatus = ($event) => {
                return $mdDialog.show({
                    controller: 'TruckCourierStatusDialogController',
                    controllerAs: 'ctrl',
                    parent: angular.element($document.body),

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

            /**
             * @param {Object} $event
             */
            $scope.createNewJob = async ($event) => {
                async function showCreateJobDialog() {
                    return $mdDialog.show({
                        controller: 'CreateJobDialogController',
                        controllerAs: 'ctrl',
                        parent: angular.element($document.body),

                        templateUrl: versionUrl("app/components/dialogs/create-job-dialog/create-job-dialog.html"),
                        clickOutsideToClose: false,
                        fullscreen: true,
                        locals: {
                            staffId: ContactID, despatcherName: FirstName
                        },
                        bindToController: true
                    });
                }

                /**
                 * @param {number} newJobId
                 */
                async function processNewJob(newJobId) {
                    try {
                        const job = await DispatchData.getJobDetail(newJobId);
                        await $scope.getData();
                        await $scope.selectJob(job);
                        toastrService.showSuccessToast("New Job Created Successfully");
                    } finally {
                        // Any cleanup operations can go here
                    }
                }

                try {
                    const newJobId = await showCreateJobDialog();
                    if (newJobId) {
                        await processNewJob(newJobId);
                    }
                } catch (error) {
                    console.log('Error in createNewJob:', error);
                }
            };

            /**
             * @param {Object} $event
             */
            $scope.interCourierCharge = async $event => {
                try {
                    await $mdDialog.show({
                        controller: 'InterCourierChargeDialog',
                        controllerAs: 'ctrl',
                        parent: angular.element($document.body),
                        templateUrl: versionUrl("app/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.html"),
                        clickOutsideToClose: false,
                        fullscreen: true,
                        locals: {
                            staffId: ContactID,
                        },
                        bindToController: true
                    });

                    console.log("Inter-courier Charge Added!");
                    toastrService.showSuccessToast("Inter-courier charge added successfully");
                } catch (error) {
                    if (error === undefined) {
                        console.log("Inter-courier Charge Canceled!");
                    } else {
                        throw error;
                    }
                }
            };

            /**
             * @param {Object} $event
             * @param {Job} job
             */
            $scope.createEvent = async ($event, job) => {
                try {
                    await $mdDialog.show({
                        controller: 'AddEventDialogController',
                        controllerAs: "ctrl",
                        templateUrl: versionUrl("app/components/dialogs/add-event-dialog/add-event-dialog.html"),
                        parent: angular.element($document.body),
                        clickOutsideToClose: true,
                        fullscreen: true,
                        locals: {
                            job: job,
                            dispatherName: FirstName,
                            contactId: ContactID
                        },
                        bindToController: true
                    });

                    toastrService.showSuccessToast("Event created successfully");
                    console.log('Pallet Dialog closed!');
                } catch (error) {
                    if (error === undefined) {
                        console.log('User canceled!')
                    } else {
                        throw error;
                    }
                }
            };

            /**
             * @param {number} jobId
             */
            async function checkForAttachments(jobId) {
                $scope.isCheckingAttachments = true;
                $scope.hasAttachedFile = false;

                try {
                    const response = await DispatchData.isFilesAttachedToJob(jobId);
                    $scope.hasAttachedFile = response;
                    return response;
                } catch (error) {
                    console.log('Error checking for attachments:', error);
                    $scope.hasAttachedFile = false;
                    throw error;
                } finally {
                    $scope.isCheckingAttachments = false;
                }
            }

            /**
             * @param {Object} $event
             * @param {Job} job
             */
            $scope.openFileAttachmentDialog = async ($event, job) => {
                console.log(job);
                try {
                    await $mdDialog.show({
                        controller: 'JobFileUploadController',
                        controllerAs: 'ctrl',
                        parent: angular.element($document.body),
                        templateUrl: versionUrl("app/components/dialogs/job-file-upload-dialog/job-file-upload-dialog.html"),
                        clickOutsideToClose: false,
                        fullscreen: true,
                        locals: {
                            jobId: job.id
                        },
                        bindToController: true
                    });

                    console.log('Job File Upload Dialog Closed!');
                } catch (error) {
                    if (error === undefined) {
                        console.log('User canceled!');
                    } else {
                        throw error;
                    }
                }
            };

            /**
             * @param  {Object}  $event
             * @param  {Job}  job
             */
            $scope.showAdditionalServicesMenu = async ($event, job) => {
                try {
                    const isClientItemsAvailable = await DispatchData.hasClientItemsAvailable(job.clientId, job.speedId);

                    if (!isClientItemsAvailable) {
                        await $mdDialog.show($mdDialog.alert()
                            .clickOutsideToClose(true)
                            .title('No Additional Services')
                            .targetEvent($event)
                            .textContent('No additional services has been set up for this client. Please add a service through Admin Manager and try again.')
                            .ok('OK'));
                        return;
                    }

                    await $mdDialog.show({
                        controller: 'AdditionalServicesDialogController',
                        controllerAs: "ctrl",
                        templateUrl: versionUrl("app/components/dialogs/additional-services-dialog/additional-services-dialog.html"),
                        parent: angular.element($document.body),

                        clickOutsideToClose: false,
                        fullscreen: true,
                        locals: {
                            job: job
                        },
                        bindToController: true
                    });

                    console.log('Additional Services Dialog closed!');
                } catch (error) {
                    if (error === undefined) {
                        console.log('User canceled dialog!')
                    } else {
                        console.error('Error in showAdditionalServicesMenu:', error);
                    }
                }
            };

//Init the controller
            function init() {
                initializeVariables();
                initLayoutSystem($scope, ContactID);

                loadPageViews().then(() => {
                    console.log('Loaded Page Views and Data!');
                });
            }

            init();
        }]);

/**
 * Converts degrees to radians.
 *
 * @param {number} deg - The angle in degrees.
 * @returns {number} The angle in radians.
 */
function Deg2Rad(deg) {
    return deg * Math.PI / 180;
}

/**
 * Calculates the distance between two points on Earth using the Pythagorean theorem on an equirectangular projection.
 *
 * @param {number} lat1 - Latitude of the first point in degrees.
 * @param {number} lon1 - Longitude of the first point in degrees.
 * @param {number} lat2 - Latitude of the second point in degrees.
 * @param {number} lon2 - Longitude of the second point in degrees.
 * @returns {number} The distance between the two points in kilometers.
 */
function PythagorasEquirectAngular(lat1, lon1, lat2, lon2) {
    lat1 = Deg2Rad(lat1);
    lat2 = Deg2Rad(lat2);
    lon1 = Deg2Rad(lon1);
    lon2 = Deg2Rad(lon2);
    const R = 6371; // Earth's radius in km
    const x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
    const y = (lat2 - lat1);
    return Math.sqrt(x * x + y * y) * R;
}

/**
 * Finds the closest location from a list of locations to a given point.
 *
 * @param {number} latitude - The latitude of the reference point.
 * @param {number} longitude - The longitude of the reference point.
 * @param {Array<Array<any>>} locations - An array of locations. Each location should be an array where the second element is latitude and the third is longitude.
 * @returns {Array<any>} The closest location from the list.
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
