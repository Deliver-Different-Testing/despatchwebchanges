import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/ToastrService";
import {IJob} from "../../../interfaces/job.interface";
import app from "../../../app";

export class AdditionalServicesDialogController implements angular.IController {
    static $inject: string[] = ["$mdDialog", "DispatchData", "toastrService", "job"];

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

    constructor(private $mdDialog: angular.material.IDialogService,
                private DispatchData: DispatchCoreService,
                private toastrService: ToastrService,
                private job: IJob) {
        this.jobId = this.job.id ?? 0;
        this.clientId = this.job.clientId ?? 0;
        this.speedId = this.job.speedId ?? 0;
        this.quantity = this.job.items ?? 0;

        this.isLoading = false;
        this.isTotalCostCalculating = false;
        this.selected = [];
        this.additionalServices = [];
        this.totalServicesCount = 0;
    }

    $onInit(): void {
        this.setTotalCost(this.job.charge);
        this.addJobSpeedToSelected();

        this.addToSelectList = this.addToSelectList.bind(this);
        this.getTotal = this.getTotal.bind(this);

        this.refreshServices().catch((error: Error) => {
            this.toastrService.showErrorToast(`Error initializing services: ${error.message}`);
        });
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

    async refreshServices(): Promise<void> {
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

    async addToSelectList(): Promise<void> {
        this.isTotalCostCalculating = true;
        try {
            this.totalCost = await this.getTotal();
        } catch (error: any) {
            this.toastrService.showErrorToast(`Error calculating total: ${error.message}`);
        } finally {
            this.isTotalCostCalculating = false;
        }
    }

    async getTotal(): Promise<number> {
        const totalAmount = this.selected.reduce((total: number, item: any) => {
            const itemCharge = item.perItem ? (item.rate * this.quantity) : item.rate;
            return total + itemCharge;
        }, 0.0);

       return await this.DispatchData.ppdExclusiveAmount(this.clientId, totalAmount);
    }

    async bookServices(): Promise<void> {
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
