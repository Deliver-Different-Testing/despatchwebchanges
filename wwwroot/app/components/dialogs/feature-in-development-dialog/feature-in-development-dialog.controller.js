"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeatureInDevelopmentDialogController = void 0;
require("./feature-in-development-dialog.styles.less");
class FeatureInDevelopmentDialogController {
    constructor($mdDialog) {
        this.$mdDialog = $mdDialog;
        this.$mdDialog = $mdDialog;
    }
    close() {
        this.$mdDialog.hide();
    }
}
exports.FeatureInDevelopmentDialogController = FeatureInDevelopmentDialogController;
FeatureInDevelopmentDialogController.$inject = ["$mdDialog"];
exports.default = FeatureInDevelopmentDialogController;
