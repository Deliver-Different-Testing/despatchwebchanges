import CourierMapComponent from "./courier-map.controller";

const courierMapModule = angular.module('uDispatch.courierMap', [
    'heremaps',
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
]);

courierMapModule
    .component("courierMapComponent", CourierMapComponent);

export default courierMapModule;
