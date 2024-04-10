angular
    .module("uDispatch")
    .factory("JobDetailService",
        ["DispatchData", "$ngConfirm",
            function (DispatchData, $ngConfirm) {
                var self = this;
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

                var gather = {
                };
                self.gpsForm = {
                };


                DispatchData.getLeaveList().then(function(data) {
                    pickLeaveList = data;
                });

                DispatchData.getUndeliverableList().then(function(data) {
                    pickUndeliverableList = data;
                });

                DispatchData.getSpeedList().then(function(data) {
                    pickSpeeds = data;
                });

                DispatchData.getSuburbList().then(function(data) {
                    self.pickSuburbs = data;
                });

                DispatchData.getInternalStatusList().then(function(data) {
                    self.pickInternalStatus = data;
                });


                self.setGather = function(g) {
                    gather = g;
                };

                self.setGPSForm = function(g) {
                    self.gpsForm = g;
                    //self.setupAutoComplete();
                };
                self.setSelectJobDetail = function(f) {
                    self.selectJobDetail = f;
                };
                self.setSelectBulkJobDetail = function (f) {
                    self.selectBulkJobDetail = f;
                };
                self.setJob = function(job) {
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
                        onSelectionChanged: function(item) {
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

                String.prototype.replaceAt = function(index, replacement) {
                    return this.substring(0, index) + replacement + this.substring(index + replacement.length);
                };

                self.frequencyChanged = function() {
                    
                };

                self.getTrackingMethod = function(tm) {
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

                self.getInternalStatus = function(is) {
                    var selected = self.pickInternalStatus.find(({ id }) => id === is);
                    return selected !== undefined ? selected.text : "";
                }

                self.hasDGDocs = function(job) {
                    if (job.dgClass) {
                        return ((job.dgDocumentation || 0) === 1) || ((job.dgDocumentation || false) === true)
                            ? "Yes"
                            : "No";
                    } else {
                        return "";
                    }

                };

                self.ppdExclusiveAmount = function(clientId, amount) {
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
                                    job.gstRate).then(function(description) {
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

                self.rateJob = function(job) {
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
                        job.speedID === 52 ||
                        job.speedID == 124 ||
                        job.speedID == 125 ||
                        job.speedID == 150 ||
                        job.speedID == 151 ||
                        job.speedID == 152 
                        )) {
                        //Truck Job
                        return DispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(
                            function(itemSummary) {
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

                self.editDetailField = function(job, fieldName, label, value, jobID, type, options) {

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
                        onSubmit: function() {
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
                                        FirstName).then(function(response) {

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
                                        job.preBook).then(function (response) {
                                        if (job.dgDocumentation !== dgdocs) {
                                            job.dgDocumentation = dgdocs;
                                            return DispatchData
                                                .updateJobDetail(callData.jobID,
                                                    "DGDocumentation",
                                                    job.dgDocumentation,
                                                    job.charge,
                                                    FirstName,
                                                    ContactID,
                                                    job.preBook).then(function (response) {
                                                    return response;
                                                });
                                        } else {
                                            return response;
                                        }

                                    });
                            }
                            if (rerate && !job.bulkJob) {
                                return self.rateJob(job).then(function(rate) {
                                    //console.log(rate);
                                    //if (rate !== job.charge) {
                                    //    DispatchData.addPriceSuburbChangeEvent(job.jobNo,
                                    //        job.clientID,
                                    //        job.contactName,
                                    //        ContactID,
                                    //        job.courierData.courierID,
                                    //        job.id,
                                    //        job.jobType,
                                    //        FirstName);
                                    //}
                                    return DispatchData
                                        .updateJobDetail(callData.jobID,
                                            callData.field,
                                            callData.value,
                                            Number(rate.replace(/[^0-9.-]+/g, "")),
                                            FirstName,
                                            ContactID,
                                            job.preBook).then(function (response) {
                                            return response;
                                        });
                                });
                            } else {
                                return job.bulkJob ?  DispatchData
                                    .updateBulkJobDetail(job.id,
                                        callData.field,
                                        callData.value,
                                        job.charge,
                                        FirstName,
                                        ContactID).then(function (response) {
                                        return response;
                                    }) :
                                    DispatchData
                                    .updateJobDetail(callData.jobID,
                                        callData.field,
                                        callData.value,
                                        job.charge,
                                        FirstName,
                                        ContactID,
                                        job.preBook).then(function(response) {
                                        return response;
                                    });
                            }

                        },
                        submitValue: "Update Field"
                    };

                    setTimeout(function() {
                            console.log(gather);
                            gather.showForm();
                        },
                        200);


                };

                self.setupAutoComplete = function() {
                    console.log("setup autocomplete");
                    var options = {
                        minimumInputLength: 1,
                        ajax: {
                            url: 'https://autocomplete.geocoder.cit.api.here.com/6.2/suggest.json',
                            delay: 250,
                            dataType: "json",
                            data: function(params) {
                                return {
                                    query: params.term,
                                    app_id: "bBPfh2x8Cauun3ygLMAx",
                                    app_code: "yjfwTdkin_R2rGXYTrwWVg",
                                    beginHighlight: "<b>",
                                    endHighlight: "</b>",
                                    country: "NZL"
                                };
                            },
                            processResults: function(data) {
                                return {
                                    results: $.map(data.suggestions,
                                        function(obj) {
                                            return {
                                                id: obj.locationId,
                                                text: obj.label.split(", ").reverse().join(", ")
                                            };
                                        })
                                };
                            }
                        },
                        escapeMarkup: function(markup) { return markup; }
                    };

                    $("#location").select2(options).on("select2:select",
                        function(e) {
                            $.getJSON("https://geocoder.cit.api.here.com/6.2/geocode.json",
                                {
                                    app_id: "bBPfh2x8Cauun3ygLMAx",
                                    app_code: "yjfwTdkin_R2rGXYTrwWVg",
                                    locationId: e.params.data.id
                                }).done(function(data) {
                                var locn = data.Response.View[0].Result[0].Location;
                                console.log("Suburb = " + locn.Address.District);
                                console.log("PostCode = " + locn.Address.PostalCode);
                                $("#suburb").val(locn.Address.District);
                                var mappedSub = self.pickSuburbs.find(obj => obj.text === locn.Address.District ||
                                    obj.alias === locn.Address.District);
                                if (mappedSub !== undefined) {
                                    console.log(mappedSub);
                                    $('#our_suburb').val(mappedSub.id).trigger('change');
                                } else {
                                    $('#our_suburb').val(null).trigger('change');
                                }


                                self.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                                self.gpsForm.data.long = locn.DisplayPosition.Longitude;
                                self.gpsForm.data.address = locn.Address.Label;
                                self.gpsForm.data.suburb = locn.Address.District;
                                self.gpsForm.data.postCode = locn.Address.PostalCode;
                                //var ll = new google.maps.LatLng(locn.DisplayPosition.Latitude, locn.DisplayPosition.Longitude);
                                //self.map.setCenter(ll);
                                //self.marker.setPosition(ll);

                            });
                        });

                    var suburbOptions = {
                        minimumInputLength: 1,
                        data: self.pickSuburbs
                    };

                    $("#our_suburb").select2(suburbOptions);

                    //waitingDialog.hide();
                };

                self.updateGPS = function(currentJob, field, fromRightClick) {
                    waitingDialog.show();
                    var lat;
                    var long;
                    var q;
                    if (field === "toAddress") {


                        if (currentJob.deliveryLongitude) {

                            lat = currentJob.deliveryLatitude;
                            long = currentJob.deliveryLongitude;
                            //q = $("#gpsMap").attr("data-src") + lat + "," + long;
                        } else {
                            lat = "";
                            long = "";
                            //q = $("#gpsMap").attr("data-src") + encodeURIComponent(currentJob.toAddress);
                        }
                    } else {

                        if (currentJob.pickUpLongitude) {
                            lat = currentJob.pickUpLatitude;
                            long = currentJob.pickUpLongitude;
                            //q = $("#gpsMap").attr("data-src") + lat + "," + long;
                        } else {
                            lat = "";
                            long = "";
                           //q = $("#gpsMap").attr("data-src") + encodeURIComponent(currentJob.fromAddress);
                        }
                    }

                    console.log(currentJob.pickUpLatitude);
                    //console.log(q);
                   // $("#gpsMap").attr("src", q);


                    self.gpsForm.data = {
                        "address": currentJob[field],
                        "lat": lat,
                        "long": long
                    };
                    self.gpsForm.onSubmit = function(location) {

                        var job = currentJob;
                        if (self.gpsForm.data.our_suburb === undefined) {
                            alert("You must pick one of our suburbs to map this address to");
                            return self.gpsFormPromise;
                        }



                        if (field === "toAddress") {
                            job.toAddress = (self.gpsForm.data.extras || '').length > 1 ? self.gpsForm.data.extras + ',' + self.gpsForm.data.address : self.gpsForm.data.address;
                            if (job.bulkJob) {
                                return DispatchData.updateBulkDeliveryAddress(job.id,
                                    self.gpsForm.data.suburb,
                                    self.gpsForm.data.postCode,
                                    job.toAddress,
                                    self.gpsForm.data.lat,
                                    self.gpsForm.data.long,
                                    FirstName).then(function () {
                                        $(".gpsForm").hide(0);

                                });
                            }
                            //if (!job.bulkJob && job.toSuburbID.toString() !== self.gpsForm.data.our_suburb) {
                            //    //ToDo create change event
                            //    DispatchData.addPriceSuburbChangeEvent(job.jobNo,
                            //        job.clientID,
                            //        job.contactName,
                            //        ContactID,
                            //        job.courierData.courierID,
                            //        job.id,
                            //        job.jobType,
                            //        FirstName);
                            //}
                            job.toSuburbID = parseInt(self.gpsForm.data.our_suburb);
                        } else {
                            job.fromAddress = (self.gpsForm.data.extras || '').length > 1 ? self.gpsForm.data.extras + ',' + self.gpsForm.data.address : self.gpsForm.data.address;
                            if (job.bulkJob) {
                                return DispatchData.updateBulkPickupAddress(job.id,
                                    self.gpsForm.data.suburb,
                                    self.gpsForm.data.postCode,
                                    job.fromAddress,
                                    self.gpsForm.data.lat,
                                    self.gpsForm.data.long,
                                    FirstName).then(function () {
                                    $(".gpsForm").hide(0);
                                    

                                });
                            }
                            
                            //if (!job.bulkJob && job.fromSuburbID.toString() !== self.gpsForm.data.our_suburb) {
                            //    //ToDo create change event
                            //    DispatchData.addPriceSuburbChangeEvent(job.jobNo,
                            //        job.clientID,
                            //        job.contactName,
                            //        ContactID,
                            //        job.courierData.courierID,
                            //        job.id,
                            //        job.jobType,
                            //        FirstName);
                            //}
                            job.fromSuburbID = parseInt(self.gpsForm.data.our_suburb);
                        }
                        var pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 ||
                            job.fromSuburbID === 112 && job.toSuburbID === 112 ||
                            job.fromSuburbID === 480 && job.toSuburbID === 480;

                        return self.rateJob(job).then(function(rate) {
                            //console.log(rate);
                            //if (rate !== job.charge) {
                            //    DispatchData.addPriceSuburbChangeEvent(job.jobNo,
                            //        job.clientID,
                            //        job.contactName,
                            //        ContactID,
                            //        job.courierData.courierID,
                            //        job.id,
                            //        job.jobType,
                            //        FirstName);
                            //}
                            var callData = {
                                "call": "updateJobData",
                                "addressField": field,
                                "lat": self.gpsForm.data.lat,
                                "long": self.gpsForm.data.long,
                                "fromSuburbId": job.fromSuburbID,
                                "toSuburbId": job.toSuburbID,
                                "fromAddress": job.fromAddress,
                                "toAddress": job.toAddress,
                                "rate": rate,
                                "jobID": currentJob.id,
                                "CBD": pedal
                            };
                            console.log(callData);
                            if (field === "toAddress") {
                                return DispatchData.updateDeliveryAddress(callData.jobID,
                                    callData.toSuburbId,
                                    callData.toAddress,
                                    callData.lat,
                                    callData.long,
                                    callData.CBD,
                                    Number(callData.rate.replace(/[^0-9.-]+/g, "")),
                                    FirstName,
                                    job.preBook).then(function () {
                                    $(".gpsForm").hide(0);

                                });
                            } else {
                                return DispatchData.updatePickupAddress(callData.jobID,
                                    callData.fromSuburbId,
                                    callData.fromAddress,
                                    callData.lat,
                                    callData.long,
                                    callData.CBD,
                                    Number(callData.rate.replace(/[^0-9.-]+/g, "")),
                                    FirstName,
                                    job.preBook).then(function () {
                                    $(".gpsForm").hide(0);
                                    var j = currentJob;

                                });
                            }

                        });


                    };
                    self.gpsForm.cancel = function() {
                        $(".gpsForm").hide(0);
                    };
                    self.gpsForm.placeChanged = function(place) {
                        if (place !== null) {
                            self.place = place;
                        } else {
                            self.place = this.getPlace();
                        }

                        //self.gpsForm.address = $scope.place.formatted_address;
                        self.gpsForm.data.lat = self.place.geometry.location.lat();
                        self.gpsForm.data.long = self.place.geometry.location.lng();
                        if (self.place.address_components.find(x => x.types[0] === "postal_code")) {
                            self.gpsForm.data.postCode = self.place.address_components
                                .find(x => x.types[0] === "postal_code").long_name;
                        }
                        self.map.setCenter(self.place.geometry.location);
                    };
                    self.gpsForm.moveMarker = function(event) {
                        var latlng = event.latLng;
                        //GeoCoder.geocode({ location: latlng })
                        //    .then(function (result) {
                        //        $scope.marker.setPosition(latlng);
                        //        self.gpsForm.placeChanged(result[0]);
                        //    });
                    };
                    self.gpsForm.markerDragend = function() {
                        //Geo coder for drag marker
                        var location = self.marker.getPosition();
                        $.getJSON("https://reverse.geocoder.api.here.com/6.2/reversegeocode.json",
                            {
                                app_id: "bBPfh2x8Cauun3ygLMAx",
                                app_code: "yjfwTdkin_R2rGXYTrwWVg",
                                mode: "retrieveAddresses",
                                prox: location.lat().toString() + "," + location.lng().toString() + "," + "250"
                            }).done(function(data) {
                            var locn = data.Response.View[0].Result[0].Location;
                            self.gpsForm.data.address = locn.Address.Label;
                            console.log("Suburb = " + locn.Address.District);
                            console.log("PostCode = " + locn.Address.PostalCode);
                            $("#suburb").val(locn.Address.District);
                            var mappedSub =
                                self.pickSuburbs.find(obj => obj.text === locn.Address.District || obj.alias === locn.Address.District);
                            if (mappedSub !== undefined) {
                                console.log(mappedSub);
                                $('#our_suburb').val(mappedSub.id).trigger('change');
                            } else {
                                $('#our_suburb').val(null).trigger('change');
                            }


                            self.gpsForm.data.lat = locn.DisplayPosition.Latitude;
                            self.gpsForm.data.long = locn.DisplayPosition.Longitude;
                        });

                    };
                      


                self.gpsForm.showForm(fromRightClick);
                



                self.copyGpsAddress = function () {
                    $('#location').select2('open');
                    var search = $('#location').data('select2').dropdown.$search;
                    if (self.gpsForm.data.address.indexOf(',') > 0) {
                        search.val(self.gpsForm.data.address.split(',')[1].split());
                    } else {
                        search.val(self.gpsForm.data.address);
                    }
                    search.trigger("input");
                };


                };

                self.unlockJob = function(job) {
                    return DispatchData
                        .updateJobDetail(job.id,
                            "Locked",
                            false,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(function (response) {
                                self.selectJobDetail(job.id);
                            return response;
                        });
                }

                self.lockJob = function (job) {
                    return DispatchData
                        .updateJobDetail(job.id,
                            "Locked",
                            true,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(function (response) {
                                self.selectJobDetail(job.id);
                            return response;
                        });
                }

                self.preBookDirectClick = function(job) {
                    return DispatchData
                    .updateJobDetail(job.id,
                        "Direct",
                        job.direct,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                        });
                };

            self.repriceClick = function (job) {
                return DispatchData
                    .updateJobDetail(job.id,
                        "Reprice",
                        job.reprice,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                        });
            };

            self.pushToLive = function (job) {
                return DispatchData
                    .releaseBulkJob(job.jobNo, job.bookedDate).then(function (response) {
                        self.selectBulkJobDetail(job.id);
                        return response;
                    });
            };

            self.vanOkClick = function (job) {
                return DispatchData
                    .updateJobDetail(job.id,
                        "VanOK",
                        job.vanOK,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                        return response;
                    });
            };


            self.vanClick = function (job) {
                return self.rateJob(job).then(function (rate) {
                    console.log(rate);
                    return DispatchData
                        .updateJobDetail(job.id,
                            "Van",
                            job.van,
                            Number(rate.replace(/[^0-9.-]+/g, "")),
                            FirstName,
                            ContactID,
                            job.preBook).then(function (response) {
                                self.selectJobDetail(job.id);
                                return response;
                        });
                });

            };

            self.pedalClick = function (job) {
                return self.rateJob(job).then(function (rate) {
                    console.log(rate);
                    return DispatchData
                        .updateJobDetail(job.id,
                            "Pedal",
                            job.pedal,
                            Number(rate.replace(/[^0-9.-]+/g, "")),
                            FirstName,
                            ContactID,
                            job.preBook).then(function (response) {
                                self.selectJobDetail(job.id);
                            return response;
                        });
                });

            };

            self.truckClick = function (job) {
                return self.rateJob(job).then(function (rate) {
                    console.log(rate);
                    return DispatchData
                        .updateJobDetail(job.id,
                            "Truck",
                            job.truck,
                            Number(rate.replace(/[^0-9.-]+/g, "")),
                            FirstName,
                            ContactID,
                            job.preBook).then(function (response) {
                                self.selectJobDetail(job.id);
                            return response;
                        });
                });

            };

            self.directClick = function(job) {
                if (!job.direct) {
                    return DispatchData.processUncheckDirect(job.id, FirstName, ContactID, job.speedAccepted);
                } else {
                    return self.rateJob(job).then(function(rate) {
                        console.log(rate);
                        return DispatchData
                            .updateJobDetail(job.id,
                                "Direct",
                                job.direct,
                                Number(rate.replace(/[^0-9.-]+/g, "")),
                                FirstName,
                                ContactID,
                                job.preBook).then(function (response) {
                                    self.selectJobDetail(job.id);
                                    return response;
                            });
                    });

                }

            };

            self.attentionClick = function(job) {
                return DispatchData
                    .updateJobDetail(job.id,
                        "Attention",
                        job.attention,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                    });
                };

            self.repriceClick = function (job) {
                return DispatchData
                    .updateJobDetail(job.id,
                        "Reprice",
                        job.reprice,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                        });
            };


            self.preBookReturnClick = function(job) {
                return DispatchData
                    .updateJobDetail(job.id,
                        "Return",
                        job.return,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                        });
            };




            self.oneOffClick = function (job) {
                return DispatchData
                    .updateJobDetail(job.id,
                        "OneOff",
                        job.oneOff,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                        return response;
                    });

                };

            self.activeClick = function (job) {
                return DispatchData
                    .updateJobDetail(job.id,
                        "Active",
                        job.active,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                        });

            };

            self.voidClick = function (job) {
                return job.bulkJob ? DispatchData
                    .updateBulkJobDetail(job.id,
                        "Void",
                        job.void,
                        job.charge,
                        FirstName,
                        ContactID).then(function (response) {
                            self.selectBulkJobDetail(job.id);
                        return response;
                    }) : DispatchData
                    .updateJobDetail(job.id,
                        "Void",
                        job.void,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                        self.selectJobDetail(job.id);
                        return response;
                    });

            };
            self.doneClick = function (job) {
                if (!job.completedTime) {
                    $ngConfirm("You must set completed time (POD Time) first");
                    job.done = false;
                    return false;
                }
                if (!job.podName) {
                    $ngConfirm("You must set POD Name first");
                    job.done = false;
                    return false;
                }
                return DispatchData
                    .updatePODDetail(job.jobNo,
                        6,
                        job.podName,
                        job.completedTime).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                        });

                };


            self.deliveredClick = function (job) {
                DispatchData
                    .updateJobDetail(job.id,
                        "Delivered",
                        job.done,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                        });
                };

            self.airportOnlyClick = function (job) {
                DispatchData
                    .updateJobDetail(job.id,
                        "AirportOnly",
                        job.airportOnly,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(function (response) {
                            self.selectJobDetail(job.id);
                            return response;
                        });
            };
            
            self.leaveClick = function(job) {
                this.editDetailField(job, 'DeliverToLeaveID', 'Leave Parcel', '', job.id, 'select2');
                setTimeout(function() {
                        var speedOptions = {
                            minimumInputLength: 1,
                            data: pickLeaveList,
                            placeholder: "Start typing to enter new location..."
                        };

                        $("#gather-DeliverToLeaveID").select2(speedOptions);
                        $("#gather-DeliverToLeaveID").select2('open');
                        $("#gather-DeliverToLeaveID").select2().dropdown.$search;

                    },
                    400);
            };

            self.undeliverableClick = function(job) {
                this.editDetailField(job, 'UndeliverableLocationID', 'Undeliverable Location', '', job.id, 'select2');
                setTimeout(function() {
                        var speedOptions = {
                            minimumInputLength: 1,
                            data: pickUndeliverableList,
                            placeholder: "Start typing to enter new location..."
                        };

                        $("#gather-UndeliverableLocationID").select2(speedOptions);
                        $("#gather-UndeliverableLocationID").select2('open').val(job.udStatus).trigger('change');
                        $("#gather-UndeliverableLocationID").select2().dropdown.$search;

                    },
                    400);
            };


            self.notifyClick = function(job) {
                this.editDetailField(job, 'NotifiedJobTypeID', 'Notified', '', job.id, 'select2');
                setTimeout(function() {
                        var speedOptions = {
                            minimumInputLength: 1,
                            data: pickSpeeds,
                            placeholder: "Start typing to enter new speed..."
                        };

                    $("#gather-NotifiedJobTypeID").select2(speedOptions);
                    $("#gather-NotifiedJobTypeID").select2('open').val(job.notifiedJobTypeID).trigger('change');
                    $("#gather-NotifiedJobTypeID").select2().dropdown.$search;

                    },
                    400);
            };

            self.acceptedClick = function(job) {
                this.editDetailField(job, 'AcceptedJobTypeID', 'Accepted', '', job.id, 'select2');
                setTimeout(function() {
                        var speedOptions = {
                            minimumInputLength: 1,
                            data: pickSpeeds,
                            placeholder: "Start typing to enter new speed..."
                        };

                        $("#gather-AcceptedJobTypeID").select2(speedOptions);

                    },
                    400);
            };

            self.speedClick = function(job) {
                this.editDetailField(job, 'SpeedID', 'Speed', '', job.id, 'select2');
                setTimeout(function() {
                        var speedOptions = {
                            minimumInputLength: 1,
                            data: pickSpeeds,
                            placeholder: "Start typing to enter new speed..."
                        };

                        $("#gather-SpeedID").select2(speedOptions);
                        $("#gather-SpeedID").select2('open').val(job.speedID).trigger('change');
                        $("#gather-SpeedID").select2().dropdown.$search;

                    },
                    200);
                };

            self.contactClick = function (job) {
                this.editDetailField(job, 'ContactID', 'Contact', '', job.id, 'select2');
                setTimeout(function () {
                        var speedOptions = {
                            minimumInputLength: 1,
                            data: pickContacts,
                            placeholder: "Start typing to enter new contact..."
                        };

                        $("#gather-ContactID").select2(speedOptions);
                        $("#gather-ContactID").select2('open').val(job.contactID).trigger('change');
                        $("#gather-ContactID").select2().dropdown.$search;

                    },
                    200);
            };

            self.getJobTypeDescription = function(jobTypeID) {
                switch (jobTypeID||1) {
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

            self.jobTypeClick = function (job) {
                this.editDetailField(job, 'JobTypeID', 'Job Type', '', job.id, 'select2');
                setTimeout(function() {
                    var jtOptions = {
                        minimumInputLength: 1,
                        data: [
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
                        ],
                        placeholder: "Start typing to enter new speed..."
                    };

                    $("#gather-JobTypeID").select2(jtOptions);
                    $("#gather-JobTypeID").select2('open').val(job.jobType).trigger('change');
                    $("#gather-JobTypeID").select2().dropdown.$search;
                },200);
            };

            self.internalStatusClick = function(job) {
                this.editDetailField(job, 'InternalStatusID', 'Job FollowUp', '', job.id, 'select2');
                setTimeout(function() {
                        var statusOptions = {
                            minimumInputLength: 1,
                            data: self.pickInternalStatus,
                            placeholder: "Start typing to enter new status..."
                        };

                        $("#gather-InternalStatusID").select2(statusOptions);

                    },
                    200);
            };

            self.clientClick = function(job) {
                this.editDetailField(job, 'ClientID', 'Client', '', job.id, 'select2');
                setTimeout(function() {
                        $("#gather-ClientID").select2({
                            ajax: {
                                url: "/home/ActiveClients",
                                dataType: 'json',
                                delay: 250,
                                data: function(params) {
                                    return {
                                        searchTerm: params.term
                                    };
                                },
                                processResults: function(data) {
                                    // parse the results into the format expected by Select2
                                    return {
                                        results: data
                                    };
                                },
                                cache: true
                            },
                            placeholder: "Start typing to enter new client...",
                            minimumInputLength: 3
                        });

                    },
                    200);
                };

                self.courierClick = function (job) {
                    this.editDetailField(job, 'CourierID', 'Courier', '', job.id, 'select2');
                    setTimeout(function () {
                        $("#gather-CourierID").select2({
                            ajax: {
                                url: "/courier/AllActiveSearch",
                                dataType: 'json',
                                delay: 250,
                                data: function (params) {
                                    return {
                                        searchTerm: params.term
                                    };
                                },
                                processResults: function (data) {
                                    // parse the results into the format expected by Select2
                                    return {
                                        results: data
                                    };
                                },
                                cache: true
                            },
                            placeholder: "Start typing to search courier...",
                            minimumInputLength: 3
                        });

                    },
                        200);
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
                        onSubmit: function() {

                            var newP = {};

                            gather.form.fields.forEach(function(field) {
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

                            return DispatchData.editPallet(newP, self.currentJob.preBook, FirstName).then(function() {
                                return self.rateJob(self.currentJob).then(function(rate) {
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
                    setTimeout(function() {

                            gather.showForm();
                        },
                        200);

                };

            return self;

        }

        
    ]);
        