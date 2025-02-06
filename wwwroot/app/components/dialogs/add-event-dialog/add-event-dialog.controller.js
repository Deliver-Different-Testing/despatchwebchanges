/**
 * @fileoverview Controller for the Add Event Dialog in the uDispatch application.
 * @module AddEventDialogController
 */

/**
 * Controller for the Add Event Dialog
 * @class
 */
class AddEventDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ["$scope", "$mdDialog", "NWData", "toastrService", "job", "dispatcherName", "contactId"];

    /**
     * Create an AddEventDialogController.
     * @param {Object} $scope - Angular scope object.
     * @param {Object} $mdDialog - Angular Material dialog service.
     * @param {Object} NWData - Service for fetching and manipulating data.
     * @param {Object} toastrService - Service for displaying toast notifications.
     * @param {Object} job - The job object.
     * @param {string} dispatcherName - Name of the dispatcher.
     * @param {string} contactId - ID of the contact.
     */
    constructor($scope, $mdDialog, NWData, toastrService, job, dispatcherName, contactId) {
        this.$mdDialog = $mdDialog;
        this._NWData = NWData;
        this.toastrService = toastrService;
        this.dispatcherName = dispatcherName;
        this.contactId = contactId;
        this._job = job;

        /** @type {boolean} */
        this.isLoading = false;
        /** @type {Array} */
        this.eventTypes = [];
        /** @type {Object|null} */
        this.selectedEvent = null;
        /** @type {Object} */
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

    /**
     * Initialize the controller data.
     * @private
     */
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
     * Submit the event form.
     * @param {Event} event - The event object to submit.
     * @returns {Promise<void>}
     */
    async submit(event) {
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
                await this._NWData.exsalerateActivity(eventName, event.notes, this._job.clientId, event.jobNumber, this.dispatcherName);
            }

            //Process Event
            if (eventId === "48" || eventId === "52" || eventId === "54" || eventId === "60" || eventId === "6") {
                //Add Notes
                const newNote = eventName + ":" + event.notes;
                await this._NWData.addNote(event.jobId, newNote, FirstName, false);
            }

            await this._NWData.addEvent(event.jobNumber, this._job.clientId, this._job.contact, this.contactId, this._job.courierData.courierID, this._job.id, this._job.jobType, this.dispatcherName, event.notes, eventId);

            if (eventId === "6") {
                this._NWData.voidJob(this._job.id);
            }
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
        }

        this.$mdDialog.hide();
    }

    /**
     * Cancel the dialog.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

angular.module("uDispatch").controller("AddEventDialogController", AddEventDialogController);
