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
exports.EventGroupDialogService = void 0;
class EventGroupDialogService {
    constructor($mdDialog, DispatchData) {
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        console.log('EventGroupDialogService: Service instantiated');
    }
    openEventGroupDialog(eventGroupId, jobId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const eventTypeGroups = yield this.DispatchData.getEventTypeGroups(eventGroupId);
                const users = yield this.DispatchData.getActiveStaff();
                yield this.$mdDialog.show({
                    controller: 'EventGroupDialogController',
                    controllerAs: 'ctrl',
                    template: require("./event-group-dialog.template.html"),
                    parent: document.body,
                    clickOutsideToClose: false,
                    escapeToClose: true,
                    locals: {
                        jobId,
                        eventTypeGroups,
                        users
                    },
                    bindToController: true,
                });
                console.log('EventGroupDialogService: Dialog closed');
            }
            catch (error) {
                if (error === undefined) {
                    return;
                }
                // Error occured
                console.error('EventGroupDialogService: Error in openEventGroupDialog', error);
                throw error;
            }
        });
    }
}
exports.EventGroupDialogService = EventGroupDialogService;
EventGroupDialogService.$inject = [
    '$mdDialog', "DispatchData"
];
