/**
 * @typedef {Object} Job
 * @property {number} id - The unique identifier for the job.
 * @property {number} rootParentID - The root parent's unique identifier.
 * @property {string} time - The time associated with the job in ISO 8601 date string format.
 * @property {?string} bookedDate - The date the job was booked, if applicable.
 * @property {boolean} direct - Whether the job is direct or not.
 * @property {boolean} van - Whether the job is associated with a van.
 * @property {?number} jobRelationshipTypeID - The unique identifier for the job relationship type.
 * @property {boolean} vanOK - Whether a van is OK for the job.
 * @property {boolean} done - Whether the job is done.
 * @property {boolean} void - Whether the job is void.
 * @property {boolean} truck - Whether the job is associated with a truck.
 * @property {boolean} saturdayDelivery - Whether the job is for Saturday delivery.
 * @property {boolean} return - Whether the job is a return.
 * @property {boolean} pedal - Whether the job involves pedaling.
 * @property {?boolean} reprice - Whether the job is repriced.
 * @property {boolean} attention - Whether the job requires attention.
 * @property {?number} pickupFrom - The pick up from location unique identifier.
 * @property {string} jobNo - The job number.
 * @property {string} speed - The speed category associated with the job.
 * @property {string} speedName - The name of the speed category associated with the job.
 * @property {?string} source - The source associated with the job.
 * @property {string} notifiedName - The name of the notified speed category associated with the job.
 * @property {string} acceptedName - The name of the accepted speed category associated with the job.
 * @property {number} speedId - The unique identifier for the speed category.
 * @property {string} notify - The notification status or value for the job.
 * @property {Object} vehicle - The vehicle detail object.
 * @property {number} vehicle.id - The unique identifier for the vehicle.
 * @property {string} vehicle.label - The label of the vehicle type. * @property {Array<object>} palletInfo - An array of objects containing pallet information.
 * @property {number} clientId - The unique identifier for the client.
 * @property {number} jobType - The unique identifier for the job type.
 * @property {string} client - The client's code or short name.
 * @property {string} clientName - The full name of the client.
 * @property {string} from - The start location for the job.
 * @property {number} fromSuburbId - The unique identifier for the suburb of the start location.
 * @property {string} fromSuburbName - The name of the suburb of the start location.
 * @property {string} fromPostCode - The postcode of the start location.
 * @property {string} fromAddress - The full address of the start location.
 * @property {string} to - The end location for the job.
 * @property {number} toSuburbID - The unique identifier for the suburb of the end location.
 * @property {string} toSuburbName - The name of the suburb of the end location.
 * @property {string} toPostCode - The postcode of the end location.
 * @property {string} toAddress - The full address of the end location.
 * @property {string} toCity - The city of the end location.
 * @property {?string} courier - The courier assigned to the job.
 * @property {number} gstRate - The Goods and Services Tax (GST) rate applied to the job.
 * @property {number} remain - Remaining quantity or value pertaining to the job.
 * @property {number} pickupTime - The scheduled pickup time for the job.
 * @property {number} deliveryTime - The scheduled delivery time for the job.
 * @property {number} alertLatePickup - Alert flag for a late pickup.
 * @property {number} alertLateDelivery - Alert for a late delivery.
 * @property {number} minutes - The estimated duration of the job in minutes.
 * @property {number} statusID - The status ID of the job.
 * @property {string} status - The status of the job.
 * @property {string} statusName - The name representing the job's status.
 * @property {?string} lp - Uncertain property, could relate to "last pickup" or other aspect of the job based context.
 * @property {?string} ld - Uncertain property, could relate to "last delivery" or other aspect of the job based context.
 * @property {string} contactName - The name of the main contact for the job.
 * @property {string} loggedInContactName - The name of the contact who logged in.
 * @property {string} deliverToContact - The name of the contact to who delivery should be made.
 * @property {number} trackingMethod - The tracking method used for the job.
 * @property {string} trackingMobile - The mobile number for tracking.
 * @property {?string} trackingEmail - The email address for tracking.
 * @property {?string} udStatus - Uncertain property, could relate to a status or identifier in the system.
 * @property {?string} podPhoto - Proof of Delivery photo if available.
 * @property {?string} deliverySignature - The signature made upon delivery.
 * @property {?string} podPhotos - Array of Proof of Delivery photos if available.
 * @property {?string} podName - Proof of Delivery name if available.
 * @property {string} description - Description of the job.
 * @property {string} reference1 - Reference data related to the job.
 * @property {string} reference2 - Additional reference data related to the job.
 * @property {boolean} autoSize - Whether the size was automatically determined.
 * @property {boolean} autoPrice - Whether the price was automatically determined.
 * @property {number} price - The price for the job.
 * @property {number} size - The size associated with the job.
 * @property {string} distance - The distance associated with the job.
 * @property {string} quantity - The quantity associated with the job.
 * @property {string} weight - The weight associated with the job.
 * @property {?string} height - The height associated with the job.
 * @property {?string} width - The width associated with the job.
 * @property {?string} depth - The depth associated with the job.
 * @property {string} contractName - The name of the contract associated with the job.
 * @property {number} contractId - The unique identifier for the contract.
 * @property {string} contractingChainName - The name of the contract chain associated with the job.
 * @property {number} contractingChainId - The unique identifier for the contract chain.
 * @property {number} pricingBandId - The unique identifier for the pricing band.
 * @property {string} pricingBandName - The name of the pricing band.
 * @property {number} charged - The amount charged for the job.
 * @property {string} chargeCode - The code representing the charge for the job.
 * @property {number} volumeCubed - The cubed volume associated with the job.
 * @property {boolean} express - Indicates if the job is an express delivery.
 * @property {string} itemDescription - Description of the item for the job.
 * @property {number} directDriveJobId - The unique identifier for direct drive job.
 * @property {string} transportType - The type of transport used for the job.
 * @property {number} deliveryCharge - The charge for delivery.
 * @property {number} totalCharge - The total charge for the job.
 * @property {string} deliverySuburb - The suburb for delivery.
 * @property {?string} deliveryPostCode - The postcode for delivery.
 * @property {?string} deliveryState - The state for delivery.
 * @property {?string} deliveryContactName - The contact name for delivery.
 * @property {?string} deliveryContactNumber - The contact number for delivery.
 * @property {?string} deliveryContactEmail - The contact email for delivery.
 * @property {string} pickupSuburb - The suburb for pickup.
 * @property {?string} pickupPostCode - The postcode for pickup.
 * @property {?string} pickupState - The state for pickup.
 * @property {?string} pickupContactName - The contact name for pickup.
 * @property {?string} pickupContactNumber - The contact number for pickup.
 * @property {?string} pickupContactEmail - The contact email for pickup.
 * @property {string} formattedDeliveryAddress - The formatted delivery address.
 * @property {string} formattedPickupAddress - The formatted pickup address.
 * @property {?boolean} isPickup - Flag determining if this location is meant for pickup.
 * @property {?boolean} isDelivery - Flag determining if this location is meant for delivery.
 * @property {string} createdDate - The date the job was created on.
 * @property {string} updatedDate - The date the job was last updated on.
 * @property {?string} deliveredDate - The date the job was delivered on.
 * @property {?string} pickedUpDate - The date the job was picked up on.
 * @property {?string} eta - The estimated time of arrival for delivery.
 * @property {?string} pickupEta - The estimated time of arrival for pickup.
 * @property {boolean} isDeleted - Flag determining if the job is deleted.
 * @property {Array<object>} additionalProperties - An array of additional properties associated with the job.
 * @property {?string} locationType - The type of location (pick up, delivery, etc.)
 * @property {number} locationId - The unique identifier for the location.
 * @property {string} locationName - The name of the location.
 * @property {?string} locationSuburb - The suburb of the location.
 * @property {?string} locationPostCode - The postal code of the location.
 * @property {?string} locationState - The state where the location is situated.
 * @property {?string} locationContactName - The contact name for the location.
 * @property {?string} locationContactNumber - The contact number for the location.
 * @property {?string} locationContactEmail - The contact email for the location.
 * @property {?string} serviceLevel - The service level for the job.
 * @property {?boolean} isExpedited - Flag indicating whether the job is expedited.
 * @property {?string} jobStatus - The current status of the job.
 * @property {?string} jobType - The type of the job.
 * @property {?string} jobPriority - The priority assigned to the job.
 * @property {?boolean} isHighValue - Flag indicating whether the job is of high value.
 * @property {Array<object>} attachments - An array of attachments related to the job.
 * @property {Array<object>} comments - An array of comments related to the job.
 * @property {?string} specialInstructions - Any special instructions related to the job.
 * @property {?string} termsAndConditions - The terms and conditions for the job.
 * @property {?string} clientReferenceNumber - The client's reference number for the job.
 * @property {?string} clientJobId - The ID of the job as provided by the client.
 * @property {Array<object>} jobRoutes - An array of routes related to the job.
 * @property {?number} estimatedJobDuration - The estimated duration of the job in minutes.
 * @property {?string} driverNotes - Any relevant notes for the driver regarding the job.
 * @property {?string} pickupWindowStart - The start of the pickup window in ISO 8601 format.
 * @property {?string} pickupWindowEnd - The end of the pickup window in ISO 8601 format.
 * @property {?string} deliveryWindowStart - The start of the delivery window in ISO 8601 format.
 * @property {?string} deliveryWindowEnd - The end of the delivery window in ISO 8601 format.
 * @property {?string} deliveryDate - The delivery date in ISO 8601 format.
 * @property {?string} holdAtLocation - A designated location where the goods can be held.
 * @property {?string} specialHandling - Any special handling requirements for the delivery.
 * @property {number} numberOfPieces - The total number of pieces in the delivery.
 * @property {number} totalWeight - The total weight of the delivery items.
 * @property {?string} weightUnit - The unit of measure used for the weight.
 * @property {?string} totalVolume - The total volume of the delivery items.
 * @property {?string} volumeUnit - The unit of measure used for the volume.
 * @property {?boolean} isDangerousGoods - Flag indicating whether the job involves dangerous goods.
 * @property {?string} originNote - A note related to the origin of the job.
 * @property {?string} destinationNote - A note related to the destination of the job.
 * @property {?number} temperatureControlledMin - The minimum temperature to be maintained (if the job is temperature controlled).
 * @property {?number} temperatureControlledMax - The maximum temperature to be maintained (if the job is temperature controlled).
 * @property {?boolean} isLiveAnimals - Flag indicating whether the job involves live animals.
 * @property {?string} animalInfo - Any additional information related to the animals (if the job involves live animals).
 * @property {?boolean} isPerishable - Flag indicating whether the job involves perishable items.
 * @property {?string} perishableInfo - Any additional information related to the perishable items (if the job involves perishable items).
 * @property {?string} customerSignature - The signature of the customer at delivery.
 * @property {?string} deliveryConfirmationName - The name of the person who confirmed the delivery.
 * @property {?string} deliveryConfirmationDate - The date and time (in ISO 8601 format) when the delivery was confirmed.
 * @property {?string} correctionNote - A note made in case there were any corrections to the job details.
 * @property {Array<object>} relatedJobs - An array of objects containing related jobs.
 * @property {?string} $hashKey - Internal AngularJS property for object hashing.
 */

