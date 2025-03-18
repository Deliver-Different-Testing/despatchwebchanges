import "./feature-in-development-dialog.styles.less";
import app from "../../../app";

export class FeatureInDevelopmentDialogController {
    static $inject = ["$mdDialog"];

    constructor(private $mdDialog: angular.material.IDialogService) {
        this.$mdDialog = $mdDialog;
    }

    close(): void {
        this.$mdDialog.hide();
    }
}
export default FeatureInDevelopmentDialogController;
