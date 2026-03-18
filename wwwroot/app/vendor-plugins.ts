// vendor-plugins.ts - Third-party plugins and app module setup
// This file is the entry point for the plugins vendor bundle
// Must be loaded AFTER vendor-core

// Style imports
import "../css/udispatch.less";
import "../css/toasts.less";
import "angular-resizable/angular-resizable.min.css";
import "angular-material-data-table/dist/md-data-table.css";

// Third-party Angular plugins
import "ng-file-upload";
import "angular-ui-sortable/dist/sortable";
import "angular-resizable/angular-resizable.min";
import "angular-material-data-table";

// Bootstrap (CSS only - JS not needed, using Angular Material for UI)
import "bootstrap/dist/css/bootstrap.css";

// Local libs
import "../lib/ModernizerLocalStorage";

// React HereMap component
import {HereMapReactComponent} from "./react/components/common/here-map";

// React DispatchMap component
import {DispatchMapReactComponent} from "./react/components/common/dispatch-map";
import angular from "angular";

// Create the main Angular module
const app = angular.module("uDispatch", [
    "ui.router",
    "oc.lazyLoad",
    "angularResizable",
    "ui.sortable",
    "ngAnimate",
    "ngMessages",
    "ngSanitize",
    "ngMaterial",
    "md.data.table",
    "ngFileUpload"
]);

// Register React HereMap component
app.component("hereMapReact", HereMapReactComponent);

// Register React DispatchMap component
app.component("dispatchMapReact", DispatchMapReactComponent);

// Make the module available globally
window.uDispatchApp = app;
