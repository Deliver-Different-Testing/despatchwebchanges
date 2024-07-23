class CreateJobDialog {
    /**
     * @constructor
     * @param {*} $scope
     * @param {*} $mdDialog
     * @param {*} DispatchData
     * @param {*} toastrService
     * @param {*} loadingService
     * @param {*} $http
     * @param {*} $document
     * @param {number} staffId
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

        // Set default booking date to tomorrow
        this.jobDate = new Date();
        this.jobDate.setDate(this.jobDate.getDate() + 1);

        // Define job form
        this.job = {
            clientID: "",
            deliverToContact: "",
            fromAddress: "",
            toAddress: "",
            date: "",
            fromContactName: "",
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
            charge: 0.0
        };
    }

    /**
     * Method to autocomplete client search
     * @param {string} searchTerm
     * @return {Promise<unknown>}
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
     * Method to autocomplete address search
     * @param {string} searchText
     * @return {Promise<unknown>}
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
     * Method to transform suggestions
     * @param {*} data
     * @returns
     */
    transformSuggestions(data) {
        return data.suggestions.map(obj => ({
            id: obj.locationId,
            text: obj.label.split(", ").reverse().join(", ")
        }))
    }

    /**
     * Method to submit job
     * @param {*} event
     * @param {*} job
     * @return {Promise<void>}
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
            job.date = this.jobDate.toISOString()

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
     * Method to create job
     * @param {*} job
     * @return {Promise<unknown>}
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


    cancel() {
        this.$mdDialog.cancel();
    }
}
