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
exports.EventGroupDialogController = void 0;
require("./event-group-dialog.styles.less");
class EventGroupDialogController {
    constructor($mdDialog, $http, toastrService, jobId, events, users) {
        this.$mdDialog = $mdDialog;
        this.$http = $http;
        this.toastrService = toastrService;
        this.jobId = jobId;
        this.events = events;
        this.users = users;
        this.searchText = '';
    }
    save(jobId, events) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const activeEvents = events.filter(event => event.active);
                yield this.addTasksToJob(jobId, activeEvents);
                const taskCount = activeEvents.length;
                this.toastrService.showSuccessToast(`${taskCount} task${taskCount !== 1 ? 's' : ''} added successfully`);
            }
            catch (error) {
                console.error('EventGroupDialogController: Error in save', error);
                this.toastrService.showErrorToast();
            }
        });
    }
    addTasksToJob(jobId, eventGroupViewModels) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.$http.post('task/AddTasks', {
                jobId,
                eventGroupViewModels
            });
        });
    }
    querySearch(text, index) {
        if (!text)
            return this.users;
        const lowercaseQuery = text.toLowerCase();
        return this.users.filter(user => user.text.toLowerCase().includes(lowercaseQuery));
    }
    selectedUserChange(user, index) {
        if (user && user.text) {
            if (!this.events[index].assignTo) {
                this.events[index].assignTo = { text: '', id: 0 };
            }
            this.events[index].assignTo.text = user.text;
            this.events[index].assignTo.id = user.id;
        }
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.EventGroupDialogController = EventGroupDialogController;
EventGroupDialogController.$inject = [
    '$mdDialog',
    '$http',
    'toastrService',
    'jobId',
    'eventTypeGroups',
    'users'
];
