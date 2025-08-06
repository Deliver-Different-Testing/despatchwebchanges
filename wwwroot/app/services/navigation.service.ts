import ToastrService from "./toastr.service";
import IOpenJobOptions from "../interfaces/open-job-options.interface";
import CustomUrlService from "./custom-url-service";

class NavigationService implements angular.IServiceProvider {
    static $inject = [
        "$window",
        "$state",
        "toastrService",
        "customUrlService"
    ];

    constructor(
        private $window: angular.IWindowService,
        private $state: angular.ui.IStateService,
        private toastrService: ToastrService,
        private customUrlService: CustomUrlService,
    ) {
        console.log("OpenJobDispatchService: Service instantiated");
    }

    $get() {
        return this;
    }

    async openHubUrl() {
        await this.openUrlInNewWindow(
            () => this.customUrlService.getHubUrl(),
            "Hub URL not configured",
            "Hub URL"
        );
    }

    async openAdminManagerUrl() {
        await this.openUrlInNewWindow(
            () => this.customUrlService.getAdminManagerUrl(),
            "Admin Manager URL not configured",
            "Admin Manager URL"
        );
    }

    private async openUrlInNewWindow(
        urlGetter: () => string,
        errorMessage: string,
        urlType: string
    ): Promise<void> {
        const url = urlGetter();
        if (!url) {
            this.toastrService.showErrorToast(errorMessage);
            return;
        }

        this.$window.open(url, '_blank');
        console.log(`${urlType} opened successfully:`, url);
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
