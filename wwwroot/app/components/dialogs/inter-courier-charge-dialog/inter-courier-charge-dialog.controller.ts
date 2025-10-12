import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import BaseController from "../../base-controller";
import {IHttpService, material} from "angular";
import "./inter-courier-charge-dialog.styles.less";
import {
    FeatureInDevelopmentDialogService
} from "../feature-in-development-dialog/feature-in-development-dialog.service";
import {ISuggestion} from "../../../interfaces/job.interface";
import IInterCourierData from "./interfaces/IInterCourierData";

class InterCourierChargeDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService"
    ];

    isLoading: boolean = false;
    courierChargeForm: any;
    fromCourierSearchText?: string;
    toCourierSearchText?: string;
    fromCourierSelectedItem?: ISuggestion;
    toCourierSelectedItem?: ISuggestion;
    
    data: IInterCourierData;
    
    clientSelectedItem?: ISuggestion;
    clientSearchText?: string;

    constructor(
        private $mdDialog: material.IDialogService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
    ) {
        super();
        this.data = {} as IInterCourierData;
    }

    async courierSearch(searchTerm: string): Promise<ISuggestion[]> {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        try {
            const url = "/courier/AllActiveSearch";
            return await this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this.toastrService.showErrorToast("An error occurred while searching. Please try again later.");
            console.error(error);
            return [];
        }
    }

    async clientSearch(searchTerm: string): Promise<ISuggestion[]> {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        try {
            const url = "/home/ActiveClients";
            return await this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error) {
            this.toastrService.showErrorToast("An error occurred while searching. Please try again later.");
            console.error(error);
            return [];
        }
    }

    updateAmountByZones(zones: number): void {
        if (isNaN(zones)) {
            this.data.amount = 0;
            return;
        }

        this.data.amount = zones * 7;
    }

    async submit(data: IInterCourierData): Promise<void> {
        try {
            this.isLoading = true;

            if (!this.courierChargeForm.$valid) {
                this.toastrService.showWarningToast("Please complete all the required fields");
                this.isLoading = false;
                return;
            }

            if (this.fromCourierSelectedItem) {
                data.fromCourierId = this.fromCourierSelectedItem.id;
            }

            if (this.toCourierSelectedItem) {
                data.toCourierId = this.toCourierSelectedItem.id;
            }
            
            if(this.clientSelectedItem) {
                data.clientId = this.clientSelectedItem.id;
            }

            await this.DispatchData.createInterCourierCharge(data);

            this.toastrService.showSuccessToast("Inter-Courier Charge saved successfully");
            this.$mdDialog.hide();
        } catch (error) {
            this.toastrService.showErrorToast();
            console.error(error);
        } finally {
            this.isLoading = false;
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default InterCourierChargeDialogController;
