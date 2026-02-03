/**
 * Courier Map Module
 *
 * AngularJS module for the courier map page.
 * The actual map functionality is implemented in React (CourierMapReact component).
 */

const courierMapModule = angular.module('uDispatch.courierMap', [
    'ui.router',
]);

// Minimal component that renders the template with React components
const CourierMapComponent: angular.IComponentOptions = {
    template: require("./courier-map.template.html"),
};

courierMapModule.component("courierMapComponent", CourierMapComponent);

export default courierMapModule;
