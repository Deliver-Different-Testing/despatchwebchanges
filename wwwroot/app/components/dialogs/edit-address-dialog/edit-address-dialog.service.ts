import {AddressViewModel, EditAddressDialogViewModel} from "../../../interfaces/job.interface";
import EditAddressDialogController from "./edit-address-dialog.controller";
import {bindAllMethods} from "../../../bindAllMethods";
import {IDocumentService, IServiceProvider, material} from "angular";

export class EditAddressDialogService implements IServiceProvider {
    static $inject = [
        '$mdDialog',
        "$document"
    ];

    constructor(
        private $mdDialog: material.IDialogService,
        private $document: IDocumentService,
    ) {
        console.log('EditAddressDialogService: Service instantiated');
        bindAllMethods(this);
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
