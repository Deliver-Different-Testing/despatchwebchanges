"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateJobDialogController = void 0;
class CreateJobDialogController {
    constructor($scope, $mdDialog, dispatchData, toastrService, $http, dispatchJobService, staffId, despatcherName, APP_CONFIG, UsStatesService) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = dispatchData;
        this.toastrService = toastrService;
        this.$http = $http;
        this.vehicleSearchText = "";
        this.speedSearchText = "";
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
        this.vehicleSizes = [];
        this.staffId = staffId;
        this.despatcherName = despatcherName;
        this.dispatchJobService = dispatchJobService;
        this.UsStatesService = UsStatesService;
        this.initializeOptions();
        this.initializeFormData($scope);
        this.initializeJob();
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
        this.selectedVehicle = null;
        this.selectedSpeed = null;
        this.speedOptions = [];
        this.jobDate = new Date();
    }
    initializeOptions() {
        Promise.all([
            this.dispatchData.getSpeedList(),
            this.dispatchData.getVehicleSizes()
        ]).then(([speedOptions, vehicleSizes]) => {
            this.speedOptions = speedOptions;
            this.vehicleSizes = vehicleSizes;
        });
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
    vehicleSearch(searchText) {
        searchText = searchText.toLowerCase();
        return this.vehicleSizes.filter(item => item.text.toLowerCase().includes(searchText));
    }
    onVehicleSelect(item) {
        this.selectedVehicle = item;
    }
    speedSearch(searchText) {
        searchText = searchText.toLowerCase();
        return this.speedOptions.filter(item => item.text.toLowerCase().includes(searchText));
    }
    onSpeedSelect(item) {
        this.selectedSpeed = item;
    }
    clientSearch(searchTerm) {
        return this.performAutocompleteSearch(searchTerm, "/home/ActiveClients");
    }
    courierSearch(searchText) {
        return this.performAutocompleteSearch(searchText, "/courier/AllActiveSearch");
    }
    performAutocompleteSearch(searchTerm, url) {
        try {
            return this.dispatchData.autocompleteSearch(searchTerm, url);
        }
        catch (error) {
            console.error(`Search failed: ${error.message}`);
            return Promise.resolve([]);
        }
    }
    addressSearchAutocomplete(searchText) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const suggestions = yield this.dispatchData.autocompleteAddressSearch(searchText);
                return this.transformSuggestions(suggestions);
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
                return [];
            }
        });
    }
    transformSuggestions(data) {
        return data.suggestions.map((obj) => ({
            id: obj.locationId,
            text: obj.label.split(", ").reverse().join(", ")
        }));
    }
    findSuburbByDistrict(district) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const ourSuburbsArray = yield this.dispatchData.getSuburbList();
                const lowerCaseDistrict = district.toLowerCase();
                return ourSuburbsArray.find((localSuburb) => localSuburb.text.toLowerCase() === lowerCaseDistrict ||
                    (localSuburb.alias && localSuburb.alias.toLowerCase() === lowerCaseDistrict));
            }
            catch (error) {
                console.error(`Failed to find suburb: ${error.message}`);
                return null;
            }
        });
    }
    addressSearchItemSelected(item, isToAddress) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const data = yield this.dispatchData.getGeoCodeInformation(item);
                const returnedLocation = data.Response.View[0].Result[0].Location;
                console.log(`Suburb/City = ${returnedLocation.Address.District}`);
                console.log(`PostCode/ZIP = ${returnedLocation.Address.PostalCode}`);
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
                }
                else {
                    // NZ address format
                    addressDetails.addressLine1 = returnedLocation.Address.Place || ""; // Business name or building name
                    addressDetails.addressLine2 = returnedLocation.Address.Subunit || ""; // Apartment or unit number
                    addressDetails.addressLine3 = returnedLocation.Address.HouseNumber || "";
                    addressDetails.addressLine4 = returnedLocation.Address.Street || "";
                    addressDetails.addressLine5 = returnedLocation.Address.District || ""; // Suburb
                    addressDetails.addressLine6 = returnedLocation.Address.City || "";
                    addressDetails.addressLine7 = returnedLocation.Address.County || ""; // Region
                    addressDetails.addressLine8 = returnedLocation.Address.PostalCode || "";
                    const mappedSub = yield this.findSuburbByDistrict(returnedLocation.Address.District);
                    if (mappedSub) {
                        addressDetails.our_suburb = mappedSub.id;
                    }
                    else {
                        addressDetails.our_suburb = null;
                        this.toastrService.showWarningToast("Matching suburb could not be found from this address. Please select manually.");
                    }
                }
                // Coordinates
                addressDetails.latitude = returnedLocation.DisplayPosition.Latitude;
                addressDetails.longitude = returnedLocation.DisplayPosition.Longitude;
            }
            catch (error) {
                console.log("Error: ", error);
            }
        });
    }
    submit(job) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isFormValid())
                return;
            this.isLoading = true;
            try {
                this.applyFormValuesToJob(job);
                const response = yield this.createJob(job);
                const jobId = response.data;
                if (this.selectedCourier) {
                    yield this.dispatchJobIfCourierSelected(this.selectedCourier.id, jobId);
                }
                this.$mdDialog.hide(jobId);
            }
            catch (error) {
                console.error(`Job creation failed: ${error.message}`);
            }
            finally {
                this.isLoading = false;
            }
        });
    }
    isFormValid() {
        if (this.jobForm.$valid)
            return true;
        this.toastrService.showWarningToast("Please complete all the required fields.");
        return false;
    }
    applyFormValuesToJob(job) {
        job.clientId = this.selectedClient.id;
        job.date = this.jobDate;
        job.speedId = this.selectedSpeed.id;
        job.vehicleId = this.selectedVehicle.id;
        // Ensure fullAddress is up-to-date for both pickup and delivery addresses
        ["pickupAddress", "deliveryAddress"].forEach(addressType => {
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
            ].filter(line => line && line.trim() !== "").join(", ");
        });
    }
    createJob(job) {
        return __awaiter(this, void 0, void 0, function* () {
            const url = "job/QuickCreateJob/";
            const callData = {
                job,
                staffId: this.staffId,
                despatcherName: this.despatcherName
            };
            return this.$http.post(url, callData, { headers: { 'Content-Type': "application/json" } });
        });
    }
    dispatchJobIfCourierSelected(courierId, jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.dispatchJobService.dispatchJobByJobId(courierId, jobId);
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.CreateJobDialogController = CreateJobDialogController;
CreateJobDialogController.$inject = [
    "$scope",
    "$mdDialog",
    "DispatchData",
    "toastrService",
    "$http",
    "dispatchJobService",
    "staffId",
    "despatcherName",
    "APP_CONFIG",
    "UsStatesService"
];
