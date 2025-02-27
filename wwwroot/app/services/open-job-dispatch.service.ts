import app from "../app";
import angular from "angular";
import ToastrService from "./toastr.service";
import OpenJobOptions from "../interfaces/open-job-options.interface";

class OpenJobDispatchService {
    static $inject = ["$window", "$state", "toastrService"];

    constructor(private $window: angular.IWindowService,
                private $state: angular.ui.IStateService,
                private toastrService: ToastrService) {
    }

    public openJobDetail(jobId: string | number, options: OpenJobOptions = {}): boolean {
        const {
            stateName = "home",
            target = "_blank"
        } = options;

        if (!jobId) {
            this.toastrService.showErrorToast("Cannot open job details: Invalid job ID");
            return false;
        }

        try {
            const url = this.$state.href(stateName, {jobId});
            this.$window.open(url, target);
            return true;
        } catch (error: any) {
            this.toastrService.showErrorToast(`Error opening job details: ${error.message}`);
            return false;
        }
    }
}

app.service("openJobDispatchService", OpenJobDispatchService);
export default OpenJobDispatchService;
