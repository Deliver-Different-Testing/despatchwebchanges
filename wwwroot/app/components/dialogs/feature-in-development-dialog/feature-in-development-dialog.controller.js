import "./feature-in-development-dialog.styles.less";

/**
 * @fileoverview Controller for the Feature in Development Dialog
 * @module FeatureInDevelopmentDialogController
 */

/**
 * Controller for the Feature in Development Dialog
 * @class
 */
class FeatureInDevelopmentDialogController {
    /**
     * @type {string[]}
     * @static
     * @description List of dependencies to be injected.
     */
    static $inject = ["$mdDialog"];

    /**
     * Create a FeatureInDevelopmentDialogController.
     * @param {Object} $mdDialog - The AngularJS Material service for showing dialogs.
     */
    constructor($mdDialog) {
        this.$mdDialog = $mdDialog;
    }

    /**
     * Close the dialog
     */
    close() {
        this.$mdDialog.hide();
    }
}

angular.module("uDispatch").controller("FeatureInDevelopmentDialogController", FeatureInDevelopmentDialogController);
