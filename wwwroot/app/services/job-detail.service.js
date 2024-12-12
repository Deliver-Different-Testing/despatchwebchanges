class JobDetailService {
    constructor(DispatchData, $mdDialog, toastrService, rateJobService, $document, moment, versionUrl, APP_CONFIG, $rootScope) {
        this.DispatchData = DispatchData;
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.rateJobService = rateJobService;
        this.$document = $document;
        this.moment = moment;
        this.versionUrl = versionUrl;
        this.APP_CONFIG = APP_CONFIG;
        this.$rootScope = $rootScope;

        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.jobDetailLoading = false;
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

        this.pickContacts = [];

        this.gather = {};

        this.pickHolidays = [{
            "id": "0", "label": "Don't Book"
        }, {
            "id": "1", "label": "Next Business Day"
        }];

        this.pickDays = [{
            "id": "0", "label": "Monday"
        }, {
            "id": "1", "label": "Tuesday"
        }, {
            "id": "2", "label": "Wednesday"
        }, {
            "id": "3", "label": "Thursday"
        }, {
            "id": "4", "label": "Friday"
        }, {
            "id": "5", "label": "Saturday"
        }, {
            "id": "6", "label": "Sunday"
        }];
        this.pickFrequency = [{
            "id": "0", "label": "Weekly"
        }, {
            "id": "1", "label": "Fortnightly"
        }, {
            "id": "2", "label": "First of the Month"
        }, {
            "id": "3", "label": "Second of the Month"
        }, {
            "id": "4", "label": "Third of the Month"
        }, {
            "id": "5", "label": "Last of the Month"
        }, {
            "id": "6", "label": "First work day of the Month"
        }, {
            "id": "7", "label": "Last work day of the Month"
        }];

        this.combos = {
            "frequency": [], "frequencyEvents": {}, "days": [], "daysEvents": {
                onSelectionChanged: function (item) {
                    const self = this;

                    console.log("Days =");
                    console.log(self.combos.days);
                    if (self.combos.frequency.length > 0 && self.combos.days.length > 0 && self.combos.holidays.length > 0) {
                        let newDays = "0000000";
                        for (let i = 0; i < self.combos.days.length; i++) {
                            newDays = newDays.replaceAt(parseInt(self.combos.days[i].id), "1");
                        }
                        newDays = newDays + self.combos.frequency[0].id + self.combos.holidays[0].id;
                        console.log(newDays);
                        return DispatchData
                            .updateJobDetail(self.currentJob.id, "Days", newDays, self.currentJob.charge, FirstName, ContactID, self.currentJob.preBook).then(response => {
                                self.selectJobDetail(self.currentJob.id);
                                return response;
                            });
                    } else {
                        console.log("invalid data");
                    }
                }
            }, "holidays": [], "holidaysEvents": {
                onSelectionChanged: function (item) {
                    const self = this;

                    console.log("Days =");
                    console.log(self.combos.days);
                    if (self.combos.frequency.length > 0 && self.combos.days.length > 0 && self.combos.holidays.length > 0) {
                        let newDays = "0000000";
                        for (let i = 0; i < this.combos.days.length; i++) {
                            newDays = newDays.replaceAt(parseInt(self.combos.days[i].id), "1");
                        }
                        newDays = newDays + self.combos.frequency[0].id + self.combos.holidays[0].id;
                        console.log(newDays);
                        return DispatchData
                            .updateJobDetail(self.currentJob.id, "Holidays", newDays, self.currentJob.charge, FirstName, ContactID, self.currentJob.preBook).then(response => {
                                self.selectJobDetail(self.currentJob.id);
                                return response;
                            });
                    } else {
                        console.log("invalid data");
                    }
                }
            }
        };

        String.prototype.replaceAt = function (index, replacement) {
            return this.substring(0, index) + replacement + this.substring(index + replacement.length);
        };

        return this;
    }

    /**
     * @param {*|{cancel: (function(): *), submitValue: string, submit(): void, showForm: $scope.gather.showForm}} g
     */
    setGather(g) {
        this.gather = g;
    }

    /**
     * @param {number} jobId
     */
    setSelectJobDetail(jobId) {
        this.selectJobDetail = jobId;
    }

    setSelectBulkJobDetail(f) {
        this.selectBulkJobDetail = f;
    }

    /**
     * @param {Job} job
     */
    async setJob(job) {
        this.currentJob = job;
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
     * @param $event
     * @param {Job} job
     */
    async displayPriceBreakdown($event, job) {
        console.log('Starting displayPriceBreakdown for job:', job.id);
        $event.stopPropagation();

        /**
         * @param {string} description
         */
        const showDialog = async (description) => {
            console.log('Opening price breakdown dialog');
            return this.$mdDialog.show(this.$mdDialog.alert()
                .parent(this.$document.body)
                .clickOutsideToClose(true)
                .title('Charge Information')
                .htmlContent(description)
                .ariaLabel('Alert Dialog')
                .ok('OK'));
        };

        try {
            console.log('Fetching price breakdown data for job:', job.id);
            const data = await this.DispatchData.getPriceBreakdown(job.id);
            console.log('Received price breakdown data:', data);

            console.log('Formatting price breakdown');
            const formattedBreakdown = this.formatPriceBreakDown(data);
            console.log('Formatted breakdown:', formattedBreakdown);

            console.log('Showing dialog with formatted breakdown');
            await showDialog(formattedBreakdown);
            console.log('Dialog closed successfully');
        } catch (error) {
            console.error('Error in displayPriceBreakdown:', error);
            this.toastrService.showErrorToast('An error occurred while fetching the price breakdown. Please try again.');
        }
    }

    /**
     * @param {PriceBreakdown[]} data - Array of price breakdown items
     * @returns {string} Formatted price breakdown string with HTML line breaks
     */
    formatPriceBreakDown(data) {
        let breakdownString = '';
        let total = 0;

        data.forEach(item => {
            breakdownString += `${item.name}: $${item.amount.toFixed(2)}<br>`;
            total += item.amount;
        });

        breakdownString += `<br>Total: $${total.toFixed(2)}`;
        return breakdownString;
    };

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
                controller: 'AddNotesDialogController',
                controllerAs: "ctrl",
                templateUrl: this.versionUrl("app/components/dialogs/add-notes-dialog/add-notes-dialog.html"),
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
     * Shows a dialog for editing a date
     * @param $event
     * @param {Job} job - The job being edited
     * @param {string} title - The title of the dialog
     * @param {string} fieldName - The name of the field being edited
     * @param {string} date - The current date value
     * @param {string} [id="editForm"] - The ID for the form
     * @returns {Promise} A promise that resolves when the dialog is closed
     */
    async showEditDateDialog($event, job, title, fieldName, date, id = "editForm") {
        try {
            await this.$mdDialog.show({
                controller: 'EditDateTimeDialogController',
                controllerAs: 'ctrl',
                parent: this.$document.body,
                targetEvent: $event,
                templateUrl: this.versionUrl("app/components/dialogs/edit-date-time-dialog/edit-date-time-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    job, title, fieldName, dateTime: date, id, showDate: true, showTime: false
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
     * Opens a dialog to edit the job date
     * @param $event
     * @param {Job} job - The job to edit
     */
    async editJobDate($event, job) {
        await this.showEditDateDialog($event, job, "Date", "Date", job.date);
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {Date} time
     * @param {string} id
     */
    async showEditTimeDialog($event, job, title, fieldName, time, id = "editForm") {

        try {
            await this.$mdDialog.show({
                controller: 'EditDateTimeDialogController',
                controllerAs: 'ctrl',
                parent: this.$document.body,
                targetEvent: $event,
                templateUrl: this.versionUrl("app/components/dialogs/edit-date-time-dialog/edit-date-time-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    job, title, fieldName, dateTime: time, id, showDate: false, showTime: true
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
     */
    async editLogTime($event, job) {
        await this.showEditTimeDialog($event, job, "Time", "Time", job.time);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    editCompletedTime($event, job) {
        return this.showEditTimeDialog($event, job, "Completed Time", "CompletedTime", job.completedTime);
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {Date} datetime
     * @param {string} id
     */
    async showEditDateTimeDialog($event, job, title, fieldName, datetime, id = "editForm") {
        try {
            await this.$mdDialog.show({
                controller: 'EditDateTimeDialogController',
                controllerAs: 'ctrl',
                parent: this.$document.body,
                targetEvent: $event,
                templateUrl: this.versionUrl("app/components/dialogs/edit-date-time-dialog/edit-date-time-dialog.html"),
                clickOutsideToClose: false,
                fullscreen: true,
                locals: {
                    job, title, fieldName, dateTime: datetime, id, showDate: true, showTime: true
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
     */
    async editFollowUpTime($event, job) {
        await this.showEditDateTimeDialog($event, job, "Follow Up Time", "FollowupTime", job.followupTime);
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
    async showEditPrompt($event, job, title, placeholder, ariaLabel, initialValue, field) {
        const prompt = this.$mdDialog.prompt()
            .title(title)
            .placeholder(placeholder)
            .ariaLabel(ariaLabel)
            .initialValue(initialValue)
            .targetEvent($event)
            .required(true)
            .ok('Save')
            .cancel('Cancel');

        try {
            // Get new value
            const result = await this.$mdDialog.show(prompt);

            // Update in backend
            const callData = {
                "call": "updateDetailField", "field": field, "value": result, "jobID": job.id
            };
            await this.updateField(true, job, callData);

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
     */
    async editClientCode($event, job) {
        await this.showEditPrompt($event, job, 'Edit Client Code', 'Client Code...', 'client code', job.client, 'ClientCode');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editItems($event, job) {
        await this.showEditPrompt($event, job, 'Edit Items', 'Items...', 'items', job.items, 'Items');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editJobToPhone($event, job) {
        return this.showEditPrompt($event, job, 'Edit To Contact Phone', 'To Contact Phone...', 'to contact phone', job.toContactPhone, 'ToContactPhone');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editJobFromPhone($event, job) {
        await this.showEditPrompt($event, job, 'Edit From Contact Phone', 'From Contact Phone...', 'from contact phone', job.fromContactNumber, 'FromContactPhone');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editToJobContact($event, job) {
        await this.showEditPrompt($event, job, 'Edit To Contact Name', 'To Contact Name...', 'to contact name', job.deliverToContact, 'DeliverToContact');
    }

    /**
     * @param $event
     * @param {Job} job
     */

    async editPodName($event, job) {
        await this.showEditPrompt($event, job, 'Edit POD Name', 'POD Name...', 'pod name', job.podName, 'PODName');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editFromJobContact($event, job) {
        await this.showEditPrompt($event, job, 'Edit From Contact Name', 'From Contact Name...', 'from contact name', job.fromContactName, 'FromContactName');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editJobWeight($event, job) {
        await this.showEditPrompt($event, job, 'Edit Weight', 'Job Weight...', 'job weight', job.weight, 'Weight');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editAmount($event, job) {
        await this.showEditPrompt($event, job, 'Amount', 'Amount...', 'job weight', job.charge, 'Amount');
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {boolean} isRefA
     */
    async editRef($event, job, isRefA) {
        if (isRefA) {
            await this.showEditPrompt($event, job, 'Edit RefA', 'RefA...', 'refa', job.refA, 'RefA');
        } else {
            await this.showEditPrompt($event, job, 'Edit RefA', 'RefB...', 'refb', job.refB, 'RefB');
        }
    }


    /**
     * @param $event
     * @param {Job} job
     */
    async editOurRef($event, job) {
        await this.showEditPrompt($event, job, 'Edit Our Reference', 'Our Reference...', 'our reference', job.ourRef, 'OurRef');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editTrackingMobile($event, job) {
        await this.showEditPrompt($event, job, 'Edit Tracking Mobile', 'Tracking Mobile...', 'tracking mobile', job.trackingMobile, 'TrackingMobile');
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async editTrackingEmail($event, job) {
        await this.showEditPrompt($event, job, 'Edit Tracking Email', 'Tracking Email...', 'tracking email', job.trackingEmail, 'TrackingEmail');
    }

    /**
     * @param $event
     * @param {Job} currentJob
     */
    async editJobDimensions($event, currentJob) {
        const dimensions = currentJob.parcelDimensions;
        const jobId = currentJob.id;

        await this.$mdDialog.show({
            controller: 'EditParcelDimensionsDialogController',
            controllerAs: 'ctrl',
            parent: this.$document.body,
            targetEvent: $event,
            templateUrl: this.versionUrl("app/components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                jobId, dimensions
            },
            bindToController: true
        });

        // Show feature in development dialog
        await this._showFeatureInDevelopment();
    }

    /**
     * @param reRate
     * @param {Job} job
     * @param callData
     */
    async updateField(reRate, job, callData) {
        try {
            if (reRate && !job.bulkJob) {
                const rate = await this.rateJobService.rateJob(job);

                // Ensure rate is decimal
                const numericRate = parseFloat(rate.replace(/[^\d.-]/g, ''));
                if (isNaN(numericRate)) {
                    console.error('Failed to convert rate to a number:', rate);
                }

                await this.DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, FirstName, ContactID, job.preBook);
            } else {
                // Ensure rate is decimal
                const numericRate = parseFloat(job.charge.replace(/[^\d.-]/g, ''));
                if (isNaN(numericRate)) {
                    console.error('Failed to convert rate to a number:', rate);
                }

                if (job.bulkJob) {
                    await this.DispatchData.updateBulkJobDetail(job.id, callData.field, callData.value, numericRate, FirstName, ContactID);
                } else {
                    await this.DispatchData.updateJobDetail(callData.jobID, callData.field, callData.value, numericRate, FirstName, ContactID, job.preBook);
                }
            }
        } catch (error) {
            console.error('Error updating job:', error);
            this.toastrService.showErrorToast('Failed to update job. Please try again.');
            throw error;
        }
    }

    /**
     * Updates the GPS coordinates and address for a job
     * @param $event
     * @param {Job} currentJob - The job to update
     * @param {string} field - The field to update ('deliveryAddress' or 'pickupAddress')
     */
    async updateAddress($event, currentJob, field) {
        const isDeliveryAddress = field === "toAddress";

        try {
            const result = await this.showAddressDialog($event, currentJob, isDeliveryAddress);
            return this._processAddressUpdate(currentJob, field, result, isDeliveryAddress);
        } catch (error) {
            console.log('Error updating GPS:', error);
        }
    }

    /**
     * @param {Object} event
     * @param {Job} currentJob
     * @param {boolean} isDeliveryAddress
     */
    async showAddressDialog(event, currentJob, isDeliveryAddress) {
        const addressToUpdate = isDeliveryAddress ? currentJob.deliveryAddress : currentJob.pickupAddress;
        const pickSuburbs = await this.DispatchData.getSuburbList();

        return this.$mdDialog.show({
            controller: 'EditAddressDialogController',
            controllerAs: 'ctrl',
            parent: this.$document.body,
            targetEvent: event,
            templateUrl: this.versionUrl("app/components/dialogs/edit-address-dialog/edit-address-dialog.html"),
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
     * @param {Job} job
     * @param {string} field
     * @param {Object} addressResult
     * @param {boolean} isDeliveryAddress
     */
    async _processAddressUpdate(job, field, addressResult, isDeliveryAddress) {
        console.log('isDeliveryAddress: ' + isDeliveryAddress);

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
        const addressField = isDeliveryAddress ? 'toAddress' : 'from';
        const suburbIdField = isDeliveryAddress ? 'toSuburbId' : 'fromSuburbId';
        const suburbField = isDeliveryAddress ? 'toSuburbName' : 'fromSuburbName';

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
        const addressField = isDeliveryAddress ? 'deliveryAddress' : 'pickupAddress';
        console.log('Address Field: ' + addressField);

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

        console.log('Job Rate: ' + rate);

        if (isDeliveryAddress) {
            await this.DispatchData.updateDeliveryAddress(job.id, rate, FirstName, job.preBook, addressResult.addressData);
        } else {
            await this.DispatchData.updatePickupAddress(job.id, rate, FirstName, job.preBook, addressResult.addressData);
        }
    }

    /**
     * Unlocks a job
     * @param {Job} job - The job to be unlocked
     */
    async unlockJob(job) {
        try {
            const callData = {
                "call": "updateDetailField", "field": 'Locked', "value": false, "jobID": job.id
            };

            await this.updateField(false, job, callData);

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error('An error occured unlocking the job.');
        }
    }

    /**
     * Locks a job
     * @param {Job} job - The job to be locked
     */
    async lockJob(job) {
        try {
            const callData = {
                "call": "updateDetailField", "field": 'Locked', "value": true, "jobID": job.id
            };

            await this.updateField(false, job, callData);

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error('An error occured locking the job.');
        }
    }

    /**
     * @param {Job} job
     */
    async pushToLive(job) {
        job.done = !job.done;

        try {
            const response = await this.DispatchData.releaseBulkJob(job.jobNo, job.bookedDate);
            await this.selectBulkJobDetail(job.id);
            return response;
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Toggles the VanOK status of a job
     * @param {Job} job - The job to update
     */
    async vanOkClick(job) {
        const vanOkValue = !job.vanOK;
        try {
            const callData = {
                "call": "updateDetailField", "field": 'VanOK', "value": vanOkValue, "jobID": job.id
            };

            await this.updateField(true, job, callData);
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * @param {Job} job
     */
    async vanClick(job) {
        const vanValue = !job.van;

        try {
            const callData = {
                "call": "updateDetailField", "field": 'Van', "value": vanValue, "jobID": job.id
            };

            await this.updateField(true, job, callData);
            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * Extracts the numeric rate from a string
     * @param {string} rate - The rate string to parse
     * @returns {number} The numeric rate
     */
    extractNumericRate(rate) {
        return Number(rate.replace(/[^0-9.-]+/g, ""));
    }

    /**
     * Generic function to toggle a job property
     * @param {Job} job
     * @param {string} property
     * @param {boolean} useCharge
     */
    async toggleJobProperty(job, property, useCharge = true) {
        const newValue = !job[property];
        const capitalizedProperty = property.charAt(0).toUpperCase() + property.slice(1);

        const updateJob = async (rate) => {
            await this.DispatchData.updateJobDetail(job.id, capitalizedProperty, newValue, rate, FirstName, ContactID, job.preBook);
        };

        try {
            if (useCharge) {
                await updateJob(job.charge);
            } else {
                const rate = await this.rateJobService.rateJob(job);
                await updateJob(this.extractNumericRate(rate));
            }

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            this._handleError(error);
        }
    }

    /**
     * Toggles the Pedal status of a job
     * @param {Job} job - The job to update
     */
    async pedalClick(job) {
        await this.toggleJobProperty(job, 'pedal');
    }

    /**
     * Toggles the Truck status of a job
     * @param {Job} job - The job to update
     */
    async truckClick(job) {
        await this.toggleJobProperty(job, 'truck');
    }

    /**
     * Toggles the Direct status of a job
     * @param {Job} job - The job to update
     */
    async directClick(job) {
        await this.toggleJobProperty(job, 'direct');
    }

    /**
     * Toggles the Attention status of a job
     * @param {Job} job - The job to update
     */
    async attentionClick(job) {
        await this.toggleJobProperty(job, 'attention');
    }

    /**
     * Toggles the Reprice status of a job
     * @param {Job} job - The job to update
     */
    async repriceClick(job) {
        try {
            // Store previous status before update
            const previousStatus = job.internalStatusId;

            // Prepare the call data for updating the reprice status
            const callData = {
                "call": "updateDetailField", "field": 'Reprice', "value": !job.reprice, "jobID": job.id
            };

            // Update the job
            await this.updateField(false, job, callData);

            // If job moves to reprice status, update internal status
            if (this.currentJob.reprice) {
                const repriceStatusId = 4; // Assuming 4 is the ID for reprice status
                await this.DispatchData.updateJobDetail(job.id, "InternalStatusID", repriceStatusId, job.charge, FirstName, ContactID, job.preBook);
            }

            // If job moves out of reprice status, restore previous status
            if (!this.currentJob.reprice && previousStatus) {
                await this.DispatchData.updateJobDetail(job.id, "InternalStatusID", previousStatus, job.charge, FirstName, ContactID, job.preBook);
            }

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            console.error('Error in repriceClick:', error);
            this.toastrService.showErrorToast('Failed to update reprice status. Please try again.');
        }
    }

    /**
     * Toggles the Return status of a pre-booked job
     * @param {Job} job - The job to update
     */
    async preBookReturnClick(job) {
        await this.toggleJobProperty(job, 'return');
    }

    /**
     * Toggles the OneOff status of a job
     * @param {Job} job - The job to update
     */
    async oneOffClick(job) {
        await this.toggleJobProperty(job, 'oneOff');
    }

    /**
     * Toggles the Active status of a job
     * @param {Job} job - The job to update
     */
    async activeClick(job) {
        await this.toggleJobProperty(job, 'Active');
    }

    /**
     * Toggles the Void status of a job
     * @param {Job} job - The job to update
     */
    async voidClick(job) {
        await this.toggleJobProperty(job, 'Void');
    }

    /**
     * Marks a job as done
     * @param $event
     * @param {Job} job - The job to update
     */
    async doneClick($event, job) {
        if (!job.completedTime || !job.podName) {
            try {
                await this.showMissingInfoDialog($event, job);
            } catch (error) {
                this._handleError(error);
            }
        }

        try {
            await this.DispatchData.updatePODDetail(job.jobNo, 6, job.podName, job.completedTime);

            this.toastrService.showSuccessToast(`Job ${job.jobNo} updated successfully. Refreshing..`);
            await this._refreshJobDetails(job.id);
        } catch (error) {
            const message = "Failed to mark job as done. Please try again.";
            console.error(message);
            this.toastrService.showErrorToast(message);
        }
    }

    /**
     * Shows a dialog for missing information
     * @param $event
     * @param {Job} job - The job being updated
     * @returns {Promise} A promise that resolves when the dialog is closed
     */
    showMissingInfoDialog($event, job) {
        let message = '';
        if (!job.completedTime) {
            message = 'You must set completed time (POD Time) first';
        } else if (!job.podName) {
            message = 'You must set POD Name first';
        }

        const confirm = this.$mdDialog.confirm()
            .title(message)
            .targetEvent($event)
            .ok('OK');

        return this.$mdDialog.show(confirm);
    }

    /**
     * Toggles the Delivered status of a job
     * @param {Job} job - The job to update
     */
    async deliveredClick(job) {
        await this.toggleJobProperty(job, 'done');
    }

    /**
     * Toggles the AirportOnly status of a job
     * @param {Job} job - The job to update
     */
    async airportOnlyClick(job) {
        await this.toggleJobProperty(job, 'airportOnly');
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

        await this.showSelectDialog($event, job, trackingArray, "TrackingMethod", "Tracking Method", this.getTrackingMethod(job.trackingMethod));
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async leaveClick($event, job) {
        const pickLeaveList = await this.DispatchData.getLeaveList();
        await this.showSelectDialog($event, job, pickLeaveList, "DeliverToLeaveID", "Leave Parcel", job.sigNotRequired || "Signature Required");
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async undeliverableClick($event, job) {
        const pickUndeliverableList = await this.DispatchData.getUndeliverableList();
        await this.showSelectDialog($event, job, pickUndeliverableList, "UndeliverableLocationID", "Undeliverable Location", job.udStatus);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async sizeClick($event, job) {
        const pickVehicleSizes = await this.DispatchData.getVehicleSizes();
        await this.showSelectDialog($event, job, pickVehicleSizes, "Size", "Size", job.size.text);
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {[]} data
     * @param {string} fieldName
     * @param {string} title
     * @param {string|number|null} initialValue
     * @param {string} id
     * @param {boolean} showCheckbox
     * @param {string} checkboxLabel
     */
    async showSelectDialog($event, job, data, fieldName, title, initialValue = null, id = "editField", showCheckbox = false, checkboxLabel = "") {
        const options = {
            minimumInputLength: 1, items: data, placeholder: title
        };

        try {
            await this.$mdDialog.show({
                controller: 'SelectDialogController',
                controllerAs: 'ctrl',
                parent: this.$document.body,
                targetEvent: $event,
                templateUrl: this.versionUrl('app/components/dialogs/select-dialog/select-dialog.html'),
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    id, fieldName, title, job, options, initialValue, showCheckbox, checkboxLabel
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
     */
    async statusClick($event, job) {
        const pickStatus = await this.DispatchData.getStatusList();
        await this.showSelectDialog($event, job, pickStatus, "Status", "Status", job.statusId);
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

        await this.showSelectDialog($event, job, dgClassOptions, "DGClass", "DG Class", initialValue, "editField", true, "Has Documentation?");
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async notifyClick($event, job) {
        const pickSpeeds = await this.DispatchData.getSpeedList();
        await this.showSelectDialog($event, job, pickSpeeds, "NotifiedJobTypeID", "Notified", job.notifiedName);
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async acceptedClick($event, job) {
        const pickSpeeds = await this.DispatchData.getSpeedList();
        await this.showSelectDialog($event, job, pickSpeeds, "AcceptedJobTypeID", "Accepted", job.acceptedName);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async speedClick($event, job) {
        const pickSpeeds = await this.DispatchData.getSpeedList();
        await this.showSelectDialog($event, job, pickSpeeds, "SpeedID", "Speed", job.speedName);
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async contactClick($event, job) {
        const pickContacts = await this.DispatchData.getContactList(job.clientId);
        await this.showSelectDialog($event, job, pickContacts, "ContactID", "Contact", job.contactName);
    }

    /**
     * @param {number} jobTypeID
     */
    getJobTypeDescription(jobTypeID) {
        switch (jobTypeID || 1) {
            case 1:
                return "Pickup";
            case 2:
                return "Delivery";
            case 3:
                return "3rd-Party";
            default:
                return "Pickup";
        }
    }

    /**
     * @param $event
     * @param {Job} job
     */
    async jobTypeClick($event, job) {
        const data = [{
            id: 1, text: 'Pickup'
        }, {
            id: 2, text: 'Delivery'
        }, {
            id: 3, text: '3rd-Party'
        }];

        const jobTypeDes = this.getJobTypeDescription(job.jobType);
        await this.showSelectDialog($event, job, data, "JobTypeID", "Job Type", jobTypeDes);
    }

    /**
     * @param $event
     * @param {Job} job
     * @param {string} url
     * @param {string} placeholder
     * @param {string} fieldName
     * @param {string} title
     * @param {string} id
     * @param {null} existingItem
     * @param {boolean} showRerateOption
     */
    async showAutocompleteDialog($event, job, url, placeholder, fieldName, title, existingItem, showRerateOption, id = "editField") {
        const options = {
            placeholder, minimumInputLength: 3, searchUrl: url
        };

        try {
            await this.$mdDialog.show({
                controller: 'AutoCompleteDialogController',
                controllerAs: 'ctrl',
                parent: this.$document.body,
                targetEvent: $event,
                templateUrl: this.versionUrl('app/components/dialogs/auto-complete-dialog/auto-complete-dialog.html'),
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    id, fieldName, title, job, options, existingItem, showRerateOption
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
     * Shows a dialog for creating or editing a pallet
     * @param $event
     * @param {Job} job - The job associated with the pallet
     * @param {Object} [existingPallet] - The pallet to edit (if editing an existing pallet)
     */
    async showPalletDialog($event, job, existingPallet = undefined) {
        const isEditing = !!existingPallet;
        const dialogTitle = isEditing ? 'Edit Pallet' : 'New Pallet';

        try {
            await this.$mdDialog.show({
                controller: 'PalletDialogController',
                controllerAs: "ctrl",
                templateUrl: this.versionUrl("app/components/dialogs/add-pallet-dialog/add-pallet-dialog.html"),
                parent: this.$document.body,
                targetEvent: $event,
                clickOutsideToClose: true,
                fullscreen: true,
                locals: {
                    job, dispatcherName: FirstName, contactId: ContactID, existingPallet, dialogTitle
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
     * Opens a dialog to create a new pallet
     * @param {Object} $event - The triggering event
     * @param {Job} job - The job to associate with the new pallet
     * @returns {Promise} A promise that resolves when the creation is complete
     */
    async newPallet($event, job) {
        await this.showPalletDialog($event, job);
    }

    /**
     * Opens a dialog to edit an existing pallet
     * @param {Object} $event - The triggering event
     * @param {Job} job - The job associated with the pallet
     * @param {Object} pallet - The pallet to edit
     * @returns {Promise} A promise that resolves when the edit is complete
     */
    async editPallet($event, job, pallet) {
        await this.showPalletDialog($event, job, pallet);
    }

    async _showFeatureInDevelopment() {
        // Show feature in development dialog
        await this.$mdDialog.show({
            controller: 'FeatureInDevelopmentDialogController',
            controllerAs: 'ctrl',
            templateUrl: this.versionUrl('app/components/dialogs/feature-in-development-dialog/feature-in-development-dialog.html'),
            parent: this.$document.body,
            clickOutsideToClose: true,
            bindToController: true
        });
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
            if (this.currentJob) {
                this.currentJob = await this.DispatchData.getJobDetail(jobId);
            }
        } catch (error) {
            console.error('Error refreshing job details:', error);
            this.toastrService.showErrorToast();
        } finally {
            this.jobDetailLoading = false; // Hide loader
        }
    }

    _handleError(error) {
        if (error === undefined) {
            console.log('User closed dialog');
        } else {
            console.error(error);
            this.toastrService.showErrorToast();
        }
    }
}

angular.module('uDispatch').service('JobDetailService', ["DispatchData", "$mdDialog", "toastrService", "rateJobService", "$document", "moment", "versionUrl", "APP_CONFIG", "$rootScope", (DispatchData, $mdDialog, toastrService, rateJobService, $document, moment, versionUrl, APP_CONFIG, $rootScope) => new JobDetailService(DispatchData, $mdDialog, toastrService, rateJobService, $document, moment, versionUrl, APP_CONFIG, $rootScope)]);
