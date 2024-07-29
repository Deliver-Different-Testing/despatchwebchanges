/**
 * A controller which handles the Create Job dialog.
 * @class
 */

/**
 * @typedef {Object} Job
 * @property {number} clientID - The ID of the client associated with the job.
 * @property {number} courierId - The ID of the courier associated with the job.
 * @property {string} deliverToContact - The contact to whom the job will be delivered.
 * @property {string} fromAddress - The address from which the job will be picked up.
 * @property {string} fromSuburb - The suburb from which the job will be picked up.
 * @property {number} fromLong - The longitude of the pickup address.
 * @property {number} fromLat - The latitude of the pickup address.
 * @property {string} toAddress - The address to which the job will be delivered.
 * @property {string} toSuburb - The suburb to which the job will be delivered.
 * @property {number} toLong - The longitude of the delivery address.
 * @property {number} toLat - The latitude of the delivery address.
 * @property {string} date - The date when the job is scheduled.
 * @property {string} fromContactName - The name of the contact from whom the job will be picked up.
 * @property {string} deliveryNotes - Any notes related to the delivery of the job.
 * @property {string} pickupNotes - Any notes related to the pickup of the job.
 * @property {string} jobNotes - Any other notes related to the job.
 * @property {number} speedId - The ID of the speed at which the job will be performed.
 * @property {boolean} van - Indicator if a van is required for the job.
 * @property {boolean} truck - Indicator if a truck is required for the job.
 * @property {boolean} pedal - Indicator if a pedal vehicle is required for the job.
 * @property {boolean} attention - Indicator to draw attention to the job.
 * @property {boolean} vanOK - Indicator if a van is acceptable for the job.
 * @property {boolean} reprice - Indicator to reprice the job.
 * @property {boolean} void - Indicator if the job is voided.
 * @property {boolean} done - Indicator if the job is done.
 * @property {number} charge - The charge for the job.
 * @property {string} refA - Reference A for the job
 * @property {string} refB - Reference B for the job
 */

/**
 * @typedef {Object} SuburbOption - An option for selection in the ourSuburbSearch.
 * @property {string} text - The textual representation of the suburb.
 * @property {string=} alias - The alias of the suburb.
 */
class CreateJobDialogController {
    /**
     * Create a CreateJobDialogController
     * @param {Object} $scope - The active AngularJS scope.
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} DispatchData - The service used for data dispatching.
     * @param {Object} toastrService - The service used for toast notifications.
     * @param {Object} loadingService - The service used for loading animations.
     * @param {Object} $http - Angular's built-in $http service.
     * @param {Object} $document - Angular's built-in $document service.
     * @param {number} staffId - The ID of the staff member initiating the action.
     * @param {string} despatcherName
     */
    constructor($scope, $mdDialog, DispatchData, toastrService, loadingService, $http, $document, staffId, despatcherName) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.$http = $http;
        this.toastrService = toastrService;
        this.loadingService = loadingService;
        this.$document = $document;
        this._staffId = staffId;
        this._despatcherName = despatcherName;

        this.jobForm = $scope.jobForm;
        this.fromAddressSearchText = "";
        this.toAddressSearchText = "";
        this.searchClientText = "";
        this.fromCourierSearchText = "";

        this.selectedCourier = null;
        this.selectedClient = null;
        this.selectedFromAddress = null;
        this.selectedToAddress = null;
        this.selectedSpeed = null;

        // Initialize pickSpeeds
        this.speedOptions = [];
        DispatchData.getSpeedList().then(data => {
            this.speedOptions = data;
        });

        // Set default booking date to today
        this.jobDate = new Date();

