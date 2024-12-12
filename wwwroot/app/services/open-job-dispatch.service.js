class OpenJobDispatchService {
    constructor($window, $state, toastrService) {
        this.$window = $window;
        this.$state = $state;
        this.toastrService = toastrService;
    }

    /**
     * Opens job detail in dispatch screen in a new tab
     * @param {string|number} jobId The ID of the job to view
     * @param {Object} [options] Optional configuration
     * @param {string} [options.stateName='home'] The target state name
     * @param {string} [options.target='_blank'] The window target
     * @returns {boolean} True if successful, false otherwise
     */
    openJobDetail(jobId, options = {}) {
        const {
            stateName = 'home',
            target = '_blank'
        } = options;

        if (!jobId) {
            this.toastrService.showErrorToast("Cannot open job details: Invalid job ID");
            return false;
        }

        try {
            const url = this.$state.href(stateName, {jobId});
            this.$window.open(url, target);
            return true;
        } catch (error) {
            this.toastrService.showErrorToast(`Error opening job details: ${error.message}`);
            return false;
        }
    }
}

angular.module("uDispatch")
    .service("openJobDispatchService", ["$window", "$state", "toastrService", ($window, $state, toastrService) => new OpenJobDispatchService($window, $state, toastrService)]);
