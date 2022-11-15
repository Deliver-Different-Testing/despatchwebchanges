angular
    .module("uDispatch")
    .factory("JobDetailService",
        ["DispatchData",
            function(DispatchData) {
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


                self.setGather = function(g) {
                    gather = g;
                };

                self.setGPSForm = function(g) {
                    self.gpsForm = g;
                    //self.setupAutoComplete();
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
                        job.speedID === 52)) {
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
                                return DispatchData.addNote(job.id, callData.value, FirstName);
                            }

                            if (fieldName === "Items" || fieldName === "Weight") {
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
                                job.speedID = gather.form.fields[0].value;
                                job.speed = $("#gather-SpeedID").find(':selected').text();
                                rerate = true;
                            }
                            if (fieldName === "NotifiedJobTypeID") {
                                callData.value = gather.form.fields[0].value;
                                job.notifiedJobTypeID = gather.form.fields[0].value;
                                job.notify = $("#gather-NotifiedJobTypeID").find(':selected').text();
                                rerate = true;
                            }
                            if (fieldName === "AcceptedJobTypeID") {
                                callData.value = gather.form.fields[0].value;
                                job.acceptedJobTypeID = gather.form.fields[0].value;
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
                                        ContactID).then(function(response) {
                                        if (job.dgDocumentation !== dgdocs) {
                                            job.dgDocumentation = dgdocs;
                                            return DispatchData
                                                .updateJobDetail(callData.jobID,
                                                    "DGDocumentation",
                                                    job.dgDocumentation,
                                                    job.charge,
                                                    FirstName,
                                                    ContactID).then(function(response) {
                                                    return response;
                                                });
                                        } else {
                                            return response;
                                        }

                                    });
                            }
                            if (rerate) {
                                return self.rateJob(job).then(function(rate) {
                                    console.log(rate);
                                    if (rate !== job.charge) {
                                        DispatchData.addPriceSuburbChangeEvent(job.jobNo,
                                            job.clientID,
                                            job.contactName,
                                            ContactID,
                                            job.courierData.courierID,
                                            job.id,
                                            job.jobType,
                                            FirstName);
                                    }
                                    return DispatchData
                                        .updateJobDetail(callData.jobID,
                                            callData.field,
                                            callData.value,
                                            Number(rate.replace(/[^0-9.-]+/g, "")),
                                            FirstName,
                                            ContactID).then(function(response) {
                                            return response;
                                        });
                                });
                            } else {
                                return DispatchData
                                    .updateJobDetail(callData.jobID,
                                        callData.field,
                                        callData.value,
                                        job.charge,
                                        FirstName,
                                        ContactID).then(function(response) {
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

                    var lat;
                    var long;
                    var q;
                    if (field === "toAddress") {


                        if (currentJob.deliveryLongitude) {

                            lat = currentJob.deliveryLatitude;
                            long = currentJob.deliveryLongitude;
                            q = $("#gpsMap").attr("data-src") + lat + "," + long;
                        } else {
                            lat = "";
                            long = "";
                            q = $("#gpsMap").attr("data-src") + encodeURIComponent(currentJob.toAddress);
                        }
                    } else {

                        if (currentJob.pickUpLongitude) {
                            lat = currentJob.pickUpLatitude;
                            long = currentJob.pickUpLongitude;
                            q = $("#gpsMap").attr("data-src") + lat + "," + long;
                        } else {
                            lat = "";
                            long = "";
                            q = $("#gpsMap").attr("data-src") + encodeURIComponent(currentJob.fromAddress);
                        }
                    }

                    console.log(currentJob.pickUpLatitude);
                    console.log(q);
                    $("#gpsMap").attr("src", q);


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
                            job.toAddress = job.deliverToContact + ',' + self.gpsForm.data.address;
                            if (job.toSuburbID.toString() !== self.gpsForm.data.our_suburb) {
                                //ToDo create change event
                                DispatchData.addPriceSuburbChangeEvent(job.jobNo,
                                    job.clientID,
                                    job.contactName,
                                    ContactID,
                                    job.courierData.courierID,
                                    job.id,
                                    job.jobType,
                                    FirstName);
                            }
                            job.toSuburbID = parseInt(self.gpsForm.data.our_suburb);
                        } else {
                            job.fromAddress = self.gpsForm.data.address;
                            if (job.fromSuburbID.toString() !== self.gpsForm.data.our_suburb) {
                                //ToDo create change event
                                DispatchData.addPriceSuburbChangeEvent(job.jobNo,
                                    job.clientID,
                                    job.contactName,
                                    ContactID,
                                    job.courierData.courierID,
                                    job.id,
                                    job.jobType,
                                    FirstName);
                            }
                            job.fromSuburbID = parseInt(self.gpsForm.data.our_suburb);
                        }
                        var pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 ||
                            job.fromSuburbID === 112 && job.toSuburbID === 112 ||
                            job.fromSuburbID === 480 && job.toSuburbID === 480;

                        return self.rateJob(job).then(function(rate) {
                            console.log(rate);
                            if (rate !== job.charge) {
                                DispatchData.addPriceSuburbChangeEvent(job.jobNo,
                                    job.clientID,
                                    job.contactName,
                                    ContactID,
                                    job.courierData.courierID,
                                    job.id,
                                    job.jobType,
                                    FirstName);
                            }
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
                                    FirstName).then(function() {
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
                                    FirstName).then(function() {
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

            self.directClick = function(job) {
                if (!job.direct) {
                    return DispatchData.processUncheckDirect(job.id, FirstName, ContactID, job.speedAccepted);
                } else {
                    return self.rateJob(job).then(function(rate) {
                        console.log(rate);
                        return DispatchData
                            .updateJobDetail(job.id,
                                "Direct",
                                true,
                                Number(rate.replace(/[^0-9.-]+/g, "")),
                                FirstName,
                                ContactID).then(function (response) {
                                    self.selectJobDetail(self.currentJob.id);
                                    return response;
                            });
                    });

                }

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

            return self;

        }

        
    ]);
        