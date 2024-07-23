/**
 * A controller which handles the Create Job dialog.
 * @class
 */

/**
 * @typedef {Object} Job
 * @property {number} clientID - The ID of the client associated with the job.
 * @property {string} deliverToContact - The contact to whom the job will be delivered.
 * @property {string} fromAddress - The address from which the job will be picked up.
 * @property {string} fromSuburb - The suburb from which the job will be picked up.
 * @property {string} toAddress - The address to which the job will be delivered.
 * @property {string} toSuburb - The suburb to which the job will be delivered.
 * @property {string} date - The date when the job is scheduled.
 * @property {string} fromContactName - The name of the contact from whom the job will be picked up.
 * @property {string} deliveryNotes - Any notes related to the delivery of the job.
 * @property {string} pickupNotes - Any notes related to the pickup of the job.
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
     */
    constructor($scope, $mdDialog, DispatchData, toastrService, loadingService, $http, $document, staffId) {
        this.$scope = $scope;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.$http = $http;
        this.toastrService = toastrService;
        this.loadingService = loadingService;
        this.$document = $document;
        this.staffId = staffId;

        this.jobForm = $scope.jobForm;
        this.fromAddressSearchText = "";
        this.toAddressSearchText = "";
        this.searchClientText = "";

        this.selectedClient = null;
        this.selectedFromAddress = null;
        this.selectedToAddress = null;
        this.selectedSpeed = null;

        // Initialize pickSpeeds
        this.speedOptions = [];
        DispatchData.getSpeedList().then(data => {
            this.speedOptions = data;
        });

        // Set default booking date to tomorrow
        this.jobDate = new Date();
        this.jobDate.setDate(this.jobDate.getDate() + 1);

        // Define job form
        this.job = {};
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
     * @param {Object} item - A selected item from the address search.
     * @param {boolean} toAddress - A selected item from the address search.
     */
    async addressSearchItemSelected(item, toAddress) {
        try {
            const data = await this.DispatchData.getGeoCodeInformation(item);
            const returnedLocation = data.Response.View[0].Result[0].Location;

            const mappedSub = await this.findSuburbByDistrict(returnedLocation.Address.District);
            if (mappedSub !== undefined) {
                console.log(mappedSub);

                if (toAddress) {
                    this.job.toSuburb = mappedSub.text;
                } else {
                    this.job.fromSuburb = mappedSub.text;
                }
            }
        } catch (error) {
            console.log("Error: ", error);
        }
    }

    /**
     * Submits a job after validating form and applying form values.
     * @param {Event} event - The event object, required for the AlertDialog.
     * @param {Job} job - A job object to submit.
     */
    async submit(event, job) {
        try {
            if (!this.jobForm.$valid) {
                this.$mdDialog.show(
                    this.$mdDialog.alert()
                        .parent(angular.element(this.$document.body))
                        .clickOutsideToClose(true)
                        .title('Required Fields')
                        .textContent('Please complete all the required fields.')
                        .ariaLabel('Not all required fields are completed')
                        .ok('Got it!')
                        .targetEvent(event)
                );

                return;
            }

            // Apply form values to job
            job.clientID = this.selectedClient.id;
            job.fromAddress = this.selectedFromAddress.text;
            job.toAddress = this.selectedToAddress.text;
            job.date = this.jobDate.toISOString();
            job.speedId = this.selectedSpeed.id;

            // Create Job
            const response = await this.createJob(job);
            const newJobId = response.data.jobId;

            this.toastrService.showSuccessToast("New Job Created Successfully")

            // Pass new jobId back to function that called dialog
            this.$mdDialog.hide(newJobId);
        } catch (error) {
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
                staffId: this.staffId
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
