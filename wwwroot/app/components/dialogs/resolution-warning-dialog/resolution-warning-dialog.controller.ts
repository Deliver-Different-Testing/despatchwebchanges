import "./resolution-warning-dialog.styles.less";

class ResolutionWarningDialogController {
    static $inject = [
        '$mdDialog',
        'STORAGE_KEY'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private STORAGE_KEY: string
    ) {
        console.log('ResolutionWarningDialogController: Controller instantiated');
    }

    close(): void {
        this.$mdDialog.hide();
    }

    dismiss(): void {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        this.$mdDialog.hide();
    }
}

export default ResolutionWarningDialogController;