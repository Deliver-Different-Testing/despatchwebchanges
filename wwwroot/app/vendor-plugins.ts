// vendor-plugins.ts - Third-party plugins and app module setup
// This file is the entry point for the plugins vendor bundle
// Must be loaded AFTER vendor-core

// Style imports
import "../css/udispatch.less";
import "../css/toasts.less";
import "angular-resizable/angular-resizable.min.css";
import "angular-material-data-table/dist/md-data-table.css";

// Third-party Angular plugins
import "angular-ui-sortable/dist/sortable";
import "angular-resizable/angular-resizable.min";
import "angular-material-data-table";

// Bootstrap was removed: its JS was never loaded, and across every AngularJS
// template and React component there were no Bootstrap class names left — the UI
// is Angular Material, Mantine and MUI. Its 280 KB of CSS shipped on every page
// for two class usages on one Razor error page, and its reboot actively fought
// the Mantine theme. Do not re-add it.

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
]);

// The React island components are registered from app.ts, not here. vendor-plugins
// loads BEFORE vendor-react, so it cannot resolve React/Mantine off the window
// globals — importing an island here makes esbuild inline a second copy of the
// Mantine runtime, giving the page two provider contexts that cannot see each other.

// Make the module available globally
window.uDispatchApp = app;
