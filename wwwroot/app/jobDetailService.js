angular
    .module("uDispatch")
    .factory("JobDetailService",
        ["DispatchData", "$ngConfirm", "$mdDialog", "toastrService", "loadingService", "rateJobService",
            function (DispatchData, $ngConfirm, $mdDialog, toastrService, loadingService, rateJobService) {
                const self = this;
                const options = {
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
                }
                var pickLeaveList = [];
                var pickUndeliverableList = [];
                var pickSpeeds = [];
                var pickContacts = [];

                var gather = {};
                self.gpsForm = {};


                DispatchData.getLeaveList().then(function (data) {
                    pickLeaveList = data;
                });

                DispatchData.getUndeliverableList().then(function (data) {
                    pickUndeliverableList = data;
                });

                DispatchData.getSpeedList().then(function (data) {
                    pickSpeeds = data;
                });

                DispatchData.getSuburbList().then(function (data) {
                    self.pickSuburbs = data;
                });

                DispatchData.getInternalStatusList().then(function (data) {
                    self.pickInternalStatus = data;
                });


                self.setGather = function (g) {
                    gather = g;
                };

                self.setSelectJobDetail = function (jobId) {
                    self.selectJobDetail = jobId;
                };
                self.setSelectBulkJobDetail = function (f) {
                    self.selectBulkJobDetail = f;
                };
                self.setJob = function (job) {
                    self.currentJob = job;
                    DispatchData.getContactList(job.clientID).then(function (data) {
                        pickContacts = data;
                    });
                };

                self.getClientContactDetail = function ($event, job) {
                    $event.stopPropagation();
                    DispatchData.getContactDetailList(job.clientID).then(function (data) {
                        job.contactList = data;
                    });
                }

                self.pickHolidays = [
                    {
                        "id": "0",
                        "label": "Don't Book"
                    },
                    {
                        "id": "1",
                        "label": "Next Business Day"
                    }
                ];

                self.pickDays = [
                    {
                        "id": "0",
                        "label": "Monday"
                    },
                    {
                        "id": "1",
                        "label": "Tuesday"
                    },
                    {
                        "id": "2",
                        "label": "Wednesday"
                    },
                    {
                        "id": "3",
                        "label": "Thursday"
                    },
                    {
                        "id": "4",
                        "label": "Friday"
                    },
                    {
                        "id": "5",
                        "label": "Saturday"
                    },
                    {
                        "id": "6",
                        "label": "Sunday"
                    }
                ];
                self.pickFrequency = [
                    {
                        "id": "0",
                        "label": "Weekly"
                    },
                    {
                        "id": "1",
                        "label": "Fortnightly"
                    },
                    {
                        "id": "2",
                        "label": "First of the Month"
                    },
                    {
                        "id": "3",
                        "label": "Second of the Month"
                    },
                    {
                        "id": "4",
                        "label": "Third of the Month"
                    },
                    {
                        "id": "5",
                        "label": "Last of the Month"
                    },
                    {
                        "id": "6",
                        "label": "First work day of the Month"
                    },
                    {
                        "id": "7",
                        "label": "Last work day of the Month"
                    }
                ];

                self.combos = {
                    "frequency": [],
                    "frequencyEvents": {
                        onSelectionChanged: function (item) {
                            console.log("Freq =");
                            console.log(self.combos.frequency);
                            if (self.combos.frequency.length > 0 &&
                                self.combos.days.length > 0 &&
                                self.combos.holidays.length > 0) {
                                var newDays = "0000000";
                                for (let i = 0; i < self.combos.days.length; i++) {
                                    newDays = newDays.replaceAt(parseInt(self.combos.days[i].id), "1");
                                }
                                newDays = newDays + self.combos.frequency[0].id + self.combos.holidays[0].id;
                                console.log(newDays);
                                return DispatchData
                                    .updateJobDetail(self.currentJob.id,
                                        "Frequency",
                                        newDays,
                                        self.currentJob.charge,
                                        FirstName,
                                        ContactID,
                                        self.currentJob.preBook).then(function (response) {
                                        self.selectJobDetail(self.currentJob.id);
                                        return response;
                                    });
                            } else {
                                console.log("invalid data");
                            }
                        }
                    },
                    "days": [],
                    "daysEvents": {
                        onSelectionChanged: function (item) {
                            console.log("Days =");
                            console.log(self.combos.days);
                            if (self.combos.frequency.length > 0 &&
                                self.combos.days.length > 0 &&
                                self.combos.holidays.length > 0) {
                                var newDays = "0000000";
                                for (let i = 0; i < self.combos.days.length; i++) {
                                    newDays = newDays.replaceAt(parseInt(self.combos.days[i].id), "1");
                                }
                                newDays = newDays + self.combos.frequency[0].id + self.combos.holidays[0].id;
                                console.log(newDays);
                                return DispatchData
                                    .updateJobDetail(self.currentJob.id,
                                        "Days",
                                        newDays,
                                        self.currentJob.charge,
                                        FirstName,
                                        ContactID,
                                        self.currentJob.preBook).then(function (response) {
                                        self.selectJobDetail(self.currentJob.id);
                                        return response;
                                    });
                            } else {
                                console.log("invalid data");
                            }
                        }
                    },
                    "holidays": [],
                    "holidaysEvents": {
                        onSelectionChanged: function (item) {
                            console.log("Days =");
                            console.log(self.combos.days);
                            if (self.combos.frequency.length > 0 &&
                                self.combos.days.length > 0 &&
                                self.combos.holidays.length > 0) {
                                var newDays = "0000000";
                                for (let i = 0; i < self.combos.days.length; i++) {
                                    newDays = newDays.replaceAt(parseInt(self.combos.days[i].id), "1");
                                }
                                newDays = newDays + self.combos.frequency[0].id + self.combos.holidays[0].id;
                                console.log(newDays);
                                return DispatchData
                                    .updateJobDetail(self.currentJob.id,
                                        "Holidays",
                                        newDays,
                                        self.currentJob.charge,
                                        FirstName,
                                        ContactID,
                                        self.currentJob.preBook).then(function (response) {
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

                self.frequencyChanged = function () {

                };

                self.getTrackingMethod = function (tm) {
                    switch (tm || 0) {
                        case 1:
                            return "Email";
                        case 2:
                            return "Mobile";
                        case 3:
                            return "Email & Mobile";
                        default:
                            return "";
                    }
                };

                self.getInternalStatus = function (is) {
                    var selected = self.pickInternalStatus.find(({id}) => id === is);
                    return selected !== undefined ? selected.text : "";
                }

                self.hasDGDocs = function (job) {
                    if (job.dgClass) {
                        return ((job.dgDocumentation || 0) === 1) || ((job.dgDocumentation || false) === true)
                            ? "Yes"
                            : "No";
                    } else {
                        return "";
                    }

                };

                self.ppdExclusiveAmount = function (clientId, amount) {
                    return DispatchData.ppdExclusiveAmount(clientId, amount);
                };

                self.displayPriceBreakdown = function ($event, job) {
                    $event.stopPropagation();
                    console.log(job);
                    var pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 ||
                        job.fromSuburbID === 112 && job.toSuburbID === 112 ||
                        job.fromSuburbID === 480 && job.toSuburbID === 480;
                    if (job.size.id === 4 &&
                        (job.speedID === 41 ||
                            job.speedID === 42 ||
                            job.speedID === 43 ||
                            job.speedID === 44 ||
                            job.speedID === 46 ||
                            job.speedID === 51 ||
                            job.speedID === 52)) {
                        //Truck Job
                        DispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(
                            function (itemSummary) {
                                return DispatchData.truckJobAmountBreakdown(job.clientID,
                                    job.fromSuburbID,
                                    job.toSuburbID,
                                    itemSummary.weight,
                                    job.size.id,
                                    job.speedID,
                                    itemSummary.quantity,
                                    job.booked,
                                    itemSummary.pickUp,
                                    itemSummary.dropOff,
                                    job.privateRes,
                                    itemSummary.overSize,
                                    itemSummary.overWeight,
                                    itemSummary.dgClass,
                                    job.truckStartTime || moment().format("YYYY-MM-DDThh:mm:ss"),
                                    job.truckHours || 2,
                                    job.gstRate).then(function (description) {
                                    alert(description);
                                });

                            });

                        return false;
                    } else {
                        return DispatchData.jobAmountBreakdown(job.clientID,
                            job.fromSuburbID,
                            job.toSuburbID,
                            job.speedID,
                            pedal,
                            job.van,
                            job.return,
                            job.weight,
                            job.size.id,
                            true,
                            job.direct,
                            job.acceptedJobTypeID,
                            job.ourRef || '',
                            job.refA || '',
                            job.refB || '',
                            job.items,
                            job.booked,
                            job.gstRate,
                            job.charge.replace("$", "")).then(function (description) {
                            alert(description);
                        });
                    }
                };

                self.rateJob = function (job) {
                    const pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 ||
                        job.fromSuburbID === 112 && job.toSuburbID === 112 ||
                        job.fromSuburbID === 480 && job.toSuburbID === 480;
                    if (job.size.id === 4 &&
                        (job.speedID === 41 ||
                            job.speedID === 42 ||
                            job.speedID === 43 ||
                            job.speedID === 44 ||
                            job.speedID === 46 ||
                            job.speedID === 51 ||
                            job.speedID === 52 ||
                            job.speedID === 124 ||
                            job.speedID === 125 ||
                            job.speedID === 150 ||
                            job.speedID === 151 ||
                            job.speedID === 152
                        )) {
                        //Truck Job
                        return DispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(
                            function (itemSummary) {
                                return DispatchData.rateTruckJob(job.clientID,
                                    job.fromSuburbID,
                                    job.toSuburbID,
                                    itemSummary.weight,
                                    job.size.id,
                                    job.speedID,
                                    itemSummary.quantity,
                                    job.booked,
                                    itemSummary.pickUp,
                                    itemSummary.dropOff,
                                    job.privateRes,
                                    itemSummary.overSize,
                                    itemSummary.overWeight,
                                    itemSummary.dgClass,
                                    job.truckStartTime || moment().format("YYYY-MM-DDThh:mm:ss"),
                                    job.truckHours || 2);

                            });
                    } else {
                        return DispatchData.rateJob(job.clientID,
                            job.fromSuburbID,
                            job.toSuburbID,
                            job.speedID,
                            pedal,
                            job.van,
                            job.return,
                            job.weight,
                            job.size.id,
                            true,
                            job.direct,
                            job.acceptedJobTypeID,
                            job.ourRef || '',
                            job.refA || '',
                            job.refB || '',
                            job.items,
                            job.booked);
                    }
                };

                self.editDetailField = function (job, fieldName, label, value, jobID, type, options) {

                    if (type === "time" || type === "date") {

                        if (!(value instanceof Date)) {
                            value = new Date(value);
                        }

                    }

                    if (type === "datetime") {
                        value = new Date(moment(value).format("YYYY-MM-DDTHH:mm"))
                    }

                    var max = "";
                    var valueToUse = options ? options[value] : value;

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


                    gather.form = {
                        id: "editField",
                        title: (fieldName === "Notes" ? "Add " : "Edit ") + label,
                        fields: fieldName === "ClientID"
                            ? [
                                {
                                    "name": fieldName,
                                    "label": label + "...",
                                    "value": value,
                                    "jobID": jobID,
                                    "type": type,
                                    "options": options
                                },
                                {
                                    "name": "Rate",
                                    "label": "Re-Rate?",
                                    "value": false,
                                    "jobID": jobID,
                                    "type": "checkbox",
                                    "options": options
                                }
                            ]
                            : fieldName === "DGClass"
                                ? [
                                    {
                                        "name": fieldName,
                                        "label": label + "...",
                                        "value": options[value],
                                        "jobID": jobID,
                                        "type": type,
                                        "options": options,
                                        "maxLength": max
                                    },
                                    {
                                        "name": "Documentation",
                                        "label": "Has Documentation?",
                                        "value": job.dgDocumentation,
                                        "jobID": jobID,
                                        "type": "checkbox",
                                        "options": options
                                    }
                                ]
                                : [
                                    {
                                        "name": fieldName,
                                        "label": label + "...",
                                        "value": valueToUse,
                                        "jobID": jobID,
                                        "type": type,
                                        "options": options,
                                        "maxLength": max
                                    }
                                ],
                        onSubmit: function () {
                            var rerate = false;

                            var callData = {
                                "call": "updateDetailField",
                                "field": gather.form.fields[0].name,
                                "value": gather.form.fields[0].value,
                                "jobID": gather.form.fields[0].jobID
                            };

                            if (callData.field === "Notes") {
                                return job.bulkJob ? DispatchData.addBulkJobNote(job.id, callData.value, FirstName, job.preBook) : DispatchData.addNote(job.id, callData.value, FirstName, job.preBook);
                            }

                            if (fieldName === "Items" || fieldName === "Weight" || fieldName === "Date") {
                                rerate = true;
                            }
                            if (fieldName === "Size") {
                                callData.value = gather.form.fields[0].value.id;
                                rerate = true;
                            }
                            if (fieldName === "TrackingMethod") {
                                callData.value = gather.form.fields[0].value.id;

                            }
                            if (fieldName === "Size" || fieldName === "TrackingMethod") {
                                job[callData.field.toLowerCase()] = gather.form.fields[0].value;
                            } else {
                                job[callData.field.toLowerCase()] = callData.value;
                            }

                            if (fieldName === "SpeedID") {
                                callData.value = gather.form.fields[0].value;
                                job.speedID = parseInt(gather.form.fields[0].value);
                                job.speed = $("#gather-SpeedID").find(':selected').text();
                                rerate = true;
                            }
                            if (fieldName === "JobTypeID") {
                                callData.value = gather.form.fields[0].value;
                                job.jobType = gather.form.fields[0].value;
                                return DispatchData
                                    .updateJobType(callData.jobID,
                                        callData.value,
                                        FirstName).then(function (response) {

                                    });
                            }
                            if (fieldName === "InternalStatusID") {
                                callData.value = gather.form.fields[0].value;
                                job.internalStatusID = gather.form.fields[0].value;
                            }
                            if (fieldName === "NotifiedJobTypeID") {
                                callData.value = gather.form.fields[0].value;
                                job.notifiedJobTypeID = parseInt(gather.form.fields[0].value);
                                job.notify = $("#gather-NotifiedJobTypeID").find(':selected').text();
                                rerate = true;
                            }
                            if (fieldName === "AcceptedJobTypeID") {
                                callData.value = gather.form.fields[0].value;
                                job.acceptedJobTypeID = parseInt(gather.form.fields[0].value);
                                job.speedAccepted = $("#gather-AcceptedJobTypeID").find(':selected').text();
                                rerate = true;
                            }
                            if (fieldName === "DeliverToLeaveID") {
                                callData.value = gather.form.fields[0].value;
                                job.sigNotRequired = $("#gather-DeliverToLeaveID").find(':selected').text();
                            }
                            if (fieldName === "UndeliverableLocationID") {
                                callData.value = gather.form.fields[0].value;
                                job.UDStatus = $("#gather-UndeliverableLocationID").find(':selected').text();
                            }
                            if (fieldName === "ClientID") {
                                callData.value = gather.form.fields[0].value;
                                job.clientID = gather.form.fields[0].value;
                                rerate = gather.form.fields[1].value;
                            }
                            if (fieldName === "DGClass") {
                                callData.value = callData.value.id;
                                job.dgClass = callData.value.id;
                                var dgdocs = gather.form.fields[1].value;


                                return DispatchData
                                    .updateJobDetail(callData.jobID,
                                        callData.field,
                                        callData.value,
                                        job.charge,
                                        FirstName,
                                        ContactID,
                                        job.preBook).then(response => {
                                        if (job.dgDocumentation !== dgdocs) {
                                            job.dgDocumentation = dgdocs;
                                            return DispatchData
                                                .updateJobDetail(callData.jobID,
                                                    "DGDocumentation",
                                                    job.dgDocumentation,
                                                    job.charge,
                                                    FirstName,
                                                    ContactID,
                                                    job.preBook).then(response => response);
                                        } else {
                                            return response;
                                        }

                                    });
                            }
                            if (rerate && !job.bulkJob) {
                                return self.rateJob(job).then(function (rate) {
                                    return DispatchData
                                        .updateJobDetail(callData.jobID,
                                            callData.field,
                                            callData.value,
                                            Number(rate.replace(/[^0-9.-]+/g, "")),
                                            FirstName,
                                            ContactID,
                                            job.preBook).then(response => response);
                                });
                            } else {
                                return job.bulkJob ? DispatchData
                                        .updateBulkJobDetail(job.id,
                                            callData.field,
                                            callData.value,
                                            job.charge,
                                            FirstName,
                                            ContactID).then(response => response) :
                                    DispatchData
                                        .updateJobDetail(callData.jobID,
                                            callData.field,
                                            callData.value,
                                            job.charge,
                                            FirstName,
                                            ContactID,
                                            job.preBook).then(response => response);
                            }

                        },
                        submitValue: "Update Field"
                    };

                    setTimeout(function () {
                            console.log(gather);
                            gather.showForm();
                        },
                        200);
                };


                self.updateGPS = function (event, currentJob, field) {
                    // Get coordinates
                    const getDeliveryLocation = currentJob => currentJob.deliveryLongitude
                        ? {lat: currentJob.deliveryLatitude, long: currentJob.deliveryLongitude}
                        : {lat: "", long: ""};
                    const getPickupLocation = currentJob => currentJob.pickUpLongitude
                        ? {lat: currentJob.pickUpLatitude, long: currentJob.pickUpLongitude}
                        : {lat: "", long: ""};
                    const location = field === "toAddress" ? getDeliveryLocation(currentJob) : getPickupLocation(currentJob);
                    const {lat, long} = location;

                    const suburbText = field === "toAddress" ? currentJob.toSuburbName : currentJob.fromSuburbName;
                    console.log("Retrieved job coordinates!");

                    // Dialog
                    $mdDialog.show({
                        controller: GpsFormController,
                        controllerAs: 'ctrl',
                        parent: angular.element(document.body),
                        targetEvent: event,
                        templateUrl: "app/components/common/gpsForm/gpsForm.html",
                        clickOutsideToClose: false,
                        fullscreen: true,
                        locals: {
                            addressDetails: {
                                address: currentJob[field],
                                lat,
                                long,
                                suburb: suburbText,
                                postCode: currentJob.postCode,
                            },
                            suburbOptions: self.pickSuburbs,
                            title: "Update Address and GPS",
                            submitLabel: "Update",
                        },
                    }).then(addressDetails => {
                        try {
                            loadingService.showLoader();
                            const job = currentJob;

                            if (field === "toAddress") {
                                job.toAddress = (addressDetails.extras || '').length > 1 ? addressDetails.extras + ',' + addressDetails.address : addressDetails.address;
                                if (job.bulkJob) {
                                    DispatchData.updateBulkDeliveryAddress(job.id, addressDetails.suburb, addressDetails.postCode, job.toAddress, addressDetails.lat, addressDetails.long, FirstName)
                                        .then(() => {
                                            self.selectJobDetail(currentJob.id);
                                            $mdDialog.hide();
                                            toastrService.showSuccessToast("Address successfully updated");
                                            loadingService.closeLoader();
                                        });
                                }

                                job.toSuburbID = parseInt(addressDetails.our_suburb);
                            } else {
                                job.fromAddress = (addressDetails.extras || '').length > 1 ? addressDetails.extras + ',' + addressDetails.address : addressDetails.address;
                                if (job.bulkJob) {
                                    DispatchData.updateBulkPickupAddress(job.id, addressDetails.suburb, addressDetails.postCode, job.fromAddress, addressDetails.lat, addressDetails.long, FirstName)
                                        .then(() => {
                                            self.selectJobDetail(currentJob.id);
                                            $mdDialog.hide();
                                            toastrService.showSuccessToast("Address successfully updated");
                                            loadingService.closeLoader();
                                        });
                                }

                                job.fromSuburbID = parseInt(addressDetails.our_suburb);
                            }

                            const pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 || job.fromSuburbID === 112 && job.toSuburbID === 112 || job.fromSuburbID === 480 && job.toSuburbID === 480;

                            rateJobService.rateJob(job)
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
                                        DispatchData.updateDeliveryAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long, callData.CBD, Number(callData.rate.replace(/[^0-9.-]+/g, "")), FirstName, job.preBook)
                                            .then(() => {
                                                self.selectJobDetail(currentJob.id);
                                                $mdDialog.hide();
                                                toastrService.showSuccessToast("Address successfully updated")
                                                loadingService.closeLoader();
                                            });
                                    } else {
                                        DispatchData.updatePickupAddress(callData.jobID, callData.fromSuburbId, callData.fromAddress, callData.lat, callData.long, callData.CBD, Number(callData.rate.replace(/[^0-9.-]+/g, "")), FirstName, job.preBook)
                                            .then(() => {
                                                self.selectJobDetail(currentJob.id);
                                                $mdDialog.hide();
                                                toastrService.showSuccessToast("Address successfully updated")
                                                loadingService.closeLoader();
                                            });
                                    }
                                });
                        } catch (error) {
                            toastrService.showErrorToast(error.message)
                        }

                        console.log('Dialog closed!')
                    }).then(() => console.log("Split jobs canceled!"));
                };

                self.unlockJob = function (job) {
                    return DispatchData
                        .updateJobDetail(job.id, "Locked", false, job.charge, FirstName, ContactID, job.preBook)
                        .then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch((_) => {
                            toastrService.showErrorToast();
                        });
                }

                self.lockJob = function (job) {
                    return DispatchData
                        .updateJobDetail(job.id, "Locked", true, job.charge, FirstName, ContactID, job.preBook)
                        .then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                }

                self.preBookDirectClick = function (job) {
                    const directValue = !job.direct;

                    return DispatchData
                        .updateJobDetail(job.id, "Direct", directValue, job.charge, FirstName, ContactID, job.preBook)
                        .then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                }

                self.repriceClick = function (job) {
                    return DispatchData
                        .updateJobDetail(job.id, "Reprice", job.reprice, job.charge, FirstName, ContactID, job.preBook)
                        .then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.pushToLive = function (job) {
                    job.done = !job.done;

                    return DispatchData
                        .releaseBulkJob(job.jobNo, job.bookedDate)
                        .then(response => {
                            self.selectBulkJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.vanOkClick = function (job) {
                    const vanOkValue = !job.vanOK;

                    return DispatchData
                        .updateJobDetail(job.id,
                            "VanOK",
                            vanOkValue,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.vanClick = function (job) {
                    const vanValue = !job.van;

                    return self.rateJob(job)
                        .then(rate => {
                            console.log(rate);

                            return DispatchData
                                .updateJobDetail(
                                    job.id,
                                    "Van",
                                    vanValue,
                                    Number(rate.replace(/[^0-9.-]+/g, "")),
                                    FirstName,
                                    ContactID,
                                    job.preBook
                                )
                                .then(response => {
                                    self.selectJobDetail(job.id);
                                    return response;
                                }).catch(() => toastrService.showErrorToast());
                        }).catch(() => toastrService.showErrorToast());

                };

                self.pedalClick = function (job) {
                    const pedalValue = !job.pedal;

                    return self.rateJob(job).then(rate => {
                        console.log(rate);
                        return DispatchData
                            .updateJobDetail(job.id,
                                "Pedal",
                                pedalValue,
                                Number(rate.replace(/[^0-9.-]+/g, "")),
                                FirstName,
                                ContactID,
                                job.preBook).then(function (response) {
                                self.selectJobDetail(job.id);
                                return response;
                            }).catch(() => toastrService.showErrorToast());
                    }).catch(() => toastrService.showErrorToast());
                };

                self.truckClick = function (job) {
                    const truckValue = !job.truck;

                    return self.rateJob(job)
                        .then(rate => {
                            console.log(rate);
                            return DispatchData.updateJobDetail(
                                job.id,
                                "Truck",
                                truckValue,
                                Number(rate.replace(/[^0-9.-]+/g, "")),
                                FirstName,
                                ContactID,
                                job.preBook
                            );
                        })
                        .then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.directClick = function (job) {
                    const directValue = !job.direct;

                    if (!directValue) {
                        return DispatchData.processUncheckDirect(job.id, FirstName, ContactID, job.speedAccepted);
                    } else {
                        return self.rateJob(job).then(rate => {
                            console.log(rate);
                            return DispatchData
                                .updateJobDetail(job.id,
                                    "Direct",
                                    directValue,
                                    Number(rate.replace(/[^0-9.-]+/g, "")),
                                    FirstName,
                                    ContactID,
                                    job.preBook).then(response => {
                                    self.selectJobDetail(job.id);
                                    return response;
                                }).catch(() => toastrService.showErrorToast());
                        }).catch(() => toastrService.showErrorToast());
                    }
                };

                self.attentionClick = function (job) {
                    const attentionValue = !job.attention;

                    return DispatchData
                        .updateJobDetail(job.id,
                            "Attention",
                            attentionValue,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };


                self.repriceClick = function (job) {
                    const repriceValue = !job.reprice;

                    return DispatchData
                        .updateJobDetail(job.id,
                            "Reprice",
                            repriceValue,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.preBookReturnClick = function (job) {
                    returnValue = !job.return;

                    return DispatchData
                        .updateJobDetail(job.id,
                            "Return",
                            returnValue,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.oneOffClick = function (job) {
                    const oneoffValue = !job.oneOff;

                    return DispatchData
                        .updateJobDetail(job.id,
                            "OneOff",
                            oneoffValue,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());

                };

                self.activeClick = function (job) {
                    const activeValue = !job.active;

                    return DispatchData
                        .updateJobDetail(job.id,
                            "Active",
                            activeValue,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.voidClick = function (job) {
                    const voidValue = !job.void;

                    return job.bulkJob ? DispatchData
                            .updateBulkJobDetail(job.id,
                                "Void",
                                voidValue,
                                job.charge,
                                FirstName,
                                ContactID).then(response => {
                                self.selectBulkJobDetail(job.id);
                                return response;
                            }).catch(() => toastrService.showErrorToast())
                        : DispatchData
                            .updateJobDetail(job.id,
                                "Void",
                                voidValue,
                                job.charge,
                                FirstName,
                                ContactID,
                                job.preBook).then(response => {
                                self.selectJobDetail(job.id);
                                return response;
                            }).catch(() => toastrService.showErrorToast());
                };

                self.doneClick = function (event, job) {
                    job.done = !job.done;

                    if (!job.completedTime) {
                        const confirm = $mdDialog.confirm()
                            .title('You must set completed time (POD Time) first')
                            .targetEvent(event)
                            .ok('OK');

                        $mdDialog.show(confirm).then(() => {
                            job.done = false;
                            return false;
                        });
                    }

                    if (!job.podName) {
                        const confirm = $mdDialog.confirm()
                            .title('You must set POD Name first')
                            .targetEvent(event)
                            .ok('OK');

                        $mdDialog.show(confirm).then(() => {
                            job.done = false;
                            return false;
                        }).catch(() => toastrService.showErrorToast());
                    }

                    return DispatchData
                        .updatePODDetail(job.jobNo,
                            6,
                            job.podName,
                            job.completedTime).then(() => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.deliveredClick = function (job) {
                    const doneValue = !job.done;

                    return DispatchData
                        .updateJobDetail(job.id,
                            "Delivered",
                            doneValue,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.airportOnlyClick = function (job) {
                    const airportOnlyValue = !job.airportOnly;

                    return DispatchData
                        .updateJobDetail(job.id,
                            "AirportOnly",
                            airportOnlyValue,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            self.selectJobDetail(job.id);
                            return response;
                        }).catch(() => toastrService.showErrorToast());
                };

                self.trackingMethodClick = function (event, job) {
                    self.showSelectDialog(event, job, options.detail.tracking, "TrackingMethod", "Tracking Method", "Select new tracking method..");
                };

                self.leaveClick = function (event, job) {
                    self.showSelectDialog(event, job, pickLeaveList, "DeliverToLeaveID", "Leave Parcel", "Select new location..");
                };

                self.undeliverableClick = function (event, job) {
                    self.showSelectDialog(event, job, pickUndeliverableList, "UndeliverableLocationID", "Undeliverable Location", "Select new location..");
                };

                self.showSelectDialog = function (event, job, data, fieldName, title, placeholder, id = "editField") {
                    const options = {
                        minimumInputLength: 1,
                        items: data,
                        placeholder: placeholder
                    };

                    $mdDialog.show({
                        controller: SelectDialogController,
                        controllerAs: 'ctrl',
                        parent: angular.element(document.body),
                        targetEvent: event,
                        templateUrl: 'app/components/common/selectDialog/selectDialog.html',
                        clickOutsideToClose: true,
                        fullscreen: true,
                        locals: {
                            id: id,
                            fieldName: fieldName,
                            title: title,
                            job: job,
                            options: options
                        },
                    }).then(_ => {
                        self.selectJobDetail(job.id);
                        console.log('Dialog closed!');
                    });
                };


                self.notifyClick = function (event, job) {
                    self.showSelectDialog(event, job, pickSpeeds, "NotifiedJobTypeID", "Notified", "Select new speed....");
                };

                self.acceptedClick = function (event, job) {
                    self.showSelectDialog(event, job, pickSpeeds, "AcceptedJobTypeID", "Accepted", "Select new speed....");
                };

                self.speedClick = function (event, job) {
                    self.showSelectDialog(event, job, pickSpeeds, "SpeedID", "Speed", "Select new speed....");
                };

                self.contactClick = function (event, job) {
                    self.showSelectDialog(event, job, pickSpeeds, "ContactID", "Contact", "Select new contact....");
                };

                self.getJobTypeDescription = function (jobTypeID) {
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
                };

                self.jobTypeClick = function (event, job) {
                    const data = [
                        {
                            id: 1,
                            text: 'Pickup'
                        },
                        {
                            id: 2,
                            text: 'Delivery'
                        },
                        {
                            id: 3,
                            text: '3rd-Party'
                        }
                    ];

                    self.showSelectDialog(event, job, data, "JobTypeID", "Job Type", "Select new job type....");
                };

                self.internalStatusClick = function (event, job) {
                    self.showSelectDialog(event, job, self.pickInternalStatus, "InternalStatusID", "Job FollowUp", "Select new status....");
                };

                self.showAutocompleteDialog = function (event, job, url, placeholder, fieldName, title, id = "editField", existingItem, showRerateOption) {
                    const options = {
                        placeholder,
                        minimumInputLength: 3,
                        searchUrl: url
                    };

                    $mdDialog.show({
                        controller: AutoCompleteDialogController,
                        controllerAs: 'ctrl',
                        parent: angular.element(document.body),
                        targetEvent: event,
                        templateUrl: 'app/components/common/autocompleteDialog/autoCompleteDialog.html',
                        clickOutsideToClose: true,
                        fullscreen: true,
                        locals: {
                            id,
                            fieldName,
                            title,
                            job,
                            options,
                            existingItem,
                            showRerateOption
                        },
                    }).then(_ => {
                        self.selectJobDetail(job.id);
                        console.log('Dialog closed!')
                    });
                }


                self.clientClick = function (event, job) {
                    const url = "/home/ActiveClients";
                    const placeholder = "Start typing to enter new client...";

                    const existingItem = {
                        id: job.clientID,
                        text: job.clientName
                    }

                    self.showAutocompleteDialog(event, job, url, placeholder, "ClientId", "Client", job.id, existingItem, true)
                };

                self.courierClick = function (event, job) {
                    const url = "/courier/AllActiveSearch";
                    const placeholder = "Start typing to search courier...";

                    self.showAutocompleteDialog(event, job, url, placeholder, "CourierID", "Courier", job.id, null, false)
                };

                //////////////////////////////
                //  PALLET CONTROLS //
                /////////////////////////////
                self.palletMenu = [
                    // NEW IMPLEMENTATION
                    {
                        text: "Delete",
                        click: function ($itemScope, $event, modelValue, text, $li) {

                            return DispatchData.deletePallet($itemScope.pallet, self.currentJob.preBook, FirstName).then(function (response) {

                                console.log(response);

                                if (response === "OK") {

                                    var index = $itemScope.currentJob.palletInfo.indexOf($itemScope.pallet);
                                    $itemScope.currentJob.palletInfo.splice(index, 1);

                                    return self.rateJob(self.currentJob).then(function (rate) {
                                        console.log(rate);
                                        if (rate !== self.currentJob.charge) {
                                            return DispatchData
                                                .updateJobDetail(self.currentJob.id,
                                                    "rate",
                                                    Number(rate.replace(/[^0-9.-]+/g, "")),
                                                    Number(rate.replace(/[^0-9.-]+/g, "")),
                                                    FirstName,
                                                    ContactID,
                                                    self.currentJob.preBook).then(function (response) {
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
                    }
                ];


                self.newPallet = function () {

                    gather.form = {
                        id: "newPallet",
                        tpl: "multi",
                        title: "Add Pallet",
                        fields: [
                            {
                                "name": "amount",
                                "label": "# of pallets...",
                                "colSize": "6"
                            },
                            {
                                "name": "weight",
                                "label": "Weight (KG)",
                                "colSize": "6"
                            },
                            {
                                "name": "length",
                                "label": "Length (m)",
                                "colSize": "6"
                            },
                            {
                                "name": "depth",
                                "label": "Depth (m)",
                                "colSize": "6"
                            },
                            {
                                "name": "height",
                                "label": "Height (m)",
                                "colSize": "6"
                            },
                            {
                                "name": "pu",
                                "label": "PU",
                                "type": "checkbox",
                                "colSize": "6"
                            },
                            {
                                "name": "do",
                                "label": "DO",
                                "type": "checkbox",
                                "colSize": "6"
                            },
                            {
                                "name": "dgclass",
                                "label": "DG Class",
                                "colSize": "6"
                            },
                            {
                                "name": "notes",
                                "label": "Notes...",
                                "colSize": "12",
                                "type": "textarea"
                            }
                        ],
                        onSubmit: function () {

                            var newP = {};

                            gather.form.fields.forEach(function (field) {
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

                            newP["id"] = self.currentJob.id;


                            return DispatchData.addPallet(newP, self.currentJob.preBook, FirstName).then(function (response) {

                                console.log(response);

                                if (response === "OK") {

                                    if (!self.currentJob.palletInfo) {
                                        self.currentJob.palletInfo = [];
                                    }

                                    self.currentJob.palletInfo.push(newP);

                                    return self.rateJob(self.currentJob).then(function (rate) {
                                        console.log(rate);
                                        if (rate !== self.currentJob.charge) {
                                            //DispatchData.addPriceSuburbChangeEvent(self.currentJob.jobNo,
                                            //    self.currentJob.clientID,
                                            //    self.currentJob.contactName,
                                            //    ContactID,
                                            //    self.currentJob.courierData.courierID,
                                            //    self.currentJob.id,
                                            //    self.currentJob.jobType,
                                            //    FirstName);

                                            return DispatchData
                                                .updateJobDetail(self.currentJob.id,
                                                    "rate",
                                                    Number(rate.replace(/[^0-9.-]+/g, "")),
                                                    Number(rate.replace(/[^0-9.-]+/g, "")),
                                                    FirstName,
                                                    ContactID,
                                                    self.currentJob.preBook).then(function (response) {
                                                    self.selectJobDetail(self.currentJob.id);
                                                    return response;
                                                });
                                        }

                                    });

                                } else {

                                    console.log("Critical Error Add Pallet");

                                }

                            });

                        },
                        submitValue: "Add Pallet"
                    };
                    setTimeout(function () {

                            gather.showForm();
                        },
                        200);


                };

                self.currentPallet = "";

                self.editPallet = function (pallet) {

                    self.currentPallet = pallet;

                    gather.form = {
                        id: "editPallet",
                        title: "Edit Pallet",
                        tpl: "multi",
                        fields: [
                            {
                                "name": "amount",
                                "label": "# of pallets",
                                "colSize": "6",
                                "value": pallet.quantity
                            },
                            {
                                "name": "weight",
                                "label": "Weight (KG)",
                                "colSize": "6",
                                "value": pallet.weight
                            },
                            {
                                "name": "length",
                                "label": "Length (m)",
                                "colSize": "6",
                                "value": pallet.length
                            },
                            {
                                "name": "depth",
                                "label": "Depth (m)",
                                "colSize": "6",
                                "value": pallet.depth
                            },
                            {
                                "name": "height",
                                "label": "Height (m)",
                                "colSize": "6",
                                "value": pallet.height
                            },
                            {
                                "name": "pu",
                                "label": "PU",
                                "colSize": "6",
                                "type": "checkbox",
                                "value": pallet.pu
                            },
                            {
                                "name": "do",
                                "label": "DO",
                                "colSize": "6",
                                "type": "checkbox",
                                "value": pallet.do
                            },
                            {
                                "name": "dgclass",
                                "label": "DG Class",
                                "colSize": "6",
                                "value": pallet.dgClass
                            },
                            {
                                "name": "notes",
                                "label": "Notes",
                                "colSize": "12",
                                "type": "textarea",
                                "value": pallet.notes
                            }
                        ],
                        onSubmit: function () {

                            var newP = {};

                            gather.form.fields.forEach(function (field) {
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

                            return DispatchData.editPallet(newP, self.currentJob.preBook, FirstName).then(function () {
                                return self.rateJob(self.currentJob).then(function (rate) {
                                    console.log(rate);
                                    if (rate !== self.currentJob.charge) {
                                        //DispatchData.addPriceSuburbChangeEvent(self.currentJob.jobNo,
                                        //    self.currentJob.clientID,
                                        //    self.currentJob.contactName,
                                        //    ContactID,
                                        //    self.currentJob.courierData.courierID,
                                        //    self.currentJob.id,
                                        //    self.currentJob.jobType,
                                        //    FirstName);
                                        return DispatchData
                                            .updateJobDetail(self.currentJob.id,
                                                "rate",
                                                Number(rate.replace(/[^0-9.-]+/g, "")),
                                                Number(rate.replace(/[^0-9.-]+/g, "")),
                                                FirstName,
                                                ContactID,
                                                self.currentJob.preBook).then(function (response) {
                                                self.selectJobDetail(self.currentJob.id);
                                                return response;
                                            });
                                    }

                                });
                            });
                        },
                        submitValue: "Edit Pallet"
                    };
                    setTimeout(function () {

                            gather.showForm();
                        },
                        200);

                };

                return self;

            }


        ]);
