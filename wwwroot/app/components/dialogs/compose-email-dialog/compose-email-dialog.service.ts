import ComposeEmailDialogController from "./compose-email-dialog.controller";
import IGroupEmailData from "../../driver-management-dashboard/interfaces/IGroupEmailData";
import IDriverEmail from "../../driver-management-dashboard/interfaces/IDriverEmail";
import angular from 'angular';

export class ComposeEmailDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        "$document",
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $document: angular.IDocumentService,
    ) {
        console.debug('ComposeEmailDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openComposeEmailDialog(
        $event: MouseEvent,
        selectedCouriers: IDriverEmail[],
        title: string = 'Compose Email',
        submitLabel: string = 'Send Email'
    ): Promise<IGroupEmailData | undefined> {
        try {
            // Initialize email data if not provided
            const initialEmailData: IGroupEmailData = {
                courierIds: selectedCouriers.map(courier => courier.courierId),
                subject: '',
                body: ''
            };

            const result: IGroupEmailData = await this.$mdDialog.show({
                controller: ComposeEmailDialogController,
                controllerAs: 'ctrl',
                template: require("./compose-email-dialog.template.html"),
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: false,
                escapeToClose: true,
                fullscreen: true,
                locals: {
                    emailData: initialEmailData,
                    title,
                    submitLabel,
                    selectedCouriers
                }
            });

            console.debug('ComposeEmailDialogService: Email data result', result);
            return result;
        } catch (error) {
            if (error === undefined) {
                console.debug('User cancelled email dialog');
                return;
            }

            // Error occurred
            console.error('ComposeEmailDialogService: Error in openComposeEmailDialog', error);
            throw error;
        }
    }
}