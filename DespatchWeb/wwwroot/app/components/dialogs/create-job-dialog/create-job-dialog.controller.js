/**
 * @class
 */
class CreateJobDialogController {
    /**
     * @param $scope
     * @param $mdDialog
     * @param DispatchData
     * @param toastrService
     * @param $http
     * @param dispatchJobService
     * @param {number} staffId
     * @param {string} despatcherName
     */
    constructor($scope, $mdDialog, DispatchData, toastrService, $http, dispatchJobService, staffId, despatcherName) {
        this.$scope = $scope;
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._$http = $http;
        this._toastrService = toastrService;
        this._staffId = staffId;
        this._despatcherName = despatcherName;
        this._dispatchJobService = dispatchJobService;

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

        // Define job form
        this.job = {
            clientID: "",
            deliverToContact: "",
            fromAddress: "",
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

        this._fetchDataLists();
    }

    _fetchDataLists() {
        this._dispatchData.getSpeedList().then(data => {
            this.speedOptions = data;
        });
    }


    resetChoices() {
        this.job.van = false;
        this.job.truck = false;
        this.job.pedal = false;
        this.job.attention = false;
        this.job.vanOK = false;
        this.job.reprice = false;
        this.job.void = false;
    }

    /**
     * @param {string} key
     */
    updateChoice(key) {
        this.resetChoices();
        this.job[key] = true;
    }

    /**
     * Autocomplete the client search based on the searchTerm
     * @param {string} searchTerm - The term for which to search associative clients.
     */
    async clientSearchAutocomplete(searchTerm) {
        const url = "/home/ActiveClients";

        try {
            return await this._dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    /**
     * @param {string} searchText
     */
    async courierSearch(searchText) {
        try {
            const url = "/courier/AllActiveSearch";
            return await this._dispatchData.autocompleteSearch(searchText, url);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Autocomplete the given address searchText
     * @param {string} searchText - Search text of the address to autocomplete.
     */
    async addressSearchAutocomplete(searchText) {
        try {
            const suggestions = await this._dispatchData.autocompleteAddressSearch(searchText);
            return this.transformSuggestions(suggestions);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Transforms API suggestion data format into application-specific format.
     * @param {Object} data - Suggestion data from the DispatchData service.
     */
    transformSuggestions(data) {
        return data.suggestions.map(obj => ({
            id: obj.locationId, text: obj.label.split(", ").reverse().join(", ")
        }))
    }

    /**
     * This function finds a suburb by its district.
     * @param {string} district - The district of the suburb.
     * @returns {SuburbOption|null} - The matched suburb or null.
     */
    async findSuburbByDistrict(district) {
        const ourSuburbs = await this._dispatchData.getSuburbList();

        let lowerCaseDistrict = district.toLowerCase();
        return ourSuburbs.find(localSuburb => localSuburb.text.toLowerCase() === lowerCaseDistrict || (localSuburb.alias && localSuburb.alias.toLowerCase() === lowerCaseDistrict));
    }

    /**
     * Handles the selection of items from the address search.
     *
     * @param {Object} item - A selected item from the address search. The object should have 'text' and 'id' properties.
     * @param {string} item.text - The text of the selected item.
     * @param {number} item.id - The id of the selected item.
     *
     * @param {boolean} isToAddress - A boolean value to indicate whether the address is a 'to address'.
     */
    async addressSearchItemSelected(item, isToAddress) {
        try {
            const data = await this._dispatchData.getGeoCodeInformation(item);

            const returnedLocation = data.Response.View[0].Result[0].Location;
            const lat = returnedLocation.DisplayPosition.Latitude;
            const long = returnedLocation.DisplayPosition.Longitude;

            const mappedSub = await this.findSuburbByDistrict(returnedLocation.Address.District);
            if (mappedSub !== undefined) {
                this.assignAddressToJob(mappedSub.id, item.text, lat, long, isToAddress);
            }
        } catch (error) {
            console.log("Error: ", error);
        }
    }

    /**
     * Assigns an address to a job based on the provided parameters.
     *
     * @param {number} suburbId - The id of the suburb.
     * @param {string} addressFull - The full address.
     * @param {number} lat
     * @param {number} long
     * @param {boolean} toAddress - If true, assign to the 'to' address of the job. Otherwise, assign to the 'from' address.
     */
    assignAddressToJob(suburbId, addressFull, lat, long, toAddress) {
        if (toAddress) {
            this.job.toSuburb = suburbId;
            this.job.toAddress = addressFull;
            this.job.toLat = lat;
            this.job.toLong = long;
        } else {
            this.job.fromSuburb = suburbId;
            this.job.fromAddress = addressFull;
            this.job.fromLat = lat;
            this.job.fromLong = long;
        }
    }

    /**
     * Submits a job after validating form and applying form values.
     * @param {Job} job - A job object to submit.
     */
    async submit(job) {
        try {
            this.isLoading = true;
            if (!this._isFormValid()) {
                return;
            }

            // Apply form values to job
            this._applyFormValuesToJob(job);

            // Create Job
            const response = await this._createJob(job);
            const jobId = response.data.jobId;

            // Dispatch to courier if selected
            if (this.selectedCourier) {
                await this._dispatchJobIfCourierSelected(this.selectedCourier.id, jobId);
            }

            // Pass new jobId back to function that called dialog
            this._$mdDialog.hide(jobId);
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Check if the form is valid; if not, show a warning message to user.
     * @returns {boolean} - Form validity status
     */
    _isFormValid() {
        if (this.jobForm.$valid) {
            return true;
        }

        this._toastrService.showWarningToast("Please complete all the required fields.");
        return false;
    }

    /**
     * Apply form values to the given job object
     * @param {Job} job - The job object where to apply form values.
     */
    _applyFormValuesToJob(job) {
        job.clientID = this.selectedClient.id;
        job.date = this.jobDate.toISOString();
        job.speedId = this.selectedSpeed.id;
    }

    /**
     * Creates a job, sending details to the server and returns the server's response.
     * @param {Job} job - A job object to create.
     */
    async _createJob(job) {
        const url = "job/QuickCreateJob/";
        const callData = {
            job, staffId: this._staffId, despatcherName: this._despatcherName
        };

        return await this._$http.post(url, callData, {headers: {'Content-Type': 'application/json'}});
    }

    /**
     * Dispatch to courier if a courier is selected
     * @param {number} courierId - The id of the selected courier.
     * @param {number} jobId - The id of the job.
     */
    async _dispatchJobIfCourierSelected(courierId, jobId) {
        await this._dispatchJobService.dispatchJobByJobId(courierId, jobId);
    }

    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}
