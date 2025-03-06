import "./feature-in-development-dialog.styles.less";
import app from "../../../app";

class FeatureInDevelopmentDialogController {
    static $inject = ["$mdDialog"];

    constructor(private $mdDialog: angular.material.IDialogService) {
        this.$mdDialog = $mdDialog;
    }

    close(): void {
        this.$mdDialog.hide();
    }
}

app.controller("FeatureInDevelopmentDialogController", FeatureInDevelopmentDialogController);
