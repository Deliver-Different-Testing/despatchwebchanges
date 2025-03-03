import app from "../../app";
import "./keyboardEvents";
import './nationwide.styles.less';

function NationwideControl($scope, jdSvc, NWData, $state, $filter, hotkeys, $timeout,
    greetingService, $mdDialog, $document, toastrService, DispatchData, moment,
    $mdSidenav, AppPages, APP_CONFIG, $mdEditDialog, LayoutService, $mdMenu,
    dispatchJobService) {
    $scope.jdSvc = jdSvc;

    const JOB_DATA_TYPE = {
        NEW: 'new', POD: 'pod', REPRICE: 'reprice', DELIVERY: 'delivery', ALL: 'all'
    };

    // Variables
    function initializeVariables() {
        $scope.name = "Nationwide";
        $scope.isInternal = (ClientInternal === "True");
        /** @type {boolean} */
        $scope.isUsCustomer = APP_CONFIG.US_Customer;
        /** @type {string} */
        $scope.courierSearchText = "";
        /** @type {string} */
        $scope.jobRecordSearchText = "";

        // New map
        $scope.mapCenter = APP_CONFIG.US_Customer
            ? { lat: 39.8283, lng: -98.5795 } // US center
            : { lat: -36.8485, lng: 174.7633 }; // Auckland, NZ
        $scope.courierPositions = [];
        $scope.mapZoom = 4;

        /**
         * @type {JobDataType}
         * @constant
         */
        $scope.jobDataType = JOB_DATA_TYPE;

        /** @type {Date} */
        $scope.currentSearchTime = new Date();

        $scope.sort = [];
        /** @type {FlightOptions[]} */
        $scope.flightOptions = [];
        /** @type {string} */
        $scope.flightMessage = '';
        /** @type {string} */
        $scope.flightError = '';
        /** @type {boolean} */
        $scope.flightsLoading = false;

        /** @type {Agent[]} */
        $scope.agentOptions = [];
        /** @type {string} */
        $scope.agentMessage = '';
        /** @type {string} */
        $scope.agentError = '';
        /** @type {boolean} */
        $scope.agentLoading = false;

        /** @type {Job} */
        $scope.currentJob = {};
        /** @type {boolean} */
        $scope.jobDetailFabIsOpen = false;
        /** @type {boolean} */
        $scope.courierListFabIsOpen = false;
        /** @type {Array} */
        $scope.views = [];
        /** @type {Array} */
        $scope.selectedViews = [];

        $scope.filters = [{value: 3, label: 'Active', icon: 'sync', active: false}, {
            value: 4,
            label: 'Done',
            icon: 'task_alt',
            active: false
        }, {value: 5, label: 'All', icon: 'list_alt', active: true}];

// Load saved filter or use default
        $scope.selectedFilter = loadFilterFromStorage();

// Set active state based on loaded filter
        $scope.filters.forEach(filter => {
            filter.active = filter.value === $scope.selectedFilter;
        });

        $scope.showInput = {};
        $scope.inputWidth = {};

        /** @type {Job[]} */
        $scope.jobList = [];

        // Job list loading indicators
        /** @type {boolean} */
        $scope.jobListLoading = false;
        /** @type {boolean} */
        $scope.deliveryListLoading = false;
        /** @type {boolean} */
        $scope.podListLoading = false;
        /** @type {boolean} */
        $scope.repriceListLoading = false;

        $scope.selected = [];

        $scope.jobFilters = {
            order: 'time',
            filter: '',
            status: 'all',
            asc: 'asc',
            page: 1,
            limit: 10
        };

        $scope.jobDeliveryFilters = {
            order: 'time',
            filter: '',
            status: 'all',
            asc: 'asc',
            page: 1,
            limit: 10
        };

        $scope.jobPodFilters = {
            order: 'time',
            filter: '',
            status: 'all',
            asc: 'asc',
            page: 1,
            limit: 10
        };

        $scope.jobRepriceFilters = {
            order: 'time',
            filter: '',
            status: 'all',
            asc: 'asc',
            page: 1,
            limit: 10
        };

        $scope.flightTableQuery = {
            order: 'departureTime'
        };

        $scope.agentTableQuery = {
            order: 'agentName'
        };

        $scope.internalStatusOptions = [];
        DispatchData.getInternalStatusList().then(data => {
            $scope.internalStatusOptions = data;
        }).catch(error => {
            console.error('Error fetching internal status list:', error);
            $scope.internalStatusOptions = [];
        });


        $scope.truckCourierStatus = [];
        $scope.getJobStyle = assigned => {
            const normal = {
                "font-weight": "normal"
            }, bold = {
                "font-weight": "bold"
            };

            if (assigned) {
                return bold;
            } else {
                return normal;
            }
        };

        $scope.courierMenu = [{
            text: "Dispatch Selected", click: ($itemScope) => {
                $scope.dispatchJobs($itemScope.courier.courier || $itemScope.courier.code);
            }
        }];

        $scope.potentialCourierMenu = [{
            text: "Dispatch Selected", click: async ($itemScope) => {
                await $scope.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
            }
        }];

        $scope.normalStyle = "{'font-weight:normal'}";
        /** @type {boolean} */
        $scope.showChat = false;
        $scope.chatBox = "";

        $scope.boxes = {
            "jobsList": {
                "title": "New Jobs",
                "icon": "new_releases",
                "templateUrl": "app/components/Nationwide/partials/jobList.html",
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListPOD": {
                "title": "Awaiting POD",
                "icon": "pending_actions",
                "templateUrl": "app/components/Nationwide/partials/jobListPOD.html",
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListDelivery": {
                "title": "Action Required",
                "icon": "warning",
                "templateUrl": "app/components/Nationwide/partials/jobListDelivery.html",
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListReprice": {
                "title": "Reprice",
                "icon": "price_change",
                "templateUrl": "app/components/Nationwide/partials/jobListReprice.html",
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobDetail": {
                "title": "Detail",
                "icon": "assignment",
                "templateUrl": "app/components/Nationwide/partials/jobDetail.html",
                "showSearch": 0,
                "showRefresh": 0,
                "showDetailButtons": 1
            },
            "map": {
                "title": "Map",
                "icon": "pin_drop",
                "templateUrl": "app/components/Nationwide/partials/map.html",
                "showSearch": 0,
                "showRefresh": 1
            },
            "flightAgentDataTable": {
                "title": "Available",
                "icon": "docs_add_on",
                "templateUrl": "app/components/Nationwide/partials/flightAgentDataTableBox.html",
                "showSearch": 0,
                "showRefresh": 1
            }
        };

        $scope.pickService = {
            "clients": [], "settings": {
                "enableSearch": true,
                "selectedToTop": true,
                "closeOnBlur": true,
                "closeOnSelect": true,
                "buttonClasses": "topBarActive btn-sm btn-clients"
            }
        };
        $scope.pickClients = [];
        $scope.pickEventTypes = [];

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
    }

    function init() {
        initializeVariables();
        initHereMaps();

        // Initialize layouts through the service
        try {
            $scope.layouts = LayoutService.getLayouts() || [LayoutService.getDefaultLayout()[0]];
            $scope.currentLayoutIndex = LayoutService.getCurrentLayoutIndex() || 0;
            $scope.currentLayoutName = LayoutService.getCurrentLayoutName() || 'Default';
            $scope.layout = LayoutService.getCurrentLayout() || LayoutService.getDefaultLayout()[0].layout;

            // Add layout watchers
            $scope.$watch('layout', (newValue, oldValue) => {
                if (newValue !== oldValue && $scope.currentLayoutName) {
                    const currentLayoutIndex = $scope.layouts.findIndex(l => l.name === $scope.currentLayoutName);
                    if (currentLayoutIndex !== -1) {
                        $scope.layouts[currentLayoutIndex].layout = angular.copy(newValue);
                        if (Modernizr.localstorage) {
                            localStorage.setItem(`layoutsNW-${ContactID}`, JSON.stringify($scope.layouts));
                        }
                    }
                }
            }, true);

            // Watch for layout updates from service
            $scope.$on('layoutUpdated', (event, data) => {
                $scope.layouts = LayoutService.getLayouts();
                $scope.layout = LayoutService.getCurrentLayout();
                if (data) {
                    $scope.currentLayoutIndex = data.currentLayoutIndex;
                    $scope.currentLayoutName = data.currentLayoutName;
                }
            });

        } catch (error) {
            console.error('Error initializing layouts:', error);
            // Set defaults if initialization fails
            $scope.layouts = [LayoutService.getDefaultLayout()[0]];
            $scope.currentLayoutIndex = 0;
            $scope.currentLayoutName = 'Default';
            $scope.layout = LayoutService.getDefaultLayout()[0].layout;
        }

        // Start loading data
        loadPageViews().then(() => {
            console.log('Loaded Page Views and Data!');
        });
    }

    function initHereMaps() {
        $scope.hereCredentials = {
            apiKey: 'KedIcK-HWes4X4mqtK64i4jrxTkD7tAWfJdLCXwGPD8'
        };

        /** @type {MapConfig} */
        $scope.mapConfig = {
            center: {lat: 39.8097343, lng: -98.5556199}, zoom: 7, job: null, selectedJobIndex: 0 // Default to parent job view
        };
    }

    init();

    /**
     * Toggles the sidenav.
     */
    $scope.toggleSidenav = () => {
        $mdSidenav('right').toggle();
    };

    /**
     * Create greeting for the user based on time of day
     */
    $scope.greetUser = () => {
        return greetingService.greetUser(FirstName);
    }

    async function loadPageViews() {
        try {
            $scope.views = await DispatchData.getSelectedViews(ContactID, AppPages.Domestic);
            await initializeViews();
            await $scope.updateFilters();

            if (!$scope.isInternal) {
                await $scope.getClientContacts();
            }

            await $scope.getEventTypes();
            await $scope.getData();

            $timeout(() => sizeHeadings(), 1000);
        } catch (error) {
            console.error('Error fetching dispatch views:', error);
            $scope.views = [];
            await initializeViews();
        }
    }

    // Initialize views
    async function initializeViews() {
        if ($scope.views && $scope.views.length > 0) {
            // Load saved views or initialize empty array
            $scope.selectedViews = loadViewsFromStorage();

            // Set selected property on each view
            $scope.views = $scope.views.map(view => ({
                ...view, selected: $scope.selectedViews.some(v => v.id === view.id)
            }));

            // If no views are selected, select the first one by default
            if ($scope.selectedViews.length === 0) {
                $scope.views[0].selected = true;
                $scope.selectedViews.push($scope.views[0]);
                saveViewsToStorage($scope.selectedViews);
            }
        }
    }

    $scope.toggleView = async view => {
        if (view.selected) {
            if (!$scope.selectedViews.some(v => v.id === view.id)) {
                $scope.selectedViews.push(view);
            }
        } else {
            const index = $scope.selectedViews.findIndex(v => v.id === view.id);
            if (index > -1) {
                $scope.selectedViews.splice(index, 1);
            }
        }

        // Save filtered views
        saveViewsToStorage($scope.selectedViews);

        await $scope.getData();
    };

    $scope.updateFilters = async (selectedFilter) => {
        try {
            // If no filter provided, use current selectedFilter
            selectedFilter = selectedFilter || $scope.selectedFilter;

            // Set all filters to inactive
            $scope.filters.forEach(filter => {
                filter.active = false;
            });

            // Set the selected filter to active
            const selectedFilterObj = $scope.filters.find(filter => filter.value === selectedFilter);
            if (selectedFilterObj) {
                selectedFilterObj.active = true;
                $scope.selectedFilter = selectedFilter;
            }

            // Save the selected filter
            saveFilterToStorage(selectedFilter);

            // Pass the numeric value directly to setFilters without the timeout
            await setFilters({'status': selectedFilter});

            if (!$scope.$$phase) {
                $scope.$apply();
            }
        } catch (error) {
            console.error('Error updating filters:', error);
        }
    };

    async function setFilters(data) {
        // Ensure data is an object
        data = data || {};

        if (data.status) {
            // Set numeric status directly
            $scope.queryParams.status = data.status;
        } else {
            // Use current selectedFilter if no status provided
            $scope.queryParams.status = $scope.selectedFilter || 3; // Default to 3 (Active)
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

        // Save filters to storage if available
        if (Modernizr.localstorage) {
            localStorage.setItem(`nw-filters-${ContactID}`, JSON.stringify($scope.queryParams));
        }

        return $scope.getData();
    }

    $scope.setActiveArea = selectedArea => {
        angular.forEach($scope.driverLocations.views, area => {
            area.isActive = (area === selectedArea);
        });
    };

    $scope.updateGPS = (currentJob, field, fromRightClick) => {
        $scope.jdSvc.updateGPS(currentJob, field, fromRightClick);
    };

    jdSvc.setSelectJobDetail(async () => {
        const currentJob = $scope.currentJob;
        if (!currentJob) {
            return;
        }

        await jdSvc.setJob(currentJob);
        await $scope.getData();

        const jobLists = [{list: $scope.jobList, elementId: 'jobList'}, {
            list: $scope.jobListDelivery, elementId: 'jobListDelivery'
        }, {list: $scope.jobListPOD, elementId: 'jobListPOD'}, {
            list: $scope.jobListReprice, elementId: 'jobListReprice'
        }];

        for (const {list, elementId} of jobLists) {
            const refreshedJob = list.find(jo => jo.id === currentJob.id);
            if (refreshedJob) {
                await $scope.selectJob(refreshedJob);
                await new Promise(resolve => $timeout(async () => {
                    const element = angular.element(`#${elementId} tr[data-jobid='${currentJob.id}']`);
                    element.addClass("active");

                    const parentDiv = angular.element(`#${elementId} tr[data-jobid='${currentJob.id}'].box-content`);
                    let goTop = element.prop('offsetTop');

                    try {
                        goTop = goTop - parentDiv.prop('offsetTop') + parentDiv.prop('scrollTop') - 28;
                        parentDiv.prop('scrollTop', goTop);
                    } catch (e) {
                        // ignore
                    }

                    resolve();
                }, 1000));
                return;
            }
        }
    });

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
        return $scope.selectJob(selectedJob);
    }

    /**
     * Generic function to edit courier
     * @param {Object} $event - The event object
     * @param {Job} job - The job object
     * @param {Function} dispatchFunction - The dispatch function to call
     */
    $scope.editCourier = async ($event, job, dispatchFunction) => {
        $event.stopPropagation(); // Prevent row selection
        const editDialog = {
            modelValue: job.courier, placeholder: 'Assign Courier', save: async input => {
                job.courier = input.$modelValue;
                await dispatchFunction(job.courier);
            }, targetEvent: $event, title: 'Assign Courier', validators: {
                'md-maxlength': 30
            }
        };

        try {
            const dialog = await $mdEditDialog.small(editDialog);
            const input = dialog.getInput();
            input.$viewChangeListeners.push(() => {
                input.$setValidity('test', input.$modelValue !== 'invalid');
            });
        } catch (error) {
            console.error('Error in edit dialog:', error);
            // Handle error as needed
        }
    };

    /**
     * @param {Object} $event - The event object
     * @param {Job} job - The job object
     */
    $scope.editCourierNew = async ($event, job) => {
        await $scope.editCourier($event, job, $scope.dispatchJobsFromNew);
    };

    /**
     * @param {Object} $event - The event object
     * @param {Job} job - The job object
     */
    $scope.editCourierStandard = async ($event, job) => {
        await $scope.editCourier($event, job, $scope.dispatchJobs);
    };

    /**
     * @param {Object} $event - The event object
     * @param {Job} job - The job object
     */
    $scope.editCourierPOD = async ($event, job) => {
        await $scope.editCourier($event, job, $scope.dispatchJobsFromPOD);
    };


    $scope.$on('layoutUpdated', () => {
        $scope.layout = LayoutService.getCurrentLayout();
        $scope.$apply();
    });

    /**
     * @param {number} index
     */
    $scope.loadLayout = (index) => {
        const layout = LayoutService.loadLayout(index);
        $scope.layout = angular.copy(layout);
        $scope.currentLayoutName = LayoutService.getCurrentLayoutName();
        $scope.currentLayoutIndex = index;

        // Ensure dimensions are applied
        $timeout(async () => {
            layout.columns.forEach(column => {
                const columnEl = angular.element(`#co-${column.id}`);
                columnEl.css('flex-basis', column.width);

                column.boxes.forEach(box => {
                    const boxEl = angular.element(`#box-${box.name}`);
                    boxEl.css('flex-basis', box.height);
                });
            });

            // Refresh data after layout is properly applied
            await $scope.getData();
        });
    };

    $scope.saveLayout = async () => {
        try {
            const result = await LayoutService.saveLayout($scope.layout);
            $scope.layouts = LayoutService.getLayouts();
            $scope.currentLayoutName = result.name;
            $scope.layout = result.layout;
            if (!$scope.$$phase) {
                $scope.$apply();
            }
            return result;
        } catch (error) {
            console.error("Error saving layout:", error);
        }
    };

    /**
     * @param {number} index
     */
    $scope.deleteLayout = async (index) => {
        try {
            await LayoutService.deleteLayout(index);
            $scope.layouts = LayoutService.getLayouts();
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        } catch (error) {
            console.error("Error deleting layout:", error);
        }
    };

    function saveFilterToStorage(filter) {
        if (Modernizr.localstorage) {
            localStorage.setItem(`selectedFilter-NW-${ContactID}`, filter);
        }
    }

    function loadFilterFromStorage() {
        if (Modernizr.localstorage) {
            const savedFilter = localStorage.getItem(`selectedFilter-NW-${ContactID}`);
            return savedFilter ? parseInt(savedFilter) : 3; // Default to 3 (Active) if not found
        }
        return 3; // Default value if localStorage not available
    }

    function saveViewsToStorage(views) {
        if (Modernizr.localstorage) {
            localStorage.setItem(`selectedViews-NW-${ContactID}`, JSON.stringify(views));
        }
    }

    function loadViewsFromStorage() {
        if (Modernizr.localstorage) {
            try {
                const savedViews = JSON.parse(localStorage.getItem(`selectedViews-NW-${ContactID}`));
                return savedViews || [];
            } catch (error) {
                console.error('Error loading views from storage:', error);
                return [];
            }
        }
        return [];
    }


    $scope.getSelectedStatusText = () => {
        const defaultText = 'Stage';
        if (!$scope.internalStatusOptions || !$scope.currentJob) {
            return defaultText;
        }

        const selectedStatus = $scope.internalStatusOptions.find(status => status.id === $scope.currentJob.internalStatusId);
        return selectedStatus ? selectedStatus.text : defaultText;
    };

    /**
     * Maps internal status IDs to job data types
     * @type {Object.<number, number[]>}
     */
    const STATUS_TO_LIST_MAP = {
        1: [$scope.jobDataType.NEW],
        2: [$scope.jobDataType.DELIVERY],
        3: [$scope.jobDataType.POD],
        4: [$scope.jobDataType.REPRICE]
    };

    /**
     * Sets the internal status for a job and refreshes relevant data
     * @param {number} internalStatusId - The new internal status ID
     * @param {Job} job - The job being updated
     */
    $scope.setInternalStatus = async (internalStatusId, job) => {
        try {
            $mdMenu.hide();

            // Get the current status before update
            const previousStatusId = job.internalStatusId;

            // Update Job
            await NWData.updateJobDetail(job.id, "InternalStatusID", internalStatusId, job.charge, FirstName, ContactID, false);

            // Determine which lists need refreshing
            const listsToRefresh = new Set([...STATUS_TO_LIST_MAP[previousStatusId] || [], ...STATUS_TO_LIST_MAP[internalStatusId] || []]);

            // Only refresh the affected lists
            await getJobList(Array.from(listsToRefresh));

            // Get all potentially affected lists based on what we just refreshed
            const relevantLists = [];
            if (listsToRefresh.has($scope.jobDataType.NEW)) {
                relevantLists.push(...($scope.jobList || []));
            }
            if (listsToRefresh.has($scope.jobDataType.POD)) {
                relevantLists.push(...($scope.jobListPOD || []));
            }
            if (listsToRefresh.has($scope.jobDataType.DELIVERY)) {
                relevantLists.push(...($scope.jobListDelivery || []));
            }
            if (listsToRefresh.has($scope.jobDataType.REPRICE)) {
                relevantLists.push(...($scope.jobListReprice || []));
            }

            // Find and reselect the updated job
            const refreshedJob = relevantLists.find(j => j.id === job.id);
            if (refreshedJob) {
                await $scope.selectJob(refreshedJob);
            }

            // Adjust table headings after data update
            $timeout(() => sizeHeadings(), 200);
        } catch (error) {
            console.error("Error setting internal status:", error);
        }
    };

    /**
     * Handles reordering of the job list
     */
    $scope.onReorderJobList = async () => {
        // Reset to first page when order changes
        $scope.jobFilters.page = 1;
        await getJobList($scope.jobDataType.NEW);
    };

    /**
     * Handles pagination of the job list
     * @param {number} page - The page number
     * @param {number} limit - The number of items per page
     */
    $scope.onPaginateJobList = async (page, limit) => {
        $scope.jobFilters.page = page;
        $scope.jobFilters.limit = limit;
        await getJobList($scope.jobDataType.NEW);
    };

    /**
     * Handles reordering of the POD job list
     */
    $scope.onReorderPodList = async () => {
        // Reset to first page when order changes
        $scope.jobPodFilters.page = 1;
        await getJobList($scope.jobDataType.POD);
    };

    /**
     * Handles pagination of the POD job list
     * @param {number} page - The page number
     * @param {number} limit - The number of items per page
     */
    $scope.onPaginatePodList = async (page, limit) => {
        $scope.jobPodFilters.page = page;
        $scope.jobPodFilters.limit = limit;
        await getJobList($scope.jobDataType.POD);
    };

    /**
     * Handles reordering of the Reprice job list
     */
    $scope.onReorderRepriceList = async () => {
        // Reset to first page when order changes
        $scope.jobRepriceFilters.page = 1;
        await getJobList($scope.jobDataType.REPRICE);
    };

    /**
     * Handles pagination of the Reprice job list
     * @param {number} page - The page number
     * @param {number} limit - The number of items per page
     */
    $scope.onPaginateRepriceList = async (page, limit) => {
        $scope.jobRepriceFilters.page = page;
        $scope.jobRepriceFilters.limit = limit;
        await getJobList($scope.jobDataType.REPRICE);
    };

    /**
     * Handles reordering of the Delivery job list
     */
    $scope.onReorderDeliveryList = async () => {
        // Reset to first page when order changes
        $scope.jobDeliveryFilters.page = 1;
        await getJobList($scope.jobDataType.DELIVERY);
    };

    /**
     * Handles pagination of the Delivery job list
     * @param {number} page - The page number
     * @param {number} limit - The number of items per page
     */
    $scope.onPaginateDeliveryList = async (page, limit) => {
        $scope.jobDeliveryFilters.page = page;
        $scope.jobDeliveryFilters.limit = limit;
        await getJobList($scope.jobDataType.DELIVERY);
    };


    /**
     * @param {Job} job
     */
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

    /**
     * Orders a job list by the given property
     * @param {string} list - The name of the list to order ('jobList', 'jobListPOD', etc.)
     * @param {string} prop - The property to sort by
     * @returns {Promise<void>}
     */
    $scope.orderList = async (list, prop) => {
        // Determine if we should use server-side ordering
        const serverOrder = list === "jobList";

        // Update sort state
        if ($scope.sort[list] !== prop) {
            // New sort property
            $scope.sort[list] = prop;
            $scope.jobFilters.asc = "asc";
        } else {
            // Toggle sort direction for same property
            $scope.sort[list] = "d-" + prop;
            $scope.jobFilters.asc = "desc";
        }

        // Handle server-side sorting
        if (serverOrder) {
            await setFilters(list, {"order": prop});
            return;
        }

        // Client-side sorting for other lists
        const direction = $scope.sort[list].startsWith('d-') ? '-' : '';
        $scope[list] = $filter("orderBy")($scope[list], direction + prop);
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
        callback: (event) => {
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
        callback: async (event) => {
            try {
                if (angular.element(".gatherForm").is(":visible") === true) {
                    await $timeout(async () => {
                        await $scope.gather.submit();
                    }, 0);
                }
                if (event.srcElement.id === "gps") {
                    await $scope.searchCourier(event.srcElement.value);
                }
            } catch (error) {
                console.error("Error in hotkey callback:", error);
            }
        }
    });

    /**
     * @param {Job} job
     */
    $scope.unlockJob = async (job) => {
        await jdSvc.unlockJob(job);
    };

    /**
     * @param {Job} job
     */
    $scope.lockJob = async (job) => {
        await jdSvc.lockJob(job);
    };

    /**
     * @param {Job} job
     */
    $scope.selectForDispatch = job => {
        console.log("In SelectForDispatch");
        $scope.jobForDispatch = job;
    };

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
        .cancel('Cancel')).then(note => DispatchData.addNote(jobId, note, FirstName, false)).then(() => DispatchData.voidJob(jobId)).then(() => $scope.getData()).catch(error => {
        console.log("Job void canceled or error occurred", error);
    });

    /**
     * @param {number} courierId
     * @param {string} message
     */
    $scope.sendSMS = async (courierId, message) => {
        await NWData.sendSMS(courierId, ContactID, FirstName, message);
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    $scope.otherEventForm = ($event, job) => {
        $mdDialog.show({
            controller: 'AddEventDialogController',
            controllerAs: "ctrl",
            templateUrl: "app/components/dialogs/add-event-dialog/add-event-dialog.html",
            parent: $document.body,
            targetEvent: $event,
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
                return "Gre";
            case 2:
                return "Gre";
            default:
                break;
        }
    }


    ////////////////////////////////////////
    // LOAD DISPATCH JOBS SCREEN
    ///////////////////////////////////////
    $scope.dispatchJobsForm = () => {
        $scope.gather.form = {
            id: "dispatchJobs",
            title: "Dispatch Jobs",
            fields: [{
                "name": "courierNumber", "label": "Courier Number...", "value": ""
            }],
            onSubmit: () => $scope.dispatchJobs(angular.element("#gather-courierNumber").val()),
            submitValue: "Dispatch"
        };
        $scope.gather.showForm();
    };

    $scope.selectAllContent = $event => {
        $event.target.select();
    };

    $scope.latePickup = async (minsAway, j, obj) => {
        try {
            console.log("current = " + j.lp);
            console.log("param minsAway = " + minsAway);
            console.log(obj);
            await $scope.lateCall(minsAway, 1, j, true);
        } catch (error) {
            console.error('Error in latePickup:', error);
        }
    };

    $scope.lateDelivery = async (minsAway, j, obj) => {
        try {
            console.log("current = " + j.ld);
            console.log("param minsAway = " + minsAway);
            console.log(obj);
            await $scope.lateCall(minsAway, 2, j, true);
        } catch (error) {
            console.error('Error in lateDelivery:', error);
        }
    };

    /////////////////////////////////////
    // LATE CALLS
    /////////////////////////////////////
    $scope.lateCall = async (lateTime, lateType, j, calc) => {
        try {
            const response = await NWData.lateCall(lateType, lateTime, j.minutes, j.pickupTime, j.alertLatePickup, j.deliveryTime, j.alertLateDelivery, j.jobNo, j.clientId, j.contactName, ContactID, j.time, j.id, j.jobType, j.speed, j.notify || j.speed, FirstName, calc);

            await $scope.getData();

            return response;
        } catch (error) {
            console.error('Error in lateCall:', error);
            throw error; // Re-throw the error if you want calling code to handle it
        }
    };

    ////////////////////////////////////////
    // DISPATCH THE JOBS FROM NEW WINDOW PANE
    ///////////////////////////////////////
    $scope.dispatchJobsFromNew = async courier => {
        try {
            const foundCourier = $scope.pickCouriers.find(c => c.id === courier);
            if (foundCourier === undefined) {
                await $mdDialog.show($mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Error')
                    .textContent('Invalid Courier')
                    .ok('OK'));
                return;
            }

            const callData = {
                "call": "dispatchJobs", "courier": courier, "jobs": []
            };

            const reset = () => {
                angular.element(".activeTable .active").each(() => {
                    const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                    j.courier = null;
                });
            };

            for (const element of angular.element("#jobList .active")) {
                const j = $scope.jobList.find(jo => jo.id === angular.element(element).data("jobid"));
                const jn = j.jobNo;
                if (j.courierData.courierID !== null) {
                    await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Notice').textContent('Restore ' + jn + ' prior to despatching to another courier').ok('OK'));
                    reset();
                    return;
                }
                if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                    await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`DG job ${jn} can not be despatched to courier ${courier} - doesn't have DGLicense.`).ok('OK'));
                    reset();
                    return;
                }
                if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                    reset();
                    await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`DG job ${jn} can not be despatched to courier ${courier} - doesn't have DGLicense.`).ok('OK'));
                    return;
                }

                if (j.dgClass !== null && j.dgClass > 0) {
                    NWData.addFollowupEvent(jn, j.clientId, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
                }

                callData.jobs.push(angular.element(element).attr("data-jobid"));
            }

            const response = await NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs);
            await $scope.getData();

            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();

            await new Promise(resolve => $timeout(() => {
                angular.element("#jobList tr").first().find(".dispatchField").focus();
                resolve();
            }, 200));

            return response;
        } catch (error) {
            console.error('Error in dispatchJobsFromNew:', error);
        }
    };

    ////////////////////////////////////////
    // DISPATCH THE JOBS FROM POD WINDOW PANE
    ///////////////////////////////////////
    $scope.dispatchJobsFromPOD = async courier => {
        try {
            const foundCourier = $scope.pickCouriers.find(c => c.id === courier);
            if (foundCourier === undefined) {
                alert("Invalid Courier");
                return;
            }

            const callData = {
                "call": "dispatchJobs", "courier": courier, "jobs": []
            };

            const reset = () => {
                angular.element(".activeTable .active").each(() => {
                    const j = $scope.jobListPOD.find(jo => jo.id === angular.element(this).data("jobid"));
                    j.courier = null;
                });
            };

            for (const element of angular.element("#jobListPOD .active")) {
                const j = $scope.jobListPOD.find(jo => jo.id === angular.element(element).data("jobid"));
                const jn = j.jobNo;
                if (j.courierData.courierID !== null) {
                    await $mdDialog.show($mdDialog.alert()
                        .textContent(`Restore ${jn} prior to despatching to another courier.`)
                        .ok('OK'));
                    reset();
                    return;
                }
                if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                    await $mdDialog.show($mdDialog.alert()
                        .textContent(`DG job ${jn} can not be despatched to courier ${courier} - doesn't have DGLicense.`)
                        .ok('OK'));
                    reset();
                    return;
                }
                if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                    reset();
                    await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Notice').textContent(`Courier ${courier} doesn't have a DGLicense or license has expired.`).ok('OK'));
                    return;
                }

                if (j.dgClass !== null && j.dgClass > 0) {
                    NWData.addFollowupEvent(jn, j.clientId, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
                }

                callData.jobs.push(angular.element(element).attr("data-jobid"));
            }

            const response = await NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs);
            await $scope.getData();

            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();

            await new Promise(resolve => $timeout(() => {
                angular.element("#jobListPOD tr").first().find(".dispatchField").focus();
                resolve();
            }, 200));

            return response;
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
        }
    };

    $scope.dispatchJobsFromPotentialCouriers = async courier => {
        try {
            const foundCourier = $scope.pickCouriers.find(c => c.id === courier);
            if (foundCourier === undefined) {
                await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent('Invalid Courier').ok('OK'));
                return;
            }

            const callData = {
                "call": "dispatchJobs", "courier": courier, "jobs": []
            };

            const reset = () => {
                angular.element("#jobList .active").each(() => {
                    const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                    j.courier = null;
                });
            };

            for (const element of angular.element("#jobList .active")) {
                const j = $scope.jobList.find(jo => jo.id === angular.element(element).data("jobid"));
                const jn = j.jobNo;
                if (j.courierData.courierID !== null) {
                    await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Notice').textContent(`Restore ${jn} prior to despatching to another courier`).ok('OK'));
                    reset();
                    return;
                }

                if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                    await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`DG job ${jn} cannot be dispatched to courier ${courier} - doesn't have DGLicense.`).ok('OK'));
                    reset();
                    return;
                }
                if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                    reset();
                    await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`Courier ${courier} doesn't have a DGLicense or license has expired.`).ok('OK'));
                    return;
                }

                if (j.dgClass !== null && j.dgClass > 0) {
                    NWData.addFollowupEvent(jn, j.clientId, j.contactName, ContactID, foundCourier.courierID, j.id, j.jobType, FirstName);
                }

                callData.jobs.push(angular.element(element).attr("data-jobid"));
            }

            const response = await NWData.allocateJobs(foundCourier.courierID, ContactID, callData.jobs);
            await $scope.getData();

            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();

            return response;
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
        }
    };

            /**
             * @param {Job} job
             */
            $scope.restoreJob = async (job) => {
                try {
                    const result = await dispatchJobService.restoreJob(job);
                    $scope.courier = {gpsCourier: result.gpsCourier};

                    await $scope.getData();

                    if ($scope.searchCourier) {
                        await $scope.searchCourier();
                    }

                    $scope.$apply();
                } catch (error) {
                    console.error('Error restoring job:', error);
                }
            };

    ////////////////////////////////////////
    // REDESPATCHED JOB
    ///////////////////////////////////////
    $scope.reAllocateJobs = async () => {
        try {
            const callData = {
                "call": "redespatchJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
            };

            let foundCourier = null;

            angular.element("#jobList .active").each(function () {
                const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));

                foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
                callData.jobs.push(angular.element(this).attr("data-jobid"));
            });

            if (callData.jobs.length > 0) {
                await NWData.reAllocateJobs(foundCourier.courierID, ContactID, callData.jobs);
            }

            await $scope.getData();

            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();
        } catch (error) {
            console.error('Error in reAllocateJobs:', error);
        }
    };

    $scope.resendJobs = async () => {
        try {
            const callData = {
                "call": "redespatchJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
            };

            let foundCourier;

            angular.element("#jobList .active").each(function () {
                const j = $scope.jobList.find(jo => jo.id === angular.element(this).data("jobid"));
                foundCourier = $scope.pickCouriers.find(c => c.courierID === j.courierData.courierID);
                callData.jobs.push(angular.element(this).attr("data-jobid"));
            });

            if (callData.jobs.length > 0) {
                await NWData.resendJobs(callData.jobs);
            }

            await $scope.getData();

            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
        }
    };

    $scope.restoreAll = async () => {
        try {
            let dialog = $mdDialog.confirm()
                .title('Restore All Jobs')
                .textContent('Are you sure you wish to restore all jobs for ' + $scope.currentCourier.courier)
                .ok('Yes')
                .cancel('No');

            await $mdDialog.show(dialog);

            let callData = {
                "call": "restoreJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
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
                await NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs);
            }
            if (callData.jobs.length > 0) {
                await NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
            }

            await new Promise(resolve => $timeout(resolve, 1000));

            await $scope.getCurrentJobs(foundCourier.courierID);
            await $scope.getData();
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
        }
    };

    $scope.redispatchAll = async () => {
        try {
            let dialog = $mdDialog.confirm()
                .title('Restore All Jobs')
                .textContent('Are you sure you wish to redispatch all jobs for ' + $scope.currentCourier.courier)
                .ok('Yes')
                .cancel('No');

            await $mdDialog.show(dialog);

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
                await NWData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
            }

            await $scope.getData();

            angular.element("#box-map").find(".loading").show();
            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
        }
    };

    $scope.resendAll = async () => {
        const dialog = $mdDialog.confirm()
            .title('Resend All Jobs')
            .textContent('Are you sure you wish to resend all jobs for ' + $scope.currentCourier.courier)
            .ok('Yes')
            .cancel('No');

        try {
            await $mdDialog.show(dialog);

            const callData = {
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
                await NWData.resendAllJobs(callData.courierID);
            }

            await $scope.getData();

            angular.element("#box-map").find(".loading").show();
            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();

        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
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
            foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID);
        });

        if (callData.jobs.length > 0) {
            await NWData.reAllocateJobs(callData.courierID, ContactID, callData.jobs);
        }

        try {
            await $scope.getData();

            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();
        } catch (error) {
            console.error("Error in reAllocateJobsFromCurrentWindow:", error);
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

        let foundCourier = null;
        angular.element("#currentWork .active").each(function () {
            callData.jobs.push(angular.element(this).attr("data-jobid"));
            foundCourier = $scope.pickCouriers.find(c => c.courierID === callData.courierID);
        });

        try {
            if (callData.jobs.length > 0) {
                await NWData.resendJobs(callData.jobs);
            }

            await $scope.getData();

            angular.element("#box-map").find(".loading").show();

            $scope.courier = {gpsCourier: foundCourier.id};
            await $scope.searchCourier();
        } catch (error) {
            console.error("Error in resendJobsFromCurrentWindow:", error);
        }
    };

    $scope.restoreJobsFromCurrentWindow = async () => {
        const callData = {
            "call": "restoreJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
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

        try {
            if (callData.splitJobs.length > 0) {
                await NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs);
            }
            if (callData.jobs.length > 0) {
                await NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
            }

            await new Promise(resolve => $timeout(resolve, 1000));

            await $scope.getCurrentJobs(foundCourier.courierID);
            await $scope.getData();
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }

        }
    };

    //////////////////////////////
    //  SPLIT JOB //
    /////////////////////////////
    $scope.splitJob = async () => {
        let jid = angular.element(".activeTable .active").first().data("jobid");
        const firstJob = $scope.jobList.find(jo => jo.id === jid);
        if (!firstJob.allowSplit) {
            await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent(`Cannot split ${firstJob.JobNo}.`).ok('OK'));
            return;
        }

        try {
            await NWData.splitJob(firstJob.id, FirstName);
            await $scope.getData();

            const refreshedJob = $scope.jobList.find(jo => jo.id === firstJob.id);
            await $scope.selectJob(refreshedJob);

            await new Promise(resolve => $timeout(() => {
                angular.element(`#jobList tr[data-jobid='${firstJob.id}']`).addClass("active");

                const $parentDiv = angular.element(`#jobList tr[data-jobid='${firstJob.id}']`).parents(".box-content");
                let goTop = angular.element(`#jobList tr[data-jobid='${firstJob.id}']`).offset().top;

                try {
                    goTop = goTop - $parentDiv.offset().top + $parentDiv.scrollTop() - 28;
                    $parentDiv.scrollTop(goTop);
                } catch (e) {
                    //ignore
                }

                resolve();
            }, 1000));
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
        }
    };

    //////////////////////////////
    //  PALLET CONTROLS //
    /////////////////////////////
    $scope.palletMenu = [// NEW IMPLEMENTATION
        {
            text: "Delete", click: ($itemScope) => {
                const index = $scope.currentJob.PalletInfo.indexOf($itemScope.pallet);
                $scope.currentJob.PalletInfo.splice(index, 1);
            }
        }];


    //ACTIVATE DROP
    $scope.activateDrop = () => {
        $timeout(() => {

            $document.on('ready', () => {
                angular.element(".droppable-row").droppable({
                    classes: {
                        "ui-droppable-hover": "active"
                    }, drop: function () {
                        const parent = angular.element(this).parents(".box");
                        const parentOffset = parent.offset();
                        const parentTop = parentOffset.top;
                        const parentBottom = parentTop + parent.outerHeight();

                        const row = angular.element(this);
                        const rowOffset = row.offset();
                        const rowTop = rowOffset.top;
                        const rowBottom = rowTop + row.outerHeight();

                        if (rowTop < parentBottom && rowBottom > parentTop) {
                            angular.element(this).css({"background-color": "#c6dfad"});
                            angular.element(this).animate({backgroundColor: "inherit"}, 300, function () {
                                angular.element(this).removeAttr("style");
                            });

                            $scope.dispatchJobs(angular.element(this).attr("data-courier").replace(/[^\d.-]/g, ''));
                        }
                    }
                });
            });
        }, 0);
    };

    ////////////////////////////
    // POTENTIAL COURIERS
    ////////////////////////////

    /**
     * @param {number} jobId
     */
    $scope.getPotentialCouriers = (jobId) => {
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
    $scope.searchCourier = async () => {
        angular.element("#box-currentWork").find(".loading").show();
        angular.element("#box-map").find(".loading").show();
        const ac = $scope.pickCouriers.find(c => c.id === $scope.courier.gpsCourier);
        console.log(ac);
        if (ac === undefined) {
            angular.element("#box-currentWork").find(".loading").fadeOut();
            angular.element("#box-map").find(".loading").show();
            await $mdDialog.show($mdDialog.alert().clickOutsideToClose(true).title('Error').textContent('Courier not found').ok('OK'));
            return;
        }
        $scope.currentWorkSelection = " for Courier " + ac.id + " " + ac.name;
        $scope.currentCourier = {
            courierID: ac.courierID, courier: ac.label
        };

        $scope.currentSelection = " for Courier " + ac.id + " " + ac.name;
        await $scope.getCurrentJobs(ac.courierID);
    };

    // Select the courier
    $scope.selectCourier = async (courier) => {
        jdSvc.jobDetailLoading = true;
        angular.element("#box-map").find(".loading").show();
        if (courier.courier === undefined) {
            courier.courier = courier.code + ' ' + courier.firstName;
        }
        console.log(courier);
        await $scope.getCurrentJobs(courier.courierID);
        $scope.currentWorkSelection = " for Courier " + courier.courier;

        //SHOW MAP
        $scope.currentCourier = courier;

        await new Promise(resolve => $timeout(resolve, 100));
        $document.ready(() => {
            jdSvc.jobDetailLoading = false;
            angular.element("#box-map").find(".loading").fadeOut();
        });

        try {
            const result = await NWData.truckCourierStatus(courier.courierID);
            $scope.truckCourierStatus = result.data;
        } catch (error) {
            console.error("Error fetching truck courier status:", error);
            // Handle the error appropriately
        }
    };

    $scope.refreshTruckCourierStatus = async () => {
        try {
            const result = await NWData.truckCourierStatus($scope.currentCourier.courierID);
            $scope.truckCourierStatus = result.data;
        } catch (error) {
            console.error("Error refreshing truck courier status:", error);
            // Handle the error appropriately
        }
    };

    $scope.selectMapCourier = async (courier) => {
        jdSvc.jobDetailLoading = true;
        angular.element("#box-map").find(".loading").show();

        angular.element("#box-currentWork").find(".loading").show();
        const foundCourier = $scope.pickCouriers.find(x => x.courierID === courier.courierID);
        $scope.currentCourier = {
            courierID: foundCourier.courierID, courier: foundCourier.label
        };

        try {
            const data = await NWData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done");
            angular.element("#box-currentWork").find(".loading").fadeOut();

            $scope.jobsCurrentList = data;
            if (data.length > 0) {
                await displayRoutePointsOnly(data, false, $scope.mapZoom.display);
            }
            $scope.activateDrop();
            await new Promise(resolve => $timeout(resolve, 1000));
            await new Promise(resolve => $timeout(resolve, 1000));
        } catch (error) {
            console.error("Error in selectMapCourier:", error);
            // Handle the error appropriately
        }

        $scope.currentWorkSelection = " for Courier " + courier.label;

        await new Promise(resolve => $timeout(resolve, 100));
        $document.ready(() => {
            jdSvc.jobDetailLoading = false;
            angular.element("#box-map").find(".loading").fadeOut();
        });

        try {
            $scope.truckCourierStatus = await NWData.truckCourierStatus(courier.courierID);
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
        }
    };
    $scope.selectPotentialCourier = async (courier) => {
        jdSvc.jobDetailLoading = true;
        angular.element("#box-map").find(".loading").show();
        if (courier.courier === undefined) {
            courier.courier = courier.code + ' ' + courier.firstName;
        }

        if ($scope.jobList.length > 0) {
            const jid = angular.element("#jobList .active").last().data("jobid");
            const currentJob = $scope.jobList.find(jo => jo.id === jid);
            const undespatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
            await displayPickupPoints(undespatchedData, true, currentJob);
        }

        angular.element("#box-currentWork").find(".loading").show();
        const code = $scope.pickCouriers.find(x => x.courierID === courier.courierID).id;

        try {
            const data = await NWData.getJobsCurrent(courier.courierID, $scope.jobFilters.status === "done");
            angular.element("#box-currentWork").find(".loading").fadeOut();
            if ($scope.currentJob !== null && $scope.currentJob.courier !== code) {
                $scope.currentJob = null;
            }
            $scope.jobsCurrentList = data;
            if (data.length > 0) {
                await displayRoutePoints(data, false);
            } else {
                const posData = await NWData.getCourierPosition(code);
                await displayCourierPositionOnly(posData.latitude, posData.longitude);
            }
            $scope.activateDrop();
            await new Promise(resolve => $timeout(resolve, 1000));
            await new Promise(resolve => $timeout(resolve, 1000));
            await $scope.getAvailableCourierLocation();
        } catch (error) {
            console.error("Error in selectPotentialCourier:", error);
        }

        $scope.currentWorkSelection = " for Courier " + courier.courier;
        $scope.currentCourier = courier;

        await new Promise(resolve => $timeout(resolve, 100));
        $document.ready(() => {
            jdSvc.jobDetailLoading = false;
            angular.element("#box-map").find(".loading").fadeOut();
        });
    };

    ////////////////////////////
    // CURRENT JOBS
    ////////////////////////////

    /**
     * @param {number} courierId
     */
    $scope.getCurrentJobs = async (courierId) => {
        try {
            const $boxCurrentWork = angular.element("#box-currentWork");
            $boxCurrentWork.find(".loading").show();

            const foundCourier = $scope.pickCouriers.find(x => x.courierID === courierId);
            const code = foundCourier ? foundCourier.id : "";

            const data = await NWData.getJobsCurrent(courierId, $scope.jobFilters.status === "done");

            $boxCurrentWork.find(".loading").fadeOut();

            $scope.jobsCurrentList = data;

            if (data.length > 0) {
                displayRoutePoints(data, true);
            } else {
                const posData = await NWData.getCourierPosition(code);
                displayCourierPositionOnly(posData.latitude, posData.longitude);
            }

            $scope.activateDrop();

            $timeout(() => sizeHeadings(), 1000);

        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
            }
        }
    };

    $scope.selectJobDetail = job => {
        $scope.currentJob = job;
        $scope.currentSupport = null;
        $scope.potentialCouriers = false;
        $scope.potentialCouriersSelection = " for Job " + job.jobNo;
    };

    $scope.selectSupportJobDetail = async (support) => {
        try {
            console.log("select Job  " + support.jobId);

            $scope.currentSupport = support;
            jdSvc.jobDetailLoading = true;


            $scope.currentJob = await NWData.getJobDetail(support.jobId);
            jdSvc.jobDetailLoading = false;
            $scope.currentSelection = " for Job " + support.jobNumber;

            const jobs = [$scope.currentJob];
            displayRoutePointsOnly(jobs, true, $scope.mapZoom.display);

            if ($scope.mapZoom.display) {
                setMapBounds();
                map.setZoom(12);
            }
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error(error);
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
            console.error("Error in loadRelatedJobDetail:", error);
        }
    };

    /**
     * Handles sending a quote request to an agent
     * @param {Object} $event - The event object
     * @param {Agent} agent - The agent to send the quote request to
     * @param {Job} job - The job to request a quote for
     */
    $scope.sendQuoteRequest = async ($event, agent, job) => {
        try {
            // Show confirmation dialog
            const confirm = $mdDialog.confirm()
                .title('Send Quote Request')
                .textContent(`Are you sure you want to send a quote request to ${agent.agentName} for job ${job.jobNo}?`)
                .ariaLabel('confirm send quote request')
                .targetEvent($event)
                .ok('Send')
                .cancel('Cancel');

            await $mdDialog.show(confirm);

            // Call API to send quote request
            // Replace with actual implementation
            // await NWData.sendQuoteRequest(job.id, agent.agentId);

            toastrService.showSuccessToast(`Quote request sent to ${agent.agentName}`);
        } catch (error) {
            if (error !== undefined) {
                console.error('Error sending quote request:', error);
                toastrService.showErrorToast('Failed to send quote request');
            }
        }
    };

    /**
     * @async
     * @param {Job} job
     */
    $scope.selectJob = async (job) => {
        try {
            await new Promise(resolve => $timeout(resolve, 0));

            // Store the previously selected job before updating
            const previousJob = $scope.currentJob;

            if (previousJob && previousJob.id !== job.id) {
                angular.element(`[data-jobid="${previousJob.id}"]`).removeClass('active-job');
            }

            if (job) {
                angular.element(`[data-jobid="${job.id}"]`).addClass('active-job');
                $scope.getSelectedStatusText();
            }

            _processActiveTable();
            _initializeJob(job);

            // Show flight table
            if (job.toAirportId && job.fromAirportId) {
                await _processFlights(job);
            }

            // Show agent table
            if ($scope.isDeliveryJob()) {
                await $scope.processAgents(job);
            }

            _displayJobOnMap(job);

            $scope.$apply();
            jdSvc.jobDetailLoading = false;
        } catch (error) {
            console.error("Error in selectJob:", error);
        }
    };

    /**
     * @param {Job} job
     * @private
     */
    function _displayJobOnMap(job) {
        try {
            $scope.mapConfig = calculateMapBounds(job);
            console.log('Calculated map bounds!');
            console.log($scope.mapConfig);
        } catch (error) {
            console.error(error);
            toastrService.showErrorToast('An unexpected error occured displaying this job on the map');
        }
    }

    /**
     * @param {Job} job
     * @private
     */
    function calculateMapBounds(job) {
        // Extract coordinates
        const pickupCoords = {
            lat: job.pickUpLatitude, lng: job.pickUpLongitude
        };
        const deliveryCoords = {
            lat: job.deliveryLatitude, lng: job.deliveryLongitude
        };

        // Calculate the center point between pickup and delivery
        const centerLat = (pickupCoords.lat + deliveryCoords.lat) / 2;
        const centerLng = (pickupCoords.lng + deliveryCoords.lng) / 2;

        // Calculate the appropriate zoom level
        const latDiff = Math.abs(pickupCoords.lat - deliveryCoords.lat);
        const lngDiff = Math.abs(pickupCoords.lng - deliveryCoords.lng);

        // Use the larger difference to determine zoom
        const maxDiff = Math.max(latDiff, lngDiff);

        // Zoom calculation - adjusted for larger distances
        let zoom;
        if (maxDiff > 40) zoom = 3; else if (maxDiff > 20) zoom = 4; else if (maxDiff > 10) zoom = 5; else if (maxDiff > 5) zoom = 6; else if (maxDiff > 2) zoom = 7; else if (maxDiff > 1) zoom = 8; else if (maxDiff > 0.5) zoom = 9; else if (maxDiff > 0.1) zoom = 10; else zoom = 12;

        return {
            center: {
                lat: centerLat, lng: centerLng
            }, zoom: zoom, job: {
                id: job.id, pickup: pickupCoords, delivery: deliveryCoords, childJobs: {}
            }, selectedJobIndex: 0
        };
    }

    /**
     * @async
     * @private
     * Get and process flight options for table
     * @param {Job} job
     */
    async function _processFlights(job) {
        console.log('Getting flights');

        $scope.flightsLoading = true;

        const result = await NWData.getFlightOptions(job.id, job.booked);
        $scope.flightOptions = result.flights;
        console.log("Flight options:", result.flights);
        $scope.flightMessage = result.message;
        $scope.flightError = result.error;

        $scope.flightsLoading = false;
    }

    /**
     * Determines if the current job is a delivery job.
     * @returns {boolean} True if the current job is a delivery job, false otherwise.
     */
    $scope.isDeliveryJob = () => {
        if (!$scope.currentJob || !$scope.currentJob.jobNo) {
            return false;
        }

        const jobNumber = $scope.currentJob.jobNo;
        const isDeliveryJob = jobNumber.charAt(jobNumber.length - 1) === '1' || jobNumber.charAt(jobNumber.length - 1) === '3';

        console.log(jobNumber + " is delivery job!");
        return isDeliveryJob;
    }

    /**
     * Choose flight icon based on stage
     * @param {string} jobNumber
     */
    $scope.getFlightIcon = jobNumber => {
        if (!jobNumber) return '';

        const lastChar = jobNumber.toString().slice(-1);

        switch (lastChar) {
            case '1':
                return 'flight_takeoff';
            case '2':
                return 'local_airport';
            case '3':
                return 'flight_land';
            default:
                return '';
        }
    };

    /**
     * @async
     * @private
     * Get and process agent options for table
     * @param {Job} job
     */
    $scope.processAgents = async (job) => {
        console.log('Getting agents');

        $scope.agentsLoading = true;
        $scope.agentListPromise = NWData.getAgentOptions(job.id);

        try {
            const result = await $scope.agentListPromise;
            $scope.agentOptions = result.agents;
            console.log("Agent options:", result.agents);
            $scope.agentMessage = result.message;
            $scope.agentError = result.error;
        } catch (error) {
            console.error("Error fetching agents:", error);
            $scope.agentError = "Failed to retrieve agents. Please try again.";
        } finally {
            $scope.agentsLoading = false;
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        }
    };

    function _processActiveTable() {
        $scope.selectedJobs = [];
        $scope.currentSupport = null;
        angular.element(".activeTable .active").each(function () {
            angular.element(this).find(".selectjob").click();
            $scope.selectedJobs.push($scope.jobForDispatch.ID);
        });
        console.log("selectJob");
    }

    /**
     * @param {Job} job
     */
    function _initializeJob(job) {
        $scope.currentJob = job;
        $scope.$apply();
        console.log(job);
        return jdSvc.setJob($scope.currentJob);
    }

    /**
     * @async
     * @function updateData
     * @param {Object} job - The job object to update
     * @param {boolean} clear - Flag to determine if settings should be cleared
     */
    async function updateData(job, clear) {
        try {
            const [activeCouriers, relatedJobs] = await Promise.all([NWData.getActiveCouriers(), job.rootParentID ? NWData.getRelatedJobs(job.rootParentID, job.clientId) : Promise.resolve([])]);

            $scope.pickCouriers = activeCouriers;

            if (job.rootParentID) {
                $scope.currentJob.relatedJobs = relatedJobs;
            }

            if (clear === true && job.courier === null) {
                await processClearSettings(job);
                displayRoutePoints([job], false);
            } else {
                $scope.potentialCouriers = false;
                await $scope.selectCourier(job.courierData);
            }

            $scope.currentCourier = null;
            $scope.currentSelection = " for Job " + job.jobNo;
            const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
            displayPickupPoints(unDispatchedData, true, job);

        } catch (error) {
            console.error("Error in updateData:", error);
        }
    }

    /**
     * @param {Job} job
     */
    async function processClearSettings(job) {
        clearSettings(job);
        $scope.potentialCouriersSelection = " for Job " + job.jobNo;
        $scope.groupJobsSelection = " for Job " + job.jobNo;
        $scope.currentWorkSelection = "";
    }

    /**
     * @param {Job} job
     */
    function clearSettings(job) {
        $scope.getPotentialCouriers(job.id);
        $scope.jobGroups = false;
        $scope.jobsCurrentList = false;
    }

    /**
     * Updates flight loading to use the progress indicator with the table
     */
    $scope.loadNextFlights = async () => {
        $scope.flightsLoading = true;
        $scope.flightError = null;
        $scope.flightListPromise = NWData.getFlightOptions($scope.currentJob.id, $scope.currentSearchTime);

        try {
            if ($scope.flightOptions && $scope.flightOptions.length > 0) {
                let lastFlight = $scope.flightOptions[$scope.flightOptions.length - 1];
                $scope.currentSearchTime = moment(lastFlight.departureTime, 'YYYY-MM-DDTHH:mm:ss')
                    .format('YYYY-MM-DDTHH:mm:ss');
            }

            const result = await $scope.flightListPromise;

            $scope.flightOptions = result.flights;
            console.log("Flight options:", result.flights);
            $scope.flightMessage = result.message;
            $scope.flightError = result.error;
        } catch (error) {
            console.error(error);
            toastrService.showErrorToast("An unexpected error occurred retrieving flights");
        } finally {
            $scope.flightsLoading = false;
            $scope.$apply();
        }
    };

    $scope.loadNextDayFlights = async () => {
        $scope.flightsLoading = true;
        $scope.flightError = null;

        try {
            const newDate = moment($scope.currentSearchTime, 'YYYY-MM-DDTHH:mm:ss')
                .add(1, 'days')
                .startOf('day')
                .format('YYYY-MM-DDTHH:mm:ss');

            const result = await NWData.getFlightOptions($scope.currentJob.id, newDate);

            $scope.currentSearchTime = newDate;
            $scope.flightOptions = result.flights;
            console.log("Flight options:", result.flights);
            $scope.flightMessage = result.message;
            $scope.flightError = result.error;
        } catch (error) {
            console.error(error);
            toastrService.showErrorToast("An unexpected error occured retrieving flights");
        } finally {
            $scope.flightsLoading = false;
            $scope.$apply();
        }
    };

    /**
     * @param {Object} $event
     * @param {FlightOptions} flight
     * @param {Job} job
     */
    $scope.addFlightToJob = async ($event, flight, job) => {
        try {
            const confirm = $mdDialog.confirm()
                .title('Assign Flight')
                .textContent(`You are assigning to Job ${job.jobNo} to ${flight.flightNumber}. Please confirm this is correct.`)
                .ariaLabel('confirm assign flight to job')
                .targetEvent($event)
                .ok('Confirm')
                .cancel('Cancel');

            await $mdDialog.show(confirm);
            console.log('Assigning to job');

            // Store the previous internal status ID before updating
            const previousInternalStatusId = job.internalStatusId ?? 1;

            // Determine which lists need to be refreshed based on previous status
            const listsToRefresh = new Set([$scope.jobDataType.POD]); // Always refresh POD list

            // Map internal status IDs to job data types using the STATUS_TO_LIST_MAP
            if (STATUS_TO_LIST_MAP[previousInternalStatusId]) {
                STATUS_TO_LIST_MAP[previousInternalStatusId].forEach(type => listsToRefresh.add(type));
            }

            // Assign the flight
            await NWData.assignFlightToJob(job.id, flight.flightNumber, flight.departureTime);

            // Refresh the determined lists
            await getJobList(Array.from(listsToRefresh));

            // Find the updated job in either the new jobs list or POD list
            let updatedJob = $scope.jobListPOD?.find(j => j.id === job.id);

            if (updatedJob) {
                await $scope.selectJob(updatedJob);
            }

            const successMessage = `Successfully assigned flight ${flight.flightNumber} to job ${job.jobNo}`;
            toastrService.showSuccessToast(successMessage);

        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error('Error assigning flight to job:', error);
            }
        }
    };

    /**
     * @param {Object} $event
     * @param {Agent} agent
     * @param {Job} job
     */
    $scope.addAgentToJob = async ($event, agent, job) => {
        try {
            const confirm = $mdDialog.confirm()
                .title('Assign Agent')
                .textContent(`You are assigning Job ${job.jobNo} to ${agent.agentName}. Please confirm this is correct.`)
                .ariaLabel('confirm assign flight to job')
                .targetEvent($event)
                .ok('Confirm')
                .cancel('Cancel');

            await $mdDialog.show(confirm);
            console.log('Assigning to job');

            await NWData.assignAgentToJob(job.id, agent.agentId);

            // Refresh both new jobs and POD lists since flight assignment can affect both
            await getJobList([$scope.jobDataType.NEW, $scope.jobDataType.POD]);

            const successMessage = (`Successfully assigned agent ${agent.agentName} to job ${job.jobNo}`)
            toastrService.showSuccessToast(successMessage)
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error('Error assigning flight to job:', error);
            }
        }
    };

    $scope.fromColumnClick = $event => {
        switch ($event.which) {
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

    $scope.toColumnClick = $event => {
        switch ($event.which) {
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

    $scope.latePickColumnClick = $event => {
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
                    const dueTime = moment($scope.currentJob.booked).add($scope.currentJob.lp || $scope.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');
                    const items = [];
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
                        }, submit: async () => {
                            const pickupETAValue = parseInt($scope.lateForm.choose.value);
                            const dueMins = moment($scope.currentJob.booked).add($scope.currentJob.lp || $scope.currentJob.pickupTime, "minutes").diff(moment(), 'minutes');

                            if ($scope.currentJob.lp !== pickupETAValue) {
                                const window = $scope.currentJob.lp || $scope.currentJob.pickupTime;
                                const lateMins = pickupETAValue - dueMins + window;
                                $scope.currentJob.lp = lateMins;
                                console.log(lateMins);
                                await $scope.lateCall(lateMins, 1, $scope.currentJob, false);
                                $scope.lateForm.data = null;
                                angular.element("#AwayMins").select2().empty();
                                angular.element("#AwayMins").select2('destroy');
                                angular.element(".lateForm").hide(0)
                            }
                        }, cancel: () => {
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

    /**
     * @param {Object} $event
     */
    $scope.speedColumnClick = ($event) => {
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

    /**
     * @param {Object} $event
     */
    $scope.clientColumnClick = ($event) => {
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

    /**
     * @param {Object} $event
     */
    $scope.notifyColumnClick = ($event) => {
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
                break;

        }
        return false;
    };

    /**
     * Creates and returns the context menu items for job events
     * @param {Event} $event - The triggering event object
     * @returns {Promise<Array<Object>>} Array of menu items
     */
    $scope.setEventsMenu = $event => [{
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

    $scope.setJobsMenu = async () => {
        const multiple = angular.element(".activeTable .active").length > 1;
        let lastCourier = null;
        let sameCourier = true;

        const activeElements = angular.element(".activeTable .active");
        for (let i = 0; i < activeElements.length; i++) {
            const element = activeElements[i];
            const jobId = angular.element(element).data("jobid");
            const j = $scope.jobList.find(jo => jo.id === jobId);
            if (lastCourier !== null && lastCourier !== j.courier) {
                sameCourier = false;
                break;
            }
            lastCourier = j.courier;
        }

        console.log("same courier =" + sameCourier + " last courier =" + lastCourier);
        if (!sameCourier) {
            return [];
        }

        let multipleMenu = [{
            text: "Dispatch Selected", click: async () => {
                await $scope.dispatchJobsForm();
            }
        }, {
            text: "Re-dispatch Selected", click: async () => {
                // Async operation might be needed here
            }
        }];

        if (sameCourier) {
            multipleMenu.push({
                text: "Restore Selected", click: async () => {
                    await $scope.restoreJobs();
                }
            }, {
                text: "Redispatch Selected", click: async () => {
                    await $scope.reAllocateJobs();
                }
            }, {
                text: "Resend Selected", click: async () => {
                    await $scope.resendJobs();
                }
            });
        }

        if (sameCourier && lastCourier === null) {
            multipleMenu = [{
                text: "Dispatch Selected", click: async () => {
                    await $scope.dispatchJobsForm();
                }
            }];
        }

        const fullMenu = [{
            text: "Dispatch", click: async () => {
                await $scope.dispatchJobsForm();
            }
        }];

        if (lastCourier !== null) {
            multipleMenu.shift();
            multipleMenu.shift();
            fullMenu.shift();
            fullMenu.push({
                text: "Restore", click: async () => {
                    await $scope.restoreJobs();
                }
            }, {
                text: "Redispatch", click: async () => {
                    await $scope.reAllocateJobs();
                }
            }, {
                text: "Resend", click: async () => {
                    await $scope.resendJobs();
                }
            });
        }

        return multiple ? multipleMenu : fullMenu;
    };

    $scope.setTruckMode = async mode => {
        $scope.truckMode = mode;
        await $scope.getData();
    };

    $scope.setSupportChannel = async channel => {
        $scope.supportChannel = channel;
        await $scope.getSupports();
    };

    $scope.getAvailableCourierLocation = () => {
        // Todo: Update courier location for new US based implementation
    };

    $scope.totalJobCount = 0;
    $scope.totalPodCount = 0;
    $scope.totalRepriceCount = 0;
    $scope.totalDeliveryCount = 0;

    /**
     * Gets job list data for specified data types
     * @param {JobDataType|JobDataType[]} dataTypes - Single data type or array of data types to fetch
     * @returns {Promise<void>}
     */
    async function getJobList(dataTypes = $scope.jobDataType.ALL) {
        const selectedClients = $scope.pickService.clients.map(a => a.id);
        const types = Array.isArray(dataTypes) ? dataTypes : [dataTypes];
        const requestedTypes = types.includes($scope.jobDataType.ALL) ?
            Object.values($scope.jobDataType).filter(type => type !== $scope.jobDataType.ALL) :
            types;

        try {
            // Set loading states
            const loadingStates = {
                [$scope.jobDataType.NEW]: () => {
                    $scope.jobListLoading = true;
                    $scope.jobListPromise = NWData.getNationwideJobsNew(
                        $scope.jobFilters,
                        selectedClients,
                        $scope.isInternal,
                        $scope.selectedViews
                    );
                },
                [$scope.jobDataType.DELIVERY]: () => $scope.deliveryListLoading = true,
                [$scope.jobDataType.POD]: () => $scope.podListLoading = true,
                [$scope.jobDataType.REPRICE]: () => $scope.repriceListLoading = true
            };
            requestedTypes.forEach(type => loadingStates[type]?.());

            // Define fetch functions for each type
            const fetchMap = {
                [$scope.jobDataType.NEW]: {
                    fetch: () => $scope.jobListPromise,
                    updateScope: (result) => {
                        if (result && result.items) {
                            $scope.jobList = result.items;
                            $scope.totalJobCount = result.total || result.items.length;
                        } else {
                            $scope.jobList = result || [];
                            $scope.totalJobCount = (result || []).length;
                        }
                        $scope.jobListLoading = false;
                    }
                },
                [$scope.jobDataType.POD]: {
                    fetch: () => {
                        $scope.podListPromise = NWData.getNationwideJobsPOD(
                            $scope.jobPodFilters,
                            selectedClients,
                            $scope.isInternal,
                            $scope.selectedViews
                        );
                        return $scope.podListPromise;
                    },
                    updateScope: (result) => {
                        if (result && result.items) {
                            $scope.jobListPOD = result.items;
                            $scope.totalPodCount = result.total || result.items.length;
                        } else {
                            $scope.jobListPOD = result || [];
                            $scope.totalPodCount = (result || []).length;
                        }
                        $scope.podListLoading = false;
                    }
                },
                [$scope.jobDataType.REPRICE]: {
                    fetch: () => {
                        $scope.repriceListPromise = NWData.getNationwideJobsReprice(
                            $scope.jobRepriceFilters,
                            selectedClients,
                            $scope.isInternal,
                            $scope.selectedViews
                        );
                        return $scope.repriceListPromise;
                    },
                    updateScope: (result) => {
                        if (result && result.items) {
                            $scope.jobListReprice = result.items;
                            $scope.totalRepriceCount = result.total || result.items.length;
                        } else {
                            $scope.jobListReprice = result || [];
                            $scope.totalRepriceCount = (result || []).length;
                        }
                        $scope.repriceListLoading = false;
                    }
                },
                [$scope.jobDataType.DELIVERY]: {
                    fetch: () => {
                        $scope.deliveryListPromise = NWData.getNationwideJobsBookDelivery(
                            $scope.jobDeliveryFilters,
                            selectedClients,
                            $scope.isInternal,
                            $scope.selectedViews
                        );
                        return $scope.deliveryListPromise;
                    },
                    updateScope: (result) => {
                        if (result && result.items) {
                            $scope.jobListDelivery = result.items;
                            $scope.totalDeliveryCount = result.total || result.items.length;
                        } else {
                            $scope.jobListDelivery = result || [];
                            $scope.totalDeliveryCount = (result || []).length;
                        }
                        $scope.deliveryListLoading = false;
                    }
                }
            };

            // Execute promises and store results with their types
            const promises = requestedTypes.map(async type => ({
                type, data: await fetchMap[type].fetch()
            }));

            const results = await Promise.all(promises);

            // Update scope with results
            results.forEach(({type, data}) => {
                fetchMap[type].updateScope(data);
            });

            if (!$scope.$$phase) {
                $scope.$apply();
            }

            // Handle additional tasks for delivery data
            if (requestedTypes.includes($scope.jobDataType.DELIVERY)) {
                await $scope.getAvailableCourierLocation();
            }

            // Run size headings if any data was fetched
            if (results.length > 0) {
                $timeout(() => sizeHeadings(), 1000);
            }
        } catch (error) {
            console.error("Error fetching job data:", error);

            // Reset loading states
            requestedTypes.forEach(type => {
                switch (type) {
                    case $scope.jobDataType.NEW:
                        $scope.jobListLoading = false;
                        break;
                    case $scope.jobDataType.DELIVERY:
                        $scope.deliveryListLoading = false;
                        break;
                    case $scope.jobDataType.POD:
                        $scope.podListLoading = false;
                        break;
                    case $scope.jobDataType.REPRICE:
                        $scope.repriceListLoading = false;
                        break;
                }
            });

            $scope.$apply();
        }
    }

    $scope.closeSupport = async (support) => {
        try {
            await NWData.closeSupport(support.eventId, ContactID);
            await $scope.getSupports();
            $scope.currentSupport = null;
        } catch (error) {
            console.error("Error closing support:", error);
        }
    };

    $scope.lockSupport = async (support) => {
        console.log(support);
        try {
            if (support.lockedBy === Dispatcher) {
                await NWData.unLockSupport(support.eventId, Dispatcher);
            } else {
                await NWData.lockSupport(support.eventId, Dispatcher);
            }
            await $scope.getSupports();
        } catch (error) {
            console.error("Error locking/unlocking support:", error);
        }
    };

    $scope.getSupports = async () => {
        ////////////////////////////
        // SUPPORTS
        ////////////////////////////
        angular.element("#box-supports").find(".loading").show();

        try {
            $scope.supports = await NWData.getSupports($scope.supportChannel);

            $scope.supportMenu = [{
                text: "Complete", click: ($itemScope) => {
                    $scope.closeSupport($itemScope.support);
                }
            }, {
                text: "Toggle Lock", click: ($itemScope) => {
                    $scope.lockSupport($itemScope.support);
                }
            }];

            await $timeout(() => {
                $document.on('ready', () => {
                    angular.element("#box-supports").find(".loading").fadeOut();
                    if ($scope.currentSupport) {
                        angular.element("#supports tr[data-id='" + $scope.currentSupport.eventId + "']").addClass("active");
                    }
                });
            }, 100);

            $timeout(() => sizeHeadings(), 1000);
        } catch (error) {
            console.error("Error fetching supports:", error);
        }
    };

    $scope.getClientContacts = async () => {
        try {
            $scope.pickClients = await NWData.getClientContacts(ContactID);
        } catch (error) {
            console.error("Error fetching client contacts:", error);
        }
    };

    $scope.getEventTypes = async () => {
        try {
            $scope.pickEventTypes = await NWData.getEventTypes();
        } catch (error) {
            console.error("Error fetching event types:", error);
        }
    };

    $scope.getData = async () => {
        angular.element("#box-jobsList").find(".loading").show();

        // Clear data once
        $scope.jobList = [];
        $scope.jobListPOD = [];
        $scope.currentJob = false;
        $scope.potentialCouriers = false;
        $scope.jobGroups = false;
        $scope.jobsCurrentList = false;
        $scope.currentCourier = false;

        try {
            // Fetch active couriers
            $scope.pickCouriers = await NWData.getActiveCouriers();

            ///////////////////////////
            // JOB DETAIL
            //////////////////////////
            await getJobList($scope.jobDataType.ALL);
        } catch (error) {
            console.error("Error in getData:", error);
        }
    };

    /////////////////////////
    // JOB DETAILS
    /////////////////////////
    $scope.detailAddressMenu = [{
        text: "Update GPS", click: ($itemScope, $event) => {
            console.log($event.currentTarget.attributes["data-field"].nodeValue);
            $scope.jdSvc.updateGPS($scope.currentJob, $event.currentTarget.attributes["data-field"].nodeValue);
        }
    }];

    $scope.closeSupport = async (support) => {
        try {
            await DispatchData.closeSupport(support.eventId, ContactID);
            await $scope.getSupports();
            $scope.currentSupport = null;
        } catch (error) {
            console.error("Error in closeSupport:", error);
        }
    };

    /**
     * @param  {Object}  $event
     * @param  {Job}  job
     */
    $scope.createEvent = async ($event, job) => {
        try {
            await $mdDialog.show({
                controller: 'AddEventDialogController',
                controllerAs: "ctrl",
                templateUrl: "app/components/dialogs/add-event-dialog/add-event-dialog.html",
                parent: $document.body,
                targetEvent: $event,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    job: job, dispatcherName: FirstName, contactId: ContactID
                },
                bindToController: true
            });

            await $scope.getData();
            console.log('Pallet Dialog closed!');
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error("Error in createEvent:", error);
            }
        }
    };

    /**
     * @param  {Object}  $event
     */
    $scope.truckLoadingStatus = async ($event) => {
        try {
            await $mdDialog.show({
                controller: 'TruckCourierStatusDialogController',
                controllerAs: 'ctrl',
                parent: $document.body,
                targetEvent: $event,
                templateUrl: "app/components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    data: $scope.truckCourierStatus[0],
                },
                bindToController: true
            });
        } catch (error) {
            if (error === undefined) {
                console.log('User canceled!');
            } else {
                console.error("Error in truckLoadingStatus:", error);
            }
        }
    };

    /**
     * @param {string} searchText
     */
    $scope.courierSearch = searchText => {
        try {
            const url = "/courier/AllActiveSearch";
            return DispatchData.autocompleteSearch(searchText, url);
        } catch (error) {
            console.error(error.message);
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

    /**
     * Determines the CSS classes to apply to a job row
     * @param {Job} job - The job object
     * @returns {string} Space-separated list of CSS classes
     */
    $scope.jobClass = (job) => {
        if (!job || !job.followupTime) {
            return '';
        }

        // Add time-based status class
        const followupTime = moment(job.followupTime);
        const now = moment();
        const diffMinutes = followupTime.diff(now, 'minutes');

        if (diffMinutes > 30) {
            return 'status-future';
        } else if (diffMinutes < -30) {
            return 'status-past';
        } else {
            return 'status-current';
        }
    };
}

NationwideControl.$inject = [
    '$scope',
    'JobDetailService',
    'NWData',
    '$state',
    '$filter',
    'hotkeys',
    '$timeout',
    'greetingService',
    '$mdDialog',
    '$document',
    'toastrService',
    'DispatchData',
    'moment',
    '$mdSidenav',
    'AppPages',
    'APP_CONFIG',
    '$mdEditDialog',
    'NationwideLayoutService',
    '$mdMenu',
    'dispatchJobService'
];

app.controller('NationwideControl', NationwideControl);
export default NationwideControl;

/**
 * Converts degrees to radians.
 * @param {number} deg - The angle in degrees.
 * @returns {number} The angle in radians.
 */
function Deg2Rad(deg) {
    return deg * Math.PI / 180;
}

/**
 * Calculates the distance between two points on Earth using the Pythagorean theorem on an equirectangular projection.
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
    const R = 6371; // km
    const x = (lon2 - lon1) * Math.cos((lat1 + lat2) / 2);
    const y = (lat2 - lat1);
    return Math.sqrt(x * x + y * y) * R;
}

/**
 * Finds the closest location from a list of locations to a given latitude and longitude.
 * @param {number} latitude - The latitude of the reference point.
 * @param {number} longitude - The longitude of the reference point.
 * @param {Array<Array<*>>} locations - An array of locations. Each location should be an array where the second element is latitude and the third element is longitude.
 * @returns {Array<*>} The closest location from the list.
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