class JobDetailService {
    static $inject = ["DispatchData", "$mdDialog", "toastrService", "loadingService", "rateJobService", "$document", "$timeout"];

    constructor(
        DispatchData,
        $mdDialog,
        toastrService,
        loadingService,
        rateJobService,
        $document,
        $timeout,
    ) {
        this.DispatchData = DispatchData;
        this.$mdDialog = $mdDialog;
        this.toastrService = toastrService;
        this.loadingService = loadingService;
        this.rateJobService = rateJobService;
        this.$document = $document;
        this.$timeout = $timeout;

        this.options = {
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

        this.DispatchData.getSuburbList().then(data => {
            this.pickSuburbs = data;
        });

        DispatchData.getInternalStatusList().then((data) => {
            this.pickInternalStatus = data;
        });


        this.pickHolidays = [
            {
                "id": "0",
                "label": "Don't Book"
            },
            {
                "id": "1",
                "label": "Next Business Day"
            }
        ];

        this.pickDays = [
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
        this.pickFrequency = [
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

        this.combos = {
            "frequency": [],
            "frequencyEvents": {
                onSelectionChanged: function (item) {
                    const self = this;

                    console.log("Freq =");
                    console.log(self.combos.frequency);
                    if (self.combos.frequency.length > 0 &&
                        self.combos.days.length > 0 &&
                        self.combos.holidays.length > 0) {
                        let newDays = "0000000";
                        for (let i = 0; i < self.combos.days.length; i++) {
                            newDays = newDays.replaceAt(parseInt(self.combos.days[i].id), "1");
                        }
                        newDays = newDays + self.combos.frequency[0].id + self.combos.holidays[0].id;
                        console.log(newDays);
                        return self.DispatchData
                            .updateJobDetail(self.currentJob.id,
                                "Frequency",
                                newDays,
                                self.currentJob.charge,
                                FirstName,
                                ContactID,
                                self.currentJob.preBook).then(response => {
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
                    const self = this;

                    console.log("Days =");
                    console.log(self.combos.days);
                    if (self.combos.frequency.length > 0 &&
                        self.combos.days.length > 0 &&
                        self.combos.holidays.length > 0) {
                        let newDays = "0000000";
                        for (let i = 0; i < self.combos.days.length; i++) {
                            newDays = newDays.replaceAt(parseInt(self.combos.days[i].id), "1");
                        }
                        newDays = newDays + self.combos.frequency[0].id + self.combos.holidays[0].id;
                        console.log(newDays);
                        return self.DispatchData
                            .updateJobDetail(self.currentJob.id,
                                "Days",
                                newDays,
                                self.currentJob.charge,
                                FirstName,
                                ContactID,
                                self.currentJob.preBook).then(response => {
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
                    const self = this;

                    console.log("Days =");
                    console.log(self.combos.days);
                    if (self.combos.frequency.length > 0 &&
                        self.combos.days.length > 0 &&
                        self.combos.holidays.length > 0) {
                        let newDays = "0000000";
                        for (let i = 0; i < this.combos.days.length; i++) {
                            newDays = newDays.replaceAt(parseInt(self.combos.days[i].id), "1");
                        }
                        newDays = newDays + self.combos.frequency[0].id + self.combos.holidays[0].id;
                        console.log(newDays);
                        return self.DispatchData
                            .updateJobDetail(self.currentJob.id,
                                "Holidays",
                                newDays,
                                self.currentJob.charge,
                                FirstName,
                                ContactID,
                                self.currentJob.preBook).then(response => {
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
        this.palletMenu = [
            // NEW IMPLEMENTATION
            {
                text: "Delete",
                click: function ($itemScope, $event, modelValue, text, $li) {
                    return self.DispatchData.deletePallet($itemScope.pallet, self.currentJob.preBook, FirstName).then(response => {

                        console.log(response);

                        if (response === "OK") {
                            const index = $itemScope.currentJob.palletInfo.indexOf($itemScope.pallet);
                            $itemScope.currentJob.palletInfo.splice(index, 1);

                            return self.rateJob(this.currentJob).then(rate => {
                                console.log(rate);
                                if (rate !== self.currentJob.charge) {
                                    return self.DispatchData
                                        .updateJobDetail(self.currentJob.id,
                                            "rate",
                                            Number(rate.replace(/[^0-9.-]+/g, "")),
                                            Number(rate.replace(/[^0-9.-]+/g, "")),
                                            FirstName,
                                            ContactID,
                                            self.currentJob.preBook).then(response => {
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
        this.DispatchData.getContactList(job.clientID).then(data => {
            this.pickContacts = data;
        });
    }

    /**
     * @param {Event} $event
     * @param {Job} job
     */
    getClientContactDetail($event, job) {
        $event.stopPropagation();
        this.DispatchData.getContactDetailList(job.clientID).then(data => {
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

    getInternalStatus(is) {
        const selected = this.pickInternalStatus.find(({id}) => id === is);
        return selected !== undefined ? selected.text : "";
    }

    /**
     * @param {Job} job
     */
    hasDGDocs(job) {
        if (job.dgClass) {
            return ((job.dgDocumentation || 0) === 1) || ((job.dgDocumentation || false) === true)
                ? "Yes"
                : "No";
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
                job.speedID === 52)) {
            //Truck Job
            this.DispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(
                itemSummary => this.DispatchData.truckJobAmountBreakdown(job.clientID,
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
                }));

            return false;
        } else {
            return this.DispatchData.jobAmountBreakdown(job.clientID,
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
                job.charge.replace("$", "")).then(description => {
                alert(description);
            });
        }
    }

    rateJob(job) {
        const self = this;

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
            return self.DispatchData.getTruckItemsSummary(job.id, job.truckWeightLimit).then(
                function (itemSummary) {
                    return self.DispatchData.rateTruckJob(job.clientID,
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
            return self.DispatchData.rateJob(job.clientID,
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
    }

    /**
     * @param {Event} event
     * @param {Job} job
     * @param {string} title
     * @param {string} fieldName
     * @param {string} id
     */
    showNotesDialog(event, job, title, fieldName, id = "editField") {
        return this.$mdDialog.show({
            controller: AddNotesDialogController,
            controllerAs: "ctrl",
            templateUrl: "app/components/common/addNotesDialog/addNotesDialog.html",
            parent: angular.element(this.$document.body),
            targetEvent: event,
            clickOutsideToClose: true,
            fullscreen: true,
            locals: {
                id: id,
                fieldName: fieldName,
                title: title,
                job: job,
            }
        }).then(_ => {
            this.selectJobDetail(job.id);
            console.log('Notes Dialog closed!');
        });
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
    editPrompt(event, job, title, placeholder, ariaLabel, initialValue, field) {
        const prompt = this.$mdDialog.prompt()
            .title(title)
            .placeholder(placeholder)
            .ariaLabel(ariaLabel)
            .initialValue(initialValue)
            .targetEvent(event)
            .required(true)
            .ok('Save')
            .cancel('Cancel');

        this.$mdDialog.show(prompt).then(result => {
            const callData = {
                "call": "updateDetailField",
                "field": field,
                "value": result,
                "jobID": job.jobID
            };
            this.updateField(false, job, callData)
        }, () => {
            console.log(`Edit ${title} Cancelled!`)
        });
    }

    editClientCode(event, job) {
        this.editPrompt(event, job, 'Edit Client Code', 'Client Code...', 'client code', job.client, 'ClientCode');
    }

    editJobToPhone(event, job) {
        this.editPrompt(event, job, 'Edit To Contact Phone', 'To Contact Phone...', 'to contact phone', job.phone, 'ToContactPhone');
    }

    editJobFromPhone(event, job) {
        this.editPrompt(event, job, 'Edit From Contact Phone', 'From Contact Phone...', 'from contact phone', job.fromContactNumber, 'FromContactPhone');
    }

    editToJobContact(event, job) {
        this.editPrompt(event, job, 'Edit To Contact Name', 'To Contact Name...', 'to contact name', job.deliverToContact, 'ToContactName');
    }

    editFromJobContact(event, job) {
        this.editPrompt(event, job, 'Edit From Contact Name', 'From Contact Name...', 'from contact name', job.fromContactName, 'FromContactName');
    }

    editJobWeight(event, job) {
        this.editPrompt(event, job, 'Edit Weight', 'Job Weight...', 'job weight', job.weight, 'Weight');
    }

    editRef(event, job, isRefA) {
        if (isRefA) {
            this.editPrompt(event, job, 'Edit RefA', 'RefA...', 'refa', job.refA, 'RefA');
        } else {
            this.editPrompt(event, job, 'Edit RefA', 'RefB...', 'refb', job.refB, 'RefB');
        }
    }

    editOurRef(event, job) {
        this.editPrompt(event, job, 'Edit Our Reference', 'Our Reference...', 'our reference', job.ourRef, 'OurRef');
    }

    editTrackingMobile(event, job) {
        this.editPrompt(event, job, 'Edit Tracking Mobile', 'Tracking Mobile...', 'tracking mobile', job.trackingMobile, 'TrackingMobile');
    }

    editTrackingEmail(event, job) {
        this.editPrompt(event, job, 'Edit Tracking Email', 'Tracking Email...', 'tracking email', job.trackingEmail, 'TrackingEmail');
    }

    updateField(reRate, job, callData) {
        if (reRate && !job.bulkJob) {
            return this.rateJob(job).then(rate => this.DispatchData
                .updateJobDetail(callData.jobID,
                    callData.field,
                    callData.value,
                    Number(rate.replace(/[^0-9.-]+/g, "")),
                    FirstName,
                    ContactID,
                    job.preBook).then(response => response));
        } else {
            return job.bulkJob ? this.DispatchData
                    .updateBulkJobDetail(job.id,
                        callData.field,
                        callData.value,
                        job.charge,
                        FirstName,
                        ContactID).then(response => response) :
                this.DispatchData
                    .updateJobDetail(callData.jobID,
                        callData.field,
                        callData.value,
                        job.charge,
                        FirstName,
                        ContactID,
                        job.preBook).then(response => response);
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
            value = new Date(moment(value).format("YYYY-MM-DDTHH:mm"))
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
                        .updateJobType(callData.jobID,
                            callData.value,
                            FirstName).then(response => {

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
                if (fieldName === "ClientID") {
                    callData.value = self.gather.form.fields[0].value;
                    job.clientID = self.gather.form.fields[0].value;
                    reRate = self.gather.form.fields[1].value;
                }
                if (fieldName === "DGClass") {
                    callData.value = callData.value.id;
                    job.dgClass = callData.value.id;
                    let dgdocs = self.gather.form.fields[1].value;

                    return self.DispatchData
                        .updateJobDetail(callData.jobID,
                            callData.field,
                            callData.value,
                            job.charge,
                            FirstName,
                            ContactID,
                            job.preBook).then(response => {
                            if (job.dgDocumentation !== dgdocs) {
                                job.dgDocumentation = dgdocs;
                                return self.DispatchData
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
                if (reRate && !job.bulkJob) {
                    return self.rateJob(job).then(rate => self.DispatchData
                        .updateJobDetail(callData.jobID,
                            callData.field,
                            callData.value,
                            Number(rate.replace(/[^0-9.-]+/g, "")),
                            FirstName,
                            ContactID,
                            job.preBook).then(response => response));
                } else {
                    return job.bulkJob ? self.DispatchData
                            .updateBulkJobDetail(job.id,
                                callData.field,
                                callData.value,
                                job.charge,
                                FirstName,
                                ContactID).then(response => response) :
                        self.DispatchData
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

        this.$timeout(function () {
                console.log(this.gather);
                this.gather.showForm();
            },
            200);
    }

    /**
     * @param {Event} event
     * @param {Job} currentJob
     * @param {string} field
     */
    updateGPS(event, currentJob, field) {
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
        this.$mdDialog.show({
            controller: GpsFormController,
            controllerAs: 'ctrl',
            parent: angular.element(this.$document.body),
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
                suburbOptions: this.pickSuburbs,
                title: "Update Address and GPS",
                submitLabel: "Update",
            },
        }).then(addressDetails => {
            try {
                this.loadingService.showLoader();
                const job = currentJob;

                if (field === "toAddress") {
                    job.toAddress = (addressDetails.extras || '').length > 1 ? addressDetails.extras + ',' + addressDetails.address : addressDetails.address;
                    if (job.bulkJob) {
                        this.DispatchData.updateBulkDeliveryAddress(job.id, addressDetails.suburb, addressDetails.postCode, job.toAddress, addressDetails.lat, addressDetails.long, FirstName)
                            .then(() => {
                                this.selectJobDetail(currentJob.id);
                                this.$mdDialog.hide();
                                this.toastrService.showSuccessToast("Address successfully updated");
                                this.loadingService.closeLoader();
                            });
                    }

                    job.toSuburbID = parseInt(addressDetails.our_suburb);
                } else {
                    job.fromAddress = (addressDetails.extras || '').length > 1 ? addressDetails.extras + ',' + addressDetails.address : addressDetails.address;
                    if (job.bulkJob) {
                        this.DispatchData.updateBulkPickupAddress(job.id, addressDetails.suburb, addressDetails.postCode, job.fromAddress, addressDetails.lat, addressDetails.long, FirstName)
                            .then(() => {
                                this.selectJobDetail(currentJob.id);
                                this.$mdDialog.hide();
                                this.toastrService.showSuccessToast("Address successfully updated");
                                this.loadingService.closeLoader();
                            });
                    }

                    job.fromSuburbID = parseInt(addressDetails.our_suburb);
                }

                const pedal = job.fromSuburbID === 1 && job.toSuburbID === 1 || job.fromSuburbID === 112 && job.toSuburbID === 112 || job.fromSuburbID === 480 && job.toSuburbID === 480;

                this.rateJobService.rateJob(job)
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
                            this.DispatchData.updateDeliveryAddress(callData.jobID, callData.toSuburbId, callData.toAddress, callData.lat, callData.long, callData.CBD, Number(callData.rate.replace(/[^0-9.-]+/g, "")), FirstName, job.preBook)
                                .then(() => {
                                    this.selectJobDetail(currentJob.id);
                                    this.$mdDialog.hide();
                                    this.toastrService.showSuccessToast("Address successfully updated")
                                    this.loadingService.closeLoader();
                                });
                        } else {
                            this.DispatchData.updatePickupAddress(callData.jobID, callData.fromSuburbId, callData.fromAddress, callData.lat, callData.long, callData.CBD, Number(callData.rate.replace(/[^0-9.-]+/g, "")), FirstName, job.preBook)
                                .then(() => {
                                    this.selectJobDetail(currentJob.id);
                                    this.$mdDialog.hide();
                                    this.toastrService.showSuccessToast("Address successfully updated")
                                    this.loadingService.closeLoader();
                                });
                        }
                    });
            } catch (error) {
                this.toastrService.showErrorToast(error.message)
            }

            console.log('Dialog closed!')
        }).then(() => console.log("Split jobs canceled!"));
    }

    unlockJob(job) {
        return this.DispatchData
            .updateJobDetail(job.id, "Locked", false, job.charge, FirstName, ContactID, job.preBook)
            .then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((_) => {
                this.toastrService.showErrorToast();
            });
    }

    lockJob(job) {
        return this.DispatchData
            .updateJobDetail(job.id, "Locked", true, job.charge, FirstName, ContactID, job.preBook)
            .then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    preBookDirectClick(job) {
        const directValue = !job.direct;

        return this.DispatchData
            .updateJobDetail(job.id, "Direct", directValue, job.charge, FirstName, ContactID, job.preBook)
            .then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    pushToLive(job) {
        job.done = !job.done;

        return this.DispatchData
            .releaseBulkJob(job.jobNo, job.bookedDate)
            .then(response => {
                this.selectBulkJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    vanOkClick(job) {
        const vanOkValue = !job.vanOK;

        return this.DispatchData
            .updateJobDetail(job.id,
                "VanOK",
                vanOkValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    vanClick(job) {
        const vanValue = !job.van;

        return this.rateJob(job)
            .then(rate => {
                console.log(rate);

                return this.DispatchData
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
                        this.selectJobDetail(job.id);
                        return response;
                    }).catch((error) => this.toastrService.showErrorToast(error.message));
            }).catch((error) => this.toastrService.showErrorToast(error.message));

    }

    pedalClick(job) {
        const pedalValue = !job.pedal;

        return this.rateJob(job).then(rate => {
            console.log(rate);
            return this.DispatchData
                .updateJobDetail(job.id,
                    "Pedal",
                    pedalValue,
                    Number(rate.replace(/[^0-9.-]+/g, "")),
                    FirstName,
                    ContactID,
                    job.preBook).then(function (response) {
                    this.selectJobDetail(job.id);
                    return response;
                }).catch((error) => this.toastrService.showErrorToast(error.message));
        }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    truckClick(job) {
        const truckValue = !job.truck;

        return this.rateJob(job)
            .then(rate => {
                console.log(rate);
                return this.DispatchData.updateJobDetail(
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
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    directClick(job) {
        const directValue = !job.direct;

        if (!directValue) {
            return this.DispatchData.processUncheckDirect(job.id, FirstName, ContactID, job.speedAccepted);
        } else {
            return this.rateJob(job).then(rate => {
                console.log(rate);
                return this.DispatchData
                    .updateJobDetail(job.id,
                        "Direct",
                        directValue,
                        Number(rate.replace(/[^0-9.-]+/g, "")),
                        FirstName,
                        ContactID,
                        job.preBook).then(response => {
                        this.selectJobDetail(job.id);
                        return response;
                    }).catch((error) => this.toastrService.showErrorToast(error.message));
            }).catch((error) => this.toastrService.showErrorToast(error.message));
        }
    }

    attentionClick(job) {
        const attentionValue = !job.attention;

        return this.DispatchData
            .updateJobDetail(job.id,
                "Attention",
                attentionValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    repriceClick(job) {
        const repriceValue = !job.reprice;

        return this.DispatchData
            .updateJobDetail(job.id,
                "Reprice",
                repriceValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    preBookReturnClick(job) {
        const returnValue = !job.return;

        return this.DispatchData
            .updateJobDetail(job.id,
                "Return",
                returnValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    oneOffClick(job) {
        const oneoffValue = !job.oneOff;

        return this.DispatchData
            .updateJobDetail(job.id,
                "OneOff",
                oneoffValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));

    }

    activeClick(job) {
        const activeValue = !job.active;

        return this.DispatchData
            .updateJobDetail(job.id,
                "Active",
                activeValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    voidClick(job) {
        const voidValue = !job.void;

        return job.bulkJob ? this.DispatchData
                .updateBulkJobDetail(job.id,
                    "Void",
                    voidValue,
                    job.charge,
                    FirstName,
                    ContactID).then(response => {
                    this.selectBulkJobDetail(job.id);
                    return response;
                }).catch(() => this.toastrService.showErrorToast())
            : this.DispatchData
                .updateJobDetail(job.id,
                    "Void",
                    voidValue,
                    job.charge,
                    FirstName,
                    ContactID,
                    job.preBook).then(response => {
                    this.selectJobDetail(job.id);
                    return response;
                }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    doneClick(event, job) {
        job.done = !job.done;

        if (!job.completedTime) {
            const confirm = this.$mdDialog.confirm()
                .title('You must set completed time (POD Time) first')
                .targetEvent(event)
                .ok('OK');

            this.$mdDialog.show(confirm).then(() => {
                job.done = false;
                return false;
            });
        }

        if (!job.podName) {
            const confirm = this.$mdDialog.confirm()
                .title('You must set POD Name first')
                .targetEvent(event)
                .ok('OK');

            this.$mdDialog.show(confirm).then(() => {
                job.done = false;
                return false;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
        }

        return this.DispatchData
            .updatePODDetail(job.jobNo,
                6,
                job.podName,
                job.completedTime).then(() => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    deliveredClick(job) {
        const doneValue = !job.done;

        return this.DispatchData
            .updateJobDetail(job.id,
                "Delivered",
                doneValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    airportOnlyClick(job) {
        const airportOnlyValue = !job.airportOnly;

        return this.DispatchData
            .updateJobDetail(job.id,
                "AirportOnly",
                airportOnlyValue,
                job.charge,
                FirstName,
                ContactID,
                job.preBook).then(response => {
                this.selectJobDetail(job.id);
                return response;
            }).catch((error) => this.toastrService.showErrorToast(error.message));
    }

    trackingMethodClick(event, job) {
        this.showSelectDialog(event, job, this.options.detail.tracking, "TrackingMethod", "Tracking Method", "Select new tracking method..");
    }

    leaveClick(event, job) {
        this.showSelectDialog(event, job, this.pickLeaveList, "DeliverToLeaveID", "Leave Parcel", "Select new location..");
    }

    undeliverableClick(event, job) {
        this.showSelectDialog(event, job, this.pickUndeliverableList, "UndeliverableLocationID", "Undeliverable Location", "Select new location..");
    }

    sizeClick(event, job) {
        this.showSelectDialog(event, job, this.options.detail.size, "Size", "Size", "Select new size..");
    }

    /**
     * @param {Event} event
     * @param {Job} job
     * @param {[]} data
     * @param {string} fieldName
     * @param {string} title
     * @param {string} placeholder
     * @param {string} id
     */
    showSelectDialog(event, job, data, fieldName, title, placeholder, id = "editField") {
        const options = {
            minimumInputLength: 1,
            items: data,
            placeholder: placeholder
        };

        this.$mdDialog.show({
            controller: SelectDialogController,
            controllerAs: 'ctrl',
            parent: angular.element(this.$document.body),
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
            this.selectJobDetail(job.id);
            console.log('Dialog closed!');
        });
    }

    notifyClick(event, job) {
        this.showSelectDialog(event, job, this.pickSpeeds, "NotifiedJobTypeID", "Notified", "Select new speed....");
    }

    acceptedClick(event, job) {
        this.showSelectDialog(event, job, this.pickSpeeds, "AcceptedJobTypeID", "Accepted", "Select new speed....");
    }

    speedClick(event, job) {
        this.showSelectDialog(event, job, this.pickSpeeds, "SpeedID", "Speed", "Select new speed....");
    }

    contactClick(event, job) {
        this.showSelectDialog(event, job, this.pickSpeeds, "ContactID", "Contact", "Select new contact....");
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

    jobTypeClick(event, job) {
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

        this.showSelectDialog(event, job, data, "JobTypeID", "Job Type", "Select new job type....");
    }

    internalStatusClick(event, job) {
        this.showSelectDialog(event, job, this.pickInternalStatus, "InternalStatusID", "Job FollowUp", "Select new status....");
    }

    /**
     * @param {Event} event
     * @param job
     * @param {string} url
     * @param {string} placeholder
     * @param {string} fieldName
     * @param {string} title
     * @param {string} id
     * @param {null} existingItem
     * @param {boolean} showRerateOption
     */
    showAutocompleteDialog(
        event,
        job,
        url,
        placeholder,
        fieldName,
        title,
        id = "editField",
        existingItem,
        showRerateOption
    ) {
        const options = {
            placeholder,
            minimumInputLength: 3,
            searchUrl: url
        };

        this.$mdDialog.show({
            controller: AutoCompleteDialogController,
            controllerAs: 'ctrl',
            parent: angular.element(this.$document.body),
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
            this.selectJobDetail(job.id);
            console.log('Dialog closed!')
        });
    }

    clientClick(event, job) {
        const url = "/home/ActiveClients";
        const placeholder = "Start typing to enter new client...";

        const existingItem = {
            id: job.clientID,
            text: job.clientName
        }

        this.showAutocompleteDialog(event, job, url, placeholder, "ClientId", "Client", job.id, existingItem, true)
    }

    /**
     * @param {Event} event
     * @param {*} job
     */
    courierClick(event, job) {
        const url = "/courier/AllActiveSearch";
        const placeholder = "Start typing to search courier...";

        this.showAutocompleteDialog(event, job, url, placeholder, "CourierID", "Courier", job.id, null, false)
    }

    newPallet() {
        const self = this;

        self.gather.form = {
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

                newP["id"] = this.currentJob.id;


                return self.DispatchData.addPallet(newP, this.currentJob.preBook, FirstName).then(function (response) {

                    console.log(response);

                    if (response === "OK") {

                        if (!self.currentJob.palletInfo) {
                            self.currentJob.palletInfo = [];
                        }

                        self.currentJob.palletInfo.push(newP);

                        return self.rateJob(self.currentJob).then(function (rate) {
                            console.log(rate);
                            if (rate !== self.currentJob.charge) {
                                return self.DispatchData
                                    .updateJobDetail(self.currentJob.id,
                                        "rate",
                                        Number(rate.replace(/[^0-9.-]+/g, "")),
                                        Number(rate.replace(/[^0-9.-]+/g, "")),
                                        FirstName,
                                        ContactID,
                                        self.currentJob.preBook).then(function (response) {
                                        this.selectJobDetail(self.currentJob.id);
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
        this.$timeout(() => {
                this.gather.showForm();
            },
            200);
    }

    /**
     * @param {{}} pallet
     */
    editPallet(pallet) {
        const self = this;
        self.currentPallet = pallet;

        self.gather.form = {
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

                return self.DispatchData.editPallet(newP, self.currentJob.preBook, FirstName).then(function () {
                    return self.rateJob(self.currentJob).then(function (rate) {
                        console.log(rate);
                        if (rate !== self.currentJob.charge) {
                            return self.DispatchData
                                .updateJobDetail(this.currentJob.id,
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

        this.$timeout(function () {
                this.gather.showForm();
            },
            200);
    }
}

angular
    .module("uDispatch")
    .factory("JobDetailService", JobDetailService);
