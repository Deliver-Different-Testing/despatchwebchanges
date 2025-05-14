import DispatchCoreService from "./dispatch-core.service";
import {EditAddressDialogService} from "../components/dialogs/edit-address-dialog/edit-address-dialog.service";
import {IDispatchJob} from "../interfaces/job.interface";
import ToastrService from "./toastr.service";
import JobSuffix from "../enums/job-suffix.enum";
import NavigationService from "./navigation.service";
import {bindAllMethods} from "../functions/bindAllMethods";
import IOpenJobOptions from "../interfaces/open-job-options.interface";

class JobAddStopService implements angular.IServiceProvider {
    static $inject = [
        "DispatchData",
        "editAddressDialogService",
        "toastrService",
        "navigationService"
    ];

    constructor(
        private DispatchData: DispatchCoreService,
        private editAddressDialogService: EditAddressDialogService,
        private toastrService: ToastrService,
        private navigationService: NavigationService,
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
                return this.addPickUpStop(job, $event);
            case JobSuffix.Delivery:
                return this.addDeliveryStop(job, $event);
            default:
                this.toastrService.showWarningToast("Cannot add stop to this job");
                return;
        }
    }

    private getJobSuffix(jobNo: string | number): string {
        return jobNo.toString().slice(-1);
    }

    private async addPickUpStop(job: IDispatchJob, $event?: MouseEvent) {
        if(!job.pickupAddress || !job.deliveryAddress) return;

        const newPickUpAddress = await this.editAddressDialogService.openEditAddressDialog(job.pickupAddress,
            $event, "Add Pick Up Stop", "Add Stop", true);
        if(!newPickUpAddress) return;

        // Add a stop job
        const stopJobId = await this.DispatchData.addStopToJob(job.id, newPickUpAddress, undefined);

        this.openJobDetail(stopJobId);
    }

    private async addDeliveryStop(job: IDispatchJob, $event?: MouseEvent) {
        if(!job.pickupAddress || !job.deliveryAddress) return;

        const newDeliveryAddress = await this.editAddressDialogService.openEditAddressDialog(job.deliveryAddress,
            $event, "Add Delivery Stop", "Add Stop", true);
        if(!newDeliveryAddress) return;

        // Add a stop job
        const stopJobId = await this.DispatchData.addStopToJob(job.id, undefined, newDeliveryAddress);

        this.openJobDetail(stopJobId);
    }

    private openJobDetail(stopJobId: number) {
        const options: IOpenJobOptions = {
            stateName: "nw",
            target: "_blank"
        };

        this.navigationService.openJobDetail(stopJobId, options);
    }
}

export default JobAddStopService;
