import DispatchCoreService from "./dispatch-core.service";
import {EditAddressDialogService} from "../components/dialogs/edit-address-dialog/edit-address-dialog.service";
import {IDispatchJob} from "../interfaces/job.interface";
import ToastrService from "./toastr.service";
import JobSuffix from "../enums/job-suffix.enum";
import {bindAllMethods} from "../functions/bindAllMethods";

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
        bindAllMethods(this);
        console.log("JobAddStop service initialized");
    }

    $get() {
        return this;
    }

    async addNewStop(job: IDispatchJob, $event?: MouseEvent): Promise<void> {
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

    private getJobSuffix(jobNo: string): string {
        return jobNo.toString().slice(-1);
    }

    private async addPickUpStop(job: IDispatchJob, $event?: MouseEvent) {
        if(!job.pickupAddress || !job.deliveryAddress) return;

        const newPickUpAddress = await this.editAddressDialogService.openEditAddressDialog(job.pickupAddress,
            $event, "Add Pick Up Stop", "Add Stop", true);
        if(!newPickUpAddress) return;

        // Add a stop job
        await this.DispatchData.addStopToJob(job.id, newPickUpAddress, undefined);
    }

    private async addDeliveryStop(job: IDispatchJob, $event?: MouseEvent) {
        if(!job.pickupAddress || !job.deliveryAddress) return;

        const newDeliveryAddress = await this.editAddressDialogService.openEditAddressDialog(job.deliveryAddress,
            $event, "Add Delivery Stop", "Add Stop", true);
        if(!newDeliveryAddress) return;

        // Add a stop job
        await this.DispatchData.addStopToJob(job.id, undefined, newDeliveryAddress);
    }
}

export default JobAddStopService;
