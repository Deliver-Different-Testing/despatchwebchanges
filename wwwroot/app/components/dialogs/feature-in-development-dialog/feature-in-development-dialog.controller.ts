import "./feature-in-development-dialog.styles.less";
import {material} from "angular";

export class FeatureInDevelopmentDialogController {
    static $inject = ["$mdDialog"];

    constructor(
        private $mdDialog: material.IDialogService
    ) {
        this.$mdDialog = $mdDialog;
    }

    close(): void {
        this.$mdDialog.hide();
    }
}
export default FeatureInDevelopmentDialogController;
