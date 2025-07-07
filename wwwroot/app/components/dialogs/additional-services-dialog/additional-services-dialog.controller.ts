import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import {IJob} from "../../../interfaces/job.interface";
import BaseController from "../../base-controller";

class AdditionalServicesDialogController extends BaseController {
    static $inject = [
        "$mdDialog", 
        "DispatchData",
        "toastrService",
        "job"
    ];

    private readonly jobId: number;
    private readonly clientId: number;
    private readonly speedId: number;
    private readonly quantity: number;
    isLoading: boolean;
    isTotalCostCalculating: boolean;
    selected: any[];
    additionalServices: any[];
    totalServicesCount: number;
    totalCost: number = 0;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private DispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private job: IJob
    ) {
        super();

        this.jobId = this.job.id ?? 0;
        this.clientId = this.job.clientId ?? 0;
        this.speedId = this.job.speedId ?? 0;
        this.quantity = this.job.items ?? 0;

        this.isLoading = false;
        this.isTotalCostCalculating = false;
        this.selected = [];
        this.additionalServices = [];
        this.totalServicesCount = 0;

        this.refreshServices().catch((error: Error) => {
            this.toastrService.showErrorToast(`Error initializing services: ${error.message}`);
        });
    }

    $onInit() {
        this.setTotalCost(this.job.charge);
        this.addJobSpeedToSelected();
    }

    setTotalCost(charge: string) {
        const cleanedCharge = charge.replace(/\$/g, "");
        this.totalCost = parseFloat(cleanedCharge) || 0.0;
    }

    addJobSpeedToSelected() {
        const jobSpeed = {
            itemId: -1,
            clientId: this.job.clientId,
            name: `${this.job.speedName} rate`,
            description: `${this.job.speedName} rate`,
            perItem: false,
            rate: this.totalCost,
            onlyVan: false,
            selected: true
        };

        this.selected.push(jobSpeed);
    }

    async refreshServices() {
        this.isLoading = true;
        try {
            const serviceResponse = await this.DispatchData.getServices(this.clientId, this.speedId, this.jobId);
            this.additionalServices = serviceResponse.items;
            this.totalServicesCount = serviceResponse.total;

            this.selected.push(...this.additionalServices.filter((item: any) => item.selected));
        } catch (error: any) {
            this.toastrService.showErrorToast(`Error fetching services: ${error.message}`);
        } finally {
            this.isLoading = false;
        }
    }

    async addToSelectList() {
        this.isTotalCostCalculating = true;
        try {
            this.totalCost = await this.getTotal();
        } catch (error: any) {
            this.toastrService.showErrorToast(`Error calculating total: ${error.message}`);
        } finally {
            this.isTotalCostCalculating = false;
        }
    }

    async getTotal() {
        const totalAmount = this.selected.reduce((total: number, item: any) => {
            const itemCharge = item.perItem ? (item.rate * this.quantity) : item.rate;
            return total + itemCharge;
        }, 0.0);

        return await this.DispatchData.ppdExclusiveAmount(this.clientId, totalAmount);
    }

    async bookServices() {
        try {
            const serviceIds = this.selected
                .filter((service: any) => service.itemId !== -1)
                .map((service: any) => service.itemId);

            await this.DispatchData.addServicesToJob(this.jobId, serviceIds, this.totalCost || 0);
            this.toastrService.showSuccessToast(`${serviceIds.length} total services have been added to job for $${this.totalCost}`);

            this.job.charge = this.totalCost.toString();

            this.$mdDialog.hide();
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        }
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}

export default AdditionalServicesDialogController;
