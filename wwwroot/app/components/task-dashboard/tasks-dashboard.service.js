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
class TasksDashboardService {
    constructor($http) {
        this.$http = $http;
    }
    $get() {
        return this;
    }
    getAllTasks(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const cleanFilters = {};
            // Only add defined filters
            if (filters.courierId !== undefined)
                cleanFilters.courierId = filters.courierId;
            if (filters.eventTypeId !== undefined)
                cleanFilters.eventTypeId = filters.eventTypeId;
            if (filters.searchText)
                cleanFilters.searchText = filters.searchText;
            if (filters.date)
                cleanFilters.date = filters.date;
            const response = yield this.$http({
                method: 'GET',
                url: '/Task/GetAllTasks',
                params: cleanFilters,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        });
    }
    markTaskAsClosed(eventId, closed) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post("Task/MarkTaskAsClosed" + "?eventId=" + eventId + "&closed=" + closed, null);
        });
    }
    updateTaskDate(eventId, date) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post("Task/UpdateTaskDate" + "?eventId=" + eventId + "&date=" + date, null);
        });
    }
    updateTaskTime(eventId, time) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post("Task/UpdateTaskTime" + "?eventId=" + eventId + "&time=" + time, null);
        });
    }
    reassignTask(eventId, staffId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post("Task/ReassignTask" + "?eventId=" + eventId + "&staffId=" + staffId, null);
        });
    }
}
TasksDashboardService.$inject = ["$http"];
exports.default = TasksDashboardService;
