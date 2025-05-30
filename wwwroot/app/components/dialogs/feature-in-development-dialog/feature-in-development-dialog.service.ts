import FeatureInDevelopmentDialogController from "./feature-in-development-dialog.controller";
import {IDocumentService, material} from "angular";

export class FeatureInDevelopmentDialogService {
    static $inject = [
        "$mdDialog",
        "$document"
    ];

    constructor(
        private $mdDialog: material.IDialogService,
        private $document: IDocumentService,
    ) {
        console.log('InterCourierChargeDialogService: Service instantiated');
    }

    async openFeatureInDevelopmentDialog() {
        await this.$mdDialog.show({
            controller: FeatureInDevelopmentDialogController,
            controllerAs: "ctrl",
            template: require("./feature-in-development-dialog.html"),
            parent: this.$document.parent(),
            clickOutsideToClose: true,
            fullscreen: true
        });
    }
}
