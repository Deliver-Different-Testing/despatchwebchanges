import BaseController from "../../base-controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import {TruckCourierStatusViewModel} from "../../../interfaces/courier.interface";

class TruckCourierStatusDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "truckCourierStatus"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        public truckCourierStatus: TruckCourierStatusViewModel) {
        super();
    }

    async refresh(courierId: number) {
        try {
            this.truckCourierStatus = await this.dispatchData.truckCourierStatus(courierId);
        } catch (error) {
            this.toastrService.showErrorToast("An error occurred while refreshing the data. Please try again later.");
        }
    }


    cancel() {
        this.$mdDialog.cancel();
    }
}

export default TruckCourierStatusDialogController;
