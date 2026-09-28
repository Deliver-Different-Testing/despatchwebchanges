import DispatchCoreService from "./dispatch-core.service";
import {EditAddressDialogService} from "../components/dialogs/edit-address-dialog/edit-address-dialog.service";
import {IAddressViewModel, IDispatchJob} from "../interfaces/job.interface";
import ToastrService from "./toastr.service";
import JobSuffix from "../enums/job-suffix.enum";
import {AddressType} from "../enums/address-type.enum";
import angular from 'angular';

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
    ) {}

    $get() {
        return this;
    }

    async addRecurringJobStop(job: { id: number; pickupAddress: unknown; deliveryAddress: unknown }, isPickup: boolean): Promise<number | undefined> {
        if (!job.pickupAddress || !job.deliveryAddress) return;

        const newAddress = this.generateBlankAddress();
        const title = isPickup ? "Add Pick Up Stop" : "Add Delivery Stop";
        const address = await this.editAddressDialogService.openEditAddressDialog(newAddress,
            undefined, title, "Add Stop", true, isPickup ? AddressType.Pickup : AddressType.Delivery);
        if (!address) return;

        return isPickup
            ? await this.DispatchData.addStopToJob(job.id, address, undefined)
            : await this.DispatchData.addStopToJob(job.id, undefined, address);
    }

    async addNewStop(job: IDispatchJob, $event?: MouseEvent): Promise<number | undefined> {
        const lastChar = this.getJobSuffix(job.jobNo);

        switch (lastChar) {
            case JobSuffix.Pickup:
                return await this.addPickUpStop(job, $event);
            case JobSuffix.Delivery:
                return await this.addDeliveryStop(job, $event);
            default:
                await this.toastrService.showWarningToast("Cannot add stop to this job");
                return;
        }
    }
    
    private getJobSuffix(jobNo: string): string {
        return jobNo.toString().slice(-1);
    }

    private async addPickUpStop(job: IDispatchJob, $event?: MouseEvent): Promise<number | undefined> {
        if (!job.pickupAddress || !job.deliveryAddress) return;

        const newAddress = this.generateBlankAddress();
        const newPickUpAddress = await this.editAddressDialogService.openEditAddressDialog(newAddress,
            $event, "Add Pick Up Stop", "Add Stop", true, AddressType.Pickup);
        if (!newPickUpAddress) return;

        return await this.DispatchData.addStopToJob(job.id, newPickUpAddress, undefined);
    }
    
    private async addDeliveryStop(job: IDispatchJob, $event?: MouseEvent): Promise<number | undefined> {
        if (!job.pickupAddress || !job.deliveryAddress) return;

        const newAddress = this.generateBlankAddress();
        const newDeliveryAddress = await this.editAddressDialogService.openEditAddressDialog(newAddress,
            $event, "Add Delivery Stop", "Add Stop", true, AddressType.Delivery);
        if (!newDeliveryAddress) return;

        return await this.DispatchData.addStopToJob(job.id, undefined, newDeliveryAddress);
    }
    
    private generateBlankAddress(): IAddressViewModel {
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
