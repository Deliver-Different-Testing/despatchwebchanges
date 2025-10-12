import BaseController from "../../base-controller";
import DispatchCoreService from "../../../services/dispatch-core.service";
import ToastrService from "../../../services/toastr.service";
import {ITruckCourierStatus} from "../../../interfaces/courier.interface";

class TruckCourierStatusDialogController extends BaseController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "$scope",
        "$interval",
        "$timeout",
        "truckCourierStatus"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private dispatchData: DispatchCoreService,
        private toastrService: ToastrService,
        $scope: angular.IScope,
        $interval: angular.IIntervalService,
        $timeout: angular.ITimeoutService,
        public truckCourierStatus: ITruckCourierStatus
    ) {
        super();
        this.initServices($timeout, $interval, $scope);
        
        console.debug("TruckCourierStatusDialogController instantiated");
    }

    async refresh(courierId: number) {
        try {
            this.truckCourierStatus = await this.dispatchData.truckCourierStatus(courierId);
        } catch (error) {
            console.error("Error refreshing truck courier status:", error);
            this.toastrService.showErrorToast("An error occurred while refreshing the data. Please try again later.");
        } finally {
            console.debug("Truck courier status refreshed successfully");
            this.applyScope();
        }
    }
    
    cancel() {
        this.$mdDialog.cancel();
    }
}

export default TruckCourierStatusDialogController;
