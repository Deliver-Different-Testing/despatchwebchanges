import app from "../../../app";
import "./job-details.styles.less";

class JobDetailController {
    static $inject = ["$mdDialog", "$document", "toastrService", "DispatchData", "$scope", "APP_CONFIG", "rateJobService"];

    /**
     * @param {Object} $mdDialog
     * @param {Object} $document
     * @param {Object} toastrService
     * @param {Object} dispatchData
     * @param {Object} $scope
     * @param {APP_CONFIG} APP_CONFIG
     * @param {Object} rateJobService
     */
    constructor($mdDialog, $document, toastrService, dispatchData, $scope, APP_CONFIG, rateJobService) {
        this.$mdDialog = $mdDialog;
        this.$document = $document;
        this.toastrService = toastrService;
        this.dispatchData = dispatchData;
        this.$scope = $scope;
        this.rateJobService = rateJobService;

        /** @type {boolean} */
        this.isUsCustomer = APP_CONFIG.US_Customer;

        /** @type {Job|undefined} */
        this.job = undefined; // This will be injected by the bindings

        /** @type {{icon: string, text: string, type?: string}[]} */
        this.notes = [];

        /** @type {boolean} */
        this.jobDetailLoading = false

        /** @type {number} */
        this.selectedTab = 0;

        /** @type {Array} */
        this.allTabs = [];

        this.$scope.$watch(() => this.job, (newValue, oldValue) => {
            console.log('Job data changed:', {
                newValue,
                oldValue,
                hasData: !!newValue,
                isInternalUpdate: this.isInternalUpdate
            });

            if (newValue) {
                if (!this.isInternalUpdate) {
                    this.selectedTab = 0;
                    this._initializeJobData();
                    this._updateTabsArray();
                } else {
                    this._initializeJobData();
                }

                this.isInternalUpdate = false;
            }
        });

        this.options = {
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
        }
    }

    /**
     * Updates the tabs array whenever the job or related jobs change
     * @private
     */
    _updateTabsArray() {
        if (!this.job) return;

        this.allTabs = [{
            id: this.job.id,
            text: this.job.jobNo,
            isMainJob: true
        }];

        if (this.job.relatedJobs && this.job.relatedJobs.length) {
            this.allTabs = this.allTabs.concat(
                this.job.relatedJobs.map(job => ({
                    ...job,
                    isMainJob: false
                }))
            );
        }
    }

    /**
     * Handles tab navigation
     * @param {'prev'|'next'} direction
     */
    async navigateTab(direction) {
        if (!this.allTabs.length) return;

        let newIndex;
        if (direction === 'prev') {
            newIndex = this.selectedTab > 0 ? this.selectedTab - 1 : this.allTabs.length - 1;
        } else {
            newIndex = this.selectedTab < this.allTabs.length - 1 ? this.selectedTab + 1 : 0;
        }

        this.selectedTab = newIndex;
        await this._loadJobDetails(this.allTabs[newIndex].id);
    }

    /**
     * Handles when a user changes tabs
     * @param {number} tabIndex
     */
    async onTabSelected(tabIndex) {
        const selectedTab = this.allTabs[tabIndex];
        if (!selectedTab) return;

        await this._loadJobDetails(selectedTab.id);
    }

    /**
     * Loads job details while preserving tab state
     * @param {number} jobId
     * @private
     */
    async _loadJobDetails(jobId) {
        if (!jobId) {
            console.error('Invalid job ID');
            return;
        }

        this.jobDetailLoading = true;
        try {
            // Store current tabs and selected index
            const currentTabs = [...this.allTabs];
            const currentIndex = this.selectedTab;

            // Load new job details
            const updatedJob = await this.dispatchData.getJobDetail(jobId);

            // If this is loading a related job, we need to preserve the original related jobs array
            if (!currentTabs[currentIndex].isMainJob) {
                updatedJob.relatedJobs = this.job.relatedJobs;
            }

            // Set flag to indicate internal update
            this.isInternalUpdate = true;

            // Update the job
            this.job = updatedJob;

            // Keep the tabs and selection state
            this.allTabs = currentTabs;
            this.selectedTab = currentIndex;

            this.$scope.currentSelection = ` for Job ${this.job.jobNo}`;
        } catch (error) {
            console.error("Error loading job details:", error);
            this.toastrService.showErrorToast("Failed to load job details");
            // Optionally reset to main job
            if (this.job && this.job.id) {
                await this._loadJobDetails(this.job.id);
            }
        } finally {
            this.jobDetailLoading = false;
        }
    }


