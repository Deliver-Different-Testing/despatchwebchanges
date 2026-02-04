import MegaMapComponent from "./mega-map.controller";
import OverviewService from "../overview/overview.service";
import angular from 'angular';

const megaMapModule = angular.module('uDispatch.megaMap', [
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