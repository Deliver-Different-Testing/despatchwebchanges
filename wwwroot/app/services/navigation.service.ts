import ToastrService from "./toastr.service";
import IOpenJobOptions from "../interfaces/open-job-options.interface";
import CustomUrlService from "./custom-url.service";
import angular from 'angular';

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
    ) {}

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

    // Allowed window targets to prevent window opener attacks
    private static readonly ALLOWED_TARGETS = ['_blank', '_self', '_parent', '_top'] as const;

    openJobDetail(jobId: string | number, options: IOpenJobOptions = {}): boolean {
        const {
            stateName = "home",
            target = "_blank"
        } = options;

        if (!jobId) {
            this.toastrService.showErrorToast("Cannot open job details: Invalid job ID");
            return false;
        }

        // Validate target against whitelist to prevent window opener attacks
        const safeTarget = NavigationService.ALLOWED_TARGETS.includes(target as any) ? target : '_blank';

        try {
            const url = this.$state.href(stateName, {jobId});
            this.$window.open(url, safeTarget);
            return true;
        } catch (error: unknown) {
            this.toastrService.showErrorToast(`Error opening job details: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }
}

export default NavigationService;
