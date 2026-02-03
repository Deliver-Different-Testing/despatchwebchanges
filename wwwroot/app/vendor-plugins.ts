// vendor-plugins.ts - Third-party plugins and app module setup
// This file is the entry point for the plugins vendor bundle
// Must be loaded AFTER vendor-core

// Style imports
import "../css/udispatch.less";
import "../css/toasts.less";
import "angular-resizable/angular-resizable.min.css";
import "ng-material-datetimepicker/css/material-datetimepicker.css";
import "angular-material-data-table/dist/md-data-table.css";
import "angular-hotkeys/build/hotkeys.css";

// Bootstrap (CSS only - JS not needed, using Angular Material for UI)
import "bootstrap/dist/css/bootstrap.css";

// Third-party Angular plugins
import "ngmap";
import "ng-file-upload";
import "angular-ui-sortable/dist/sortable";
import "angular-resizable/angular-resizable.min";
import "ng-material-datetimepicker/js/angular-material-datetimepicker";
import "angular-material-data-table";
import "angular-hotkeys/build/hotkeys";
import "angular-bootstrap-contextmenu/contextMenu";
import "angular-heremaps/dist/angular-heremaps";

// Local libs
import "../lib/ModernizerLocalStorage";

// React HereMap component
import {HereMapReactComponent} from "./react/components/common/here-map";

// React CourierMap component
import {CourierMapReactComponent} from "./react/components/common/courier-map";

// React DispatchMap component
import {DispatchMapReactComponent} from "./react/components/common/dispatch-map";

// Create the main Angular module
const app = angular.module("uDispatch", [
    "ui.router",
    "oc.lazyLoad",
    "angularResizable",
    "ui.sortable",
    "ui.bootstrap.contextMenu",
    "cfp.hotkeys",
    "ngMap",
    "heremaps",
    "ngAnimate",
    "ngMessages",
    "ngSanitize",
    "ngMaterial",
    "md.data.table",
    "ngFileUpload",
    "ngMaterialDatePicker"
]);

// Register React HereMap component
app.component("hereMapReact", HereMapReactComponent);

// Register React CourierMap component
app.component("courierMapReact", CourierMapReactComponent);

// Register React DispatchMap component
app.component("dispatchMapReact", DispatchMapReactComponent);

// Make the module available globally
(window as any).uDispatchApp = app;
