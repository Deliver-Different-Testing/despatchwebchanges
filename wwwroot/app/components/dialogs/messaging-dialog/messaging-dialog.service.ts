import MessagingDialogController from "./messaging-dialog.controller";

class MessagingDialogService implements angular.IServiceProvider {
    static $inject = [
        '$mdDialog',
        '$log',
        '$document'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private $log: angular.ILogService,
        private $document: angular.IDocumentService,
    ) {
        this.$log.debug('MessagingDialogService: Service instantiated');
    }

    $get() {
        return this;
    }

    async openMessagingDialog($event?: MouseEvent) {
        try {
            await this.$mdDialog.show({
                controller: MessagingDialogController,
                controllerAs: 'ctrl',
                template: require("./messaging-dialog.template.html"),
                parent: this.$document.parent(),
                targetEvent: $event,
                clickOutsideToClose: false,
                escapeToClose: true,
                fullscreen: true,
                locals: {},
                bindToController: true,
            });

            this.$log.debug('MessagingDialogService: Dialog closed!');
        } catch (error) {
            if(error === undefined) {
                this.$log.debug('User closed messaging dialog');
                return;
            }

            // Error occurred
            console.error('MessagingDialogService: Error in openMessagingDialog', error);
            throw error;
        }
    }
}

export default MessagingDialogService;