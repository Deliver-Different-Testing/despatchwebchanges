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
exports.AddEventDialogController = void 0;
class AddEventDialogController {
    constructor($scope, $mdDialog, DispatchData, toastrService, NWData, job, dispatcherName, contactId) {
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;
        this.NWData = NWData;
        this.job = job;
        this.dispatcherName = dispatcherName;
        this.contactId = contactId;
        this.isLoading = false;
        this.eventTypes = [];
        this.selectedEvent = null;
        this.eventForm = $scope.eventForm;
        let time = new Date();
        time.setSeconds(0);
        time.setMilliseconds(0);
        this.event = {
            jobId: job.id,
            jobNumber: job.jobNo,
            clientCode: job.client,
            eventDate: new Date(),
            eventTime: time,
            eventType: "",
            notes: "",
        };
    }
    $onInit() {
        this.DispatchData.getEventTypes().then((data) => {
            this.eventTypes = data;
            // Find the event that matches "Other" and set it to this.selectedEvent
            const otherEvent = this.eventTypes.find((eventType) => eventType.text === "Other");
            if (otherEvent) {
                this.selectedEvent = otherEvent;
            }
        });
    }
    submit(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.eventForm.$valid) {
                    this.toastrService.showWarningToast("Please complete all the required fields.");
                    return;
                }
                this.isLoading = true;
                const eventId = this.selectedEvent.id;
                const eventName = this.selectedEvent.text;
                // Exsalerate Event
                if (eventId === "7" || eventId === "92") {
                    yield this.NWData.exsalerateActivity(eventName, event.notes, this.job.clientId, event.jobNumber, this.dispatcherName);
                }
                //Process Event
                if (eventId === "48" ||
                    eventId === "52" ||
                    eventId === "54" ||
                    eventId === "60" ||
                    eventId === "6") {
                    //Add Notes
                    const newNote = eventName + ":" + event.notes;
                    yield this.NWData.addNote(event.id, newNote, FirstName, false);
                }
                yield this.NWData.addEvent(event.jobNumber, this.job.clientId, this.job.contactName, this.contactId, this.job.courierData.courierId, this.job.id, this.job.jobType, this.dispatcherName, event.notes, eventId);
                if (eventId === "6") {
                    yield this.NWData.voidJob(this.job.id);
                }
            }
            catch (error) {
                this.toastrService.showErrorToast(error.message);
            }
            finally {
                this.isLoading = false;
            }
            this.$mdDialog.hide();
        });
    }
    cancel() {
        this.$mdDialog.cancel();
    }
}
exports.AddEventDialogController = AddEventDialogController;
AddEventDialogController.$inject = [
    "$scope",
    "$mdDialog",
    "DispatchData",
    "toastrService",
    "NWData",
    "job",
    "dispatcherName",
    "contactId",
];
