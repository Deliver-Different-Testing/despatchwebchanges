class CreateJobDialogController {
    static $inject = [
        '$scope',
        '$mdDialog',
        'DispatchData',
        'toastrService',
        '$http',
        'dispatchJobService',
        'staffId',
        'despatcherName',
        'APP_CONFIG',
        'UsStatesService'
    ];

    constructor($scope, $mdDialog, DispatchData, toastrService, $http, dispatchJobService, staffId, despatcherName, APP_CONFIG, UsStatesService) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.$http = $http;
        this.toastrService = toastrService;
        this.staffId = staffId;
        this.despatcherName = despatcherName;
        this.dispatchJobService = dispatchJobService;
        this.APP_CONFIG = APP_CONFIG;
        this.UsStatesService = UsStatesService;

        this.initializeFormData($scope);
        this.initializeJob();
        this.fetchDataLists().then(speedOptions => {
            this.speedOptions = speedOptions;
        });

        this.useUsFormat = APP_CONFIG.US_Customer;
        if (this.useUsFormat) {
            this.states = this.UsStatesService.getStates();
        }
    }

    initializeFormData($scope) {
        this.jobForm = $scope.jobForm;
        this.fromAddressSearchText = "";
        this.toAddressSearchText = "";
        this.searchClientText = "";
        this.courierSearchText = "";
        this.isLoading = false;
        this.selectedCourier = null;
        this.selectedClient = null;
        this.selectedSpeed = null;
        this.speedOptions = [];
        this.jobDate = new Date();
    }

    initializeJob() {
        this.job = {
            clientId: "",
            deliverToContact: "",
            pickupAddress: {},
            deliveryAddress: {},
            toAddress: "",
            date: "",
            fromContactName: "",
            podName: "",
            jobNotes: "",
            deliveryNotes: "",
            pickupNotes: "",
            van: false,
            truck: false,
            pedal: false,
            attention: false,
            vanOK: false,
            reprice: false,
            void: false,
            charge: 0.0,
            refA: "",
            refB: "",
        };
    }

    async fetchDataLists() {
        try {
            return await this.dispatchData.getSpeedList();
        } catch (error) {
            console.error("Failed to fetch speed list: " + error.message);
        }
    }

    resetChoices() {
        const choices = ['van', 'truck', 'pedal', 'attention', 'vanOK', 'reprice', 'void'];
        choices.forEach(choice => this.job[choice] = false);
    }

    updateChoice(key) {
        this.resetChoices();
        this.job[key] = true;
    }

    async clientSearchAutocomplete(searchTerm) {
        return this.performAutocompleteSearch(searchTerm, "/home/ActiveClients");
    }

    async courierSearch(searchText) {
        return this.performAutocompleteSearch(searchText, "/courier/AllActiveSearch");
    }

    async performAutocompleteSearch(searchTerm, url) {
        try {
            return await this.dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            console.error("Search failed: " + error.message);
            return [];
        }
    }

    async addressSearchAutocomplete(searchText) {
        try {
            const suggestions = await this.dispatchData.autocompleteAddressSearch(searchText);
            return this._transformSuggestions(suggestions);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
            return [];
        }
    }

    _transformSuggestions(data) {
        return data.suggestions.map(obj => ({
            id: obj.locationId,
            text: obj.label.split(", ").reverse().join(", ")
        }));
    }

    async findSuburbByDistrict(district) {
        try {
            const ourSuburbs = await this.dispatchData.getSuburbList();
            const lowerCaseDistrict = district.toLowerCase();
            return ourSuburbs.find(localSuburb =>
                localSuburb.text.toLowerCase() === lowerCaseDistrict ||
                (localSuburb.alias && localSuburb.alias.toLowerCase() === lowerCaseDistrict)
            );
        } catch (error) {
            console.error("Failed to find suburb: " + error.message);
            return null;
        }
    }

    /**
     * @param {Suggestion} item
     * @param {boolean} isToAddress
     */
    async addressSearchItemSelected(item, isToAddress) {
        try {
            const data = await this.dispatchData.getGeoCodeInformation(item);
            const returnedLocation = data.Response.View[0].Result[0].Location;

            console.log("Suburb/City = " + returnedLocation.Address.District);
            console.log("PostCode/ZIP = " + returnedLocation.Address.PostalCode);

            const addressDetails = isToAddress ? this.job.deliveryAddress : this.job.pickupAddress;

            if (this.useUsFormat) {
                addressDetails.addressLine1 = returnedLocation.Address.Place;
                addressDetails.addressLine2 = returnedLocation.Address.Subunit;
                addressDetails.addressLine3 = returnedLocation.Address.HouseNumber;
                addressDetails.addressLine4 = returnedLocation.Address.Street;
                addressDetails.addressLine5 = returnedLocation.Address.City;
                addressDetails.addressLine6 = returnedLocation.Address.State;
                addressDetails.addressLine7 = returnedLocation.Address.PostalCode;

                const stateObj = this.UsStatesService.getStateByAbbreviation(returnedLocation.Address.State);
                if (stateObj) {
                    addressDetails.stateName = stateObj.name;
                }
            } else {
                // NZ address format
                addressDetails.addressLine1 = returnedLocation.Address.Place || ''; // Business name or building name
                addressDetails.addressLine2 = returnedLocation.Address.Subunit || ''; // Apartment or unit number
                addressDetails.addressLine3 = returnedLocation.Address.HouseNumber || '';
                addressDetails.addressLine4 = returnedLocation.Address.Street || '';
                addressDetails.addressLine5 = returnedLocation.Address.District || ''; // Suburb
                addressDetails.addressLine6 = returnedLocation.Address.City || '';
                addressDetails.addressLine7 = returnedLocation.Address.County || ''; // Region
                addressDetails.addressLine8 = returnedLocation.Address.PostalCode || '';

                const mappedSub = await this.findSuburbByDistrict(returnedLocation.Address.District);
                if (mappedSub) {
                    addressDetails.our_suburb = mappedSub.id;
                } else {
                    addressDetails.our_suburb = null;
                    this.toastrService.showWarningToast("Matching suburb could not be found from this address. Please select manually.");
                }
            }

            // Coordinates
            addressDetails.latitude = returnedLocation.DisplayPosition.Latitude;
            addressDetails.longitude = returnedLocation.DisplayPosition.Longitude;

            this.$scope.$apply();
        } catch (error) {
            console.log("Error: ", error);
        }
    }

    async submit(job) {
        if (!this.isFormValid()) return;

        this.isLoading = true;
        try {
            this.applyFormValuesToJob(job);
            const response = await this.createJob(job);
            const jobId = response.data;

            if (this.selectedCourier) {
                await this.dispatchJobIfCourierSelected(this.selectedCourier.id, jobId);
            }

            this.$mdDialog.hide(jobId);
        } catch (error) {
            console.error("Job creation failed: " + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    isFormValid() {
        if (this.jobForm.$valid) return true;
        this.toastrService.showWarningToast("Please complete all the required fields.");
        return false;
    }

    applyFormValuesToJob(job) {
        job.clientId = this.selectedClient.id;
        job.date = this.jobDate.toISOString();
        job.speedId = this.selectedSpeed.id;

        // Ensure fullAddress is up-to-date for both pickup and delivery addresses
        ['pickupAddress', 'deliveryAddress'].forEach(addressType => {
            const address = job[addressType];
            address.fullAddress = [
                address.addressLine1,
                address.addressLine2,
                address.addressLine3,
                address.addressLine4,
                address.addressLine5,
                address.addressLine6,
                address.addressLine7,
                address.addressLine8
            ].filter(line => line && line.trim() !== '').join(', ');
        });
    }

    async createJob(job) {
        const url = "job/QuickCreateJob/";
        const callData = {
            job,
            staffId: this.staffId,
            despatcherName: this.despatcherName
        };
        return this.$http.post(url, callData, {headers: {'Content-Type': 'application/json'}});
    }

    async dispatchJobIfCourierSelected(courierId, jobId) {
        return this.dispatchJobService.dispatchJobByJobId(courierId, jobId);
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('CreateJobDialogController', CreateJobDialogController);
