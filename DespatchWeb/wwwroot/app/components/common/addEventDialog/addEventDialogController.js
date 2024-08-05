/**
 * @typedef {Object} Event
 *
 * @property {number} id Unique identifier of the job
 * @property {number} jobNumber Number associated with job
 * @property {string} clientCode Code associated with client
 * @property {Date} eventDate Timestamp when the event is created
 * @property {string} eventTime Time of the event
 * @property {string} eventType Types of event
 * @property {string} notes Additional notes for the event
 */
class AddEventDialogController {
    constructor($scope, $mdDialog, NWData, toastrService, rateJobService, job, dispatherName, contactId) {
        this.$mdDialog = $mdDialog;
        this.NWData = NWData;
        this.toastrService = toastrService;
        this.rateJobService = rateJobService;
        this._dispatherName = dispatherName;
        this._contactId = contactId;
        this._job = job;

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
        this.NWData.getEventTypes().then(data => {
            this.eventTypes = data;

            // Find the event that matches "Other" and set it to this.selectedEvent
            const otherEvent = this.eventTypes.find(eventType => eventType.text === "Other");
            if (otherEvent) {
                this.selectedEvent = otherEvent;
            }
        });
    }

    async submit(event) {
        try {
            if (!this.eventForm.$valid) {
                this.toastrService.showWarningToast("Please complete all the required fields.");
                return;
            }

            const eventId = this.selectedEvent.id;
            const eventName = this.selectedEvent.text;

            // Exsalerate Event
            if (eventId === "7" || eventId === "92") {
                this.NWData.exsalerateActivity(eventName, event.notes, this._clientId, event.jobNumber, this._dispatherName);
            }

            //Process Event
            if (eventId === "48" || eventId === "52" || eventId === "54" || eventId === "60" || eventId === "6") {
                //Add Notes
                const newNote = eventName + ":" + event.notes;
                await this.NWData.addNote(event.jobId, newNote, FirstName, false);
            }

            await this.NWData.addEvent(event.jobNumber, this._job.clientId, this._job.contact, this._contactId, this._job.courierData.courierID, this._job.id, this._job.jobType, this._dispatherName, event.notes, eventId);

            if (eventId === "6") {
                this.NWData.voidJob(this._job.id);
            }

            angular.element(".eventForm").hide();
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        }

        this.$mdDialog.hide();
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}
