import "./feature-in-development-dialog.styles.less";

export class FeatureInDevelopmentDialogController {
    static $inject = ["$mdDialog"];

    constructor(
        private $mdDialog: angular.material.IDialogService
    ) {
        this.$mdDialog = $mdDialog;
    }

    close(): void {
        this.$mdDialog.hide();
    }
}
export default FeatureInDevelopmentDialogController;
