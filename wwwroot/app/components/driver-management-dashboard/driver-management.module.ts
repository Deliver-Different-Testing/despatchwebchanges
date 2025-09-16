import DriverManagementService from "./driver-management.service";
import DriverManagementComponent from "./driver-management.component";

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
    .service("driverManagementService", DriverManagementService);

export default driverManagementModule;