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
class OverviewService {
    constructor($http) {
        this.$http = $http;
    }
    $get() {
        return this;
    }
    getAllJobs(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const regionIds = (_a = params.regions) === null || _a === void 0 ? void 0 : _a.map(r => r.id).join(",");
            const speedIds = (_b = params.speeds) === null || _b === void 0 ? void 0 : _b.map(s => s.id).join(",");
            const response = yield this.$http.get("/overview", {
                params: {
                    statusGroup: params.statusGroup,
                    page: params.page,
                    limit: params.limit,
                    search: params.search,
                    startDate: params.startDate ? params.startDate.toISOString() : null,
                    endDate: params.endDate ? params.endDate.toISOString() : null,
                    orderBy: params.orderBy || "jobName",
                    orderDirection: params.orderDirection,
                    regions: regionIds || null,
                    speeds: speedIds || null
                }
            });
            return {
                items: response.data.items || [],
                total: response.data.total || 0,
                page: response.data.page || params.page,
                pages: response.data.pages || Math.ceil((response.data.total || 0) / params.limit)
            };
        });
    }
    getAllRegions() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("/overview/GetAllRegions");
            return response.data;
        });
    }
    getAllSpeeds() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("/overview/GetAllSpeeds");
            return response.data;
        });
    }
    getStats() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("/overview/GetStats");
            return response.data;
        });
    }
    getParentJobMap(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`/overview/GetParentJobMap?jobId=${jobId}`);
            return response.data;
        });
    }
    getMegaMapData() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("/overview/GetJobsForMegaMap");
            return response.data;
        });
    }
    getOpenJobs(params) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const regionIds = (_a = params.regions) === null || _a === void 0 ? void 0 : _a.map(r => r.id).join(",");
            const speedIds = (_b = params.speeds) === null || _b === void 0 ? void 0 : _b.map(s => s.id).join(",");
            const response = yield this.$http.get("/overview/GetOpenJobs", {
                params: {
                    startDate: params.startDate ? params.startDate.toISOString() : null,
                    endDate: params.endDate ? params.endDate.toISOString() : null,
                    regions: regionIds || null,
                    speeds: speedIds || null
                }
            });
            return response.data;
        });
    }
    saveCollapseState(cardName, isCollapsed) {
        return __awaiter(this, void 0, void 0, function* () {
            if (window.localStorage) {
                try {
                    const saved = localStorage.getItem("cardCollapseStates");
                    const states = saved ? JSON.parse(saved) : {};
                    // Update the state for the specific card
                    states[cardName] = isCollapsed;
                    localStorage.setItem("cardCollapseStates", JSON.stringify(states));
                    return states;
                }
                catch (error) {
                    console.error("Error saving collapse state:", error);
                    throw error;
                }
            }
            return null;
        });
    }
    loadCollapseState(cardName) {
        if (window.localStorage) {
            try {
                const saved = localStorage.getItem("cardCollapseStates");
                if (saved) {
                    const states = JSON.parse(saved);
                    return states[cardName] || false;
                }
            }
            catch (error) {
                console.error("Error loading collapse state:", error);
            }
        }
        return false;
    }
}
OverviewService.$inject = ["$http"];
exports.default = OverviewService;
