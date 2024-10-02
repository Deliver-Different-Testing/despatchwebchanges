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
    "materialSidenavService",
    "AppPages",
    ($scope, jdSvc, NWData, $state,
     $filter, $parse, hotkeys, NgMap, $q, $timeout, greetingService,
     $mdDialog, $document, $window, toastrService, DispatchData, moment, versionUrl, materialSidenavService, AppPages) => {
        $scope.jdSvc = jdSvc;

        $scope.initializeVariables = () => {
            $scope.name = "Nationwide";
            $scope.isInternal = (ClientInternal === "True");
            $scope.jobDetailFabIsOpen = false;
            $scope.courierListFabIsOpen = false;

            $scope.filters = {
                active: false, done: false, all: true
            };

            $scope.jobFilters = {
                order: 'time',
                filter: '',
                status: 'all',
                asc: 'asc'
            };
        };

        $scope.toggleSidenav = () => {
            materialSidenavService.toggle();
        };

        $scope.greetUser = () => greetingService.greetUser($scope.userName)

        $scope.loadPageViews = async () => {
            try {
                $scope.areas = await DispatchData.getSelectedViews(ContactID, AppPages.Domestic);
                $scope.initializeAreas();
                await $scope.updateFilters();

                if (!$scope.isInternal) {
                    await $scope.getClientContacts();
                }

                await $scope.getEventTypes();
                await $scope.getData();
            } catch (error) {
                console.error('Error fetching dispatch views:', error);
                // Initialize areas with an empty array if fetch fails
                $scope.areas = [];
                $scope.initializeAreas();
                console.log("Failed to load dispatch views. Please try refreshing the page.");
            }
        };

        $scope.initializeAreas = () => {
            $scope.selectedAreas = {};
            if ($scope.areas && $scope.areas.length > 0) {
                const firstArea = $scope.areas[0];
                $scope.selectedAreas[firstArea.id] = true;
            }
            if ($scope.areas) {
                $scope.areas.forEach(area => {
                    if (!$scope.selectedAreas.hasOwnProperty(area.id)) {
                        $scope.selectedAreas[area.id] = false;
                    }
                });
            }
        };

        $scope.updateFilters = async () => {
            try {
                // Handle status filters
                const activeFilter = Object.keys($scope.filters).find(key => $scope.filters[key] && key !== 'all');
                const statusFilter = activeFilter || (($scope.filters.all) ? 'all' : '');

                // Call setFilters with area and status filters
                await $scope.setFilters({
                    'status': statusFilter
                });
            } catch (error) {
                console.error('Error updating filters:', error);
                console.log("Failed to update filters. Please try again.");
            }
        };

        $scope.setActiveArea = selectedArea => {
            angular.forEach($scope.driverLocations.areas, area => {
                area.isActive = (area === selectedArea);
            });
        };

        $scope.updateGPS = (currentJob, field, fromRightClick) => {
            $scope.jdSvc.updateGPS(currentJob, field, fromRightClick);
        };

        jdSvc.setSelectJobDetail(async () => {
            const currentJob = $scope.currentJob;
            await jdSvc.setJob($scope.currentJob);
            await $scope.getData();

            if (!currentJob) {
                return;
            }

            const jobLists = [
                {list: $scope.jobList, elementId: 'jobList'},
                {list: $scope.jobListDelivery, elementId: 'jobListDelivery'},
                {list: $scope.jobListPOD, elementId: 'jobListPOD'},
                {list: $scope.jobListReprice, elementId: 'jobListReprice'}
            ];

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

        $scope.jobRecordSearchText = "";

        /**
         * @param {String} searchText
         */
        $scope.jobRecordSearch = searchText => {
            return $scope.jobList
                .filter(job => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
                .map(job => ({id: job.id, text: job.jobNo}));
        }

        /**
         * @param {Number} selectedJobId
         */
        $scope.JobRecordSelected = selectedJobId => {
            const selectedJob = $scope.jobList.find(job => job.id === selectedJobId);
            return $scope.selectJob(selectedJob);
        }

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
                "templateUrl": versionUrl("app/components/Nationwide/partials/jobList.html"),
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListPOD": {
                "title": "Awaiting POD",
                "templateUrl": versionUrl("app/components/Nationwide/partials/jobListPOD.html"),
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListDelivery": {
                "title": "Action Required",
                "templateUrl": versionUrl("app/components/Nationwide/partials/jobListDelivery.html"),
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobsListReprice": {
                "title": "Reprice",
                "templateUrl": versionUrl("app/components/Nationwide/partials/jobListReprice.html"),
                "showSearch": 1,
                "showRefresh": 1
            },
            "jobDetail": {
                "title": "Detail",
                "templateUrl": versionUrl("app/components/common/partials/jobDetail.html"),
                "showSearch": 0,
                "showRefresh": 0,
                "showDetailButtons": 1
            },
            "map": {
                "title": "Google Map",
                "templateUrl": versionUrl("app/components/Nationwide/partials/map.html"),
                "showSearch": 0,
                "showRefresh": 1
            },
            "flightDataTable": {
                "title": "Flight Options",
                "templateUrl": versionUrl("app/components/Nationwide/directives/flight-table/flight-table.html"),
                "showSearch": 0,
                "showRefresh": 1
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

        /**
         * @param {Number} index
         */
        $scope.deleteLayout = async (index) => {
            const deleteConfirm = $mdDialog.confirm()
                .title('Delete Layout?')
                .textContent('Are you sure you would like to delete this layout?')
                .ariaLabel('delete layout')
                .ok('Delete')
                .cancel('Cancel');

            try {
                await $mdDialog.show(deleteConfirm);

                $scope.layouts.splice(index, 1);
                if (Modernizr.localstorage) {
                    localStorage.setItem("layoutsNW-" + ContactID, JSON.stringify($scope.layouts));
                }
            } catch (error) {
                console.log("Delete layout canceled!");
                // You can handle the cancellation or any errors here
            }
        };

        $scope.setLastActiveLayoutName = layoutName => {
            if (Modernizr.localstorage) {
                localStorage.setItem("lastActiveLayoutNW-" + ContactID, layoutName);
            }
        };

        /**
         * @param {Number} index
         */
        $scope.loadLayout = (index) => {
            $scope.currentLayoutName = $scope.layouts[index].name;
            $scope.layout = angular.copy($scope.layouts[index].layout);

            // save layout as last active
            $scope.setLastActiveLayoutName($scope.currentLayoutName);

            $timeout($scope.getData, 1000);
        };

        $scope.saveLayout = async () => {
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

            try {
                const layoutName = await $mdDialog.show(saveLayoutPrompt);

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

                return {data: "OK"};
            } catch (error) {
                console.log("Save Layout Cancelled!");
            }
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
         * @param {String} boxName
         * @param {Number} index
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
        $scope.orderList = async (list, prop) => {
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
                await $scope.setFilters({"order": prop});
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
            callback: async (event, hk) => {
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

        $scope.unlockJob = () => {
            return $scope.jdSvc.unlockJob($scope.currentJob);
        };

        $scope.lockJob = () => {
            return $scope.jdSvc.lockJob($scope.currentJob);
        };

        $scope.selectClearList = async (id, event, area) => {
            angular.element("#area-group .btn").removeClass("topBarActive");
            angular.element(".clearLists-list-title").removeClass("listActive");
            angular.element(event.currentTarget).addClass("listActive");
            $scope.getClearListEnvelope(id);
            await $scope.setFilters({'area': area});
        };

        $scope.selectForDispatch = job => {
            console.log("In SelectForDispatch");
            $scope.jobForDispatch = job;
        };

        /**
         * @param {String} jobNumber
         * @param {Number} jobId
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

        $scope.sendSMS = (courierId, message) => NWData.sendSMS(courierId, ContactID, FirstName, message);

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

        $scope.getStatusClass = job => {
            const n = new Date();
            if (!job.done && Date.parse(job.followupTime) < n && (job.speedID === 6 || job.speedID === 7 || job.speedID === 21)) {
                return "O";
            } else if (!job.done && Date.parse(job.followupTime) < n && (job.speedID === 11 || job.speedID === 23)) {
                return "B";
            } else if (!job.done && Date.parse(job.followupTime) < n) {
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

        /**
         * @param {Number} lat
         * @param {Number} lng
         * @param {Object} flags
         * @param {*} carMarker
         * @param {String} jobNumber
         */
        $scope.dispatchDroppedMarkerToClosestCourier = async (lat, lng, flags, carMarker, jobNumber) => {
            try {
                if (flags.length === 0 && carMarker === null) {
                    $scope.showConfirm = async () => {
                        const confirm = $mdDialog.confirm()
                            .title('Dispatch Invalid')
                            .textContent('Could not find courier for Dispatch')
                            .ok('Close')
                            .cancel('Cancel');

                        try {
                            await $mdDialog.show(confirm);
                            const unDispatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                            displayPickupPoints(unDispatchedData, true, null);
                            $scope.getAvailableCourierLocation();
                        } catch {
                            // This will be executed if the user cancels the dialog.
                            // Handle the cancel action here
                        }
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

                try {
                    await $mdDialog.show(dialog);
                    let j = $scope.jobList.find(jo => jo.jobNo === jobNumber);
                    const jn = j.jobNo;

                    if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                        await $mdDialog.show(
                            $mdDialog.alert()
                                .textContent(`DG job ${jn} can not be despatched to courier ${dispTo} - doesn't have DGLicense.`)
                                .ok('OK')
                        );
                        return;
                    }
                    if (j.dgClass !== null && j.dgClass > 0 && (j.DGLicenseExpiry === null || moment(foundCourier.dgLicenseExpiry) < moment().add(1, 'days'))) {
                        await $mdDialog.show(
                            $mdDialog.alert()
                                .textContent(`Courier ${dispTo} doesn't have a DGLicense or license has expired.`)
                                .ok('OK')
                        );
                        return;
                    }

                    let jobs = [];
                    jobs.push(j.id);
                    const response = await NWData.allocateJobs(foundCourier.courierID, ContactID, jobs);
                    await $scope.getData();
                    angular.element("#box-map").find(".loading").show();
                    $scope.courier = {gpsCourier: foundCourier.id};
                    await $scope.searchCourier();
                } catch {
                    let unDespatchedData = $scope.jobList.filter(x => x.courierData.courierID === null);
                    displayPickupPoints(unDespatchedData, true, null);
                    $scope.getAvailableCourierLocation();
                }
            } catch (error) {
                console.error('Error in dispatchDroppedMarkerToClosestCourier:', error);
                // Handle any errors here
            }
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
                // Handle any errors here
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
                // Handle any errors here
            }
        };

        /////////////////////////////////////
        // LATE CALLS
        /////////////////////////////////////
        $scope.lateCall = async (lateTime, lateType, j, calc) => {
            try {
                const response = await NWData.lateCall(
                    lateType,
                    lateTime,
                    j.minutes,
                    j.pickupTime,
                    j.alertLatePickup,
                    j.deliveryTime,
                    j.alertLateDelivery,
                    j.jobNo,
                    j.clientId,
                    j.contactName,
                    ContactID,
                    j.time,
                    j.id,
                    j.jobType,
                    j.speed,
                    j.notify || j.speed,
                    FirstName,
                    calc
                );

                await $scope.getData();

                return response;
            } catch (error) {
                console.error('Error in lateCall:', error);
                // Handle any errors here
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
                    await $mdDialog.show(
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
                // Handle any errors here
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

                for (const element of angular.element("#jobListPOD .active")) {
                    const j = $scope.jobListPOD.find(jo => jo.id === angular.element(element).data("jobid"));
                    const jn = j.jobNo;
                    if (j.courierData.courierID !== null) {
                        await $mdDialog.show(
                            $mdDialog.alert()
                                .textContent(`Restore ${jn} prior to despatching to another courier.`)
                                .ok('OK')
                        );
                        reset();
                        return;
                    }
                    if (j.dgClass !== null && j.dgClass > 0 && !foundCourier.dangerousGoods) {
                        await $mdDialog.show(
                            $mdDialog.alert()
                                .textContent(`DG job ${jn} can not be despatched to courier ${courier} - doesn't have DGLicense.`)
                                .ok('OK')
                        );
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
                console.error('Error in dispatchJobsFromPOD:', error);
                // Handle any errors here
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
                console.error('Error in dispatchJobsFromPotentialCouriers:', error);
                // Handle any errors here
            }
        };
        ////////////////////////////////////////
        // RESTORE JOB FROM NEW WINDOW PANE
        ///////////////////////////////////////
        $scope.restoreJobsFromNew = async () => {
            try {
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
                    await NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs);
                }
                if (callData.jobs.length > 0) {
                    await NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
                }

                await $scope.getData();

                //angular.element("#box-jobDetail").find(".loading").show();
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                await $scope.searchCourier();

            } catch (error) {
                console.error('Error in restoreJobsFromNew:', error);
                // Handle any errors here
            }
        };

        ////////////////////////////////////////
        // RESTORE JOB FROM POD WINDOW PANE
        ///////////////////////////////////////
        $scope.restoreJobsFromPOD = async () => {
            try {
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
                    await NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs);
                }
                if (callData.jobs.length > 0) {
                    await NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
                }

                await $scope.getData();

                //angular.element("#box-jobDetail").find(".loading").show();
                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                await $scope.searchCourier();

            } catch (error) {
                console.error('Error in restoreJobsFromPOD:', error);
                // Handle any errors here
            }
        };

        ////////////////////////////////////////
        // RESTORE JOB FROM BOOK DELIVERY WINDOW PANE
        ///////////////////////////////////////
        $scope.restoreJobsFromDelivery = async () => {
            try {
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
                    await NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs);
                }
                if (callData.jobs.length > 0) {
                    await NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
                }

                await $scope.getData();

                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                await $scope.searchCourier();
            } catch (error) {
                console.error('Error in restoreJobsFromDelivery:', error);
                // Handle any errors here
            }
        };

        ////////////////////////////////////////
        // REDESPATCHED JOB
        ///////////////////////////////////////
        $scope.reAllocateJobs = async () => {
            try {
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
                    await NWData.reAllocateJobs(foundCourier.courierID, ContactID, callData.jobs);
                }

                await $scope.getData();

                angular.element("#box-map").find(".loading").show();

                $scope.courier = {gpsCourier: foundCourier.id};
                await $scope.searchCourier();
            } catch (error) {
                console.error('Error in reAllocateJobs:', error);
                // Handle any errors here
            }
        };

        $scope.resendJobs = async () => {
            try {
                const callData = {
                    "call": "redespatchJobs",
                    "jobs": [],
                    "splitJobs": [],
                    "jobNos": [],
                    "courierID": null
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
                console.error('Error in resendJobs:', error);
                // Handle any errors here
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
                    await NWData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.jobs);
                }
                if (callData.jobs.length > 0) {
                    await NWData.restoreJobs(foundCourier.courierID, ContactID, callData.jobs);
                }

                await new Promise(resolve => $timeout(resolve, 1000));

                await $scope.getCurrentJobs(foundCourier.courierID);
                await $scope.getData();
            } catch (error) {
                // Handle any errors here
                console.error('Error in restoreAll:', error);
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
                // Handle any errors here
                console.error('Error in redispatchAll:', error);
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
                // This block will be executed if the dialog is cancelled or if any errors occur
                console.log("Resend All operation cancelled or encountered an error:", error);
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
                console.log("Error in reAllocateJobsFromCurrentWindow:", error);
                // Handle the error as needed
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
                console.log("Error in resendJobsFromCurrentWindow:", error);
                // Handle the error as needed
            }
        };

        $scope.restoreJobsFromCurrentWindow = async () => {
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
                console.log("Error in restoreJobsFromCurrentWindow:", error);
                // Handle the error as needed
            }
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

            NWData.splitJob(j.id, FirstName).then(() => {
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

                    $document.on('ready', () => {
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
                courierID: ac.courierID,
                courier: ac.label
            };

            $scope.currentSelection = " for Courier " + ac.id + " " + ac.name;
            await $scope.getCurrentJobs(ac.courierID);
        };

        // Select the courier
        $scope.selectCourier = async (courier) => {
            angular.element("#box-jobDetail").find(".loading").show();
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
                angular.element("#box-jobDetail").find(".loading").fadeOut();
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
            angular.element("#box-jobDetail").find(".loading").show();
            angular.element("#box-map").find(".loading").show();

            angular.element("#box-currentWork").find(".loading").show();
            const foundCourier = $scope.pickCouriers.find(x => x.courierID === courier.courierID);
            $scope.currentCourier = {
                courierID: foundCourier.courierID,
                courier: foundCourier.label
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
                sizeHeadings(angular.element("#currentWork").parents(".column"));
                await new Promise(resolve => $timeout(resolve, 1000));
                sizeHeadings(angular.element("#currentWork").parents(".column"));
            } catch (error) {
                console.error("Error in selectMapCourier:", error);
                // Handle the error appropriately
            }

            $scope.currentWorkSelection = " for Courier " + courier.label;

            await new Promise(resolve => $timeout(resolve, 100));
            $document.ready(() => {
                angular.element("#box-jobDetail").find(".loading").fadeOut();
                angular.element("#box-map").find(".loading").fadeOut();
            });

            try {
                $scope.truckCourierStatus = await NWData.truckCourierStatus(courier.courierID);
            } catch (error) {
                console.error("Error fetching truck courier status:", error);
                // Handle the error appropriately
            }
        };
        $scope.selectPotentialCourier = async (courier) => {
            angular.element("#box-jobDetail").find(".loading").show();
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
                sizeHeadings(angular.element("#currentWork").parents(".column"));
                await new Promise(resolve => $timeout(resolve, 1000));
                sizeHeadings(angular.element("#currentWork").parents(".column"));
                await $scope.getAvailableCourierLocation();
            } catch (error) {
                console.error("Error in selectPotentialCourier:", error);
                // Handle the error appropriately
            }

            $scope.currentWorkSelection = " for Courier " + courier.courier;
            $scope.currentCourier = courier;

            await new Promise(resolve => $timeout(resolve, 100));
            $document.ready(() => {
                angular.element("#box-jobDetail").find(".loading").fadeOut();
                angular.element("#box-map").find(".loading").fadeOut();
            });
        };

        ////////////////////////////
        // GROUPED JOBS
        ////////////////////////////

        $scope.getGroupedJobs = async (jobs, courier) => {
            try {
                const $boxJobGroups = angular.element("#box-jobGroups");
                $boxJobGroups.find(".loading").show();

                const data = await NWData.getJobsGrouped();

                $boxJobGroups.find(".loading").fadeOut();

                $scope.jobGroups = data;

                const sizeHeadingsColumn = () => {
                    sizeHeadings(angular.element("#jobGroups").parents(".column"));
                };

                await new Promise(() => $timeout(sizeHeadingsColumn, 1000));
                await new Promise(() => $timeout(sizeHeadingsColumn, 2000));

            } catch (error) {
                console.error("Error in getGroupedJobs:", error);
                // Handle the error appropriately
            }
        };

        ////////////////////////////
        // CURRENT JOBS
        ////////////////////////////

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

                const sizeHeadingsColumn = () => {
                    sizeHeadings(angular.element("#currentWork").parents(".column"));
                };

                await new Promise(() => $timeout(sizeHeadingsColumn, 1000));
                await new Promise(() => $timeout(sizeHeadingsColumn, 2000));

            } catch (error) {
                console.error("Error in getCurrentJobs:", error);
                // Handle the error appropriately
            }
        };

        $scope.setFilters = async (data) => {
            try {
                await new Promise(resolve => $timeout(resolve, 300));

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

                await $scope.getData();
            } catch (error) {
                console.error("Error in setFilters:", error);
                // Handle error appropriately
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
                const $boxJobDetail = angular.element("#box-jobDetail");
                $boxJobDetail.find(".loading").show();

                $scope.currentJob = await NWData.getJobDetail(support.jobId);
                $boxJobDetail.find(".loading").hide();
                $scope.currentSelection = " for Job " + support.jobNumber;

                const jobs = [$scope.currentJob];
                displayRoutePointsOnly(jobs, true, $scope.mapZoom.display);

                if ($scope.mapZoom.display) {
                    setMapBounds();
                    map.setZoom(12);
                }
            } catch (error) {
                console.error("Error in selectSupportJobDetail:", error);
            }
        };

        $scope.loadRelatedJobDetail = async (id, jn) => {
            try {
                const $boxJobDetail = angular.element("#box-jobDetail");
                $boxJobDetail.find(".loading").show();

                $scope.currentJob = await NWData.getJobDetail(id);
                $boxJobDetail.find(".loading").hide();
                $scope.currentSelection = " for Job " + jn;
            } catch (error) {
                console.error("Error in loadRelatedJobDetail:", error);
                angular.element("#box-jobDetail").find(".loading").hide();
                // Handle the error appropriately
            }
        };

        $scope.selectJob = async (job, clear) => {
            try {
                await new Promise(resolve => $timeout(resolve, 0));

                processActiveTable();
                initializeJob(job);
                await updateData(job, clear);
                angular.element("#box-jobDetail .loading").css('display', 'none');
            } catch (error) {
                console.error("Error in selectJob:", error);
                // Handle the error appropriately
            }
        };

        function processActiveTable() {
            $scope.selectedJobs = [];
            $scope.currentSupport = null;
            angular.element(".activeTable .active").each(function () {
                angular.element(this).find(".selectjob").click();
                $scope.selectedJobs.push($scope.jobForDispatch.ID);
            });
            console.log("selectJob");
        }

        function initializeJob(job) {
            $scope.currentJob = job;
            $scope.$apply();
            console.log(job);
            return jdSvc.setJob($scope.currentJob);
        }

        async function updateData(job, clear) {
            try {
                const [activeCouriers, relatedJobs] = await Promise.all([
                    NWData.getActiveCouriers(),
                    job.rootParentID ? NWData.getRelatedJobs(job.rootParentID, job.clientId) : Promise.resolve([])
                ]);

                $scope.pickCouriers = activeCouriers;

                if (job.rootParentID) {
                    //relatedJobs = relatedJobs.filter(item => item.id !== job.id);
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

                $scope.$apply();
            } catch (error) {
                console.error("Error in updateData:", error);
                // Handle the error appropriately
            }
        }

        async function processClearSettings(job) {
            clearSettings(job);
            await $scope.getGroupedJobs();
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
                    click: async ($itemScope, $event, modelValue, text, $li) => {
                        try {
                            await $scope.restoreJobsFromCurrentWindow();
                        } catch (error) {
                            console.error("Error in Restore click handler:", error);
                            // Handle the error appropriately
                        }
                    }
                },
                {
                    text: "Redispatch",
                    click: async ($itemScope, $event, modelValue, text, $li) => {
                        try {
                            await $scope.reAllocateJobsFromCurrentWindow();
                        } catch (error) {
                            console.error("Error in Redispatch click handler:", error);
                            // Handle the error appropriately
                        }
                    }
                },
                {
                    text: "Resend",
                    click: async ($itemScope, $event, modelValue, text, $li) => {
                        try {
                            await $scope.resendJobsFromCurrentWindow();
                        } catch (error) {
                            console.error("Error in Resend click handler:", error);
                            // Handle the error appropriately
                        }
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

            let multipleMenu = [
                {
                    text: "Dispatch Selected",
                    click: async ($itemScope, $event, modelValue, text, $li) => {
                        await $scope.dispatchJobsForm();
                    }
                },
                {
                    text: "Re-dispatch Selected",
                    click: async ($itemScope, $event, modelValue, text, $li) => {
                        // Async operation might be needed here
                    }
                }
            ];

            if (sameCourier) {
                multipleMenu.push(
                    {
                        text: "Restore Selected",
                        click: async ($itemScope, $event, modelValue, text, $li) => {
                            await $scope.restoreJobs();
                        }
                    },
                    {
                        text: "Redispatch Selected",
                        click: async ($itemScope, $event, modelValue, text, $li) => {
                            await $scope.reAllocateJobs();
                        }
                    },
                    {
                        text: "Resend Selected",
                        click: async ($itemScope, $event, modelValue, text, $li) => {
                            await $scope.resendJobs();
                        }
                    }
                );
            }

            if (sameCourier && lastCourier === null) {
                multipleMenu = [
                    {
                        text: "Dispatch Selected",
                        click: async ($itemScope, $event, modelValue, text, $li) => {
                            await $scope.dispatchJobsForm();
                        }
                    }
                ];
            }

            const fullMenu = [
                {
                    text: "Dispatch",
                    click: async ($itemScope, $event, modelValue, text, $li) => {
                        await $scope.dispatchJobsForm();
                    }
                }
            ];

            if (lastCourier !== null) {
                multipleMenu.shift();
                multipleMenu.shift();
                fullMenu.shift();
                fullMenu.push(
                    {
                        text: "Restore",
                        click: async ($itemScope, $event, modelValue, text, $li) => {
                            await $scope.restoreJobs();
                        }
                    },
                    {
                        text: "Redispatch",
                        click: async ($itemScope, $event, modelValue, text, $li) => {
                            await $scope.reAllocateJobs();
                        }
                    },
                    {
                        text: "Resend",
                        click: async ($itemScope, $event, modelValue, text, $li) => {
                            await $scope.resendJobs();
                        }
                    }
                );
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
                click: async ($itemScope, $event, modelValue, text, $li) => {
                    //$scope.selected = $itemScope.item.name;
                    await $scope.dispatchJobsFromPotentialCouriers($itemScope.courier.code);
                }
            }
        ];

        $scope.getJobList = async () => {
            if (Modernizr.localstorage) {
                localStorage.setItem("dispNW-filters-" + ContactID, JSON.stringify($scope.jobFilters));
            }
            const selectedClients = $scope.pickService.clients.map(a => a.id);

            try {
                const [podData, newData, repriceData, deliveryData] = await Promise.all([
                    NWData.getNationwideJobsPOD($scope.jobFilters, selectedClients, $scope.isInternal, $scope.selectedAreas),
                    NWData.getNationwideJobsNew($scope.jobFilters, selectedClients, $scope.isInternal, $scope.selectedAreas),
                    NWData.getNationwideJobsReprice($scope.jobFilters, selectedClients, $scope.isInternal, $scope.selectedAreas),
                    NWData.getNationwideJobsBookDelivery($scope.jobFilters, selectedClients, $scope.isInternal, $scope.selectedAreas)
                ]);

                $scope.jobListPOD = podData;
                $scope.jobList = newData;
                $scope.jobListReprice = repriceData;
                $scope.jobListDelivery = deliveryData;

                await Promise.all([
                    $timeout(() => {
                        angular.element("#box-jobsListPOD .loading").fadeOut();
                        sizeHeadings(angular.element("#jobListPOD").parents(".column"));
                    }, 200),
                    $timeout(() => {
                        angular.element("#box-jobsList .loading").fadeOut();
                        sizeHeadings(angular.element("#jobList").parents(".column"));
                    }, 200),
                    $timeout(() => {
                        angular.element("#box-jobsListReprice .loading").fadeOut();
                        sizeHeadings(angular.element("#jobListReprice").parents(".column"));
                    }, 200),
                    $timeout(() => {
                        angular.element("#box-jobsListDelivery .loading").fadeOut();
                        sizeHeadings(angular.element("#jobListDelivery").parents(".column"));
                        $scope.getAvailableCourierLocation();
                    }, 200)
                ]);
            } catch (error) {
                console.error("Error fetching job data:", error);
                // Handle error appropriately
            }
        };

        $scope.closeSupport = async (support) => {
            try {
                await NWData.closeSupport(support.eventId, ContactID);
                await $scope.getSupports();
                $scope.currentSupport = null;
            } catch (error) {
                console.error("Error closing support:", error);
                // Handle error appropriately
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
                // Handle error appropriately
            }
        };

        $scope.getSupports = async () => {
            ////////////////////////////
            // SUPPORTS
            ////////////////////////////
            angular.element("#box-supports").find(".loading").show();

            try {
                $scope.supports = await NWData.getSupports($scope.supportChannel);

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

                await $timeout(() => {
                    $document.on('ready', () => {
                        angular.element("#box-supports").find(".loading").fadeOut();
                        if ($scope.currentSupport) {
                            angular.element("#supports tr[data-id='" + $scope.currentSupport.eventId + "']").addClass("active");
                        }
                    });
                }, 100);

                await $timeout(() => {
                    sizeHeadings(angular.element("#supports").parents(".column"));
                }, 1000);

                await $timeout(() => {
                    sizeHeadings(angular.element("#supports").parents(".column"));
                }, 2000);

            } catch (error) {
                console.error("Error fetching supports:", error);
                // Handle error appropriately
            }
        };

        $scope.getClientContacts = async () => {
            try {
                $scope.pickClients = await NWData.getClientContacts(ContactID);
            } catch (error) {
                console.error("Error fetching client contacts:", error);
                // Handle error appropriately
            }
        };

        $scope.getEventTypes = async () => {
            try {
                $scope.pickEventTypes = await NWData.getEventTypes();
            } catch (error) {
                console.error("Error fetching event types:", error);
                // Handle error appropriately
            }
        };

        $scope.getData = async () => {
            ///////////////////////////////
            // JOB LIST
            ///////////////////////////////
            angular.element("#box-jobsList").find(".loading").show();

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
                await $scope.getJobList();
            } catch (error) {
                console.error("Error in getData:", error);
                // Handle error appropriately
            }
        };

        /////////////////////////
        // JOB DETAILS
        /////////////////////////


        $scope.detailAddressMenu = [
            // NEW IMPLEMENTATION
            {
                text: "Update GPS",
                click: ($itemScope, $event, modelValue, text, $li) => {
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

        $scope.closeSupport = async (support) => {
            try {
                await DispatchData.closeSupport(support.eventId, ContactID);
                await $scope.getSupports();
                $scope.currentSupport = null;
            } catch (error) {
                console.log("Error in closeSupport:", error);
                // Handle the error as needed
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
                });

                await $scope.getData();
                console.log('Pallet Dialog closed!');
            } catch (error) {
                console.log("Error in createEvent:", error);
                // Handle the error as needed
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
                    parent: angular.element($document.body),
                    targetEvent: $event,
                    templateUrl: versionUrl("app/components/dialogs/truck-courier-status-dialog/truck-courier-status-dialog.html"),
                    clickOutsideToClose: false,
                    fullscreen: true,
                    locals: {
                        data: $scope.truckCourierStatus[0],
                    },
                    bindToController: true
                });
            } catch (error) {
                console.log("Error in truckLoadingStatus:", error);
            }
        };

        $scope.courierSearchText = "";
        /**
         * @param {String} searchText
         */
        $scope.courierSearch = searchText => {
            try {
                const url = "/courier/AllActiveSearch";
                return DispatchData.autocompleteSearch(searchText, url);
            } catch (error) {
                console.log(error.message);
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

            // Init functions
            $scope.initializeVariables();
            $scope.loadPageViews().then(() => {
                console.log('Loaded Page Views!');
            });
        };

        // Call the init function when the controller loads
        $scope.init();
    }
]);


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
