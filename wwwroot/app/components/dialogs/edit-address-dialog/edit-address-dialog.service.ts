import {AddressViewModel, EditAddressDialogViewModel} from "../../../interfaces/job.interface";
import EditAddressDialogController from "./edit-address-dialog.controller";
import {IDocumentService, IServiceProvider, material} from "angular";
import {bindAllMethods} from "../../../functions/bindAllMethods";

export class EditAddressDialogService implements IServiceProvider {
    static $inject = [
        '$mdDialog',
        "$document",
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

    async openEditAddressDialog(addressDetails: AddressViewModel, $event?: MouseEvent,
                                title: string = 'Edit Address', submitLabel: string = 'Save',
                                showContactInfo: boolean = false): Promise<EditAddressDialogViewModel | undefined> {
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
                    submitLabel,
                    showContactInfo
                }
            });

            console.log('EditAddressDialogService: newAddress', newAddress);
            return newAddress;
        } catch (error) {
            if (error === undefined) {
                return;
            }

            // Error occurred
            console.error('EditAddressDialogService: Error in openEditAddressDialog', error);
            throw error;
        }
    }
}
