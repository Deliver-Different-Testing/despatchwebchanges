import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/ToastrService";
import DispatchExecutorService from "../../../services/dispatch-executor.service";
import {AppConfig} from "../../../interfaces/app-config.interface";
import UsStatesService from "../../../services/getUsStates.service";
import {AddressViewModel, JobCreateViewModel, SelectOption, Suggestion} from "../../../interfaces/job.interface";
import app from "../../../app";

interface CreateJobDialogControllerScope extends angular.IScope {
    jobForm: angular.IFormController;
    fromAddressSearchText: string;
    toAddressSearchText: string;
    searchClientText: string;
    courierSearchText: string;
    isLoading: boolean;
    selectedCourier: any;
    selectedClient: any;
    selectedVehicle: any;
}
export class CreateJobDialogController {
    static $inject: string[] = [
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

    private readonly staffId: number;
    private readonly useUsFormat: boolean;
    private readonly despatcherName: any;
    dispatchJobService: any;
    UsStatesService: any;
    vehicleSearchText: string = "";
    speedSearchText: string = "";
    states: any;
    jobForm: any;
    fromAddressSearchText: string = "";
    toAddressSearchText: string = "";
    searchClientText: string = "";
    courierSearchText: string = "";
    isLoading: boolean = false;
    selectedCourier: any = null;
    selectedClient: any = null;
    selectedVehicle: any = null;
    selectedSpeed: any = null;
    speedOptions: Suggestion[] = [];
    jobDate: Date = new Date();
    job: any;
    vehicleSizes: Suggestion[] = [];

    constructor(
        $scope:CreateJobDialogControllerScope,
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private $http: angular.IHttpService,
        dispatchJobService: DispatchExecutorService,
        staffId: number,
        despatcherName: string,
        APP_CONFIG: AppConfig,
        UsStatesService: UsStatesService
    ) {
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

    private initializeFormData($scope: CreateJobDialogControllerScope): void {
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

    private initializeOptions(): void {
        Promise.all([
            this.dispatchData.getSpeedList(),
            this.dispatchData.getVehicleSizes()
        ]).then(([speedOptions, vehicleSizes]) => {
            this.speedOptions = speedOptions;
            this.vehicleSizes = vehicleSizes;
        });
    }

    private initializeJob(): void {
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

    vehicleSearch(searchText: string): Suggestion[] {
        searchText = searchText.toLowerCase();
        return this.vehicleSizes.filter(item => item.text.toLowerCase().includes(searchText));
    }

    onVehicleSelect(item: Suggestion): void {
        this.selectedVehicle = item;
    }

    speedSearch(searchText: string): Suggestion[] {
        searchText = searchText.toLowerCase();
        return this.speedOptions.filter(item => item.text.toLowerCase().includes(searchText));
    }

    onSpeedSelect(item: Suggestion): void {
        this.selectedSpeed = item;
    }

    clientSearch(searchTerm: string): Promise<SelectOption[]> {
        return this.performAutocompleteSearch(searchTerm, "/home/ActiveClients");
    }

    courierSearch(searchText: string): Promise<SelectOption[]> {
        return this.performAutocompleteSearch(searchText, "/courier/AllActiveSearch");
    }

    performAutocompleteSearch(searchTerm: string, url: string): Promise<SelectOption[]> {
        try {
            return this.dispatchData.autocompleteSearch(searchTerm, url);
        } catch (error: any) {
            console.error(`Search failed: ${error.message}`);
            return Promise.resolve([]);
        }
    }

    async addressSearchAutocomplete(searchText: string): Promise<any[]> {
        try {
            const suggestions = await this.dispatchData.autocompleteAddressSearch(searchText);
            return this.transformSuggestions(suggestions);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
            return [];
        }
    }

    private transformSuggestions(data: any): any[] {
        return data.suggestions.map((obj: any) => ({
            id: obj.locationId,
            text: obj.label.split(", ").reverse().join(", ")
        }));
    }

    async findSuburbByDistrict(district: string): Promise<any | null> {
        try {
            const ourSuburbsArray = await this.dispatchData.getSuburbList();
            const lowerCaseDistrict = district.toLowerCase();
            return ourSuburbsArray.find((localSuburb: any) =>
                localSuburb.text.toLowerCase() === lowerCaseDistrict ||
                (localSuburb.alias && localSuburb.alias.toLowerCase() === lowerCaseDistrict)
            );
        } catch (error: any) {
            console.error(`Failed to find suburb: ${error.message}`);
            return null;
        }
    }

    async addressSearchItemSelected(item: any, isToAddress: boolean): Promise<void> {
        try {
            const data: any = await this.dispatchData.getGeoCodeInformation(item);
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
            } else {
                // NZ address format
                addressDetails.addressLine1 = returnedLocation.Address.Place || ""; // Business name or building name
                addressDetails.addressLine2 = returnedLocation.Address.Subunit || ""; // Apartment or unit number
                addressDetails.addressLine3 = returnedLocation.Address.HouseNumber || "";
                addressDetails.addressLine4 = returnedLocation.Address.Street || "";
                addressDetails.addressLine5 = returnedLocation.Address.District || ""; // Suburb
                addressDetails.addressLine6 = returnedLocation.Address.City || "";
                addressDetails.addressLine7 = returnedLocation.Address.County || ""; // Region
                addressDetails.addressLine8 = returnedLocation.Address.PostalCode || "";

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
        } catch (error: any) {
            console.log("Error: ", error);
        }
    }

    async submit(job: JobCreateViewModel): Promise<void> {
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
        } catch (error: any) {
            console.error(`Job creation failed: ${error.message}`);
        } finally {
            this.isLoading = false;
        }
    }

    private isFormValid(): boolean {
        if (this.jobForm.$valid) return true;
        this.toastrService.showWarningToast("Please complete all the required fields.");
        return false;
    }

    private applyFormValuesToJob(job: JobCreateViewModel): void {
        job.clientId = this.selectedClient.id;
        job.date = this.jobDate;
        job.speedId = this.selectedSpeed.id;
        job.vehicleId = this.selectedVehicle.id;

        // Ensure fullAddress is up-to-date for both pickup and delivery addresses
        ["pickupAddress", "deliveryAddress"].forEach(addressType => {
            const address = job[addressType as keyof JobCreateViewModel] as AddressViewModel;
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

    private async createJob(job: JobCreateViewModel): Promise<any> {
        const url = "job/QuickCreateJob/";
        const callData = {
            job,
            staffId: this.staffId,
            despatcherName: this.despatcherName
        };
        return this.$http.post(url, callData, {headers: {'Content-Type': "application/json"}});
    }

    async dispatchJobIfCourierSelected(courierId: number, jobId: number): Promise<void> {
        return this.dispatchJobService.dispatchJobByJobId(courierId, jobId);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
