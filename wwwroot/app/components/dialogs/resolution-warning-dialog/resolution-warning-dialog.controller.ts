import "./resolution-warning-dialog.styles.less";

class ResolutionWarningDialogController {
    static $inject = [
        '$mdDialog',
        'STORAGE_KEY',
        'MIN_WIDTH',
        'MIN_HEIGHT',
        'currentScreenWidth',
        'currentScreenHeight'
    ];

    constructor(
        private $mdDialog: angular.material.IDialogService,
        private STORAGE_KEY: string,
        public MIN_WIDTH: number,
        public MIN_HEIGHT: number,
        public currentScreenWidth: number,
        public currentScreenHeight: number,
    ) {}

    close(): void {
        this.$mdDialog.hide();
    }

    dismiss(): void {
        localStorage.setItem(this.STORAGE_KEY, 'true');
        this.$mdDialog.hide();
    }
}

export default ResolutionWarningDialogController;