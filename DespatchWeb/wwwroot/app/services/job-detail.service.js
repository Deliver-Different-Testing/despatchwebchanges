class JobDetailService {
    static $inject = ["DispatchData", "$mdDialog", "toastrService", "loadingService", "rateJobService", "$document", "$timeout", "moment"];

    constructor(DispatchData, $mdDialog, toastrService, loadingService, rateJobService, $document, $timeout, moment) {
        this._dispatchData = DispatchData;
        this._$mdDialog = $mdDialog;
        this._toastrService = toastrService;
        this._loadingService = loadingService;
        this._rateJobService = rateJobService;
        this._$document = $document;
        this._$timeout = $timeout;
        this._moment = moment;

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
        this.gpsForm = {};


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

        DispatchData.getInternalStatusList().then((data) => {
            this.pickInternalStatus = data;
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
                        return self.DispatchData
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
                text: "Delete", click: function ($itemScope, $event, modelValue, text, $li) {
                    return self._dispatchData.deletePallet($itemScope.pallet, self.currentJob.preBook, FirstName).then(response => {

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
                    });
                }
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
    setJob(job) {
        this.currentJob = job;
        this._dispatchData.getContactList(job.clientId).then(data => {
            this.pickContacts = data;
        });
    }

    /**
     * @param {Event} $event
     * @param {Job} job
     */
    getClientContactDetail($event, job) {
        $event.stopPropagation();
        this._dispatchData.getContactDetailList(job.clientId).then(data => {
            job.contactList = data;
        });
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
     * @param {Event} $event
     * @param {Job} job
     */
    displayPriceBreakdown($event, job) {
        $event.stopPropagation();
        console.log(job);
        const pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 || job.fromSuburbID === 112 && job.toSuburbID === 112 || job.fromSuburbID === 480 && job.toSuburbID === 480;
        if (job.size.id === 4 && (job.speedID === 41 || job.speedID === 42 || job.speedID === 43 || job.speedID === 44 || job.speedID === 46 || job.speedID === 51 || job.speedID === 52)) {
            //Truck Job
            this._dispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(itemSummary => this._dispatchData.truckJobAmountBreakdown(job.clientId, job.fromSuburbID, job.toSuburbID, itemSummary.weight, job.size.id, job.speedID, itemSummary.quantity, job.booked, itemSummary.pickUp, itemSummary.dropOff, job.privateRes, itemSummary.overSize, itemSummary.overWeight, itemSummary.dgClass, job.truckStartTime || this._moment().format("YYYY-MM-DDThh:mm:ss"), job.truckHours || 2, job.gstRate).then(function (description) {
                this.$mdDialog.show(this.$mdDialog.alert()
                    .parent(angular.element(this.$document.body))
                    .clickOutsideToClose(true)
                    .title('Charge Information')
                    .textContent(description)
                    .ariaLabel('Alert Dialog')
                    .ok('OK'));
            }));

            return false;
        } else {
            return this._dispatchData.jobAmountBreakdown(job.clientId, job.fromSuburbID, job.toSuburbID, job.speedID, pedal, job.van, job.return, job.weight, job.size.id, true, job.direct, job.acceptedJobTypeID, job.ourRef || '', job.refA || '', job.refB || '', job.items, job.booked, job.gstRate, job.charge.replace("$", "")).then(description => {
                this._$mdDialog.show(this._$mdDialog.alert()
                    .parent(angular.element(this._$document.body))
                    .clickOutsideToClose(true)
                    .title('Charge Information')
                    .textContent(description)
                    .ariaLabel('Alert Dialog')
                    .ok('OK'));
            });
        }
    }

    /**
     * @param {Job} job
     */
    rateJob(job) {
        const self = this;

        const pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 || job.fromSuburbID === 112 && job.toSuburbID === 112 || job.fromSuburbID === 480 && job.toSuburbID === 480;
        if (job.size.id === 4 && (job.speedID === 41 || job.speedID === 42 || job.speedID === 43 || job.speedID === 44 || job.speedID === 46 || job.speedID === 51 || job.speedID === 52 || job.speedID === 124 || job.speedID === 125 || job.speedID === 150 || job.speedID === 151 || job.speedID === 152)) {
            //Truck Job
            return self._dispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(function (itemSummary) {
                return self._dispatchData.rateTruckJob(job.clientId, job.fromSuburbID, job.toSuburbID, itemSummary.weight, job.size.id, job.speedID, itemSummary.quantity, job.booked, itemSummary.pickUp, itemSummary.dropOff, job.privateRes, itemSummary.overSize, itemSummary.overWeight, itemSummary.dgClass, job.truckStartTime || this.moment().format("YYYY-MM-DDThh:mm:ss"), job.truckHours || 2);

            });
        } else {
            return self._dispatchData.rateJob(job.clientId, job.fromSuburbID, job.toSuburbID, job.speedID, pedal, job.van, job.return, job.weight, job.size.id, true, job.direct, job.acceptedJobTypeID, job.ourRef || '', job.refA || '', job.refB || '', job.items, job.booked);
        }
    }

    /**
     * @param {Event} event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {string} id
     */
    showNotesDialog(event, job, title, fieldName, id = "editField") {
        return this._$mdDialog.show({
            controller: AddNotesDialogController,
            controllerAs: "ctrl",
            templateUrl: "app/components/dialogs/add-notes-dialog/add-notes-dialog.html",
            parent: angular.element(this._$document.body),
            targetEvent: event,
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                id: id, fieldName: fieldName, title: title, job: job,
            }
        }).then(_ => {
            this.selectJobDetail(job.id);
            // User closed notes dialog
        });
    }


    /**
     * @param {Event} event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {string} date
     * @param {string} id
     */
    showEditDateDialog(event, job, title, fieldName, date, id = "editForm") {
        this._$mdDialog.show({
            controller: EditDateDialogController,
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: event,
            templateUrl: "app/components/dialogs/edit-date-dialog/edit-date-dialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                job, title, fieldName, date, id
            },
        }).then(_ => {
            this.selectJobDetail(job.id);
            console.log('Dialog closed!');
        });
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editFollowUpTime(event, job) {
        this.showEditDateDialog(event, job, "FollowUp Time", "FollowupTime", job.followupTime);
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editJobDate(event, job) {
        this.showEditDateDialog(event, job, "Date", "Date", job.date);
    }

    /**
     * @param {Event} event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {Date} time
     * @param {string} id
     */
    showEditTimeDialog(event, job, title, fieldName, time, id = "editForm") {
        this._$mdDialog.show({
            controller: EditTimeDialogController,
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: event,
            templateUrl: "app/components/dialogs/edit-time-dialog/edit-time-dialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                job, time, title, fieldName, id
            },
        }).then(_ => {
            this.selectJobDetail(job.id);
            console.log('Dialog closed!');
        });
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editLogTime(event, job) {
        this.showEditTimeDialog(event, job, "Time", "Time", job.time);
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editCompletedTime(event, job) {
        this.showEditTimeDialog(event, job, "Completed Time", "Completed Time", job.completedTime);
    }

    /**
     * @param {Event} event
     * @param {Job} job
     * @param {string} title
     * @param {string} placeholder
     * @param {string} ariaLabel
     * @param {string} initialValue
     * @param {string} field
     */
    showEditPrompt(event, job, title, placeholder, ariaLabel, initialValue, field) {
        const prompt = this._$mdDialog.prompt()
            .title(title)
            .placeholder(placeholder)
            .ariaLabel(ariaLabel)
            .initialValue(initialValue)
            .targetEvent(event)
            .required(true)
            .ok('Save')
            .cancel('Cancel');

        this._$mdDialog.show(prompt).then(result => {
            const callData = {
                "call": "updateDetailField", "field": field, "value": result, "jobID": job.id
            };
            this.updateField(false, job, callData).then(() => {
                this.selectJobDetail(job.id);
            })
        }, () => {
            console.log(`Edit ${title} Cancelled!`)
        });
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editClientCode(event, job) {
        this.showEditPrompt(event, job, 'Edit Client Code', 'Client Code...', 'client code', job.client, 'ClientCode');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editItems(event, job) {
        this.showEditPrompt(event, job, 'Edit Items', 'Items...', 'items', job.items, 'Items');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editJobToPhone(event, job) {
        this.showEditPrompt(event, job, 'Edit To Contact Phone', 'To Contact Phone...', 'to contact phone', job.phone, 'ToContactPhone');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editJobFromPhone(event, job) {
        this.showEditPrompt(event, job, 'Edit From Contact Phone', 'From Contact Phone...', 'from contact phone', job.fromContactNumber, 'FromContactPhone');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editToJobContact(event, job) {
        this.showEditPrompt(event, job, 'Edit To Contact Name', 'To Contact Name...', 'to contact name', job.deliverToContact, 'ToContactName');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */

    editPodName(event, job) {
        this.showEditPrompt(event, job, 'Edit POD Name', 'POD Name...', 'pod name', job.podName, 'PODName');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editFromJobContact(event, job) {
        this.showEditPrompt(event, job, 'Edit From Contact Name', 'From Contact Name...', 'from contact name', job.fromContactName, 'FromContactName');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editJobWeight(event, job) {
        this.showEditPrompt(event, job, 'Edit Weight', 'Job Weight...', 'job weight', job.weight, 'Weight');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editAmount(event, job) {
        this.showEditPrompt(event, job, 'Amount', 'Amount...', 'job weight', job.charge, 'Amount');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     * @param {boolean} isRefA
     */
    editRef(event, job, isRefA) {
        if (isRefA) {
            this.showEditPrompt(event, job, 'Edit RefA', 'RefA...', 'refa', job.refA, 'RefA');
        } else {
            this.showEditPrompt(event, job, 'Edit RefA', 'RefB...', 'refb', job.refB, 'RefB');
        }
    }

    editOurRef(event, job) {
        this.showEditPrompt(event, job, 'Edit Our Reference', 'Our Reference...', 'our reference', job.ourRef, 'OurRef');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editTrackingMobile(event, job) {
        this.showEditPrompt(event, job, 'Edit Tracking Mobile', 'Tracking Mobile...', 'tracking mobile', job.trackingMobile, 'TrackingMobile');
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    editTrackingEmail(event, job) {
        this.showEditPrompt(event, job, 'Edit Tracking Email', 'Tracking Email...', 'tracking email', job.trackingEmail, 'TrackingEmail');
    }

    updateField(reRate, job, callData) {
        if (reRate && !job.bulkJob) {
            return this.rateJob(job).then(rate => this._dispatchData
                .updateJobDetail(callData.jobID, callData.field, callData.value, Number(rate.replace(/[^0-9.-]+/g, "")), FirstName, ContactID, job.preBook).then(response => response));
        } else {
            return job.bulkJob ? this._dispatchData
                .updateBulkJobDetail(job.id, callData.field, callData.value, job.charge, FirstName, ContactID).then(response => response) : this._dispatchData
                .updateJobDetail(callData.jobID, callData.field, callData.value, job.charge, FirstName, ContactID, job.preBook).then(response => response);
        }
    }

    /**
     * @param {{fromSuburbID: number, toSuburbID: number, size: {id: number}, speedID: number, truckStartTime: (string|null), truckHours: number, truckWeightLimit: (number|null), pedal: boolean, van: boolean, return: boolean, weight: number, true: boolean, direct: boolean, acceptedJobTypeID: number, ourRef: string, refA: string, refB: string, items: Array, booked: Date}} job
     * @param {string} fieldName
     * @param {string} label
     * @param {Date} value
     * @param {number} jobID
     * @param {string} type
     * @param {{id: number, label: string}|[{id: number, label: string},{id: number, label: string},{id: number, label: string}]} options
     */
    editDetailField(job, fieldName, label, value, jobID, type, options) {

        if (type === "time" || type === "date") {

            if (!(value instanceof Date)) {
                value = new Date(value);
            }

        }

        if (type === "datetime") {
            value = new Date(this._moment(value).format("YYYY-MM-DDTHH:mm"))
        }

        let max = "";
        let valueToUse = options ? options[value] : value;

        switch (fieldName) {
            case "RefA":
                max = "20";
                break;
            case "RefB":
                max = "12";
                break;
            case "OurRef":
                max = "20";
                break;
            case "TrackingMobile":
                max = "500";
                break;
            case "TrackingEmail":
                max = "500";
                break;
            case "ConNote":
                max = "50";
                break;
            case "Size":
                valueToUse = options[value.id - 1];
                break;
            case "TrackingMethod":
                valueToUse = options[value - 1];
                break;
            default:
                break;
        }


        this.gather.form = {
            id: "editField",
            title: (fieldName === "Notes" ? "Add " : "Edit ") + label,
            fields: fieldName === "clientId" ? [{
                "name": fieldName,
                "label": label + "...",
                "value": value,
                "jobID": jobID,
                "type": type,
                "options": options
            }, {
                "name": "Rate",
                "label": "Re-Rate?",
                "value": false,
                "jobID": jobID,
                "type": "checkbox",
                "options": options
            }] : fieldName === "DGClass" ? [{
                "name": fieldName,
                "label": label + "...",
                "value": options[value],
                "jobID": jobID,
                "type": type,
                "options": options,
                "maxLength": max
            }, {
                "name": "Documentation",
                "label": "Has Documentation?",
                "value": job.dgDocumentation,
                "jobID": jobID,
                "type": "checkbox",
                "options": options
            }] : [{
                "name": fieldName,
                "label": label + "...",
                "value": valueToUse,
                "jobID": jobID,
                "type": type,
                "options": options,
                "maxLength": max
            }],
            onSubmit: function () {
                const self = this;
                let reRate = false;

                const callData = {
                    "call": "updateDetailField",
                    "field": self.gather.form.fields[0].name,
                    "value": self.gather.form.fields[0].value,
                    "jobID": self.gather.form.fields[0].jobID
                };

                if (callData.field === "Notes") {
                    return job.bulkJob ? self.DispatchData.addBulkJobNote(job.id, callData.value, FirstName, job.preBook) : self.DispatchData.addNote(job.id, callData.value, FirstName, job.preBook);
                }

                if (fieldName === "Items" || fieldName === "Weight" || fieldName === "Date") {
                    reRate = true;
                }
                if (fieldName === "Size") {
                    callData.value = self.gather.form.fields[0].value.id;
                    reRate = true;
                }
                if (fieldName === "TrackingMethod") {
                    callData.value = self.gather.form.fields[0].value.id;

                }
                if (fieldName === "Size" || fieldName === "TrackingMethod") {
                    job[callData.field.toLowerCase()] = self.gather.form.fields[0].value;
                } else {
                    job[callData.field.toLowerCase()] = callData.value;
                }

                if (fieldName === "SpeedID") {
                    callData.value = self.gather.form.fields[0].value;
                    job.speedID = parseInt(self.gather.form.fields[0].value);
                    job.speed = angular.element("#gather-SpeedID option:selected").text();
                    reRate = true;
                }
                if (fieldName === "JobTypeID") {
                    callData.value = self.gather.form.fields[0].value;
                    job.jobType = self.gather.form.fields[0].value;
                    return self.DispatchData
                        .updateJobType(callData.jobID, callData.value, FirstName).then(() => {

                        });
                }
                if (fieldName === "InternalStatusID") {
                    callData.value = self.gather.form.fields[0].value;
                    job.internalStatusID = self.gather.form.fields[0].value;
                }
                if (fieldName === "NotifiedJobTypeID") {
                    callData.value = self.gather.form.fields[0].value;
                    job.notifiedJobTypeID = parseInt(self.gather.form.fields[0].value);
                    job.notify = angular.element("#gather-NotifiedJobTypeID option:selected").text();
                    reRate = true;
                }
                if (fieldName === "AcceptedJobTypeID") {
                    callData.value = self.gather.form.fields[0].value;
                    job.acceptedJobTypeID = parseInt(self.gather.form.fields[0].value);
                    job.speedAccepted = angular.element("#gather-AcceptedJobTypeID option:selected").text();
                    reRate = true;
                }
                if (fieldName === "DeliverToLeaveID") {
                    callData.value = self.gather.form.fields[0].value;
                    job.sigNotRequired = angular.element("#gather-DeliverToLeaveID option:selected").text();
                }

                if (fieldName === "UndeliverableLocationID") {
                    callData.value = self.gather.form.fields[0].value;
                    job.UDStatus = angular.element("#gather-UndeliverableLocationID option:selected").text();
                }
                if (fieldName === "clientId") {
                    callData.value = self.gather.form.fields[0].value;
                    job.clientId = self.gather.form.fields[0].value;
                    reRate = self.gather.form.fields[1].value;
                }
                if (fieldName === "DGClass") {
                    callData.value = callData.value.id;
                    job.dgClass = callData.value.id;
                    let dgdocs = self.gather.form.fields[1].value;

                    return self.DispatchData
                        .updateJobDetail(callData.jobID, callData.field, callData.value, job.charge, FirstName, ContactID, job.preBook).then(response => {
                            if (job.dgDocumentation !== dgdocs) {
                                job.dgDocumentation = dgdocs;
                                return self.DispatchData
                                    .updateJobDetail(callData.jobID, "DGDocumentation", job.dgDocumentation, job.charge, FirstName, ContactID, job.preBook).then(response => response);
                            } else {
                                return response;
                            }
                        });
                }
                if (reRate && !job.bulkJob) {
                    return self.rateJobService.rateJob(job).then(rate => self.DispatchData
                        .updateJobDetail(callData.jobID, callData.field, callData.value, Number(rate.replace(/[^0-9.-]+/g, "")), FirstName, ContactID, job.preBook).then(response => response));
                } else {
                    return job.bulkJob ? self.DispatchData
                        .updateBulkJobDetail(job.id, callData.field, callData.value, job.charge, FirstName, ContactID).then(response => response) : self.DispatchData
                        .updateJobDetail(callData.jobID, callData.field, callData.value, job.charge, FirstName, ContactID, job.preBook).then(response => response);
                }

            },
            submitValue: "Update Field"
        };

        this._$timeout(function () {
            console.log(this.gather);
            this.gather.showForm();
        }, 200);
    }

    /**
     * @param {Event} event
     * @param {Job} currentJob
     * @param {string} field
     */
    updateGPS(event, currentJob, field) {
        // Get coordinates
        const getDeliveryLocation = currentJob => currentJob.deliveryLongitude ? {
            lat: currentJob.deliveryLatitude, long: currentJob.deliveryLongitude
        } : {lat: "", long: ""};
        const getPickupLocation = currentJob => currentJob.pickUpLongitude ? {
            lat: currentJob.pickUpLatitude, long: currentJob.pickUpLongitude
        } : {lat: "", long: ""};
        const location = field === "toAddress" ? getDeliveryLocation(currentJob) : getPickupLocation(currentJob);
        const {lat, long} = location;

        const suburbText = field === "toAddress" ? currentJob.toSuburbName : currentJob.fromSuburbName;
        console.log("Retrieved job coordinates!");

        // Dialog
        this._$mdDialog.show({
            controller: EditAddressDialogController,
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: event,
            templateUrl: "app/components/dialogs/edit-address-dialog/edit-address-dialog.html",
            clickOutsideToClose: false,
            fullscreen: true,
            locals: {
                addressDetails: {
                    address: currentJob[field], lat, long, suburb: suburbText, postCode: currentJob.postCode,
                }, suburbOptions: this.pickSuburbs, title: "Update Address and GPS", submitLabel: "Update",
            },
        }).then(addressDetails => {
            try {
                this._loadingService.showLoader();
                const job = currentJob;

                if (field === "toAddress") {
                    job.toAddress = (addressDetails.extras || '').length > 1 ? addressDetails.extras + ',' + addressDetails.address : addressDetails.address;
                    if (job.bulkJob) {
                        this._dispatchData.updateBulkDeliveryAddress(job.id, addressDetails.suburb, addressDetails.postCode, job.toAddress, addressDetails.lat, addressDetails.long, FirstName)
                            .then(() => {
                                this.selectJobDetail(currentJob.id);
                                this._toastrService.showSuccessToast("Address successfully updated");
                                this._loadingService.closeLoader();
                            });
                    }

                    job.toSuburbID = parseInt(addressDetails.our_suburb);
                } else {
                    job.fromAddress = (addressDetails.extras || '').length > 1 ? addressDetails.extras + ',' + addressDetails.address : addressDetails.address;
                    if (job.bulkJob) {
                        this._dispatchData.updateBulkPickupAddress(job.id, addressDetails.suburb, addressDetails.postCode, job.fromAddress, addressDetails.lat, addressDetails.long, FirstName)
                            .then(() => {
                                this.selectJobDetail(currentJob.id);
                                this._toastrService.showSuccessToast("Address successfully updated");
                                this._loadingService.closeLoader();
                            });
                    }

                    job.fromSuburbID = parseInt(addressDetails.our_suburb);
                }

                const pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 || job.fromSuburbID === 112 && job.toSuburbID === 112 || job.fromSuburbID === 480 && job.toSuburbID === 480;

                this._rateJobService.rateJob(job)
                    .then(rate => {
                        const callData = {
                            "call": "updateJobData",
                            "addressField": field,
                            "lat": addressDetails.lat,
                            "long": addressDetails.long,
                            "fromSuburbId": job.fromSuburbID,
                            "toSuburbId": job.toSuburbID,
                            "fromAddress": job.fromAddress,
                            "toAddress": job.toAddress,
                            "rate": rate,
                            "jobID": job.id,
                            "CBD": pedal
                        };
                        console.log(callData);

                        if (field === "toAddress") {
                            this._dispatchData.updateDeliveryAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long, callData.CBD, Number(callData.rate.replace(/[^0-9.-]+/g, "")), FirstName, job.preBook)
                                .then(() => {
                                    this.selectJobDetail(currentJob.id);
                                    this._toastrService.showSuccessToast("Address successfully updated")
                                    this._loadingService.closeLoader();
                                });
                        } else {
                            this._dispatchData.updatePickupAddress(callData.jobID, callData.fromSuburbId, callData.fromAddress, callData.lat, callData.long, callData.CBD, Number(callData.rate.replace(/[^0-9.-]+/g, "")), FirstName, job.preBook)
                                .then(() => {
                                    this.selectJobDetail(currentJob.id);
                                    this._toastrService.showSuccessToast("Address successfully updated")
                                    this._loadingService.closeLoader();
                                });
                        }
                    });
            } catch (error) {
                this._toastrService.showErrorToast(error.message)
            }

            console.log('Dialog closed!')
        }).then(() => console.log("Split jobs canceled!"));
    }

    /**
     * @param {Job} job
     */
    unlockJob(job) {
        return this._dispatchData
            .updateJobDetail(job.id, "Locked", false, job.charge, FirstName, ContactID, job.preBook)
            .then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((_) => {
                this._toastrService.showErrorToast();
            });
    }

    /**
     * @param {Job} job
     */
    lockJob(job) {
        return this._dispatchData
            .updateJobDetail(job.id, "Locked", true, job.charge, FirstName, ContactID, job.preBook)
            .then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    pushToLive(job) {
        job.done = !job.done;

        return this._dispatchData
            .releaseBulkJob(job.jobNo, job.bookedDate)
            .then(response => {
                this.selectBulkJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    vanOkClick(job) {
        const vanOkValue = !job.vanOK;

        return this._dispatchData
            .updateJobDetail(job.id, "VanOK", vanOkValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    vanClick(job) {
        const vanValue = !job.van;

        return this.rateJob(job)
            .then(rate => {
                console.log(rate);

                return this._dispatchData
                    .updateJobDetail(job.id, "Van", vanValue, Number(rate.replace(/[^0-9.-]+/g, "")), FirstName, ContactID, job.preBook)
                    .then(response => {
                        this.selectJobDetail(job.id);
                        return response;
                    }).catch((error) => this._toastrService.showErrorToast(error.message));
            }).catch((error) => this._toastrService.showErrorToast(error.message));

    }

    /**
     * @param {Job} job
     */
    pedalClick(job) {
        const pedalValue = !job.pedal;

        return this.rateJob(job).then(rate => {
            console.log(rate);
            return this._dispatchData
                .updateJobDetail(job.id, "Pedal", pedalValue, Number(rate.replace(/[^0-9.-]+/g, "")), FirstName, ContactID, job.preBook).then(function (response) {
                    this.selectJobDetail(job.id);
                    return response;
                }).catch((error) => this._toastrService.showErrorToast(error.message));
        }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    truckClick(job) {
        const truckValue = !job.truck;

        return this.rateJob(job)
            .then(rate => {
                console.log(rate);
                return this._dispatchData.updateJobDetail(job.id, "Truck", truckValue, Number(rate.replace(/[^0-9.-]+/g, "")), FirstName, ContactID, job.preBook);
            })
            .then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    directClick(job) {
        const directValue = !job.direct;

        if (!directValue) {
            return this._dispatchData.processUncheckDirect(job.id, FirstName, ContactID, job.speedAccepted);
        } else {
            return this.rateJob(job).then(rate => {
                console.log(rate);
                return this._dispatchData
                    .updateJobDetail(job.id, "Direct", directValue, Number(rate.replace(/[^0-9.-]+/g, "")), FirstName, ContactID, job.preBook).then(response => {
                        this.selectJobDetail(job.id);
                        return response;
                    }).catch((error) => this._toastrService.showErrorToast(error.message));
            }).catch((error) => this._toastrService.showErrorToast(error.message));
        }
    }

    /**
     * @param {Job} job
     */
    attentionClick(job) {
        const attentionValue = !job.attention;

        return this._dispatchData
            .updateJobDetail(job.id, "Attention", attentionValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    repriceClick(job) {
        const repriceValue = !job.reprice;

        return this._dispatchData
            .updateJobDetail(job.id, "Reprice", repriceValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    preBookReturnClick(job) {
        const returnValue = !job.return;

        return this._dispatchData
            .updateJobDetail(job.id, "Return", returnValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    oneOffClick(job) {
        const oneOffValue = !job.oneOff;

        return this._dispatchData
            .updateJobDetail(job.id, "OneOff", oneOffValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));

    }

    /**
     * @param {Job} job
     */
    activeClick(job) {
        const activeValue = !job.active;

        return this._dispatchData
            .updateJobDetail(job.id, "Active", activeValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    voidClick(job) {
        const voidValue = !job.void;

        return job.bulkJob ? this._dispatchData
            .updateBulkJobDetail(job.id, "Void", voidValue, job.charge, FirstName, ContactID).then(response => {
                this.selectBulkJobDetail(job.id);
                return response;
            }).catch(() => this._toastrService.showErrorToast()) : this._dispatchData
            .updateJobDetail(job.id, "Void", voidValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    doneClick(event, job) {
        job.done = !job.done;

        if (!job.completedTime) {
            const confirm = this._$mdDialog.confirm()
                .title('You must set completed time (POD Time) first')
                .targetEvent(event)
                .ok('OK');

            this._$mdDialog.show(confirm).then(() => {
                job.done = false;
                return false;
            });
        }

        if (!job.podName) {
            const confirm = this._$mdDialog.confirm()
                .title('You must set POD Name first')
                .targetEvent(event)
                .ok('OK');

            this._$mdDialog.show(confirm).then(() => {
                job.done = false;
                return false;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
        }

        return this._dispatchData
            .updatePODDetail(job.jobNo, 6, job.podName, job.completedTime).then((response) => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    deliveredClick(job) {
        const doneValue = !job.done;

        return this._dispatchData
            .updateJobDetail(job.id, "Delivered", doneValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Job} job
     */
    airportOnlyClick(job) {
        const airportOnlyValue = !job.airportOnly;

        return this._dispatchData
            .updateJobDetail(job.id, "AirportOnly", airportOnlyValue, job.charge, FirstName, ContactID, job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this._toastrService.showErrorToast(error.message));
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    trackingMethodClick(event, job) {
        const trackingArray = this.options.detail.tracking.map(item => {
            return {
                id: item.id, text: item.label
            };
        });

        this.showSelectDialog(event, job, trackingArray, "TrackingMethod", "Tracking Method", this.getTrackingMethod(job.trackingMethod));
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    leaveClick(event, job) {
        this.showSelectDialog(event, job, this.pickLeaveList, "DeliverToLeaveID", "Leave Parcel", job.sigNotRequired || "Signature Required");
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    undeliverableClick(event, job) {
        this.showSelectDialog(event, job, this.pickUndeliverableList, "UndeliverableLocationID", "Undeliverable Location", job.udStatus);
    }

    /**
     * @param {Event} event
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
     * @param {Event} event
     * @param {Job} job
     * @param {[]} data
     * @param {string} fieldName
     * @param {string} title
     * @param {string|null} initialValue
     * @param {string} id
     * @param {boolean} showCheckbox
     * @param {string} checkboxLabel
     */
    showSelectDialog(event, job, data, fieldName, title, initialValue = null, id = "editField", showCheckbox = false, checkboxLabel = "") {
        const options = {
            minimumInputLength: 1, items: data, placeholder: title
        };

        this._$mdDialog.show({
            controller: SelectDialogController,
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: event,
            templateUrl: 'app/components/dialogs/select-dialog/select-dialog.html',
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                id, fieldName, title, job, options, initialValue, showCheckbox, checkboxLabel
            },
        }).then(_ => {
            this.selectJobDetail(job.id);
            console.log('Dialog closed!');
        });
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    dgClassClick(event, job) {
        let dgClassOptions = [];
        for (let i = 1; i <= 9; i++) {
            dgClassOptions.push({id: i, text: i.toString()});
        }

        const initialValue = !job.dgClass ? null : job.dgClass;

        this.showSelectDialog(event, job, dgClassOptions, "DGClass", "DG Class", initialValue, "editField", true, "Has Documentation?");
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    notifyClick(event, job) {
        this.showSelectDialog(event, job, this.pickSpeeds, "NotifiedJobTypeID", "Notified", job.notifiedName);
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    acceptedClick(event, job) {
        this.showSelectDialog(event, job, this.pickSpeeds, "AcceptedJobTypeID", "Accepted", job.acceptedName);
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    speedClick(event, job) {
        this.showSelectDialog(event, job, this.pickSpeeds, "SpeedID", "Speed", job.speedName);
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    contactClick(event, job) {
        this.showSelectDialog(event, job, this.pickContacts, "ContactID", "Contact", job.contactName);
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
     * @param {Event} event
     * @param {Job} job
     */
    jobTypeClick(event, job) {
        const data = [{
            id: 1, text: 'Pickup'
        }, {
            id: 2, text: 'Delivery'
        }, {
            id: 3, text: '3rd-Party'
        }];

        this.showSelectDialog(event, job, data, "JobTypeID", "Job Type", this.getJobTypeDescription(job.jobType));
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    internalStatusClick(event, job) {
        this.showSelectDialog(event, job, this.pickInternalStatus, "InternalStatusID", "Job FollowUp", "Select new status....");
    }

    /**
     * @param {Event} event
     * @param {Job} job
     * @param {string} url
     * @param {string} placeholder
     * @param {string} fieldName
     * @param {string} title
     * @param {string} id
     * @param {null} existingItem
     * @param {boolean} showRerateOption
     */
    showAutocompleteDialog(event, job, url, placeholder, fieldName, title, id = "editField", existingItem, showRerateOption) {
        const options = {
            placeholder, minimumInputLength: 3, searchUrl: url
        };

        this._$mdDialog.show({
            controller: AutoCompleteDialogController,
            controllerAs: 'ctrl',
            parent: angular.element(this._$document.body),
            targetEvent: event,
            templateUrl: 'app/components/dialogs/auto-complete-dialog/auto-complete-dialog.html',
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                id, fieldName, title, job, options, existingItem, showRerateOption
            },
        }).then(_ => {
            this.selectJobDetail(job.id);
            console.log('Dialog closed!')
        });
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    clientClick(event, job) {
        const url = "/home/ActiveClients";
        const placeholder = "Start typing to enter new client...";

        const existingItem = {
            id: job.clientId, text: job.clientName
        }


        this.showAutocompleteDialog(event, job, url, placeholder, "clientId", "Client", job.id, existingItem, true)
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    courierClick(event, job) {
        const url = "/courier/AllActiveSearch";
        const placeholder = "Start typing to search courier...";

        this.showAutocompleteDialog(event, job, url, placeholder, "CourierID", "Courier", job.id, null, false)
    }

    /**
     * @param {Event} event
     * @param {Job} job
     */
    newPallet(event, job) {
        return this._$mdDialog.show({
            controller: AddPalletDialogController,
            controllerAs: "ctrl",
            templateUrl: "app/components/dialogs/add-pallet-dialog/add-pallet-dialog.html",
            parent: angular.element(this._$document.body),
            targetEvent: event,
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                job: job, dispatcherName: FirstName, contactId: ContactID
            }
        }).then(() => {
            this.selectJobDetail(job.id);
            console.log('Pallet Dialog closed!');
        });
    }

    /**
     * @param {{}} pallet
     */
    editPallet(pallet) {
        const self = this;
        self.currentPallet = pallet;

        self.gather.form = {
            id: "editPallet", title: "Edit Pallet", tpl: "multi", fields: [{
                "name": "amount", "label": "# of pallets", "colSize": "6", "value": pallet.quantity
            }, {
                "name": "weight", "label": "Weight (KG)", "colSize": "6", "value": pallet.weight
            }, {
                "name": "length", "label": "Length (m)", "colSize": "6", "value": pallet.length
            }, {
                "name": "depth", "label": "Depth (m)", "colSize": "6", "value": pallet.depth
            }, {
                "name": "height", "label": "Height (m)", "colSize": "6", "value": pallet.height
            }, {
                "name": "pu", "label": "PU", "colSize": "6", "type": "checkbox", "value": pallet.pu
            }, {
                "name": "do", "label": "DO", "colSize": "6", "type": "checkbox", "value": pallet.do
            }, {
                "name": "dgclass", "label": "DG Class", "colSize": "6", "value": pallet.dgClass
            }, {
                "name": "notes", "label": "Notes", "colSize": "12", "type": "textarea", "value": pallet.notes
            }], onSubmit: function () {

                const newP = {};

                self.gather.form.fields.forEach(function (field) {
                    if (field.name === "amount") {
                        newP["Quantity"] = field.value;
                    }
                    if (field.name === "weight") {
                        newP["Weight"] = field.value;
                    }
                    if (field.name === "length") {
                        newP["Length"] = field.value;
                    }
                    if (field.name === "depth") {
                        newP["Depth"] = field.value;
                    }
                    if (field.name === "height") {
                        newP["Height"] = field.value;
                    }
                    if (field.name === "pu") {
                        newP["PU"] = field.value;
                    }
                    if (field.name === "do") {
                        newP["DO"] = field.value;
                    }
                    if (field.name === "dgclass") {
                        newP["DGClass"] = field.value;
                    }
                    if (field.name === "notes") {
                        newP["Notes"] = field.value;
                    }
                });

                newP["id"] = self.currentPallet.id;
                newP["itemId"] = self.currentPallet.itemID;

                return self._dispatchData.editPallet(newP, self.currentJob.preBook, FirstName).then(function () {
                    return self._rateJobService.rateJob(self.currentJob).then(function (rate) {
                        console.log(rate);
                        if (rate !== self.currentJob.charge) {
                            return self._dispatchData
                                .updateJobDetail(this.currentJob.id, "rate", Number(rate.replace(/[^0-9.-]+/g, "")), Number(rate.replace(/[^0-9.-]+/g, "")), FirstName, ContactID, self.currentJob.preBook).then(function (response) {
                                    self.selectJobDetail(self.currentJob.id);
                                    return response;
                                });
                        }

                    });
                });
            }, submitValue: "Edit Pallet"
        };

        this._$timeout(function () {
            this.gather.showForm();
        }, 200);
    }
}

angular
    .module("uDispatch")
    .factory("JobDetailService", JobDetailService);