    _initializeJobData() {
        console.log('Initializing job data:', this.job.id);

        const notes = [];

        // Split internal notes by newline and add each as separate entry
        if (this.job.internalNotes) {
            console.log('Processing internal notes:', this.job.internalNotes);
            const internalNoteLines = this.job.internalNotes.split(/\r?\n/).filter(note => note.trim());
            console.log('Split internal notes into', internalNoteLines.length, 'lines:', internalNoteLines);

            internalNoteLines.forEach((noteLine, index) => {
                const trimmedNote = noteLine.trim();
                console.log(`Adding internal note ${index + 1}:`, trimmedNote);
                notes.push({
                    icon: 'note_stack' ,text: trimmedNote, type: 'internal'
                });
            });
        } else {
            console.log('No internal notes found');
        }

        // Split contractor notes by newline and add each as separate entry
        if (this.job.conNote) {
            console.log('Processing contractor notes:', this.job.conNote);
            const contractorNoteLines = this.job.conNote.split(/\r?\n/).filter(note => note.trim());
            console.log('Split contractor notes into', contractorNoteLines.length, 'lines:', contractorNoteLines);

            contractorNoteLines.forEach((noteLine, index) => {
                const trimmedNote = noteLine.trim();
                console.log(`Adding contractor note ${index + 1}:`, trimmedNote);
                notes.push({
                    icon: 'inventory_2', text: trimmedNote, type: 'contractor'
                });
            });
        } else {
            console.log('No con note found');
        }

        this.notes = notes;
        console.log('Final notes array:', this.notes);
    }

    $onInit() {
        console.log('$onInit called - job exists:', !!this.job);
        if (this.job) {
            this._initializeJobData();
        }
    }

    getJobAddressIcon() {
        const icon = this.job?.assignedFlight ? 'flight_takeoff' : 'pin_drop';
        console.log(`[getJobAddressIcon] Icon selected: ${icon}`);
        return icon || 'pin_drop';
    }

