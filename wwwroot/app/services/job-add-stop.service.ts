import DispatchCoreService from "./dispatch-core.service";
import {EditAddressDialogService} from "../components/dialogs/edit-address-dialog/edit-address-dialog.service";
import {AddressViewModel, IDispatchJob} from "../interfaces/job.interface";
import ToastrService from "./toastr.service";
import JobSuffix from "../enums/job-suffix.enum";
import {IPrebookListModel} from "../components/recurringJobs/recurringJobs.interface";

class JobAddStopService implements angular.IServiceProvider {
    static $inject = [
        "DispatchData",
        "editAddressDialogService",
        "toastrService",
    ];

    constructor(
        private DispatchData: DispatchCoreService,
        private editAddressDialogService: EditAddressDialogService,
        private toastrService: ToastrService,
    ) {
        console.log("JobAddStop service initialized");
    }

    $get() {
        return this;
    }

    async addNewStop(job: IDispatchJob, $event?: MouseEvent): Promise<number | undefined> {
        const lastChar = this.getJobSuffix(job.jobNo);

        switch (lastChar) {
            case JobSuffix.Pickup:
                return await this.addPickUpStop(job, $event);
            case JobSuffix.Delivery:
                return await this.addDeliveryStop(job, $event);
            default:
                this.toastrService.showWarningToast("Cannot add stop to this job");
                return;
        }
    }

    async addRecurringJobStop(job: IPrebookListModel, isPickupStop: boolean, $event?: MouseEvent): Promise<number | undefined> {
        switch (isPickupStop) {
            case true:
                return await this.addPickUpStopRecurringJob(job, $event);
            case false:
                return await this.addDeliveryStopToRecurringJob(job, $event);
            default:
                this.toastrService.showWarningToast("Cannot add stop to this job");
                return;
        }
    }

    private getJobSuffix(jobNo: string): string {
        return jobNo.toString().slice(-1);
    }

    private async addPickUpStop(job: IDispatchJob, $event?: MouseEvent): Promise<number | undefined> {
        if(!job.pickupAddress || !job.deliveryAddress) return;

        const newAddress = this.generateBlankAddress();
        const newPickUpAddress = await this.editAddressDialogService.openEditAddressDialog(newAddress,
            $event, "Add Pick Up Stop", "Add Stop", true);
        if(!newPickUpAddress) return;

       return await this.DispatchData.addStopToJob(job.id, newPickUpAddress, undefined);
    }

    private async addPickUpStopRecurringJob(job: IPrebookListModel, $event?: MouseEvent): Promise<number | undefined> {
        if(!job.pickupAddress || !job.deliveryAddress) return;

        const newAddress = this.generateBlankAddress();
        const newPickUpAddress = await this.editAddressDialogService.openEditAddressDialog(newAddress,
            $event, "Add Pick Up Stop", "Add Stop", true);
        if(!newPickUpAddress) return;

       return await this.DispatchData.addStopToRecurringJob(job.id, newPickUpAddress, undefined);
    }

    private async addDeliveryStop(job: IDispatchJob, $event?: MouseEvent): Promise<number| undefined> {
        if(!job.pickupAddress || !job.deliveryAddress) return;

        const newAddress = this.generateBlankAddress();
        const newDeliveryAddress = await this.editAddressDialogService.openEditAddressDialog(newAddress,
            $event, "Add Delivery Stop", "Add Stop", true);
        if(!newDeliveryAddress) return;

       return await this.DispatchData.addStopToJob(job.id, undefined, newDeliveryAddress);
    }

    private async addDeliveryStopToRecurringJob(job: IPrebookListModel, $event?: MouseEvent): Promise<number| undefined> {
        if(!job.pickupAddress || !job.deliveryAddress) return;

        const newAddress = this.generateBlankAddress();
        const newDeliveryAddress = await this.editAddressDialogService.openEditAddressDialog(newAddress,
            $event, "Add Delivery Stop", "Add Stop", true);
        if(!newDeliveryAddress) return;

        return await this.DispatchData.addStopToRecurringJob(job.id, undefined, newDeliveryAddress);
    }


    private generateBlankAddress(): AddressViewModel {
        return {
            addressLine1: "",
            addressLine2: "",
            addressLine3: "",
            addressLine4: "",
            addressLine5: "",
            addressLine6: "",
            addressLine7: "",
            addressLine8: "",
            fullAddress: ""
        }
    }
}

export default JobAddStopService;
