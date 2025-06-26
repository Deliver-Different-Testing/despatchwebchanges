import MegaMapComponent from "./mega-map.controller";
import OverviewService from "../overview/overview.service";

const megaMapModule = angular.module('uDispatch.megaMap', [
    'ngMap',
    'heremaps',
    'ui.router',
    'ngMaterial',
    'ngAnimate',
    'ngAria',
    'ngMessages',
    'md.data.table',
    'ui.sortable',
    'angularResizable',
    'ui.bootstrap.contextMenu'
]);

megaMapModule
    .component("megaMapComponent", MegaMapComponent)
    .service("overviewService", OverviewService);

export default megaMapModule;