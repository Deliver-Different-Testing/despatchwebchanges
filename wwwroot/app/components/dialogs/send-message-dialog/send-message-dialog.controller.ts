import app from "../../../app";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";

export class SendMessageDialogController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "selectedCourierId",
        "contactId",
        "dispatcherName"
    ];

    isLoading: boolean;
    message: string;

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        private selectedCourierId: number,
        private contactId: number,
        private dispatcherName: string
    ) {
        this.isLoading = false;
        this.message = "";
    }

    async submit(message: string): Promise<void> {
        try {
            this.isLoading = true;

            await this.dispatchData.sendSMS(this.selectedCourierId, this.contactId, this.dispatcherName, message);

            this.toastrService.showSuccessToast("Message sent!");
        } catch (error: any) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
            this.$mdDialog.hide();
        }
    }

    cancel(): void {
        this.$mdDialog.cancel();
    }
}
