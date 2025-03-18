import app from "../../../app";
import template from "./feature-in-development-dialog.html";

export class FeatureInDevelopmentDialogService {
    static $inject = ["$mdDialog"];

    constructor(private $mdDialog: angular.material.IDialogService) {
    }

    async openFeatureInDevelopmentDialog() {
        await this.$mdDialog.show({
            controller: "FeatureInDevelopmentDialogController",
            controllerAs: "ctrl",
            template: template,
            parent: document.body,
            clickOutsideToClose: true,
            fullscreen: true
        });
    }
}