    async showNotesInfo($event) {
        this.toastrService.showWarningToast(`Notes are not available for this job`);
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {string} id
     */
    async showNotesDialog($event, job, title, fieldName, id = "editField") {
        try {
            await this.$mdDialog.show({
                controller: "AddNotesDialogController",
                controllerAs: "ctrl",
                templateUrl: "app/components/dialogs/add-notes-dialog/add-notes-dialog.html",
                parent: this.$document.body,
                targetEvent: $event,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    id: id, fieldName: fieldName, title: title, job: job,
                },
                bindToController: true
            });

            // Refresh job detail in background
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {string} url
     * @param {string} placeholder
     * @param {string} fieldName
     * @param {string} title
     * @param {any} existingItem
     * @param {boolean} showRerateOption
     */
    async showAutocompleteDialog($event, job, url, placeholder, fieldName, title, existingItem, showRerateOption) {
        const options = {
            placeholder, minimumInputLength: 3, searchUrl: url
        };

        try {
            await this.$mdDialog.show({
                controller: "AutoCompleteDialogController",
                controllerAs: "ctrl",
                parent: this.$document.body,
                targetEvent: $event,
                templateUrl: "app/components/dialogs/auto-complete-dialog/auto-complete-dialog.html",
                clickOutsideToClose: true,
                fullscreen: false,
                locals: {
                    id: 'editField', fieldName, title, job, options, existingItem, showRerateOption
                },
                bindToController: true
            });

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {Date} time
     */
    async showEditTimeDialog($event, job, title, fieldName, time) {
        try {
            await this.$mdDialog.show({
                controller: "EditDateTimeDialogController",
                controllerAs: "ctrl",
                parent: this.$document.body,
                targetEvent: $event,
                templateUrl: "app/components/dialogs/edit-date-time-dialog/edit-date-time-dialog.html",
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    job, title, fieldName, dateTime: time, id: "editForm", showDate: false, showTime: true
                },
                bindToController: true
            });

            // Refresh job detail in background
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {[]} data
     * @param {string} fieldName
     * @param {string} title
     * @param {string|number|null} initialValue
     * @param {boolean} showCheckbox
     * @param {string} checkboxLabel
     */
    async showSelectDialog($event, job, data, fieldName, title, initialValue = null, showCheckbox = false, checkboxLabel = "") {
        const options = {
            minimumInputLength: 1, items: data, placeholder: title
        };

        try {
            await this.$mdDialog.show({
                controller: "SelectDialogController",
                controllerAs: "ctrl",
                parent: this.$document.body,
                targetEvent: $event,
                templateUrl: "app/components/dialogs/select-dialog/select-dialog.html",
                clickOutsideToClose: true,
                fullscreen: false,
                locals: {
                    id: 'editField', fieldName, title, job, options, initialValue, showCheckbox, checkboxLabel
                },
                bindToController: true
            });

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {string} title
     * @param {string} placeholder
     * @param {string} ariaLabel
     * @param {string|number} initialValue
     * @param {string} field
     */
    async showEditDialog($event, job, title, placeholder, ariaLabel, initialValue, field) {
        const prompt = this.$mdDialog.prompt()
            .title(title)
            .placeholder(placeholder)
            .ariaLabel(ariaLabel)
            .initialValue(initialValue)
            .targetEvent($event)
            .required(true)
            .ok("Save")
            .cancel("Cancel");

        try {
            // Get new value
            const result = await this.$mdDialog.show(prompt);

            // Update in backend
            const callData = {
                "call": "updateDetailField", "field": field, "value": result, "jobID": job.id
            };
            await this.updateField(false, job, callData);

            // Refresh job detail in background
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     * @param {boolean} isDeliveryAddress
     */
    async showAddressDialog($event, job, isDeliveryAddress) {
        const addressToUpdate = isDeliveryAddress ? job.deliveryAddress : job.pickupAddress;
        const pickSuburbs = await this.dispatchData.getSuburbList();

        return this.$mdDialog.show({
            controller: "EditAddressDialogController",
            controllerAs: "ctrl",
            parent: this.$document.body,
            targetEvent: $event,
            templateUrl: "app/components/dialogs/edit-address-dialog/edit-address-dialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                addressDetails: addressToUpdate,
                suburbOptions: pickSuburbs,
                title: "Update Address and GPS",
                submitLabel: "Update",
            },
            bindToController: true
        });
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async showJobDimensionsDialog($event, job) {
        await this.$mdDialog.show({
            controller: "EditParcelDimensionsDialogController",
            controllerAs: "ctrl",
            parent: this.$document.body,
            targetEvent: $event,
            templateUrl: "app/components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                jobId: job.id, parcels: job.parcelDimensions
            },
            bindToController: true
        });

        // Refresh and update job details
        await this._refreshJobDetails(job.id);
    }

    /**
     * Shows a dialog for missing information
     * @param $event
     * @param {Job} job - The job being updated
     * @returns {Promise} A promise that resolves when the dialog is closed
     */
    async showMissingInfoDialog($event, job) {
        let message = "";
        if (!job.completedTime) {
            message = "You must set completed time (POD Time) first";
        } else if (!job.podName) {
            message = "You must set POD Name first";
        }

        const confirm = this.$mdDialog.confirm()
            .title(message)
            .targetEvent($event)
            .ok("OK");

        await this.$mdDialog.show(confirm);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editLogTime($event, job) {
        await this.showEditTimeDialog($event, job, "Log Time", "Time", job.time);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editCompletedTime($event, job) {
        await this.showEditTimeDialog($event, job, "POD Time", "CompletedTime", job.completedTime);
    }

    /**
     * Updates the GPS coordinates and address for a job
     * @param $event
     * @param {Job} job - The job to update
     * @param {string} field - The field to update ('deliveryAddress' or 'pickupAddress')
     */
    async updateAddress($event, job, field) {
        //this.$myElementInkRipple.attach(this.$scope, $event.target);
        const isDeliveryAddress = field === "toAddress";

        try {
            const result = await this.showAddressDialog($event, job, isDeliveryAddress);
            return this._processAddressUpdate(job, field, result, isDeliveryAddress);
        } catch (error) {
            console.log("Error updating GPS:", error);
        }
    }

    /**
     * @param {Job} job
     * @param {string} field
     * @param {Object} addressResult
     * @param {boolean} isDeliveryAddress
     */
    async _processAddressUpdate(job, field, addressResult, isDeliveryAddress) {
        console.log(`isDeliveryAddress: ${isDeliveryAddress}`);

        // Update job by address format
        const updatedJob = this.isUsCustomer ? this._updateJobAddressUs(job, addressResult, isDeliveryAddress) : this._updateJobAddressNz(job, addressResult, isDeliveryAddress);

        try {
            await this.updateJobRateAndAddress(updatedJob, addressResult, isDeliveryAddress);

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * @param {Job} job
     * @param {Object} result
     * @param {boolean} isDeliveryAddress
     */
    _updateJobAddressNz(job, result, isDeliveryAddress) {
        const addressField = isDeliveryAddress ? "toAddress" : "from";
        const suburbIdField = isDeliveryAddress ? "toSuburbId" : "fromSuburbId";
        const suburbField = isDeliveryAddress ? "toSuburbName" : "fromSuburbName";

        job[addressField] = result.addressData.address;
        job[suburbIdField] = result.addressData.suburbId;
        job[suburbField] = result.addressData.suburbName;

        return job;
    }

    /**
     * @param {Job} job
     * @param {Object} addressResult
     * @param {boolean} isDeliveryAddress
     *
     * @private
     */
    _updateJobAddressUs(job, addressResult, isDeliveryAddress) {
        const addressField = isDeliveryAddress ? "deliveryAddress" : "pickupAddress";
        console.log(`Address Field: ${addressField}`);

        job[addressField] = addressResult.addressData;
        return job;
    }

    /**
     * @param {Job} job
     * @param {Object} addressResult
     * @param {boolean} isDeliveryAddress
     *
     * @private
     */
    async updateJobRateAndAddress(job, addressResult, isDeliveryAddress) {
        job.charge = await this.rateJobService.rateJob(job);
        const rate = Number(job.charge.replace(/[^0-9.-]+/g, ""));

        console.log(`Job Rate: ${rate}`);

        if (isDeliveryAddress) {
            await this.dispatchData.updateDeliveryAddress(job.id, rate, FirstName, job.preBook, addressResult.addressData);
        } else {
            await this.dispatchData.updatePickupAddress(job.id, rate, FirstName, job.preBook, addressResult.addressData);
        }
    }

    /**
     * Edit a contact for the job dynamically
     * @param $event
     * @param {Job} job
     * @param {'from'|'to'} contactType - Type of contact to edit ('from' or 'to')
     */
    async editJobContact($event, job, contactType) {
        const contactMapping = {
            from: {
                title: "Edit From Contact Name",
                placeholder: "From Contact Name...",
                fieldLabel: "from contact name",
                contactValue: job.fromContactName,
                contactProperty: "FromContactName"
            }, to: {
                title: "Edit To Contact Name",
                placeholder: "To Contact Name...",
                fieldLabel: "to contact name",
                contactValue: job.deliverToContact,
                contactProperty: "DeliverToContact"
            }
        };

        const contactDetails = contactMapping[contactType];

        if (!contactDetails) {
            throw new Error(`[editJobContact] Invalid contact type: ${contactType}`);
        }

        await this.showEditDialog($event, job, contactDetails.title, contactDetails.placeholder, contactDetails.fieldLabel, contactDetails.contactValue, contactDetails.contactProperty);
    }

    /**
     * Edit a contact phone number for the job dynamically
     * @param $event
     * @param {Job} job
     * @param {'from'|'to'} contactType - Type of contact phone to edit ('from' or 'to')
     */
    async editJobContactPhone($event, job, contactType) {
        const phoneMapping = {
            from: {
                title: "Edit From Contact Phone",
                placeholder: "From Contact Phone...",
                fieldLabel: "from contact phone",
                phoneValue: job.fromContactNumber,
                phoneProperty: "FromContactPhone"
            }, to: {
                title: "Edit To Contact Phone",
                placeholder: "To Contact Phone...",
                fieldLabel: "to contact phone",
                phoneValue: job.toContactPhone,
                phoneProperty: "ToContactPhone"
            }
        };

        const phoneDetails = phoneMapping[contactType];

        if (!phoneDetails) {
            throw new Error(`[editJobContactPhone] Invalid contact type: ${contactType}`);
        }

        await this.showEditDialog($event, job, phoneDetails.title, phoneDetails.placeholder, phoneDetails.fieldLabel, phoneDetails.phoneValue, phoneDetails.phoneProperty);
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {boolean} isRefA
     */
    async editRef($event, job, isRefA) {
        if (isRefA) {
            await this.showEditDialog($event, job, "Edit RefA", "RefA...", "refa", job.refA, "RefA");
        } else {
            await this.showEditDialog($event, job, "Edit RefA", "RefB...", "refb", job.refB, "RefB");
        }
    }


    /**
     * @param $event
     * @param {Job} job
     */
    async editOurRef($event, job) {
        await this.showEditDialog($event, job, "Edit Our Reference", "Our Reference...", "our reference", job.ourRef, "OurRef");
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editJobWeight($event, job) {
        await this.showEditDialog($event, job, "Edit Weight", "Job Weight...", "job weight", job.weight, "Weight");
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editTrackingMobile($event, job) {
        await this.showEditDialog($event, job, "Edit Tracking Mobile", "Tracking Mobile...",
            "tracking mobile", job.trackingMobile, "TrackingMobile");
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editTrackingEmail($event, job) {
        await this.showEditDialog($event, job, "Edit Tracking Email", "Tracking Email...",
            "tracking email", job.trackingEmail, "TrackingEmail");
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async clientClick($event, job) {
        const url = "/home/ActiveClients";
        const placeholder = "Start typing to enter new client...";

        const existingItem = {
            id: job.clientId, text: job.clientName
        }

        await this.showAutocompleteDialog($event, job, url, placeholder, "clientId", "Client", existingItem, true)
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async courierClick($event, job) {
        const url = "/courier/AllActiveSearch";
        const placeholder = "Start typing to search courier...";

        await this.showAutocompleteDialog($event, job, url, placeholder, "CourierID", "Courier", null, false)
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async contactClick($event, job) {
        const pickContacts = await this.dispatchData.getContactList(job.clientId);
        await this.showSelectDialog($event, job, pickContacts, "ContactID", "Contact", job.contactName);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async speedClick($event, job) {
        const pickSpeeds = await this.dispatchData.getSpeedList();
        await this.showSelectDialog($event, job, pickSpeeds, "SpeedID", "Speed", job.speedName);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async jobTypeClick($event, job) {
        console.log('jobTypeClick initiated', {
            eventType: $event.type,
            jobId: job.id,
            currentJobType: job.jobType
        });

        const data = [{
            id: 1, text: "Pickup"
        }, {
            id: 2, text: "Delivery"
        }, {
            id: 3, text: "3rd-Party"
        }];

        const jobTypeDes = this.getJobTypeDescription(job.jobType);
        console.log('Showing select dialog', {
            jobId: job.id,
            jobTypeDes,
            availableOptions: data.length
        });

        try {
            await this.showSelectDialog($event, job, data, "JobTypeID", "Job Type", jobTypeDes);
            console.log('Select dialog completed successfully');
        } catch (error) {
            console.error('Error showing select dialog:', error);
            throw error; // Re-throw to maintain original error handling
        }
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async sizeClick($event, job) {
        const pickVehicleSizes = await this.dispatchData.getVehicleSizes();
        await this.showSelectDialog($event, job, pickVehicleSizes, "Size", "Size", job.size.text);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async dgClassClick($event, job) {
        let dgClassOptions = [];
        for (let i = 1; i <= 9; i++) {
            dgClassOptions.push({id: i, text: i.toString()});
        }

        const initialValue = !job.dgClass ? null : job.dgClass;

        await this.showSelectDialog($event, job, dgClassOptions, "DGClass", "DG Class", initialValue, true, "Has Documentation?");
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async leaveClick($event, job) {
        const pickLeaveList = await this.dispatchData.getLeaveList();
        await this.showSelectDialog($event, job, pickLeaveList, "DeliverToLeaveID", "Leave Parcel", job.sigNotRequired || "Signature Required");
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async trackingMethodClick($event, job) {
        const trackingArray = this.options.detail.tracking.map(item => {
            return {
                id: item.id, text: item.label
            };
        });
        const trackingMethod = this.getTrackingMethod(job.trackingMethod);

        await this.showSelectDialog($event, job, trackingArray,
            "TrackingMethod", "Tracking Method", trackingMethod);
    }

    /**
     * @param {boolean} reRate
     * @param {Job} job
     * @param callData
     */
    async updateField(reRate, job, callData) {
        try {
            if (reRate && !job.bulkJob) {
                const rate = await this.rateJobService.rateJob(job);

                // Ensure rate is decimal
                const numericRate = parseFloat(rate.replace(/[^\d.-]/g, ""));
                if (isNaN(numericRate)) {
                    console.error("Failed to convert rate to a number:", rate);
                }

                await this.dispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, FirstName, ContactID, job.preBook);
            } else {
                // Ensure rate is decimal
                const numericRate = parseFloat(job.charge.replace(/[^\d.-]/g, ""));
                if (isNaN(numericRate)) {
                    console.error("Failed to convert rate to a number");
                }

                if (job.bulkJob) {
                    await this.dispatchData.updateBulkJobDetail(job.id, callData.field, callData.value, numericRate, FirstName, ContactID);
                } else {
                    await this.dispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, FirstName, ContactID, job.preBook);
                }
            }
        } catch (error) {
            console.error("Error updating job:", error);
            this.toastrService.showErrorToast("Failed to update job. Please try again.");
            throw error;
        }
    }

    /**
     * @param {number} jobTypeId
     */
    getJobTypeDescription(jobTypeId) {
        console.log(`Getting job type description for jobTypeId: ${jobTypeId}`);
        const description = (() => {
            switch (jobTypeId || 1) {
                case 1:
                    return "Pickup";
                case 2:
                    return "Delivery";
                case 3:
                    return "3rd-Party";
                default:
                    console.warn(`Unknown jobTypeId: ${jobTypeId}, defaulting to "Pickup"`);
                    return "Pickup";
            }
        })();

        console.log(`Resolved job type description: ${description}`);
        return description;
    }


    /**
     * @param {Job} job
     */
    hasDGDocs(job) {
        if (job.dgClass) {
            return ((job.dgDocumentation || 0) === 1) || ((job.dgDocumentation || false) === true) ? "Yes" : "No";
        } else {
            return "";
        }
    }

    /**
     * Generic function to toggle any job property
     * Handles unique behavior for specific properties, including 'reprice'
     * @param {Job} job - The job to update
     * @param {string} property - The property to toggle
     * @param {boolean} useCharge - Whether to use the job's charge value (default: true)
     */
    async toggleJobProperty(job, property, useCharge = true) {
        const newValue = !job[property];
        const capitalizedProperty = property.charAt(0).toUpperCase() + property.slice(1);

        const updateJob = async (rate) => {
            await this.dispatchData.updateJobDetail(job.id, capitalizedProperty, newValue, rate, FirstName, ContactID, job.preBook);
        };

        try {
            // Special handling for "reprice"
            if (property === "reprice") {
                const previousStatus = job.internalStatusId;

                const callData = {
                    call: "updateDetailField", field: "Reprice", value: newValue, jobID: job.id
                };

                // Update the reprice status
                await this.updateField(false, job, callData);

                if (newValue) {
                    const repriceStatusId = 4; // Assuming ID 4 is for reprice status
                    await this.dispatchData.updateJobDetail(job.id, "InternalStatusID", repriceStatusId, job.charge, FirstName, ContactID, job.preBook);
                } else if (previousStatus) {
                    await this.dispatchData.updateJobDetail(job.id, "InternalStatusID", previousStatus, job.charge, FirstName, ContactID, job.preBook);
                }
            }  // Special handling for "van"
            else if (property === "van") {
                const callData = {
                    call: "updateDetailField", field: "Van", value: newValue, jobID: job.id
                };

                await this.updateField(true, job, callData);
            } // Special handling for "vanOK"
            else if (property === "vanOK") {
                const callData = {
                    call: "updateDetailField", field: "VanOK", value: newValue, jobID: job.id
                };

                await this.updateField(true, job, callData);
            }
            // General handling for other properties
            else {
                // General toggle logic for other properties
                if (useCharge) {
                    await updateJob(job.charge);
                } else {
                    const rate = await this.rateJobService.rateJob(job);
                    await updateJob(this._extractNumericRate(rate));
                }
            }

            // Show success toast and refresh job details
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error(`Error toggling ${property}:`, error);
            this.toastrService.showErrorToast(`Failed to update ${property}. Please try again.`);
        }
    }

    /**
     * Toggles a specific property of a job
     * Certain properties may require special handling
     * @param {Job} job - The job to update
     * @param {string} property - The property to toggle
     */
    async toggleProperty(job, property) {
        const propertiesUsingDefaultCharge = ["pedal", "truck", "direct", "attention", "return", "oneOff", "Active", "Void", "van", "vanOK", "done", "reprice"];
        const useCharge = propertiesUsingDefaultCharge.includes(property);
        await this.toggleJobProperty(job, property, useCharge);
    }

    /**
     * Special handling for marking a job as done
     * @param $event
     * @param {Job} job - The job to update
     */
    async markJobAsDone($event, job) {
        if (!job.completedTime || !job.podName) {
            try {
                await this.showMissingInfoDialog($event, job);
            } catch (error) {
                this._handleError(error);
                return;
            }
        }

        try {
            await this.dispatchData.updatePODDetail(job.jobNo, 6, job.podName, job.completedTime);

            this.toastrService.showSuccessToast(`Job ${job.jobNo} marked as done successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            const message = "Failed to mark job as done. Please try again.";
            console.error(message);
            this.toastrService.showErrorToast(message);
        }
    }

    /**
     * Refreshes the job details in the background after an update
     * @param {number} jobId - The ID of the job to refresh
     * @returns {Promise<void>}
     * @private
     */
    async _refreshJobDetails(jobId) {
        this.jobDetailLoading = true; // Show loader
        try {
            if (this.job) {
                this.job = await this.dispatchData.getJobDetail(jobId);
            }
        } catch (error) {
            console.error("Error refreshing job details:", error);
            this.toastrService.showErrorToast();
        } finally {
            this.jobDetailLoading = false; // Hide loader
        }
    }

    _handleError(error) {
        if (error === undefined) {
            console.log("User closed dialog");
        } else {
            console.error(error);
            this.toastrService.showErrorToast();
        }
    }

    /**
     * Extracts the numeric rate from a string
     * @param {string} rate - The rate string to parse
     * @returns {number} The numeric rate
     */
    _extractNumericRate(rate) {
        return Number(rate.replace(/[^0-9.-]+/g, ""));
    }

    /**
     * @param {number} trackingMethod
     */
    getTrackingMethod(trackingMethod) {
        switch (trackingMethod || 0) {
            case 1:
                return "Email";
            case 2:
                return "Mobile";
            case 3:
                return "Email & Mobile";
            default:
                return "";
        }
    }
}

app.component('jobDetailWidget', {
    templateUrl: 'app/components/common/job-details/job-details.template.html', controllerAs: 'ctrl', bindings: {
        job: '='
    }, controller: JobDetailController
});
