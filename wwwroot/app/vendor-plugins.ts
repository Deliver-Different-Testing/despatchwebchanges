// vendor-plugins.ts - Third-party plugins and app module setup
// This file is the entry point for the plugins vendor bundle
// Must be loaded AFTER vendor-core

// Style imports
import "../css/udispatch.less";
import "../css/toasts.less";
import "../lib/ng-material-floating-button/mfb/dist/mfb.css";
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
import "../lib/ng-material-floating-button/src/mfb-directive";
import "../lib/ng-material-floating-button/mfb/dist/mfb";
import "../lib/angular-fixed-table-header/fixed-table-header";
import "../lib/google-maps-label/label";

// Custom here maps
import "../lib/here-map-tracking/here-map-tracking.module";
import "../lib/here-map-tracking/here-map-tracking.service";
import "../lib/here-map-tracking/here-map-tracking.component";

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
    "ng-mfb",
    "md.data.table",
    "ngFileUpload",
    "hereMapTracking.services",
    "hereMapTracking.components",
    "fixed.table.header",
    "ngMaterialDatePicker"
]);

// Make the module available globally
(window as any).uDispatchApp = app;
