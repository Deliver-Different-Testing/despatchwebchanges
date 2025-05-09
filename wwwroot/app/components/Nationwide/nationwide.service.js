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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("../../app"));
class NationwideService {
    constructor($http, moment) {
        this.$http = $http;
        this.moment = moment;
    }
    $get() {
        return this;
    }
    addFollowupEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`courier/AddFollowupEvent?jobNo=${jobNo}&clientId=${clientId}&contact=${contact}&staffId=${staffId}&courierId=${courierId}&jobId=${jobId}&jobType=${jobType}&despatcherName=${despatcherName}`, null);
        });
    }
    addEvent(jobNo, clientId, contact, staffId, courierId, jobId, jobType, despatcherName, notes, eventType) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/addEvent?jobNo=${jobNo}&clientId=${clientId}&contact=${contact}&staffId=${staffId}&courierId=${courierId}&jobId=${jobId}&jobType=${jobType}&despatcherName=${despatcherName}&notes=${notes}&eventType=${eventType}`, null);
        });
    }
    exsalerateActivity(eventName, notes, clientId, jobNumber, despatcherName) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post(`job/ExsalerateActivity?eventName=${eventName}&notes=${notes}&clientId=${clientId}&jobNumber=${jobNumber}&despatcherName=${despatcherName}`, null);
        });
    }
    getNationwideJobs(endpoint, queryParams, selectedClients, internal, selectedAreas) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            const despatchViewIds = this._prepareViewIdsForRequest(selectedAreas);
            const defaultParams = {
                status: 'all',
                order: 'time',
                orderDirection: 'asc'
            };
            const paramObject = {
                status: String((_a = queryParams.status) !== null && _a !== void 0 ? _a : defaultParams.status),
                order: String((_b = queryParams.order) !== null && _b !== void 0 ? _b : defaultParams.order),
                asc: String((_c = queryParams.orderDirection) !== null && _c !== void 0 ? _c : defaultParams.orderDirection),
                isInternal: String(internal),
                cid: String(ContactID),
                clientIds: selectedClients.length ? selectedClients.join(',') : '',
            };
            const params = new URLSearchParams(paramObject);
            // Add despatch view IDs
            if (despatchViewIds.length) {
                despatchViewIds.forEach(id => {
                    params.append('despatchViewIds', String(id));
                });
            }
            const url = `nationwidejob/${endpoint}?${params.toString()}`;
            const response = yield this.$http.get(url);
            return response.data;
        });
    }
    getNationwideJobsNew(queryParams, selectedClients, internal, selectedAreas) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getNationwideJobs("nationwideJobListNew", queryParams, selectedClients, internal, selectedAreas);
        });
    }
    getNationwideJobsPOD(queryParams, selectedClients, internal, selectedAreas) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getNationwideJobs("nationwideJobListPOD", queryParams, selectedClients, internal, selectedAreas);
        });
    }
    getNationwideJobsBookDelivery(queryParams, selectedClients, internal, selectedAreas) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getNationwideJobs("nationwideJobListBookDelivery", queryParams, selectedClients, internal, selectedAreas);
        });
    }
    getNationwideJobsReprice(queryParams, selectedClients, internal, selectedAreas) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getNationwideJobs("nationwideJobListReprice", queryParams, selectedClients, internal, selectedAreas);
        });
    }
    getFlightOptions(jobId, departureDate) {
        return __awaiter(this, void 0, void 0, function* () {
            const formattedDate = this.moment(departureDate, this.moment.ISO_8601, true)
                .format("YYYY-MM-DDTHH:mm:ss");
            console.log(formattedDate);
            const response = yield this.$http.get("nationwideJob/GetScheduledFlightOptions", {
                params: {
                    departureDate: formattedDate,
                    jobId,
                }
            });
            return {
                flights: response.data,
                message: response.data.length === 0
                    ? "Sorry, we couldn't find any flights between these airports on the selected date. Please try different dates or airports."
                    : null
            };
        });
    }
    assignFlightToJob(jobId, flightNumber, departureDate) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.$http.post("nationwideJob/AssignFlightToJob", {
                    jobId,
                    flightNumber,
                    departureDate,
                });
                return response.data;
            }
            catch (error) {
                console.error("Error assigning flight to job:", error);
            }
        });
    }
    getAgentOptions(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("nationwideJob/GetAgentsForJob", {
                params: {
                    jobId,
                }
            });
            return {
                agents: response.data,
                message: response.data.length === 0 ? "Sorry, we couldn't find any agents that applied to this specific job. Please check the job information is correct and try again." : null
            };
        });
    }
    assignAgentToJob(jobId, agentId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield this.$http.post("nationwideJob/AssignAgentToJob", {
                    jobId,
                    agentId,
                });
                return response.data;
            }
            catch (error) {
                console.error("Error assigning agent to job:", error);
            }
        });
    }
    _prepareViewIdsForRequest(selectedAreas) {
        return selectedAreas.map(area => {
            return typeof area === "object" && area.id ? area.id : 0;
        });
    }
}
NationwideService.$inject = ["$http", "moment"];
app_1.default.service("NWData", NationwideService);
exports.default = NationwideService;
