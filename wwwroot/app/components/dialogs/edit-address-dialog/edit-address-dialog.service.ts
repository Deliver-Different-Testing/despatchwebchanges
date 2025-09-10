import {IAddressViewModel, IEditAddressDialogViewModel} from "../../../interfaces/job.interface";
import EditAddressDialogController from "./edit-address-dialog.controller";
import {IDocumentService, IServiceProvider, material} from "angular";

export class EditAddressDialogService implements IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$log',
        "$document",
    ];

    constructor(
        private $mdDialog: material.IDialogService,
        private $log: angular.ILogService,
        private $document: IDocumentService,
    ) {
        this.$log.debug('EditAddressDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openEditAddressDialog(addressDetails: IAddressViewModel, $event?: MouseEvent,
                                title: string = 'Edit Address', submitLabel: string = 'Save',
                                showContactInfo: boolean = false): Promise<IEditAddressDialogViewModel | undefined> {
        try {
            const newAddress: IEditAddressDialogViewModel = await this.$mdDialog.show({
                controller: EditAddressDialogController,
                controllerAs: 'ctrl',
                template: require("./edit-address-dialog.template.html"),
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

            this.$log.debug('EditAddressDialogService: newAddress', newAddress);
            return newAddress;
        } catch (error) {
            if (error === undefined) {
                this.$log.debug('User closed dialog');
                return;
            }

            // Error occurred
            this.$log.error('EditAddressDialogService: Error in openEditAddressDialog', error);
            throw error;
        }
    }
}
