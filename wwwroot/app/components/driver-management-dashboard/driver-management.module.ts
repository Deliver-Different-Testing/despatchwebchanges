import DriverManagementService from "./driver-management.service";
import DriverManagementComponent from "./driver-management.component";
import ComposeEmailDialogController from "../dialogs/compose-email-dialog/compose-email-dialog.controller";
import {ComposeEmailDialogService} from "../dialogs/compose-email-dialog/compose-email-dialog.service";

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

driverManagementModule
    .service("driverManagementService", DriverManagementService)
    .service("composeEmailDialogService", ComposeEmailDialogService);

export default driverManagementModule;