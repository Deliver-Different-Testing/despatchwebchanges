class SendMessageDialogController {
    constructor($mdDialog, DispatchData, toastrService, selectedCourierId) {
        this.$mdDialog = $mdDialog;
        this.DispatchData = DispatchData;
        this.toastrService = toastrService;
        this._selectedCourierId = selectedCourierId;

        this.isLoading = false;
        this.message = "";
    }

    async submit(message) {
        try {
            this.isLoading = true;

            await this.DispatchData.sendSMS(this._selectedCourierId, ContactID, FirstName, message);

            this.toastrService.showSuccessToast("Message Sent!");
        } catch (error) {
            this.toastrService.showErrorToast(error.message);
        } finally {
            this.isLoading = false;
            this.$mdDialog.hide();
        }
    }

    cancel() {
        this.$mdDialog.cancel();
    }
}
