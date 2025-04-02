import app from "../../app";
import './keyboardEvents';

function CSControl($scope, jdSvc, uCSData, $state, $filter, $mdDialog, greetingService,
    $document, $timeout, dispatchJobService, toastrService, moment, DispatchData,
    $mdSidenav, LayoutService, APP_CONFIG) {
    $scope.jdSvc = jdSvc;
    $scope.dispatchJobService = dispatchJobService;

    // Variables
    function initializeVariables() {
        $scope.isUsCustomer = APP_CONFIG.US_Customer;
        $scope.isAdmin = (ClientInternal === "True");
        $scope.mapSetting = {
            "allCouriers": false, "allRuns": false
        };

        // New map
        $scope.mapCenter = APP_CONFIG.US_Customer ?
            { lat: 39.8283, lng: -98.5795 } : // US center
            { lat: -36.8485, lng: 174.7633 }; // Auckland, NZ
        $scope.mapZoom = 12;
        $scope.jobs = [];

        $scope.jobDetailFabIsOpen = false;
        $scope.dateSearchRange = 1; // Set to fortnight

        $scope.searchBox = "";
        $scope.selectedEvents = [];
        $scope.maxSize = 5;
        $scope.totalCount = 0;
        $scope.pageIndex = 1;
        $scope.pageSizeSelected = 50;
        $scope.bulkTotalCount = 0;
        $scope.bulkPageIndex = 1;
        $scope.bulkPageSizeSelected = 50;
        $scope.pbTotalCount = 0;
        $scope.pbPageIndex = 1;
        $scope.pbPageSizeSelected = 50;
        /** @type {BulkScanDetail[]} */
        $scope.scanList = [];

        $scope.jobRecordSearchText = "";
        $scope.sort = [];

        const now = new Date();
        let sevenDaysBefore = new Date();
        sevenDaysBefore.setDate(now.getDate() - 7);
        let sevenDaysAfter = new Date();
        sevenDaysAfter.setDate(now.getDate() + 7);

        uCSData.getActiveCouriers().then(data => {
            $scope.pickCouriers = data;
        });

        uCSData.getAllCouriers().then(data => {
            $scope.pickAllCouriers = data;
        });

        $scope.pickDateService = {
            "client": '',
            "courier": "",
            "date": now,
            "from_date": sevenDaysBefore,
            "to_date": sevenDaysAfter,
            "followupClient": "All",
            "includeClosed": true
        };
        $scope.clientSelectedItem = $scope.pickDateService.client;
        $scope.courierSelectedItem = $scope.pickDateService.client;
        $scope.clientSearchText = '';
        $scope.courierSearchText = '';

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
                        angular.element(this).css({ "flex-basis": angular.element(this).attr("data-height") });
                    });
                    parent.find(".box").last().css({ "flex-basis": "0" });
                }, 0);
            }
        };

        $scope.showInput = {};
        $scope.inputWidth = {};

        $scope.followupClient = {
            name: "All"
        };

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
        $scope.scanPromise = null;

        $scope.jobHeaders = [{ key: 'booked', label: 'Booked' }, { key: 'status', label: 'Status' }, {
            key: 'speed',
            label: 'Speed'
        }, { key: 'jobNo', label: 'Job' }, { key: 'client', label: 'Client' }, { key: 'from', label: 'From' }, {
            key: 'to',
            label: 'To'
        }, { key: 'street', label: 'Street' }];

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

        $scope.jobListMenu = [{
            text: "Close Event", click: ($itemScope, $event, modelValue, text, $li) => {
                $scope.gather.form = {
                    id: "closeEvent", title: "Close Event?", fields: [{
                        "name": "editName", "label": "Edit your name", "value": ""
                    }], onSubmit: async () => {
                        angular.element("#box-jobList").find(".loading").show();
                        angular.element("#box-map").find(".loading").show();

                        const userName = angular.element("#gather-editName").val();

                        await uCSData.closeEvent($itemScope.event.bulkEventID, userName);
                        await $scope.refreshData(1, true);
                    }, submitValue: "Close Event"
                };

                $scope.gather.showForm();
            }
        }];

        $scope.boxes = {
            "pickDate": {
                "title": "Filters",
                "icon": "filter_list",
                "templateUrl": "app/components/CS/partials/pickDate.html",
                "showSearch": 0
            },
            "jobList": {
                "title": "Live Job Data",
                "icon": "list_alt",
                "templateUrl": "app/components/CS/partials/jobList.html",
                "showSearch": 1,
            },
            "bulkJobList": {
                "title": "Bulk Job Data",
                "icon": "format_list_bulleted",
                "templateUrl": "app/components/CS/partials/bulkJobList.html",
                "showSearch": 1,
            },
            "pbList": {
                "title": "PreBook Data",
                "icon": "event_note",
                "templateUrl": "app/components/CS/partials/pbList.html",
                "showSearch": 1,
                "showRefresh": 1,
            },
            "jobDetail": {
                "title": "Detail",
                "icon": "assignment",
                "templateUrl": "app/components/CS/partials/jobDetail.html",
                "showSearch": 0,
                "showDetailButtons": 1
            },
            "scanList": {
                "title": "Scan Detail",
                "icon": "document_scanner",
                "templateUrl": "app/components/CS/partials/scanList.html",
                "showSearch": 0,
            },
            "map": {
                "title": "Map",
                "icon": "pin_drop",
                "templateUrl": "app/components/CS/partials/map.html",
                "showSearch": 0
            }
        };
    }

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

    /**
     * @param {Job} currentJob
     * @param {string} field
     * @param {boolean} fromRightClick
     */
    $scope.updateGPS = (currentJob, field, fromRightClick) => {
        jdSvc.updateGPS(currentJob, field, fromRightClick);
    };

    /**
     * @param  {Object}  $event
     * @param  {Job}  job
     */
    $scope.selectAndDispatchJob = async ($event, job) => {
        try {
            const dispatchDialog = $mdDialog.prompt()
                .title("Dispatch To Courier")
                .textContent('Enter the courier number to dispatch job to')
                .placeholder("Courier Number")
                .ariaLabel("courier to dispatch too")
                .targetEvent($event)
                .required(true)
                .ok("Dispatch")
                .cancel('Cancel');

            const courierNumber = await $mdDialog.show(dispatchDialog);

            if (courierNumber) {
                await dispatchJobService.dispatchJob(courierNumber, job);
                await $scope.selectJob(job);
                toastrService.showSuccessToast('Job dispatched to courier ' + courierNumber);
            }
            // If courierNumber is falsy, it means the user clicked cancel, so we do nothing
        } catch (error) {
            console.error('Error in selectAndDispatchJob:', error);
        }
    };

    /**
     * @param  {Object}  $event
     */
    $scope.createNewJob = async ($event) => {
        try {
            // Dialog
            const newJobId = await $mdDialog.show({
                controller: 'CreateJobDialogController',
                controllerAs: 'ctrl',
                parent: $document.body,
                targetEvent: $event,
                templateUrl: "app/components/dialogs/create-job-dialog/create-job-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    staffId: ContactID, despatcherName: FirstName
                },
                bindToController: true
            });

            // Refresh data
            await $scope.refreshData(true);

            // Then load the new job
            await $scope.selectJobDetail(newJobId);
            console.log('Dialog closed!');
        } catch (error) {
            console.error('Error in createNewJob:', error);
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

            // Show additional services dialog
            await $mdDialog.show({
                controller: 'AdditionalServicesDialogController',
                controllerAs: "ctrl",
                templateUrl: "app/components/dialogs/additional-services-dialog/additional-services-dialog.html",
                parent: $document.body,
                targetEvent: $event,
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    job
                },
                bindToController: true
            });
        } catch (error) {
            console.error('Error in showAdditionalServicesMenu:', error.message);
        }
    };

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    $scope.openFileAttachmentDialog = async ($event, job) => {
        try {
            await $mdDialog.show({
                controller: 'JobFileUploadController',
                controllerAs: 'ctrl',
                parent: $document.body,
                templateUrl: "app/components/dialogs/job-file-upload-dialog/job-file-upload-dialog.html",
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
     */
    $scope.interCourierCharge = async ($event) => {
        try {
            await $mdDialog.show({
                controller: 'InterCourierChargeDialog',
                controllerAs: 'ctrl',
                parent: $document.body,
                targetEvent: $event,
                templateUrl: "app/components/dialogs/inter-courier-charge-dialog/inter-courier-charge-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    staffId: ContactID,
                },
                bindToController: true
            });

            console.log("Inter-courier Charge Added!");
        } catch (error) {
            console.log("Inter-courier Charge Canceled!");
        }
    };

    jdSvc.setGather($scope.gather);


    ///////////////////////////////
    // LAYOUT
    ///////////////////////////////
    let layoutsObject = null;
    if (Modernizr.localstorage) {
        layoutsObject = JSON.parse(localStorage.getItem("layoutsCS-" + ContactID));
    }

    const defaultLayout = LayoutService.getDefaultLayout();


    if (layoutsObject !== null) {
        layoutsObject[0] = defaultLayout[0];
    }

    $scope.layouts = LayoutService.getLayouts();
    $scope.userName = LayoutService.getUserName();
    $scope.currentLayoutName = "default";
    $scope.layout = LayoutService.getCurrentLayout();

    /**
     * @param {Number} index
     */
    $scope.deleteLayout = async (index) => {
        await LayoutService.deleteLayout(index);
        $scope.layouts = LayoutService.getLayouts();
        $scope.$apply();
    };


    /**
     * @param {Number} index
     */
    $scope.loadLayout = (index) => {
        const loadedLayout = LayoutService.loadLayout(index);
        $scope.currentLayoutName = loadedLayout.name;
        $scope.layout = loadedLayout.layout;

        $timeout($scope.getData, 1000);
    };

    $scope.saveLayout = async () => {
        // Update layout dimensions
        angular.forEach($scope.layout.columns, (column, colKey) => {
            column.width = angular.element("#co-" + column.id).css("flex-basis");
            angular.forEach(column.boxes, (box, boxKey) => {
                box.height = angular.element("#box-" + box.name).css("flex-basis");
            });
        });

        try {
            const result = await LayoutService.saveLayout($scope.layout);
            $scope.layouts = LayoutService.getLayouts();
            $scope.currentLayoutName = result.name;
            $scope.$apply();
            return result;
        } catch (error) {
            console.error("Save Layout Cancelled!");
        }
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

    $scope.goToRunViewer = () => {
        console.log("goToRunViewer.");
        $state.go('home');
    };

    //Column Sorting
    $scope.orderList = (list, prop) => {
        if ($scope.sort[list] !== prop) {
            $scope.sort[list] = prop;
            $scope[list] = $filter('orderBy')($scope[list], prop);
        } else {
            $scope.sort[list] = "d-" + prop;
            $scope[list] = $filter('orderBy')($scope[list], "-" + prop);
        }
    };

    /**
     *
     * @param {string} searchText
     */
    $scope.jobRecordSearch = searchText => {
        return $scope.jobList
            .filter(job => job.jobNo.toLowerCase().includes(searchText.toLowerCase()))
            .map(job => ({ id: job.id, text: job.jobNo }));
    }

    /**
     * @param {number} selectedJobId
     */
    $scope.JobRecordSelected = selectedJobId => {
        const selectedJob = $scope.jobList.find(job => job.id === selectedJobId);
        $scope.selectJob(selectedJob);
    }


    $scope.filterRegion = async (region) => {
        try {
            const sr = $scope.pickRegions.find(obj => obj.id === region.id);
            $scope.pickDateService.regions = [sr];

            await Promise.all([$scope.refreshData(true), $scope.refreshBulkData(true), $scope.refreshPreBookData(true)]);
        } catch (error) {
            console.log('Error in filterRegion:', error);
        }
    };

    $scope.unlockJob = () => {
        return jdSvc.unlockJob($scope.currentJob);
    };

    $scope.lockJob = () => {
        return jdSvc.lockJob($scope.currentJob);
    };

    $scope.unSplitJob = async () => {
        try {
            const confirm = $mdDialog.confirm()
                .title('Un-Split Job?')
                .textContent('Are you sure you wish to un-split this job?')
                .ok('Yes')
                .cancel('No');

            await $mdDialog.show(confirm);

            const msg = await uCSData.unSplitJob($scope.currentJob.id);

            if ((msg || "").length > 2) {
                const alert = $mdDialog.alert()
                    .title('Error')
                    .textContent(msg)
                    .ok('Close');

                await $mdDialog.show(alert);
            }
        } catch (error) {
            // User clicked 'No' or an error occurred
            console.log('Un-split job cancelled or error occurred:', error);
        }
    };

    /**
     * @param {Job} job
     */
    $scope.restoreJob = async (job) => {
        try {
            angular.element("#box-jobDetail").find(".loading").show();
            let callData = {
                "call": "restoreJobs", "jobs": [], "splitJobs": [], "jobNos": [], "courierID": null
            };

            let foundCourier = null;
            const jn = job.jobNo;

            await uCSData.addRestoreEvent(jn, job.clientId, job.contactName, ContactID, job.courierData.courierID, job.id, job.jobType, FirstName);

            if (callData.courierID === null) {
                callData.courierID = job.courierData.courierID;
                foundCourier = $scope.pickCouriers.find(c => c.courierID === job.courierData.courierID) || $scope.pickAllCouriers.find(c => c.courierID === job.courierData.courierID);
            }

            if (job.displaySplitJobDetail) {
                callData.splitJobs.push(job.id);
            } else {
                callData.jobs.push(job.id);
            }

            // Null check
            if (foundCourier == null) return;

            const promises = [];

            if (callData.splitJobs.length > 0) {
                promises.push(uCSData.restoreSplitJobs(foundCourier.courierID, ContactID, callData.splitJobs));
            }
            if (callData.jobs.length > 0) {
                promises.push(uCSData.restoreJobs(foundCourier.courierID, callData.jobs));
            }

            await Promise.all(promises);
            await $scope.selectJobDetail(job.id);
        } catch (error) {
            console.error('Error in restoreJob:', error);
            // Handle the error appropriately
        } finally {
            angular.element("#box-jobDetail").find(".loading").hide();
        }
    };

    /**
     * @param {Object} $event
     */
    $scope.swapPOD = async ($event) => {
        try {
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

            const jobNumber = await $mdDialog.show(jobNumberPrompt);
            const data = await uCSData.validateSwapPOD(jobNumber);

            if (!data) {
                await $mdDialog.show($mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('Invalid Job')
                    .textContent('This job is invalid.')
                    .ok('OK'));
                return;
            }

            const secondJobId = data;
            const firstJobId = $scope.currentJob.id;

            const confirmSwap = $mdDialog.confirm()
                .title('Swap Delivery Info?')
                .textContent(`Are you sure you wish to swap delivery info between ${$scope.currentJob.jobNo} and ${jobNumber}?`)
                .ariaLabel('Lucky day')
                .targetEvent($event)
                .ok('Yes')
                .cancel('No');

            await $mdDialog.show(confirmSwap);

            await uCSData.swapPOD($scope.currentJob.jobNo, jobNumber);

            await $mdDialog.show($mdDialog.alert()
                .clickOutsideToClose(true)
                .title('Successful')
                .textContent('POD Swap Completed Successfully')
                .ok('OK'));

            await uCSData.reSendJobs(secondJobId);
            await uCSData.reAssignJobs(firstJobId);
            await uCSData.reSendJobs(firstJobId);
            await $scope.refreshData(true);

        } catch (error) {
            console.log("POD Swap Canceled or error occurred:", error);
            // Handle the error appropriately
        }
    };

    /**
     * @param {Object} $event
     */
    $scope.sendPOD = async ($event) => {
        try {
            if (!$scope.currentJob.podPhoto) {
                await $mdDialog.show($mdDialog.alert()
                    .clickOutsideToClose(true)
                    .title('No Photo')
                    .textContent('Sorry no photo for this job.')
                    .ok('OK'));
                console.log("Alert closed.");
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

            const email = await $mdDialog.show(confirm);

            await uCSData.sendPOD($scope.currentJob.id, email);

            await $mdDialog.show($mdDialog.alert()
                .clickOutsideToClose(true)
                .title('Email Sent')
                .textContent('POD email has been sent')
                .ok('OK'));

        } catch (error) {
            console.error("POD send cancelled or error occurred:", error);
            // Handle the error appropriately
        }
    };

    $scope.refreshAllData = async () => {
        await Promise.all([$scope.refreshData(), $scope.refreshBulkData(), $scope.refreshPreBookData()]);
    };

    $scope.refreshData = async () => {
        try {
            $scope.jobListLoading = uCSData.getPodJobs(
                $scope.pickDateService.courier,
                $scope.pickDateService.client,
                ($scope.pickDateService.wild || ""),
                ($scope.pickDateService.job || ""),
                moment($scope.pickDateService.from_date),
                moment($scope.pickDateService.to_date),
                $scope.jobQuery.page,
                $scope.jobQuery.limit
            );

            const data = await $scope.jobListLoading;
            $scope.jobList = data.item2;
            $scope.totalCount = data.item1;
        } catch (error) {
            console.error('Error in refreshData:', error);
        }
    };

    $scope.refreshBulkData = async () => {
        try {
            $scope.bulkJobPromise = uCSData.searchBulkJobs($scope.pickDateService.courier, $scope.pickDateService.client, ($scope.pickDateService.job || ""), ($scope.pickDateService.wild || ""), moment($scope.pickDateService.from_date), moment($scope.pickDateService.to_date), $scope.bulkJobQuery.page, $scope.bulkJobQuery.limit);

            const data = await $scope.bulkJobPromise;
            $scope.bulkJobList = data.item2;
            $scope.bulkTotalCount = data.item1;
        } catch (error) {
            console.error('Error in refreshBulkData:', error);
        }
    };

    $scope.refreshPreBookData = async () => {
        try {
            $scope.preBookPromise = uCSData.searchPreBookJobs($scope.pickDateService.courier, $scope.pickDateService.client, ($scope.pickDateService.wild || ""), ($scope.pickDateService.job || ""), moment($scope.pickDateService.from_date), moment($scope.pickDateService.to_date), $scope.preBookQuery.page, $scope.preBookQuery.limit);

            const data = await $scope.preBookPromise;
            $scope.pbList = data.item2;
            $scope.pbTotalCount = data.item1;
        } catch (error) {
            console.error('Error in refreshPreBookData:', error);
        }
    };

    $scope.downloadJobList = async () => {
        try {
            const response = await uCSData.podJobsDownload(
                $scope.pickDateService.courier,
                $scope.pickDateService.client,
                ($scope.pickDateService.wild || ""),
                ($scope.pickDateService.job || ""),
                moment($scope.pickDateService.from_date),
                moment($scope.pickDateService.to_date),
                $scope.jobQuery.page,
                $scope.jobQuery.limit);

            if (response.status === 200) {
                let filename = "jobs.csv";  // default filename
                const contentDisposition = response.headers()["content-disposition"];

                if (contentDisposition) {
                    const filenameMatch = contentDisposition.split(';')
                        .find(part => part.trim().startsWith('filename='));
                    if (filenameMatch) {
                        filename = filenameMatch.split('=')[1].trim().replace(/"/g, '');
                    }
                }

                const blob = new Blob([response.data], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            } else {
                console.error("Error downloading jobs");
            }
        } catch (error) {
            console.error("Failed to download jobs:", error);
        }
    };

    $scope.uploadJobList = () => {
        angular.element("jobListUpload").trigger('click');
    };

    $scope.onUploadJobList = async function () {
        const fileElement = angular.element("jobListUpload");
        const files = fileElement[0].files;
        if (!files || files.length !== 1) {
            fileElement.val(null);
            return;
        }
        // Check right file extension
        const file = files[0];
        const index = file.name.lastIndexOf(".");
        if (index < 1 || !['.xls', '.xlsx', '.csv'].includes(file.name.substring(index, file.name.length).toLowerCase())) {
            fileElement.val(null);
            console.error("Please upload correct file type, file extension should be .xls, .xlsx or .csv");
            return;
        }

        try {
            await uCSData.uploadJobList(file);
            toastrService.showSuccessToast("Job list uploaded successfully.");
        } catch {
            toastrService.showErrorToast("Job list uploaded unsuccessfully.");
        } finally {
            fileElement.val(null);
        }
    };

    /**
     * @param {Job} job
     */
    $scope.showItems = job => {
        if (job.client !== "Other") {
            if ($scope.cancelledSelected) {
                return true;
            } else {
                return job.status !== "Cancelled";
            }
        } else {
            return false;
        }
    };

    /**
     * @param {number} jobId
     * @param {string} jobNumber
     */
    $scope.loadRelatedJobDetail = async (jobId, jobNumber) => {
        const loadingElement = angular.element("#box-jobDetail").find(".loading");
        try {
            loadingElement.show();

            $scope.currentJob = await uCSData.getJobDetail(jobId);
            $scope.currentSelection = " for Job " + jobNumber;

            // Ensure the view is updated
            if (!$scope.$$phase) {
                $scope.$apply();
            }
        } catch (error) {
            console.error('Error loading job detail:', error);
            // Handle the error appropriately, e.g., show an error message to the user
        } finally {
            loadingElement.hide();
        }
    };

    /**
     * @param {number} jobId
     */
    $scope.selectJobDetail = async (jobId) => {
        try {
            console.log("select Job  " + jobId);

            const data = await uCSData.getJobDetail(jobId);
            $scope.currentJob = data;
            $scope.currentJobId = jobId;
            await jdSvc.setJob($scope.currentJob);
            $scope.currentSelection = " for Job " + data.jobNo;

            // Update map with just this job
            if ($scope.currentJob.pickupAddress?.latitude && $scope.currentJob.pickupAddress?.longitude) {
                $scope.mapCenter = {
                    lat: $scope.currentJob.pickupAddress.latitude,
                    lng: $scope.currentJob.pickupAddress.longitude
                };
                $scope.jobs = [$scope.currentJob];
            }

            if ($scope.currentJob.rootParentId) {
                $scope.currentJob.relatedJobs = await uCSData.getRelatedJobs($scope.currentJob.rootParentId, $scope.currentJob.clientId);
            }

            $scope.scanPromise = uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo);
            $scope.scanList = await $scope.scanPromise;

            if (!$scope.$$phase) {
                $scope.$apply();
            }
        } catch (error) {
            console.error('Error in selectJobDetail:', error);
        }
    };

    $scope.selectPreBookDetail = async (prebookJobId) => {
        try {
            console.log("select pre book Job  " + prebookJobId);

            const jobDetailLoading = angular.element("#box-jobDetail").find(".loading");
            jobDetailLoading.show();

            const data = await uCSData.getPreBookDetail(prebookJobId);
            $scope.currentJob = data;
            await jdSvc.setJob($scope.currentJob);
            jobDetailLoading.hide();
            $scope.currentSelection = " for Job " + data.jobNo;

            // Update map with just this job
            if ($scope.currentJob.pickupAddress?.latitude && $scope.currentJob.pickupAddress?.longitude) {
                $scope.mapCenter = {
                    lat: $scope.currentJob.pickupAddress.latitude,
                    lng: $scope.currentJob.pickupAddress.longitude
                };
                $scope.jobs = [$scope.currentJob];
            }

            console.log($scope.currentJob.days);

            // Process frequency
            const freq = $scope.currentJob.days.slice(8, 9).trim() || "0";
            console.log(freq);
            jdSvc.combos.frequency = [jdSvc.pickFrequency[freq]];
            console.log(jdSvc.combos.frequency);

            // Process holidays
            const hol = $scope.currentJob.days.slice(9, 10).trim() || "0";
            console.log(hol);
            jdSvc.combos.holidays = [jdSvc.pickHolidays[hol]];
            console.log(jdSvc.combos.holidays);

            // Process selected days
            const days = $scope.currentJob.days.slice(0, 7);
            const selectedDays = days.split('').reduce((acc, day, index) => {
                if (day === '1') {
                    acc.push(jdSvc.pickDays[index]);
                }
                return acc;
            }, []);
            console.log(selectedDays);
            jdSvc.combos.days = selectedDays;

            $scope.scanPromise = uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo);
            $scope.scanList = await $scope.scanPromise;

            if (!$scope.$$phase) {
                $scope.$apply();
            }
        } catch (error) {
            console.error('Error in selectPreBookDetail:', error);
        }
    };

    $scope.selectBulkJobDetail = async (bulkJobId) => {
        try {
            console.log("select Bulk Job  " + bulkJobId);

            const jobDetailLoading = angular.element("#box-jobDetail").find(".loading");
            jobDetailLoading.show();

            const data = await uCSData.getBulkJobDetail(bulkJobId);
            $scope.currentJob = data;
            await jdSvc.setJob($scope.currentJob);
            jobDetailLoading.hide();
            $scope.currentSelection = " for Bulk Job " + data.jobNo;

            // Update map with just this job
            if ($scope.currentJob.pickupAddress?.latitude && $scope.currentJob.pickupAddress?.longitude) {
                $scope.mapCenter = {
                    lat: $scope.currentJob.pickupAddress.latitude,
                    lng: $scope.currentJob.pickupAddress.longitude
                };
                $scope.jobs = [$scope.currentJob];
            }

            $scope.scanPromise = uCSData.getScanDetail(moment($scope.currentJob.bookedDate), $scope.currentJob.jobNo);
            $scope.scanList = await $scope.scanPromise;

            if (!$scope.$$phase) {
                $scope.$apply();
            }
        } catch (error) {
            console.error('Error in selectBulkJobDetail:', error);
        } finally {
            jobDetailLoading.hide();
            scanListLoading.hide();
        }
    };

    jdSvc.setSelectJobDetail($scope.selectJobDetail);
    jdSvc.setSelectBulkJobDetail($scope.selectBulkJobDetail);

    /**
     * @param {number} page
     * @param {number} limit
     * @returns {Promise<void>}
     */
    $scope.jobPageChanged = async (page, limit) => {
        $scope.jobQuery.page = page;
        $scope.jobQuery.limit = limit;
        await $scope.refreshData();
    };

    /**
     * @param {number} page
     * @param {number} limit
     */
    $scope.bulkJobPageChanged = async (page, limit) => {
        $scope.bulkJobQuery.page = page;
        $scope.bulkJobQuery.limit = limit;
        await $scope.refreshBulkData();
    };

    /**
     * @param {number} page
     * @param {number} limit
     */
    $scope.preBookPageChanged = async (page, limit) => {
        $scope.preBookQuery.page = page;
        $scope.preBookQuery.limit = limit;
        await $scope.refreshPreBookData();
    };

    /**
     * @param {number} index
     */
    $scope.changeBulkPageSize = async (index) => {
        $scope.bulkPageIndex = index;
        $scope.bulkPageSizeSelected = index;
        await $scope.refreshBulkData();
    };

    /**
     * @param {number} index
     */
    $scope.pbPageChanged = async (index) => {
        $scope.pbPageIndex = index;
        await $scope.refreshPreBookData();
    };

    /**
     * @param {number} index
     */
    $scope.changePBPageSize = async (index) => {
        $scope.pbPageIndex = index;
        $scope.pbPageSizeSelected = index;
        await $scope.refreshPreBookData();
    };

    /**
     * @param {number} index
     */
    $scope.bulkPageChanged = async index => {
        $scope.bulkPageIndex = index;
        await $scope.refreshBulkData();
    };

    /**
     * @param {number} index
     */
    $scope.changePageSize = async index => {
        $scope.pageIndex = index;
        $scope.pageSizeSelected = index;
        await $scope.refreshData();
    };

    /**
     * @param {string} searchText
     */
    $scope.clientQuerySearch = (searchText) => {
        return uCSData.getActiveClients(searchText);
    };

    /**
     * @param {Suggestion} item
     */
    $scope.selectedClientChange = async (item) => {
        if (!item) {
            $scope.pickDateService.client = null;
            return;
        }

        $scope.pickDateService.client = item.id;
        await $scope.refreshAllData(true);
    };

    /**
     * @param {string} searchText
     */
    $scope.courierQuerySearch = (searchText) => {
        return uCSData.getActiveCouriersSearch(searchText);
    };

    /**
     * @param {Suggestion} item
     */
    $scope.selectedCourierChange = async item => {
        if (!item) {
            $scope.pickDateService.courier = null;
            return;
        }

        $scope.pickDateService.courier = item.id;
        await $scope.refreshAllData(true);
    };


    $scope.highlightEvent = () => {
        $timeout(() => {
            $scope.selectedEvents = $scope.selected || [];
        }, 10);
    };

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
            const e = angular.element("event-notes");
            resetCursor(e);
        }

        $mdDialog.show({
            locals: { dataToPass: currentEvent },
            controller: $scope.eventDialogController,
            scope: $scope,
            preserveScope: true,
            templateUrl: "app/components/CS/partials/createEvent.html",
            parent: $document.body,
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
            locals: { dataToPass: undefined },
            controller: $scope.eventDialogController,
            scope: $scope,
            preserveScope: true,
            templateUrl: "app/components/CS/partials/createEvent.html",
            parent: $document.body,
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

    // Call the init function when the controller loads
    initializeVariables();
};

CSControl.$inject = [
    '$scope',
    'JobDetailService',
    'uCSData',
    '$state',
    '$filter',
    '$mdDialog',
    'greetingService',
    '$document',
    '$timeout',
    'dispatchJobService',
    'toastrService',
    'moment',
    'DispatchData',
    '$mdSidenav',
    'CSLayoutService',
    'APP_CONFIG'
];

app.controller('CSControl', CSControl);
export default CSControl;
