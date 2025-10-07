import "./create-job-dialog.styles.less";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import DispatchExecutorService from "../../../services/dispatch-executor.service";
import {IAppConfig} from "../../../interfaces/app-config.interface";
import {
    IAddressViewModel,
    JobCreateViewModelDto,
    ISuggestion
} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";
import {getStateByAbbreviation, getStates} from "../../../functions/usStates";
import {IHereMapsLocationResult} from "../../../interfaces/heremaps-autocomplete.interfaces";
import AddressLookupService from "../../../services/address-lookup.service";
import IStateInfo from "../../../interfaces/state-info.interface";
import dayjs, {Dayjs} from "dayjs";
import handleAddressFieldsFromLookup from "../../../functions/handleAddressFieldsFromLookup";
import {formatDateForApiWithTzs} from "../../../functions/formatDates";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export class CreateJobDialogController extends BaseController {
    static $inject = [
        "$log",
        "$mdDialog",
        "DispatchData",
        "addressLookupService",
        "toastrService",
        "dispatchJobService",
        "APP_CONFIG",
    ];

    private readonly isUsCustomer: boolean;

    vehicleSearchText?: string;
    speedSearchText?: string;
    states?: IStateInfo[];
    fromAddressSearchText?: string;
    toAddressSearchText?: string;
    searchClientText?: string;
    courierSearchText?: string;
    isLoading: boolean = false;
    selectedCourier?: ISuggestion;
    selectedClient?: ISuggestion;
    selectedVehicle?: ISuggestion;
    selectedSpeed?: ISuggestion;
    speedOptions: ISuggestion[] = [];
    jobDate: Dayjs;
    job: JobCreateViewModelDto;
    vehicleSizes: ISuggestion[] = [];
    selectedPickupAddress?: IHereMapsLocationResult;
    selectedDeliveryAddress?: IHereMapsLocationResult;
    jobForm?: angular.IFormController;

    constructor(
        private $log: angular.ILogService,
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private addressLookupService: AddressLookupService,
        private toastrService: ToastrService,
        public dispatchJobService: DispatchExecutorService,
        APP_CONFIG: IAppConfig,
    ) {
        super();
        this.isUsCustomer = APP_CONFIG.US_Customer;

        Promise.all([
            this.DispatchData.getSpeedList(),
            this.DispatchData.getVehicleSizes()
        ]).then(([speedOptions, vehicleSizes]) => {
            this.speedOptions = speedOptions;
            this.vehicleSizes = vehicleSizes;
        }).catch(error => {
            this.$log.error("Error loading initial data:", error);
            this.toastrService.showErrorToast("Failed to load form data. Please refresh and try again.");
        });

        this.fromAddressSearchText = "";
        this.toAddressSearchText = "";
        this.searchClientText = "";
        this.courierSearchText = "";
        this.isLoading = false;
        this.speedOptions = [];
        
        const tenantTimezone = TimeZone;
        console.log('Timezone:', tenantTimezone);
        this.jobDate = dayjs().tz(tenantTimezone);
        
        this.job = {
            clientId: 0,
            deliverToContact: "",
            podName: "",
            pickUpAddress: {} as IAddressViewModel,
            deliveryAddress: {} as IAddressViewModel,
            date: formatDateForApiWithTzs(this.jobDate),
            fromContactName: "",
            refA: "",
            refB: "",
            deliveryNotes: "",
            pickupNotes: "",
            jobNotes: "",
            van: false,
            truck: false,
            pedal: false,
            attention: false,
            vanOk: false,
            reprice: false,
            void: false,
            done: false,
            charge: 0.0,
            fromLat: 0,
            fromLong: 0,
            toLat: 0,
            toLong: 0,
            speedId: 0,
            vehicleId: 0
        };

        if (this.isUsCustomer) {
            this.states = getStates();
        }
    }

    vehicleSearch(searchText: string): ISuggestion[] {
        searchText = searchText.toLowerCase();
        return this.vehicleSizes.filter(item => item.text.toLowerCase().includes(searchText));
    }

    onVehicleSelect(item: ISuggestion): void {
        this.selectedVehicle = item;
    }

    speedSearch(searchText: string): ISuggestion[] {
        searchText = searchText.toLowerCase();
        return this.speedOptions.filter(item => item.text.toLowerCase().includes(searchText));
    }

    onSpeedSelect(item: ISuggestion): void {
        this.selectedSpeed = item;
    }

    clientSearch(searchTerm: string): Promise<ISuggestion[]> {
        return this.performAutocompleteSearch(searchTerm, "/home/ActiveClients");
    }

    courierSearch(searchText: string): Promise<ISuggestion[]> {
        return this.performAutocompleteSearch(searchText, "/courier/AllActiveSearch");
    }

    performAutocompleteSearch(searchTerm: string, url: string): Promise<ISuggestion[]> {
        try {
            return this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error: any) {
            this.$log.error(`Search failed: ${error.message}`);
            return Promise.resolve([]);
        }
    }

    async addressSearchAutocomplete(searchText: string): Promise<IHereMapsLocationResult[]> {
        try {
            return await this.addressLookupService.autocompleteAddressSearch(searchText);
        } catch (error: any) {
            this.toastrService.showErrorToast("An error occurred while searching for addresses. Please try again.");
            return [];
        }
    }

    async submit(job: JobCreateViewModelDto): Promise<void> {
        // Prevent double submission
        if (this.isLoading) {
            return;
        }

        // Validate form
        if (!this.isFormValid()) {
            return;
        }

        this.isLoading = true;

        try {
            job.clientId = this.selectedClient!.id;
            job.date = formatDateForApiWithTzs(this.jobDate);
            job.speedId = this.selectedSpeed!.id;
            job.vehicleId = this.selectedVehicle!.id;

            const formattedPickUpAddress = await this.processSelectedAddress(this.selectedPickupAddress!, false);
            if (!formattedPickUpAddress) {
                this.toastrService.showErrorToast("An error occurred processing the pickup address. Please try again.");
                this.$log.error("Error: formattedPickUpAddress is undefined");
                return;
            }
            job.pickUpAddress = formattedPickUpAddress;

            const formattedDeliveryAddress = await this.processSelectedAddress(this.selectedDeliveryAddress!, true);
            if (!formattedDeliveryAddress) {
                this.toastrService.showErrorToast("An error occurred processing the delivery address. Please try again.");
                this.$log.error("Error: formattedDeliveryAddress is undefined");
                return;
            }
            job.deliveryAddress = formattedDeliveryAddress;

            // Create a new job and get the new job id
            const newJobId = await this.DispatchData.quickCreateJob(job);

            if (this.selectedCourier) {
                await this.dispatchJobIfCourierSelected(this.selectedCourier.id, newJobId);
            }

            this.toastrService.showSuccessToast("Job created successfully");
            this.$mdDialog.hide(newJobId);
        } catch (error: any) {
            this.$log.error("Job creation failed:", error);
            this.toastrService.showErrorToast("Failed to create job. Please try again.");
        } finally {
            this.isLoading = false;
        }
    }

    private async processSelectedAddress(item: IHereMapsLocationResult, isToAddress: boolean): Promise<IAddressViewModel | undefined> {
        try {
            this.$log.debug("Selected address item:", item);

            if (!item || !item.id) {
                this.$log.warn("No valid address item selected");
                return;
            }

            const detailedLocation = await this.addressLookupService.getLocationDetailsById(item.id);
            if (!detailedLocation) {
                this.$log.warn("No valid address item selected");
                this.toastrService.showErrorToast("An error occurred while searching for addresses. Please try again.");
                return;
            }

            let addressDetails = isToAddress ? this.job.deliveryAddress : this.job.pickUpAddress;
            addressDetails = handleAddressFieldsFromLookup(detailedLocation, addressDetails, this.isUsCustomer);

            this.$log.debug(`Suburb/City = ${detailedLocation.address.district}`);
            this.$log.debug(`PostCode/ZIP = ${detailedLocation.address.postalCode}`);

            if (this.isUsCustomer && detailedLocation.address.stateCode) {
                const stateObj = getStateByAbbreviation(detailedLocation.address.stateCode);

                if (stateObj) {
                    addressDetails.addressLine6 = stateObj.name;
                }
            }

            return addressDetails;
        } catch (error: any) {
            this.$log.error("Error processing address:", error);
            return undefined;
        }
    }

    private isFormValid(): boolean {
        // Check Angular form validity
        if (this.jobForm && this.jobForm.$invalid) {
            this.toastrService.showWarningToast("Please complete all required fields.");
            this.markFormAsTouched();
            return false;
        }

        // Validate client selection
        if (!this.selectedClient) {
            this.toastrService.showWarningToast("Please select a client.");
            return false;
        }

        // Validate charge amount
        if (!this.job.charge || this.job.charge <= 0) {
            this.toastrService.showWarningToast("Please enter a valid charge amount.");
            return false;
        }

        // Validate job date
        if (!this.jobDate) {
            this.toastrService.showWarningToast("Please select a job date.");
            return false;
        }

        // Validate addresses
        if (!this.selectedPickupAddress) {
            this.toastrService.showWarningToast("Please select a pickup address.");
            return false;
        }

        if (!this.selectedDeliveryAddress) {
            this.toastrService.showWarningToast("Please select a delivery address.");
            return false;
        }

        // Validate contact information
        if (!this.job.fromContactName || this.job.fromContactName.trim() === "") {
            this.toastrService.showWarningToast("Please enter a pickup contact name.");
            return false;
        }

        if (!this.job.deliverToContact || this.job.deliverToContact.trim() === "") {
            this.toastrService.showWarningToast("Please enter a delivery contact name.");
            return false;
        }

        if (!this.job.podName || this.job.podName.trim() === "") {
            this.toastrService.showWarningToast("Please enter a POD name.");
            return false;
        }

        // Validate vehicle selection
        if (!this.selectedVehicle) {
            this.toastrService.showWarningToast("Please select a vehicle.");
            return false;
        }

        // Validate speed selection
        if (!this.selectedSpeed) {
            this.toastrService.showWarningToast("Please select a speed.");
            return false;
        }

        return true;
    }

    private markFormAsTouched(): void {
        if (!this.jobForm) return;

        Object.keys(this.jobForm).forEach(key => {
            if (key.startsWith('$')) return;
            const field = this.jobForm![key] as angular.INgModelController;
            if (field && field.$setTouched) {
                field.$setTouched();
            }
        });
    }

    async dispatchJobIfCourierSelected(courierId: number, jobId: number): Promise<void> {
        return this.dispatchJobService.dispatchJobByJobId(courierId, jobId);
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}