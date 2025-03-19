import {AddressViewModel, EditAddressDialogViewModel, IJob} from "../../../interfaces/job.interface";
import EditAddressDialogController from "./edit-address-dialog.controller";

export class EditAddressDialogService {
    static $inject = [
        '$mdDialog', "DispatchData"
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
    ) {
        console.log('EditAddressDialogService: Service instantiated');
    }

    async openEditAddressDialog($event: MouseEvent, addressDetails: AddressViewModel, title: string = 'Edit Address', submitLabel: string = 'Save') {
        try {
            const newAddress: EditAddressDialogViewModel = await this.$mdDialog.show({
                controller: EditAddressDialogController,
                controllerAs: 'ctrl',
                template: require("./edit-address-dialog.html"),
                parent: document.body,
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
