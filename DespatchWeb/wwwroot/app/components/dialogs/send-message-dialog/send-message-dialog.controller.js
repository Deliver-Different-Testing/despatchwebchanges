class SendMessageDialogController {
    static $inject = [
        '$mdDialog',
        'DispatchData',
        'toastrService',
        'selectedCourierId',
        'contactId',
        'dispatcherName'
    ];

    /**
     * @param $mdDialog
     * @param DispatchData
     * @param toastrService
     * @param {number} selectedCourierId
     * @param {number} contactId
     * @param {string} dispatcherName
     */
    constructor($mdDialog, DispatchData, toastrService, selectedCourierId, contactId, dispatcherName) {
        this._$mdDialog = $mdDialog;
        this._dispatchData = DispatchData;
        this._toastrService = toastrService;
        this._selectedCourierId = selectedCourierId;
        this._contactId = contactId;
        this._dispatcherName = dispatcherName;

        this.isLoading = false;
        this.message = "";
    }

    /**
     * @param {string} message
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

    cancel() {
        this._$mdDialog.cancel();
    }
}

angular.module('uDispatch').controller('SendMessageDialogController', SendMessageDialogController);