        // Define job form
        this.job = {
            clientID: "",
            courierId: "",
            deliverToContact: "",
            fromAddress: "",
            toAddress: "",
            date: "",
            fromContactName: "",
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
            done: false,
            charge: 0.0,
            refA: "",
            refB: "",
        };
    }


    resetChoices() {
        this.job.van = false;
        this.job.truck = false;
        this.job.pedal = false;
        this.job.attention = false;
        this.job.vanOK = false;
        this.job.reprice = false;
        this.job.void = false;
        this.job.done = false;
    }

    /**
     * @param {string|number} key
     */
    updateChoice(key) {
        this.resetChoices();
        this.job[key] = true;
    }

    /**
     * Autocomplete the client search based on the searchTerm
     * @param {string} searchTerm - The term for which to search associative clients.
     * @returns {Promise<Array>} - A promise that fulfills with a list of client objects that match the searchTerm.
     */
    async clientSearchAutocomplete(searchTerm) {
        const url = "/home/ActiveClients";

        try {
            return await this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * @param {string} searchTerm
     */
    async courierSearch(searchTerm) {
        try {
            const url = "/courier/AllActiveSearch";
            return await this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Autocomplete the given address searchText
     * @param {string} searchText - Search text of the address to autocomplete.
     * @returns {Promise<Array.<Suggestion>>} - A promise that fulfils with a list of potential matches for the search text.
     */
    async addressSearchAutocomplete(searchText) {
        try {
            const suggestions = await this.DispatchData.autocompleteAddressSearch(searchText);
            return this.transformSuggestions(suggestions);
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Transforms API suggestion data format into application-specific format.
     * @param {Object} data - Suggestion data from the DispatchData service.
     * @returns {Array.<Suggestion>} - Suggestions in application-specific format.
     */
    transformSuggestions(data) {
        return data.suggestions.map(obj => ({
            id: obj.locationId,
            text: obj.label.split(", ").reverse().join(", ")
        }))
    }

    /**
     * This function finds a suburb by its district.
     * @param {string} district - The district of the suburb.
     * @returns {SuburbOption|null} - The matched suburb or null.
     */
    async findSuburbByDistrict(district) {
        const ourSuburbs = await this.DispatchData.getSuburbList();

        let lowerCaseDistrict = district.toLowerCase();
        return ourSuburbs.find(localSuburb =>
            localSuburb.text.toLowerCase() === lowerCaseDistrict ||
            (localSuburb.alias && localSuburb.alias.toLowerCase() === lowerCaseDistrict)
        );
    }

    /**
     * Handles the selection of items from the address search.
     *
     * @param {Object} item - A selected item from the address search. The object should have 'text' and 'id' properties.
     * @param {string} item.text - The text of the selected item.
     * @param {number} item.id - The id of the selected item.
     *
     * @param {boolean} isToAddress - A boolean value to indicate whether the address is a 'to address'.
     *
     * @return {Promise<void>}
     */
    async addressSearchItemSelected(item, isToAddress) {
        try {
            const data = await this.DispatchData.getGeoCodeInformation(item);

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
            if (!this.jobForm.$valid) {
                this.toastrService.showWarningToast("Please complete all the required fields.");
                return;
            }

            this.loadingService.showLoader();
            // Apply form values to job
            job.clientID = this.selectedClient.id;
            job.courierId = this.selectedCourier.id;
            job.date = this.jobDate.toISOString();
            job.speedId = this.selectedSpeed.id;

            // Create Job
            const response = await this.createJob(job);
            const newJobId = response.data.jobId;

            this.toastrService.showSuccessToast("New Job Created Successfully")

            // Pass new jobId back to function that called dialog
            this.$mdDialog.hide(newJobId);
        } catch (error) {
            this.loadingService.closeLoader();
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Creates a job, sending details to the server and returns the server's response.
     * @param {Job} job - A job object to create.
     * @returns {Promise<Object>} - A Promise that fulfills with the server's response to job creation.
     */
    async createJob(job) {
        try {
            const url = "job/QuickCreateJob/";
            const callData = {
                job,
                staffId: this._staffId,
                despatcherName: this._despatcherName
            };

            return await this.$http.post(url, callData, {headers: {'Content-Type': 'application/json'}});
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    /**
     * Cancels the Angular Material Dialog
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}
