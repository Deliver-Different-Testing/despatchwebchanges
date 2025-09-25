import DriverManagementService from "./driver-management.service";
import DriverManagementComponent from "./driver-management.component";
import ComposeEmailDialogController from "../dialogs/compose-email-dialog/compose-email-dialog.controller";
import {ComposeEmailDialogService} from "../dialogs/compose-email-dialog/compose-email-dialog.service";
import EditAfterhoursDialogService from "../dialogs/edit-afterhours-dialog/edit-afterhours-dialog.service";
import EditAfterhoursDialogController from "../dialogs/edit-afterhours-dialog/edit-afterhours-dialog.controller";

const driverManagementModule = angular.module('uDispatch.driverManagementModule', [
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'md.data.table'
]);

driverManagementModule
    .component("driverManagementComponent", DriverManagementComponent);

driverManagementModule
    .controller("composeEmailDialogController", ComposeEmailDialogController)
    .controller('editAfterhoursDialogController', EditAfterhoursDialogController);

driverManagementModule
    .service("driverManagementService", DriverManagementService)
    .service("composeEmailDialogService", ComposeEmailDialogService)
    .service('editAfterhoursDialogService', EditAfterhoursDialogService);

export default driverManagementModule;