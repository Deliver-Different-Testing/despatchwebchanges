"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openJobsComponent = void 0;
const bindAllMethods_1 = require("../../../bindAllMethods");
class OpenJobsWidgetController {
    constructor($scope, overviewService, moment, APP_CONFIG, overviewFiltersService) {
        this.overviewService = overviewService;
        this.moment = moment;
        this.overviewFiltersService = overviewFiltersService;
        this.limitName = "openJobsTableViewLimit";
        this.isTableView = false;
        this.tableJobs = [];
        this.tableQuery = {
            order: 'jobId',
            limit: 5,
            page: 1
        };
        this.isUsCustomer = APP_CONFIG.US_Customer;
        this.sortBy = "jobId";
        bindAllMethods_1.bindAllMethods(this);
        $scope.$watch(() => this.tableQuery.limit, (newValue, oldValue) => {
            if (newValue !== oldValue) {
                if (Modernizr.localstorage) {
                    localStorage.setItem(this.limitName, `${this.tableQuery.limit}`);
                }
            }
        });
    }
    $onInit() {
        // Subscribe to filter changes
        this.overviewFiltersService.onFilterChange(() => this._loadOpenJobs());
        this._loadSavedLimit();
        this._loadOpenJobs();
        this.loadCardState();
        setInterval(this._loadOpenJobs, 60000);
    }
    _loadSavedLimit() {
        const savedLimit = localStorage.getItem(this.limitName);
        console.log(`Saved limit is: ${savedLimit}`);
        if (savedLimit) {
            this.tableQuery.limit = parseInt(savedLimit);
        }
    }
    _loadOpenJobs() {
        var _a, _b;
        const params = {
            startDate: ((_a = this.overviewFiltersService.dateRange) === null || _a === void 0 ? void 0 : _a.start) || undefined,
            endDate: ((_b = this.overviewFiltersService.dateRange) === null || _b === void 0 ? void 0 : _b.end) || undefined,
            regions: this.overviewFiltersService.selectedRegions || undefined,
            speeds: this.overviewFiltersService.selectedSpeeds || undefined
        };
        this.overviewService.getOpenJobs(params)
            .then((jobs) => {
            // Group jobs by driver
            const groupedJobs = {};
            this.tableJobs = []; // Reset table jobs
            jobs.forEach(job => {
                if (!groupedJobs[job.driverName]) {
                    groupedJobs[job.driverName] = {
                        name: job.driverName,
                        jobs: [],
                        completedToday: job.completedToday,
                        lastCompleted: job.lastCompleted ?
                            this._formatTime(job.lastCompleted) : "N/A",
                        expanded: false
                    };
                }
                const viewJob = {
                    jobId: job.jobId,
                    reference: job.reference,
                    status: job.status,
                    pickup: {
                        time: job.pickupTime,
                        name: job.pickupName,
                        address: job.pickupAddress
                    },
                    delivery: {
                        time: job.deliveryTime,
                        name: job.deliveryName,
                        address: job.deliveryAddress
                    },
                    quantity: job.quantity,
                    packageType: job.packageType,
                    mileage: job.mileage,
                    driverName: job.driverName,
                };
                groupedJobs[job.driverName].jobs.push(viewJob);
                this.tableJobs.push(viewJob); // Add to flat list for table view
            });
            // Convert to array and sort jobs within each driver group
            this.drivers = Object.values(groupedJobs).map(driver => {
                driver.jobs.sort(this.compareJobs);
                return driver;
            });
            // Sort table jobs
            this.tableJobs.sort(this.compareJobs);
        })
            .catch(error => {
            console.error("Error loading open jobs:", error);
        });
    }
    loadCardState() {
        this.isCardCollapsed = this.overviewService.loadCollapseState("openJobs");
    }
    loadViewModeState() {
        const savedViewMode = localStorage.getItem('openJobsViewMode');
        if (savedViewMode === 'table') {
            this.isTableView = true;
        }
    }
    toggleViewMode() {
        localStorage.setItem('openJobsViewMode', this.isTableView ? 'table' : 'card');
    }
    toggleCard() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isCardCollapsed = !this.isCardCollapsed;
            yield this.overviewService.saveCollapseState("openJobs", this.isCardCollapsed);
        });
    }
    _formatTime(timestamp) {
        return this.moment(timestamp).format("HH:mm");
    }
    compareJobs(a, b) {
        try {
            const order = this.tableQuery.order;
            const isDesc = order.charAt(0) === '-';
            const field = isDesc ? order.substring(1) : order;
            let comparison = 0;
            switch (field) {
                case "pickup":
                    comparison = this.moment(a.pickup.time).valueOf() -
                        this.moment(b.pickup.time).valueOf();
                    break;
                case "delivery":
                    comparison = this.moment(a.delivery.time).valueOf() -
                        this.moment(b.delivery.time).valueOf();
                    break;
                case "driverName":
                    comparison = (a.driverName || '').localeCompare(b.driverName || '');
                    break;
                case "status":
                    comparison = (a.status || '').localeCompare(b.status || '');
                    break;
                case "mileage":
                    comparison = a.mileage - b.mileage;
                    break;
                case "jobId":
                default:
                    // jobId is a number from backend
                    comparison = a.jobId - b.jobId;
                    break;
            }
            return isDesc ? -comparison : comparison;
        }
        catch (error) {
            console.error("Error comparing jobs:", error);
            return 0;
        }
    }
    getSortLabel() {
        switch (this.sortBy) {
            case "pickup":
                return "Pickup Time";
            case "delivery":
                return "Delivery Time";
            default:
                return "Job ID";
        }
    }
    onSortChange(order) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.tableQuery.order = order;
                if (!this.drivers)
                    return;
                // For card view
                this.drivers.forEach(driver => {
                    driver.jobs.sort((a, b) => this.compareJobs(a, b));
                });
                // For table view
                this.tableJobs.sort((a, b) => this.compareJobs(a, b));
            }
            catch (error) {
                console.error("Error during sort:", error);
            }
        });
    }
    formatRegionalTime(timestamp) {
        if (!timestamp)
            return "";
        const format = this.isUsCustomer ? "MM/DD HH:mm" : "DD/MM HH:mm";
        return this.moment(timestamp).format(format);
    }
    getTimeSinceLastCompleted(lastCompletedTime) {
        if (lastCompletedTime === "N/A")
            return 0;
        const lastCompleted = this.moment(lastCompletedTime, "HH:mm");
        const now = this.moment();
        const duration = this.moment.duration(now.diff(lastCompleted));
        return Math.round(duration.asMinutes());
    }
    getStatusClass(status) {
        const statusClasses = {
            'NEW': 'status-new',
            'DISPATCHED': 'status-dispatched',
            'ACCEPTED': 'status-accepted',
            'PICKEDUP': 'status-pickedup',
            'DELIVERED': 'status-delivered'
        };
        return statusClasses[status] || 'status-default';
    }
    onPaginate(page, limit) {
        this.tableQuery.page = page;
        this.tableQuery.limit = limit;
    }
}
OpenJobsWidgetController.$inject = ["$scope", "overviewService", "moment", "APP_CONFIG", "overviewFiltersService"];
exports.openJobsComponent = {
    template: require("./open-jobs.template.html"),
    controller: OpenJobsWidgetController,
    controllerAs: "ctrl"
};
