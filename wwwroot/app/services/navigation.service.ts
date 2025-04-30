import ToastrService from "./toastr.service";
import IOpenJobOptions from "../interfaces/open-job-options.interface";
import ConfigService from "./config.service";

class NavigationService implements angular.IServiceProvider {
    static $inject = [
        "$window",
        "$state",
        "toastrService",
        "configService"
    ];

    constructor(
        private $window: angular.IWindowService,
        private $state: angular.ui.IStateService,
        private toastrService: ToastrService,
        private configService: ConfigService,
    ) {
        console.log("OpenJobDispatchService: Service instantiated");
    }

    $get() {
        return this;
    }

    async openHubUrl() {
        const hubUrl = await this.configService.getHubUrl();
        if (!hubUrl) {
            this.toastrService.showErrorToast("Hub URL not configured");
        }

        this.$window.open(hubUrl, '_blank');

        // Log success for debugging
        console.log('Hub URL opened successfully:', hubUrl);
    }

    openJobDetail(jobId: string | number, options: IOpenJobOptions = {}): boolean {
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

export default NavigationService;
