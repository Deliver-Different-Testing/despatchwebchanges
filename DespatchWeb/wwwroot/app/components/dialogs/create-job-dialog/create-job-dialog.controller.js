class CreateJobDialogController {
    static $inject = [
        '$scope',
        '$mdDialog',
        'DispatchData',
        'toastrService',
        '$http',
        'dispatchJobService',
        'staffId',
        'despatcherName'
    ];

    constructor($scope, $mdDialog, DispatchData, toastrService, $http, dispatchJobService, staffId, despatcherName) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = DispatchData;
        this.$http = $http;
        this.toastrService = toastrService;
        this.staffId = staffId;
        this.despatcherName = despatcherName;
        this.dispatchJobService = dispatchJobService;

        this.initializeFormData($scope);
        this.initializeJob();
        this.fetchDataLists();
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
    }

    fetchDataLists() {
        this.dispatchData.getSpeedList().then(data => {
            this.speedOptions = data;
        }).catch(error => {
            this.toastrService.showErrorToast("Failed to fetch speed list: " + error.message);
        });
    }

    resetChoices() {
        const choices = ['van', 'truck', 'pedal', 'attention', 'vanOK', 'reprice', 'void'];
        choices.forEach(choice => this.job[choice] = false);
    }

    updateChoice(key) {
        this.resetChoices();
        this.job[key] = true;
    }

    clientSearchAutocomplete(searchTerm) {
        return this.performAutocompleteSearch(searchTerm, "/home/ActiveClients");
    }

    courierSearch(searchText) {
        return this.performAutocompleteSearch(searchText, "/courier/AllActiveSearch");
    }

    performAutocompleteSearch(searchTerm, url) {
        return this.dispatchData.autocompleteSearch(searchTerm, url)
            .catch(error => {
                this.toastrService.showErrorToast("Search failed: " + error.message);
                return [];
            });
    }

    async addressSearchAutocomplete(searchText) {
        try {
            const suggestions = await this.dispatchData.autocompleteAddressSearch(searchText);
            return this.transformSuggestions(suggestions);
        } catch (error) {
            this.toastrService.showErrorToast("Address search failed: " + error.message);
            return [];
        }
    }

    transformSuggestions(data) {
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
            this.toastrService.showErrorToast("Failed to find suburb: " + error.message);
            return null;
        }
    }

    async addressSearchItemSelected(item, isToAddress) {
        try {
            const data = await this.dispatchData.getGeoCodeInformation(item);
            const returnedLocation = data.Response.View[0].Result[0].Location;
            const {Latitude: lat, Longitude: long} = returnedLocation.DisplayPosition;
            const mappedSub = await this.findSuburbByDistrict(returnedLocation.Address.District);

            if (mappedSub) {
                this.assignAddressToJob(mappedSub.id, item.text, lat, long, isToAddress);
            } else {
                this.toastrService.showWarningToast("Suburb not found for the selected address.");
            }
        } catch (error) {
            this.toastrService.showErrorToast("Error processing address: " + error.message);
        }
    }

    assignAddressToJob(suburbId, addressFull, lat, long, isToAddress) {
        const prefix = isToAddress ? 'to' : 'from';
        this.job[`${prefix}Suburb`] = suburbId;
        this.job[`${prefix}Address`] = addressFull;
        this.job[`${prefix}Lat`] = lat;
        this.job[`${prefix}Long`] = long;
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
            this.toastrService.showErrorToast("Job creation failed: " + error.message);
        } finally {
            this.isLoading = false;
        }
    }

    isFormValid() {
        if (this.jobForm.$valid) return true;
        this.toastrService.showWarningToast("Please complete all the required fields.");
        return false;
    }

    /**
     * @param {Job} job
     */
    applyFormValuesToJob(job) {
        job.clientId = this.selectedClient.id;
        job.date = this.jobDate.toISOString();
        job.speedId = this.selectedSpeed.id;
    }

    /**
     * @param {Job} job
     */
    createJob(job) {
        const url = "job/QuickCreateJob/";
        const callData = {
            job,
            staffId: this.staffId,
            despatcherName: this.despatcherName
        };
        return this.$http.post(url, callData, {headers: {'Content-Type': 'application/json'}});
    }

    /**
     * @param {number} courierId
     * @param {number} jobId
     */
    dispatchJobIfCourierSelected(courierId, jobId) {
        return this.dispatchJobService.dispatchJobByJobId(courierId, jobId);
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('CreateJobDialogController', CreateJobDialogController);
