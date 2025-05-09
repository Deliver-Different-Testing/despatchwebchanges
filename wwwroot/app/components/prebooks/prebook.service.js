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
class PrebookService {
    constructor($http) {
        this.$http = $http;
    }
    getPreBookJobs() {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get("/Job/PreBookJobs");
            return response.data;
        });
    }
    sendPrebookJob(jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post(`/Job/SendPrebookJob?jobId=${jobId}`, null);
            return response.data;
        });
    }
    voidPrebookJob(jobId, despatcherName, staffId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.post(`/Job/VoidPrebookJob?jobId=${jobId}&despatcher=${despatcherName}&staffId=${staffId}`, null);
            return response.data;
        });
    }
    getJobDetail(preBookJobId) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.$http.get(`/Job/PreBookDetail?preBookJobId=${preBookJobId}`);
            return response.data;
        });
    }
}
PrebookService.$inject = ["$http"];
exports.default = PrebookService;
