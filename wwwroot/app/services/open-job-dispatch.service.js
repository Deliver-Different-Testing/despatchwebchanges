"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class OpenJobDispatchService {
    constructor($window, $state, toastrService) {
        this.$window = $window;
        this.$state = $state;
        this.toastrService = toastrService;
    }
    openJobDetail(jobId, options = {}) {
        const { stateName = "home", target = "_blank" } = options;
        if (!jobId) {
            this.toastrService.showErrorToast("Cannot open job details: Invalid job ID");
            return false;
        }
        try {
            const url = this.$state.href(stateName, { jobId });
            this.$window.open(url, target);
            return true;
        }
        catch (error) {
            this.toastrService.showErrorToast(`Error opening job details: ${error.message}`);
            return false;
        }
    }
}
OpenJobDispatchService.$inject = ["$window", "$state", "toastrService"];
exports.default = OpenJobDispatchService;
