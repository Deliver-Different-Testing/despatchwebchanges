class JobDetailService {
    constructor(DispatchData, $mdDialog, toastrService, rateJobService, $document, $timeout, moment, versionUrl, APP_CONFIG, $rootScope) {
        this._dispatchData = DispatchData;
        this._$mdDialog = $mdDialog;
        this._toastrService = toastrService;
        this._rateJobService = rateJobService;
        this._$document = $document;
        this._$timeout = $timeout;
        this._moment = moment;
        this._versionUrl = versionUrl;
        this.APP_CONFIG = APP_CONFIG;
        this._$rootScope = $rootScope;

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

        this.pickLeaveList = [];
        this.pickUndeliverableList = [];
        this.pickSpeeds = [];
        this.pickContacts = [];

        this.gather = {};

        DispatchData.getLeaveList().then(data => {
            this.pickLeaveList = data;
        });

        DispatchData.getUndeliverableList().then(data => {
            this.pickUndeliverableList = data;
        });

        DispatchData.getSpeedList().then(data => {
            this.pickSpeeds = data;
        });

        this._dispatchData.getSuburbList().then(data => {
            this.pickSuburbs = data;
        });

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

        //////////////////////////////
        //  PALLET CONTROLS //
        /////////////////////////////
        let self = this;
        this.palletMenu = [// NEW IMPLEMENTATION
            {
                text: "Delete",
                click: ($itemScope, $event, modelValue, text, $li) => self._dispatchData.deletePallet($itemScope.pallet, self.currentJob.preBook, FirstName).then(response => {

                    console.log(response);

                    if (response === "OK") {
                        const index = $itemScope.currentJob.palletInfo.indexOf($itemScope.pallet);
                        $itemScope.currentJob.palletInfo.splice(index, 1);

                        return self._rateJobService.rateJob(this.currentJob).then(rate => {
                            console.log(rate);
                            if (rate !== self.currentJob.charge) {
                                return self._dispatchData
                                    .updateJobDetail(self.currentJob.id, "rate", Number(rate.replace(/[^0-9.-]+/g, "")), Number(rate.replace(/[^0-9.-]+/g, "")), FirstName, ContactID, self.currentJob.preBook).then(response => {
                                        self.selectJobDetail(self.currentJob.id);
                                        return response;
                                    });
                            }

                        });
                    } else {
                        console.log("Critical Error Add Pallet");
                    }
                })
            }];


        this.currentPallet = "";

        return self;
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
        try {
            this.pickContacts = await this._dispatchData.getContactList(job.clientId);
        } catch (error) {
            console.error('Error fetching contact list:', error);
        }
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async getClientContactDetail($event, job) {
        $event.stopPropagation();
        try {
            job.contactList = await this._dispatchData.getContactDetailList(job.clientId);
        } catch (error) {
            console.error('Error fetching contact detail list:', error);
        }
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
     * @param {number} is
     */
    getInternalStatus(is) {
        const selected = this.pickInternalStatus.find(({id}) => id === is);
        return selected !== undefined ? selected.text : "";
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
     * @param {Object} $event
     * @param {Job} job
     */
    async displayPriceBreakdown($event, job) {
        $event.stopPropagation();
        console.log(job);

        const pedal = (job.fromSuburbId === 1 && job.toSuburbID === 1) ||
            (job.fromSuburbId === 112 && job.toSuburbID === 112) ||
            (job.fromSuburbId === 480 && job.toSuburbID === 480);

        const isTruckJob = job.size.id === 4 && [41, 42, 43, 44, 46, 51, 52].includes(job.speedID);

        const showDialog = async (description) => {
            return this._$mdDialog.show(
                this._$mdDialog.alert()
                    .parent(angular.element(this._$document.body))
                    .clickOutsideToClose(true)
                    .title('Charge Information')
                    .textContent(description)
                    .ariaLabel('Alert Dialog')
                    .ok('OK')
            );
        };

        try {
            let priceBreakdown;

            if (isTruckJob) {
                const itemSummary = await this._dispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit);
                priceBreakdown = await this._dispatchData.truckJobAmountBreakdown(
                    job.clientId, job.fromSuburbID, job.toSuburbID, itemSummary.weight,
                    job.size.id, job.speedID, itemSummary.quantity, job.booked,
                    itemSummary.pickUp, itemSummary.dropOff, job.privateRes,
                    itemSummary.overSize, itemSummary.overWeight, itemSummary.dgClass,
                    job.truckStartTime || this._moment().format("YYYY-MM-DDThh:mm:ss"),
                    job.truckHours || 2, job.gstRate
                );
            } else {
                priceBreakdown = await this._dispatchData.jobAmountBreakdown(
                    job.clientId, job.fromSuburbID, job.toSuburbID, job.speedID, pedal,
                    job.van, job.return, job.weight, job.size.id, true, job.direct,
                    job.acceptedJobTypeID, job.ourRef || '', job.refA || '', job.refB || '',
                    job.items, job.booked, job.gstRate, job.charge.replace("$", "")
                );
            }

            await showDialog(priceBreakdown);
        } catch (error) {
            console.log('Error fetching price breakdown:', error);
            await showDialog('An error occurred while fetching the price breakdown. Please try again.');
        }
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {string} id
     */
    showNotesDialog($event, job, title, fieldName, id = "editField") {
        return this._$mdDialog.show({
            controller: 'AddNotesDialogController',
            controllerAs: "ctrl",
            templateUrl: this._versionUrl("app/components/dialogs/add-notes-dialog/add-notes-dialog.html"),
            parent: angular.element(this._$document.body),
            targetEvent: $event,
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                id: id, fieldName: fieldName, title: title, job: job,
            },
            bindToController: true
        }).then(updatedJob => {
            this.currentJob = updatedJob
        });
    }


    /**
     * Shows a dialog for editing a date
     * @param {Object} $event - The triggering event
     * @param {Job} job - The job being edited
     * @param {string} title - The title of the dialog
     * @param {string} fieldName - The name of the field being edited
     * @param {string} date - The current date value
     * @param {string} [id="editForm"] - The ID for the form
     * @returns {Promise} A promise that resolves when the dialog is closed
     */
    showEditDateDialog($event, job, title, fieldName, date, id = "editForm") {
        return this._$mdDialog.show({
            controller: 'EditDateTimeDialogController',
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: $event,
            templateUrl: this._versionUrl("app/components/dialogs/edit-date-time-dialog/edit-date-time-dialog.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                job,
                title,
                fieldName,
                dateTime: date,
                id,
                showDate: true,
                showTime: false
            },
            bindToController: true
        })
            .then(() => {
                console.log('Dialog closed successfully');
            })
            .catch(error => {
                console.log('Error in date dialog:', error);
            });
    }

    /**
     * Opens a dialog to edit the job date
     * @param {Object} $event - The triggering event
     * @param {Job} job - The job to edit
     * @returns {Promise} A promise that resolves when the edit is complete
     */
    editJobDate($event, job) {
        return this.showEditDateDialog($event, job, "Date", "Date", job.date);
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {Date} time
     * @param {string} id
     */
    showEditTimeDialog($event, job, title, fieldName, time, id = "editForm") {
        return this._$mdDialog.show({
            controller: 'EditDateTimeDialogController',
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: $event,
            templateUrl: this._versionUrl("app/components/dialogs/edit-date-time-dialog/edit-date-time-dialog.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                job,
                title,
                fieldName,
                dateTime: time,
                id,
                showDate: false,
                showTime: true
            },
            bindToController: true
        }).then(_ => {
            console.log('Dialog closed!');
        });
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    editLogTime($event, job) {
        return this.showEditTimeDialog($event, job, "Time", "Time", job.time);
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    editCompletedTime($event, job) {
        return this.showEditTimeDialog($event, job, "Completed Time", "CompletedTime", job.completedTime);
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {Date} datetime
     * @param {string} id
     */
    showEditDateTimeDialog($event, job, title, fieldName, datetime, id = "editForm") {
        return this._$mdDialog.show({
            controller: 'EditDateTimeDialogController',
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: $event,
            templateUrl: this._versionUrl("app/components/dialogs/edit-date-time-dialog/edit-date-time-dialog.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                job,
                title,
                fieldName,
                dateTime: datetime,
                id,
                showDate: true,
                showTime: true
            },
            bindToController: true
        }).then(_ => {
            console.log('Dialog closed!');
        });
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    editFollowUpTime($event, job) {
        return this.showEditDateTimeDialog($event, job, "Follow Up Time", "FollowupTime", job.followupTime);
    }


    /**
     * @param {Object} $event
     * @param {Job} job
     * @param {string} title
     * @param {string} placeholder
     * @param {string} ariaLabel
     * @param {string|number} initialValue
     * @param {string} field
     */
    async showEditPrompt($event, job, title, placeholder, ariaLabel, initialValue, field) {
        const prompt = this._$mdDialog.prompt()
            .title(title)
            .placeholder(placeholder)
            .ariaLabel(ariaLabel)
            .initialValue(initialValue)
            .targetEvent($event)
            .required(true)
            .ok('Save')
            .cancel('Cancel');

        try {
            const result = await this._$mdDialog.show(prompt);

            // Update field
            let fieldName = field.toLowerCase();
            let matchingField = Object.keys(job).find(key => key.toLowerCase() === fieldName);

            if (matchingField) {
                job[matchingField] = result;
            } else {
                console.warn(`Field ${field} not found in job object.`);
            }

            const callData = {
                "call": "updateDetailField", "field": field, "value": result, "jobID": job.id
            };

            await this.updateField(true, job, callData);

            console.log('Complete');
        } catch (error) {
            if (error instanceof Error) {
                console.log(`Error: ${error.message}`);
            } else {
                console.log(`Edit ${title} Cancelled!`);
            }
        }
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editClientCode($event, job) {
        await this.showEditPrompt($event, job, 'Edit Client Code', 'Client Code...', 'client code', job.client, 'ClientCode');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editItems($event, job) {
        await this.showEditPrompt($event, job, 'Edit Items', 'Items...', 'items', job.items, 'Items');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editJobToPhone($event, job) {
        return this.showEditPrompt($event, job, 'Edit To Contact Phone', 'To Contact Phone...', 'to contact phone', job.phone, 'ToContactPhone');
    }

    /**
     * @param {Object} event
     * @param {Job} job
     */
    async editJobFromPhone(event, job) {
        await this.showEditPrompt(event, job, 'Edit From Contact Phone', 'From Contact Phone...', 'from contact phone', job.fromContactNumber, 'FromContactPhone');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editToJobContact($event, job) {
        await this.showEditPrompt($event, job, 'Edit To Contact Name', 'To Contact Name...', 'to contact name', job.deliverToContact, 'DeliverToContact');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */

    async editPodName($event, job) {
        await this.showEditPrompt($event, job, 'Edit POD Name', 'POD Name...', 'pod name', job.podName, 'PODName');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editFromJobContact($event, job) {
        await this.showEditPrompt($event, job, 'Edit From Contact Name', 'From Contact Name...', 'from contact name', job.fromContactName, 'FromContactName');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editJobWeight($event, job) {
        await this.showEditPrompt($event, job, 'Edit Weight', 'Job Weight...', 'job weight', job.weight, 'Weight');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editAmount($event, job) {
        await this.showEditPrompt($event, job, 'Amount', 'Amount...', 'job weight', job.charge, 'Amount');
    }

    /**
     * @param {Object} $event
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
     * @param {Object} $event
     * @param {Job} job
     */
    async editOurRef($event, job) {
        await this.showEditPrompt($event, job, 'Edit Our Reference', 'Our Reference...', 'our reference', job.ourRef, 'OurRef');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editTrackingMobile($event, job) {
        await this.showEditPrompt($event, job, 'Edit Tracking Mobile', 'Tracking Mobile...', 'tracking mobile', job.trackingMobile, 'TrackingMobile');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    async editTrackingEmail($event, job) {
        await this.showEditPrompt($event, job, 'Edit Tracking Email', 'Tracking Email...', 'tracking email', job.trackingEmail, 'TrackingEmail');
    }

    /**
     * @param {Object} $event
     * @param {Job} currentJob
     */
    async editJobDimensions($event, currentJob) {
        const dimensions = currentJob.parcelDimensions;
        const jobId = currentJob.id;

        await this._$mdDialog.show({
            controller: 'EditParcelDimensionsDialogController',
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: $event,
            templateUrl: this._versionUrl("app/components/dialogs/edit-parcel-dimensions-dialog/edit-parcel-dimensions-dialog.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                jobId,
                dimensions
            },
            bindToController: true
        });

        // Show feature in development dialog
        await this._$mdDialog.show({
            controller: 'FeatureInDevelopmentDialogController',
            controllerAs: 'ctrl',
            templateUrl: this._versionUrl('app/components/dialogs/feature-in-development-dialog/feature-in-development-dialog.html'),
            parent: angular.element(this._$document.body),
            clickOutsideToClose: true,
            bindToController: true
        });
    }

    /**
     * @param reRate
     * @param {Job} job
     * @param callData
     */
    async updateField(reRate, job, callData) {
        try {
            let response;
            if (reRate && !job.bulkJob) {
                const rate = await this._rateJobService.rateJob(job);

                // Ensure rate is decimal
                const numericRate = parseFloat(rate.replace(/[^\d.-]/g, ''));
                if (isNaN(numericRate)) {
                    console.error('Failed to convert rate to a number:', rate);
                }

                await this._dispatchData.updateJobDetail(
                    callData.jobID,
                    callData.field,
                    callData.value,
                    numericRate,
                    FirstName,
                    ContactID,
                    job.preBook
                );
            } else {
                // Ensure rate is decimal
                const numericRate = parseFloat(job.charge.replace(/[^\d.-]/g, ''));
                if (isNaN(numericRate)) {
                    console.error('Failed to convert rate to a number:', rate);
                }

                if (job.bulkJob) {
                    await this._dispatchData.updateBulkJobDetail(
                        job.id,
                        callData.field,
                        callData.value,
                        numericRate,
                        FirstName,
                        ContactID
                    );
                } else {
                    await this._dispatchData.updateJobDetail(
                        callData.jobID,
                        callData.field,
                        callData.value,
                        numericRate,
                        FirstName,
                        ContactID,
                        job.preBook
                    );
                }
            }
        } catch (error) {
            console.error('Error updating job:', error);
            this._toastrService.showErrorToast('Failed to update job. Please try again.');
            throw error;
        }
    }

    /**
     * Updates the GPS coordinates and address for a job
     * @param {Object} $event - The triggering event
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
    showAddressDialog(event, currentJob, isDeliveryAddress) {
        const addressToUpdate = isDeliveryAddress ? currentJob.deliveryAddress : currentJob.pickupAddress;

        return this._$mdDialog.show({
            controller: 'EditAddressDialogController',
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: event,
            templateUrl: this._versionUrl("app/components/dialogs/edit-address-dialog/edit-address-dialog.html"),
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                addressDetails: addressToUpdate,
                suburbOptions: this.pickSuburbs,
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
        const updatedJob = this.isUsCustomer ?
            this._updateJobAddressUs(job, addressResult, isDeliveryAddress) :
            this._updateJobAddressNz(job, addressResult, isDeliveryAddress);

        try {
            //await this._updateBulkJobIfNeeded(updatedJob, addressData, isDeliveryAddress);
            await this.updateJobRateAndAddress(updatedJob, addressResult, isDeliveryAddress);
            this.currentJob = updatedJob;
            this._toastrService.showSuccessToast("Address successfully updated");
        } catch (error) {
            console.log('Error processing address update:', error);
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
     * @param {AddressViewModel} addressDetails
     * @param {boolean} isDeliveryAddress
     */
    async _updateBulkJobIfNeeded(job, addressDetails, isDeliveryAddress) {
        if (!job.bulkJob) {
            return;
        }

        // Show feature in development dialog
        return this._$mdDialog.show({
            controller: 'FeatureInDevelopmentDialogController',
            controllerAs: 'ctrl',
            templateUrl: this._versionUrl('app/components/dialogs/feature-in-development-dialog/feature-in-development-dialog.html'),
            parent: angular.element(this._$document.body),
            clickOutsideToClose: true,
            bindToController: true
        });

        // Todo: Update bulk job addresses here to US
        const updateMethod = isDeliveryAddress ?
            this._dispatchData.updateBulkDeliveryAddress :
            this._dispatchData.updateBulkPickupAddress;

        await updateMethod(
            job.id,
            addressDetails.addressLine5, // Assuming suburb is in addressLine5
            addressDetails.addressLine6, // Assuming postcode is in addressLine6
            addressDetails.fullAddress,
            addressDetails.latitude,
            addressDetails.longitude,
            FirstName
        );
    }

    /**
     * @param {Job} job
     * @param {Object} addressResult
     * @param {boolean} isDeliveryAddress
     *
     * @private
     */
    async updateJobRateAndAddress(job, addressResult, isDeliveryAddress) {
        job.charge = await this._rateJobService.rateJob(job);
        const rate = Number(job.charge.replace(/[^0-9.-]+/g, ""));

        console.log('Job Rate: ' + rate);

        if (isDeliveryAddress) {
            await this._dispatchData.updateDeliveryAddress(
                job.id,
                rate,
                FirstName,
                job.preBook,
                addressResult.addressData
            );
        } else {
            await this._dispatchData.updatePickupAddress(
                job.id,
                rate,
                FirstName,
                job.preBook,
                addressResult.addressData
            );
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
            this.currentJob.locked = false;
        } catch (error) {
            console.error('An error occured unlocking the job.');
        }
    }

    /**
     * Locks a job
     * @param {Job} job - The job to be locked
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    async lockJob(job) {
        try {
            const callData = {
                "call": "updateDetailField", "field": 'Locked', "value": true, "jobID": job.id
            };

            await this.updateField(false, job, callData);
            this.currentJob.locked = true;
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
            const response = await this._dispatchData.releaseBulkJob(job.jobNo, job.bookedDate);
            await this.selectBulkJobDetail(job.id);
            return response;
        } catch (error) {
            console.log(error);
        }
    }

    /**
     * Toggles the VanOK status of a job
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    async vanOkClick(job) {
        const vanOkValue = !job.vanOK;
        try {
            const callData = {
                "call": "updateDetailField", "field": 'VanOK', "value": vanOkValue, "jobID": job.id
            };

            await this.updateField(true, job, callData);
            this.currentJob.vanOK = vanOkValue;
        } catch (error) {
            throw error; // Re-throw the error to propagate it
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
        } catch (error) {
            console.log(error.message);
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
     * @param {Job} job - The job to update
     * @param {string} property - The property to toggle
     * @param {boolean} useCharge - Whether to use job.charge or calculate a new rate
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    async toggleJobProperty(job, property, useCharge = true) {
        const newValue = !job[property];
        const capitalizedProperty = property.charAt(0).toUpperCase() + property.slice(1);

        const updateJob = async (rate) => {
            return this._dispatchData.updateJobDetail(
                job.id,
                capitalizedProperty,
                newValue,
                rate,
                FirstName,
                ContactID,
                job.preBook
            );
        };

        try {
            let response;
            if (useCharge) {
                response = await updateJob(job.charge);
            } else {
                const rate = await this._rateJobService.rateJob(job);
                response = await updateJob(this.extractNumericRate(rate));
            }

            this.currentJob[property] = newValue;
            return response;
        } catch (error) {
            console.log(`Failed to update ${capitalizedProperty} status. Please try again.`);
            throw error;
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
        const newDirectValue = !job.direct;

        if (!newDirectValue) {
            try {
                const response = await this._dispatchData.processUncheckDirect(job.id, FirstName, ContactID, job.speedAccepted);
                this.currentJob.direct = false;
                return response;
            } catch (error) {
                console.log("Failed to uncheck Direct status. Please try again.");
                throw error;
            }
        } else {
            await this.toggleJobProperty(job, 'direct', false);
        }
    }

    /**
     * Toggles the Attention status of a job
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    attentionClick(job) {
        return this.toggleJobProperty(job, 'attention');
    }

    /**
     * Toggles the Reprice status of a job
     * @param {Job} job - The job to update
     */
    repriceClick(job) {
        return this.toggleJobProperty(job, 'reprice');
    }

    /**
     * Toggles the Return status of a pre-booked job
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    preBookReturnClick(job) {
        return this.toggleJobProperty(job, 'return');
    }

    /**
     * Toggles the OneOff status of a job
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    oneOffClick(job) {
        return this.toggleJobProperty(job, 'oneOff');
    }

    /**
     * Toggles the Active status of a job
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    async activeClick(job) {
        const activeValue = !job.active;
        try {
            const response = await this._dispatchData.updateJobDetail(
                job.id,
                "Active",
                activeValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook
            );
            this.currentJob.active = activeValue;
            return response;
        } catch (error) {
            console.log(error.message || "Failed to update Active status. Please try again.");
            throw error;
        }
    }

    /**
     * Toggles the Void status of a job
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    async voidClick(job) {
        const voidValue = !job.void;
        const updateMethod = job.bulkJob ? this._dispatchData.updateBulkJobDetail : this._dispatchData.updateJobDetail;
        const params = job.bulkJob ?
            [job.id, "Void", voidValue, job.charge, FirstName, ContactID] :
            [job.id, "Void", voidValue, job.charge, FirstName, ContactID, job.preBook];

        try {
            const response = await updateMethod.apply(this._dispatchData, params);
            this.currentJob.void = voidValue;
            return response;
        } catch (error) {
            console.log("Failed to update Void status. Please try again.");
            throw error;
        }
    }

    /**
     * Marks a job as done
     * @param {Object} $event - The triggering event
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    async doneClick($event, job) {
        if (!job.completedTime || !job.podName) {
            try {
                await this.showMissingInfoDialog($event, job);
                this.currentJob.done = false;
            } catch (error) {
                // If showMissingInfoDialog throws an error, we want to propagate it
                throw error;
            }
        }

        try {
            const response = await this._dispatchData.updatePODDetail(job.jobNo, 6, job.podName, job.completedTime);
            this.currentJob.done = !job.done;
            return response;
        } catch (error) {
            console.log("Failed to mark job as done. Please try again.");
            throw error;
        }
    }

    /**
     * Shows a dialog for missing information
     * @param {Object} $event - The triggering event
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

        const confirm = this._$mdDialog.confirm()
            .title(message)
            .targetEvent($event)
            .ok('OK');

        return this._$mdDialog.show(confirm);
    }

    /**
     * Toggles the Delivered status of a job
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    deliveredClick(job) {
        return this.toggleJobProperty(job, 'done');
    }

    /**
     * Toggles the AirportOnly status of a job
     * @param {Job} job - The job to update
     * @returns {Promise} A promise that resolves with the response or rejects with an error
     */
    airportOnlyClick(job) {
        return this.toggleJobProperty(job, 'airportOnly');
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    trackingMethodClick($event, job) {
        const trackingArray = this.options.detail.tracking.map(item => {
            return {
                id: item.id, text: item.label
            };
        });

        this.showSelectDialog($event, job, trackingArray, "TrackingMethod", "Tracking Method", this.getTrackingMethod(job.trackingMethod));
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    leaveClick($event, job) {
        this.showSelectDialog($event, job, this.pickLeaveList, "DeliverToLeaveID", "Leave Parcel", job.sigNotRequired || "Signature Required");
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    undeliverableClick($event, job) {
        this.showSelectDialog($event, job, this.pickUndeliverableList, "UndeliverableLocationID", "Undeliverable Location", job.udStatus);
    }

    /**
     * @param {Object} event
     * @param {Job} job
     */
    sizeClick(event, job) {
        const sizeArray = this.options.detail.size.map(item => {
            return {
                id: item.id, text: item.label
            };
        });

        this.showSelectDialog(event, job, sizeArray, "Size", "Size", job.size.label);
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     * @param {[]} data
     * @param {string} fieldName
     * @param {string} title
     * @param {string|null} initialValue
     * @param {string} id
     * @param {boolean} showCheckbox
     * @param {string} checkboxLabel
     */
    showSelectDialog($event, job, data, fieldName, title, initialValue = null,
                     id = "editField", showCheckbox = false, checkboxLabel = "") {
        const options = {
            minimumInputLength: 1, items: data, placeholder: title
        };

        this._$mdDialog.show({
            controller: 'SelectDialogController',
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: $event,
            templateUrl: this._versionUrl('app/components/dialogs/select-dialog/select-dialog.html'),
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                id, fieldName, title, job, options, initialValue, showCheckbox, checkboxLabel
            },
            bindToController: true
        }).then(_ => {
            console.log('Dialog closed!');
        });
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    dgClassClick($event, job) {
        let dgClassOptions = [];
        for (let i = 1; i <= 9; i++) {
            dgClassOptions.push({id: i, text: i.toString()});
        }

        const initialValue = !job.dgClass ? null : job.dgClass;

        this.showSelectDialog($event, job, dgClassOptions, "DGClass", "DG Class", initialValue, "editField", true, "Has Documentation?");
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    notifyClick($event, job) {
        this.showSelectDialog($event, job, this.pickSpeeds, "NotifiedJobTypeID", "Notified", job.notifiedName);
    }

    /**
     * @param {Object} event
     * @param {Job} job
     */
    acceptedClick(event, job) {
        this.showSelectDialog(event, job, this.pickSpeeds, "AcceptedJobTypeID", "Accepted", job.acceptedName);
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    speedClick($event, job) {
        this.showSelectDialog($event, job, this.pickSpeeds, "SpeedID", "Speed", job.speedName);
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    contactClick($event, job) {
        this.showSelectDialog($event, job, this.pickContacts, "ContactID", "Contact", job.contactName);
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
     * @param {Object} $event
     * @param {Job} job
     */
    jobTypeClick($event, job) {
        const data = [{
            id: 1, text: 'Pickup'
        }, {
            id: 2, text: 'Delivery'
        }, {
            id: 3, text: '3rd-Party'
        }];

        this.showSelectDialog($event, job, data, "JobTypeID", "Job Type", this.getJobTypeDescription(job.jobType));
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    internalStatusClick($event, job) {
        this.showSelectDialog($event, job, this.pickInternalStatus, "InternalStatusID", "Service", "Select new status....");
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     * @param {string} url
     * @param {string} placeholder
     * @param {string} fieldName
     * @param {string} title
     * @param {string} id
     * @param {null} existingItem
     * @param {boolean} showRerateOption
     */
    showAutocompleteDialog($event, job, url, placeholder, fieldName, title, id = "editField", existingItem, showRerateOption) {
        const options = {
            placeholder, minimumInputLength: 3, searchUrl: url
        };

        this._$mdDialog.show({
            controller: 'AutoCompleteDialogController',
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: $event,
            templateUrl: this._versionUrl('app/components/dialogs/auto-complete-dialog/auto-complete-dialog.html'),
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                id, fieldName, title, job, options, existingItem, showRerateOption
            },
            bindToController: true
        }).then(_ => {
            console.log('Dialog closed!')
        });
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    clientClick($event, job) {
        const url = "/home/ActiveClients";
        const placeholder = "Start typing to enter new client...";

        const existingItem = {
            id: job.clientId, text: job.clientName
        }

        return this.showAutocompleteDialog($event, job, url, placeholder, "clientId", "Client", job.id, existingItem, true)
    }

    /**
     * @param {Object} $event
     * @param {Job} job
     */
    courierClick($event, job) {
        const url = "/courier/AllActiveSearch";
        const placeholder = "Start typing to search courier...";

        return this.showAutocompleteDialog($event, job, url, placeholder, "CourierID", "Courier", job.id, null, false)
    }

    /**
     * Shows a dialog for creating or editing a pallet
     * @param {Object} $event - The triggering event
     * @param {Job} job - The job associated with the pallet
     * @param {Object} [existingPallet] - The pallet to edit (if editing an existing pallet)
     * @returns {Promise} A promise that resolves when the dialog is closed
     */
    showPalletDialog($event, job, existingPallet = undefined) {
        const isEditing = !!existingPallet;
        const dialogTitle = isEditing ? 'Edit Pallet' : 'New Pallet';

        return this._$mdDialog.show({
            controller: 'PalletDialogController',
            controllerAs: "ctrl",
            templateUrl: this._versionUrl("app/components/dialogs/add-pallet-dialog/add-pallet-dialog.html"),
            parent: angular.element(this._$document.body),
            targetEvent: $event,
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                job,
                dispatcherName: FirstName,
                contactId: ContactID,
                existingPallet,
                dialogTitle
            },
            bindToController: true
        })
            .then((result) => {
                console.log(`Pallet Dialog closed: ${isEditing ? 'Edited' : 'Created'} pallet`);
                return result; // Return the result for further processing if needed
            })
            .catch((error) => {
                console.log('Error in pallet dialog:', error);
                console.log(`Failed to ${isEditing ? 'edit' : 'create'} pallet. Please try again.`);
            });
    }

    /**
     * Opens a dialog to create a new pallet
     * @param {Object} event - The triggering event
     * @param {Job} job - The job to associate with the new pallet
     * @returns {Promise} A promise that resolves when the creation is complete
     */
    newPallet(event, job) {
        return this.showPalletDialog(event, job);
    }

    /**
     * Opens a dialog to edit an existing pallet
     * @param {Object} event - The triggering event
     * @param {Job} job - The job associated with the pallet
     * @param {Object} pallet - The pallet to edit
     * @returns {Promise} A promise that resolves when the edit is complete
     */
    editPallet(event, job, pallet) {
        return this.showPalletDialog(event, job, pallet);
    }
}

angular.module('uDispatch').service('JobDetailService', [
    "DispatchData",
    "$mdDialog",
    "toastrService",
    "rateJobService",
    "$document",
    "$timeout",
    "moment",
    "versionUrl",
    "APP_CONFIG",
    "$rootScope",
    (DispatchData, $mdDialog, toastrService, rateJobService, $document, $timeout, moment, versionUrl, APP_CONFIG, $rootScope) => new JobDetailService(DispatchData, $mdDialog, toastrService, rateJobService, $document, $timeout, moment, versionUrl, APP_CONFIG, $rootScope)
]);
