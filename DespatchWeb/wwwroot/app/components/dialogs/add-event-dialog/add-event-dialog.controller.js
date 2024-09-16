class AddEventDialogController {
    static $inject = ['$scope', '$mdDialog', 'NWData', 'toastrService', 'job', 'dispatcherName', 'contactId'];

    constructor($scope, $mdDialog, NWData, toastrService, job, dispatcherName, contactId) {
        this._$mdDialog = $mdDialog;
        this._NWData = NWData;
        this._toastrService = toastrService;
        this._dispatcherName = dispatcherName;
        this._contactId = contactId;
        this._job = job;

        this.isLoading = false;
        this.eventTypes = [];
        this.selectedEvent = null;
        this.eventForm = $scope.eventForm;

        let time = new Date();

        time.setSeconds(0);
        time.setMilliseconds(0);

        /** @type {Event} */
        this.event = {
            jobId: job.id,
            jobNumber: job.jobNo,
            clientCode: job.client,
            eventDate: new Date(),
            eventTime: time,
            eventType: "",
            notes: ""
        }

        this._initialiseData();
    }

    _initialiseData() {
        this._NWData.getEventTypes().then(data => {
            this.eventTypes = data;

            // Find the event that matches "Other" and set it to this.selectedEvent
            const otherEvent = this.eventTypes.find(eventType => eventType.text === "Other");
            if (otherEvent) {
                this.selectedEvent = otherEvent;
            }
        });
    }

    /**
     * @param {Event} event
     */
    async submit(event) {
        try {
            if (!this.eventForm.$valid) {
                this._toastrService.showWarningToast("Please complete all the required fields.");
                return;
            }

            this.isLoading = true;

            const eventId = this.selectedEvent.id;
            const eventName = this.selectedEvent.text;

            // Exsalerate Event
            if (eventId === "7" || eventId === "92") {
                await this._NWData.exsalerateActivity(eventName, event.notes, this._job.clientId, event.jobNumber, this._dispatcherName);
            }

            //Process Event
            if (eventId === "48" || eventId === "52" || eventId === "54" || eventId === "60" || eventId === "6") {
                //Add Notes
                const newNote = eventName + ":" + event.notes;
                await this._NWData.addNote(event.jobId, newNote, FirstName, false);
            }

            await this._NWData.addEvent(event.jobNumber, this._job.clientId, this._job.contact, this._contactId, this._job.courierData.courierID, this._job.id, this._job.jobType, this._dispatcherName, event.notes, eventId);

            if (eventId === "6") {
                this._NWData.voidJob(this._job.id);
            }
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }

        this._$mdDialog.hide();
    }

    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('AddEventDialogController', AddEventDialogController);
