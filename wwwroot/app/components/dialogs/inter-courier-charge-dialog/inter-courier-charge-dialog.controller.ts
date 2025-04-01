import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import BaseController from "../../base-controller";
import {IHttpService, material} from "angular";
import "./inter-courier-charge-dialog.styles.less";
import {
    FeatureInDevelopmentDialogService
} from "../feature-in-development-dialog/feature-in-development-dialog.service";

class InterCourierChargeDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "$http",
        "DispatchData",
        "toastrService",
        "featureInDevelopmentDialogService"
    ];

    staffId: number;
    isLoading: boolean = false;
    courierChargeForm: any;
    fromCourierSearchText: string = "";
    toCourierSearchText: string = "";
    fromCourierSelectedItem: { id: number; name: string } | null = null;
    toCourierSelectedItem: { id: number; name: string } | null = null;

    data: {
        fromCourierId: number;
        toCourierId: number;
        reference: string;
        zones: number;
        amount: number;
        staffId: number;
    };

    constructor(
        private $mdDialog: material.IDialogService,
        private $http: IHttpService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private featureInDevelopmentDialogService: FeatureInDevelopmentDialogService
    ) {
        super();

        this.staffId = ContactID;
        this.data = {
            fromCourierId: 0,
            toCourierId: 0,
            reference: "",
            zones: 0,
            amount: 0.0,
            staffId: this.staffId
        };
    }

    async courierSearch(searchTerm: string): Promise<Suggestion[]> {
        if (!searchTerm || searchTerm.length < 2) {
            return [];
        }

        try {
            const url = "/courier/AllActiveSearch";
            return await this.DispatchData.autocompleteSearch(searchTerm, url);
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
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

    async submit(data: {
        fromCourierId: number;
        toCourierId: number;
        reference: string;
        zones: number;
        amount: number;
        staffId: number;
    }): Promise<void> {
            // This feature needs to be properly set up for US. Until then, handle not working nicely
                await this.featureInDevelopmentDialogService.openFeatureInDevelopmentDialog();
                return;
/*
            this.isLoading = true;

            if (!this.courierChargeForm.$valid) {
                this.toastrService.showWarningToast(
                    "Please complete all the required fields."
                );
                this.isLoading = false;
                return;
            }

            if (this.fromCourierSelectedItem) {
                data.fromCourierId = this.fromCourierSelectedItem.id;
            }

            if (this.toCourierSelectedItem) {
                data.toCourierId = this.toCourierSelectedItem.id;
            }

            const url = "job/InterCourierCharge";
            await this.$http.post(url, data, {
                headers: {"Content-Type": "application/json"}
            });

            this.toastrService.showSuccessToast(
                "Inter-Courier Charge saved successfully"
            );
            this.$mdDialog.hide();
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }*/
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}

export default InterCourierChargeDialogController;
