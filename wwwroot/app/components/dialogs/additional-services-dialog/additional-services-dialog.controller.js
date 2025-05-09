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
exports.AdditionalServicesDialogController = void 0;
class AdditionalServicesDialogController {
    constructor($mdDialog, DispatchData, toastrService, job) {
        var _a, _b, _c, _d;
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;
        this.job = job;
        this.totalCost = 0;
        this.jobId = (_a = this.job.id) !== null && _a !== void 0 ? _a : 0;
        this.clientId = (_b = this.job.clientId) !== null && _b !== void 0 ? _b : 0;
        this.speedId = (_c = this.job.speedId) !== null && _c !== void 0 ? _c : 0;
        this.quantity = (_d = this.job.items) !== null && _d !== void 0 ? _d : 0;
        this.isLoading = false;
        this.isTotalCostCalculating = false;
        this.selected = [];
        this.additionalServices = [];
        this.totalServicesCount = 0;
    }
    $onInit() {
        this.setTotalCost(this.job.charge);
        this.addJobSpeedToSelected();
        this.addToSelectList = this.addToSelectList.bind(this);
        this.getTotal = this.getTotal.bind(this);
        this.refreshServices().catch((error) => {
            this.toastrService.showErrorToast(`Error initializing services: ${error.message}`);
        });
    }
    setTotalCost(charge) {
        const cleanedCharge = charge.replace(/\$/g, "");
        this.totalCost = parseFloat(cleanedCharge) || 0.0;
    }
    addJobSpeedToSelected() {
        const jobSpeed = {
            itemId: -1,
            clientId: this.job.clientId,
            name: `${this.job.speedName} rate`,
            description: `${this.job.speedName} rate`,
            perItem: false,
            rate: this.totalCost,
            onlyVan: false,
            selected: true
        };
        this.selected.push(jobSpeed);
    }
    refreshServices() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isLoading = true;
            try {
                const serviceResponse = yield this.DispatchData.getServices(this.clientId, this.speedId, this.jobId);
                this.additionalServices = serviceResponse.items;
                this.totalServicesCount = serviceResponse.total;
                this.selected.push(...this.additionalServices.filter((item) => item.selected));
            }
            catch (error) {
                this.toastrService.showErrorToast(`Error fetching services: ${error.message}`);
            }
            finally {
                this.isLoading = false;
            }
        });
    }
    addToSelectList() {
        return __awaiter(this, void 0, void 0, function* () {
            this.isTotalCostCalculating = true;
            try {
                this.totalCost = yield this.getTotal();
            }
            catch (error) {
                this.toastrService.showErrorToast(`Error calculating total: ${error.message}`);
            }
            finally {
                this.isTotalCostCalculating = false;
            }
        });
    }
    getTotal() {
        return __awaiter(this, void 0, void 0, function* () {
            const totalAmount = this.selected.reduce((total, item) => {
                const itemCharge = item.perItem ? (item.rate * this.quantity) : item.rate;
                return total + itemCharge;
            }, 0.0);
            return yield this.DispatchData.ppdExclusiveAmount(this.clientId, totalAmount);
        });
    }
    bookServices() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const serviceIds = this.selected
                    .filter((service) => service.itemId !== -1)
                    .map((service) => service.itemId);
                yield this.DispatchData.addServicesToJob(this.jobId, serviceIds, this.totalCost || 0);
                this.toastrService.showSuccessToast(`${serviceIds.length} total services have been added to job for $${this.totalCost}`);
                this.job.charge = this.totalCost.toString();
                this.$mdDialog.hide();
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
            }
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.AdditionalServicesDialogController = AdditionalServicesDialogController;
AdditionalServicesDialogController.$inject = ["$mdDialog", "DispatchData", "toastrService", "job"];
