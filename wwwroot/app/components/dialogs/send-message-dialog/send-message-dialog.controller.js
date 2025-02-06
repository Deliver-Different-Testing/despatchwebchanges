import app from "../../../app";

class SendMessageDialogController {
    static $inject = [
        "$mdDialog",
        "DispatchData",
        "toastrService",
        "selectedCourierId",
        "contactId",
        "dispatcherName"
    ];

    /**
     * Creates an instance of SendMessageDialogController.
     * @constructor
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} dispatchData - The service used for data dispatching and sending SMS.
     * @param {Object} toastrService - The service to display toast messages.
     * @param {number} selectedCourierId - The ID of the selected courier to send the message to.
     * @param {number} contactId - The ID of the contact associated with the message.
     * @param {string} dispatcherName - The name of the dispatcher sending the message.
     */
    constructor($mdDialog, dispatchData, toastrService, selectedCourierId, contactId, dispatcherName) {
        this.$mdDialog = $mdDialog;
        this.dispatchData = dispatchData;
        this.toastrService = toastrService;
        this.selectedCourierId = selectedCourierId;
        this.contactId = contactId;
        this.dispatcherName = dispatcherName;

        /** @type {boolean} Indicates whether a message is currently being sent */
        this.isLoading = false;

        /** @type {string} The message to be sent */
        this.message = "";
    }

    /**
     * Submits the message to be sent as an SMS.
     * @async
     * @param {string} message - The message content to be sent.
     * @returns {Promise<void>}
     */
    async submit(message) {
        try {
            this.isLoading = true;

            await this.dispatchData.sendSMS(this.selectedCourierId, this.contactId, this.dispatcherName, message);

            this.toastrService.showSuccessToast("Message sent!");
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
            this.$mdDialog.hide();
        }
    }

    /**
     * Cancels the send message operation and closes the dialog.
     */
    cancel() {
        this.$mdDialog.cancel();
    }
}

app.controller("SendMessageDialogController", SendMessageDialogController);
