/**
 * @class SendMessageDialogController
 * @description Controller for the Send Message dialog in the uDispatch Angular module.
 * This controller handles the logic for sending SMS messages to couriers.
 */
class SendMessageDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = [
        '$mdDialog',
        'DispatchData',
        'toastrService',
        'selectedCourierId',
        'contactId',
        'dispatcherName'
    ];

    /**
     * Creates an instance of SendMessageDialogController.
     * @constructor
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     * @param {Object} DispatchData - The service used for data dispatching and sending SMS.
     * @param {Object} toastrService - The service to display toast messages.
     * @param {number} selectedCourierId - The ID of the selected courier to send the message to.
     * @param {number} contactId - The ID of the contact associated with the message.
     * @param {string} dispatcherName - The name of the dispatcher sending the message.
     */
    constructor($mdDialog, DispatchData, toastrService, selectedCourierId, contactId, dispatcherName) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;
        this._selectedCourierId = selectedCourierId;
        this._contactId = contactId;
        this._dispatcherName = dispatcherName;

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

            await this._dispatchData.sendSMS(this._selectedCourierId, this._contactId, this._dispatcherName, message);

            this._toastrService.showSuccessToast("Message sent!");
        } catch (error) {
            this._toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
            this._$mdDialog.hide();
        }
    }

    /**
     * Cancels the send message operation and closes the dialog.
     */
    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('SendMessageDialogController', SendMessageDialogController);
