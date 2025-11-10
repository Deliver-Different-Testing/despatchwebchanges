
// Style imports
import "../css/udispatch.less";
import "../css/toasts.less";
import "../lib/ng-material-floating-button/mfb/dist/mfb.css";
import "angular-resizable/angular-resizable.min.css";
import "ng-material-datetimepicker/css/material-datetimepicker.css";
import "angular-material-data-table/dist/md-data-table.css";
import "angular-hotkeys/build/hotkeys.css";
import 'angular-gridster/dist/angular-gridster.min.css';

// Angular core imports
import "angular";
import "angular-animate";
import "angular-aria";
import "angular-messages";
import "angular-sanitize";
import "angular-material";
import "@uirouter/angularjs";
import "oclazyload";

// Bootstrap
import "bootstrap";

// Npm packages
import "angular-ui-bootstrap/dist/ui-bootstrap-tpls";
import "ngmap";
import "ng-file-upload";
import "angular-ui-sortable/dist/sortable";
import "angular-resizable/angular-resizable.min";
import "ng-material-datetimepicker/js/angular-material-datetimepicker";
import "angular-material-data-table";
import "angular-hotkeys/build/hotkeys";
import "angular-bootstrap-contextmenu/contextMenu";
import "angular-heremaps/dist/angular-heremaps";
import 'angular-gridster/dist/angular-gridster.min';

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

const app = angular.module("uDispatch", [
    "ui.router",
    "oc.lazyLoad",
    "gridster",
    "angularResizable",
    "ui.sortable",
    "ui.bootstrap",
    "ui.bootstrap.pagination",
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
