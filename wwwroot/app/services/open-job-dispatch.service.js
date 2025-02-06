import app from "../app";

/**
 * @typedef {Object} OpenJobOptions
 * @property {string} [stateName='home'] - The state to navigate to
 * @property {string} [target='_blank'] - The target window for opening the job
 */

class openJobDispatchService {
    static $inject = ["$window", "$state", "toastrService"];

    constructor($window, $state, toastrService) {
        this.$window = $window;
        this.$state = $state;
        this.toastrService = toastrService;
    }

    /**
     * Opens job details in a new window
     * @param {string|number} jobId - The ID of the job to open
     * @param {OpenJobOptions} [options={}] - Options for opening the job
     * @returns {boolean} True if successful, false otherwise
     */
    openJobDetail(jobId, options = {}) {
        const {
            stateName = "home",
            target = "_blank"
        } = options;

        if (!jobId) {
            this.toastrService.showErrorToast("Cannot open job details: Invalid job ID");
            return false;
        }

        try {
            const url = this.$state.href(stateName, { jobId });
            this.$window.open(url, target);
            return true;
        } catch (error) {
            this.toastrService.showErrorToast(`Error opening job details: ${error.message}`);
            return false;
        }
    }
}

app.service("openJobDispatchService", openJobDispatchService);
export default openJobDispatchService;
