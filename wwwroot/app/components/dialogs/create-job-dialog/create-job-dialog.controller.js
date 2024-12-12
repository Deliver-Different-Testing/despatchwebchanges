/**
 * @fileoverview Controller for the Create Job Dialog in the uDispatch application.
 * @module CreateJobDialogController
 */
class CreateJobDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
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

        this.vehicleSearchText = '';
        this.speedSearchText = '';

        this._initializeOptions();
        this._initializeFormData($scope);
        this._initializeJob();

        this.useUsFormat = APP_CONFIG.US_Customer;
        if (this.useUsFormat) {
            this.states = this.UsStatesService.getStates();
        }
    }

    /**
     * Initialize form data.
     * @param {Object} $scope - Angular scope object.
     * @private
     */
    _initializeFormData($scope) {
        this.jobForm = $scope.jobForm;
        this.fromAddressSearchText = "";
        this.toAddressSearchText = "";
        this.searchClientText = "";
        this.courierSearchText = "";
        this.isLoading = false;
        this.selectedCourier = null;
        this.selectedClient = null;
        this.selectedVehicle = null;
        this.selectedSpeed = null;
        this.speedOptions = [];
        this.jobDate = new Date();
    }

    async _initializeOptions() {
        const [speedOptions, vehicleSizes] = await Promise.all([
            this.dispatchData.getSpeedList(),
            this.dispatchData.getVehicleSizes()
        ]);

        /** @type {Suggestion[]} */
        this.speedOptions = speedOptions;
        /** @type {Suggestion[]} */
        this.vehicleSizes = vehicleSizes;
    }

    /**
     * Initialize job object.
     * @private
     */
    _initializeJob() {
        /** @type {JobCreateViewModel} */
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

    /**
     * @param {string} searchText
     * @returns {Suggestion[]}
     */
    vehicleSearch(searchText) {
        searchText = searchText.toLowerCase();
        return this.vehicleSizes.filter(item => item.text.toLowerCase().includes(searchText));
    }


    /**
     * @param {Suggestion} item
     */
    onVehicleSelect(item) {
        this.selectedVehicle = item;
    }

    /**
     * @param {string} searchText
     * @returns {Suggestion[]}
     */
    speedSearch(searchText) {
        searchText = searchText.toLowerCase();
        return this.speedOptions.filter(item => item.text.toLowerCase().includes(searchText)
        );
    }

    /**
     * @param {Suggestion} item
     */
    onSpeedSelect(item) {
        this.selectedSpeed = item;
    }

    /**
     * Perform client search autocomplete.
     * @param {string} searchTerm - The search term.
     * @returns {Promise<Suggestion[]>}
     */
    clientSearch(searchTerm) {
        return this.performAutocompleteSearch(searchTerm, "/home/ActiveClients");
    }

    /**
     * Perform courier search.
     * @param {string} searchText - The search text.
     * @returns {Promise<Array>} A promise that resolves to the search results.
     */
    courierSearch(searchText) {
        return this.performAutocompleteSearch(searchText, "/courier/AllActiveSearch");
    }

    /**
     * Perform autocomplete search.
     * @param {string} searchTerm - The search term.
     * @param {string} url - The URL to perform the search.
     * @returns {Promise<Array>} A promise that resolves to the search results.
     */
    performAutocompleteSearch(searchTerm, url) {
        try {
            return this.dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            console.error("Search failed: " + error.message);
            return [];
        }
    }

    /**
     * Perform address search autocomplete.
     * @param {string} searchText - The search text.
     * @returns {Promise<Array>} A promise that resolves to the search results.
     */
    async addressSearchAutocomplete(searchText) {
        try {
            const suggestions = await this.dispatchData.autocompleteAddressSearch(searchText);
            return this._transformSuggestions(suggestions);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
            return [];
        }
    }

    /**
     * Transform suggestions to the required format.
     * @param {Object} data - The suggestions data.
     * @returns {Array} The transformed suggestions.
     * @private
     */
    _transformSuggestions(data) {
        return data.suggestions.map(obj => ({
            id: obj.locationId,
            text: obj.label.split(", ").reverse().join(", ")
        }));
    }

    /**
     * Find a suburb by district.
     * @param {string} district - The district to search for.
     * @returns {Promise<Object|null>} A promise that resolves to the found suburb or null.
     */
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
     * Handle address search item selection.
     * @param {Object} item - The selected item.
     * @param {boolean} isToAddress - Indicates if it's the 'to' address.
     * @returns {Promise<void>}
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

    /**
     * Submit the job form.
     * @param {JobCreateViewModel} job - The job object to submit.
     * @returns {Promise<void>}
     */
    async submit(job) {
        if (!this._isFormValid()) return;

        this.isLoading = true;
        try {
            this._applyFormValuesToJob(job);
            const response = await this._createJob(job);
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

    /**
     * Check if the form is valid.
     * @returns {boolean} True if the form is valid, false otherwise.
     * @private
     */
    _isFormValid() {
        if (this.jobForm.$valid) return true;
        this.toastrService.showWarningToast("Please complete all the required fields.");
        return false;
    }

    /**
     * Apply form values to the job object.
     * @param {JobCreateViewModel} job - The job object to update.
     * @private
     */
    _applyFormValuesToJob(job) {
        job.clientId = this.selectedClient.id;
        job.date = this.jobDate.toISOString();
        job.speedId = this.selectedSpeed.id;
        job.vehicleId = this.selectedVehicle.id;

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

    /**
     * Create a new job.
     * @param {JobCreateViewModel} job - The job object to create.
     * @returns {Promise<Object>} A promise that resolves to the response from the server.
     * @private
     */
    async _createJob(job) {
        const url = "job/QuickCreateJob/";
        const callData = {
            job,
            staffId: this.staffId,
            despatcherName: this.despatcherName
        };
        return this.$http.post(url, callData, {headers: {'Content-Type': 'application/json'}});
    }

    /**
     * Dispatch the job if a courier is selected.
     * @param {Number} courierId - The ID of the selected courier.
     * @param {Number} jobId - The ID of the created job.
     * @returns {Promise<void>} A promise that resolves when the job is dispatched.
     */
    async dispatchJobIfCourierSelected(courierId, jobId) {
        return this.dispatchJobService.dispatchJobByJobId(courierId, jobId);
    }

    /**
     * Cancel the dialog.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('CreateJobDialogController', CreateJobDialogController);
