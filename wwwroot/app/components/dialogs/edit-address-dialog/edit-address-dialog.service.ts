import {AddressViewModel, EditAddressDialogViewModel} from "../../../interfaces/job.interface";
import EditAddressDialogController from "./edit-address-dialog.controller";

export class EditAddressDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        "$document"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.log('EditAddressDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openEditAddressDialog($event: MouseEvent, addressDetails: AddressViewModel, title: string = 'Edit Address', submitLabel: string = 'Save') {
        try {
            const newAddress: EditAddressDialogViewModel = await this.$mdDialog.show({
                controller: EditAddressDialogController,
                controllerAs: 'ctrl',
                template: require("./edit-address-dialog.html"),
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: false,
                escapeToClose: true,
                locals: {
                    addressDetails,
                    title,
                    submitLabel
                }
            });

            console.log('EditAddressDialogService: newAddress', newAddress);
            return newAddress;
        } catch (error) {
            if(error === undefined) {
                return;
            }

            // Error occured
            console.error('EditAddressDialogService: Error in openEditAddressDialog', error);
            throw error;
        }
    }
}
