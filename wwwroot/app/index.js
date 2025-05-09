"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Style imports
require("../css/udispatch.less");
require("../css/material3.less");
require("../css/toasts.less");
require("../css/promiseButton.css");
require("../lib/ng-material-floating-button/mfb/dist/mfb.css");
require("../lib/material-time-picker/md-time-picker.css");
require("../lib/hotkeys/hotkeys.css");
// Local libs
require("../lib/material-time-picker/md-time-picker.min.js");
require("../lib/ng-material-floating-button/src/mfb-directive.min.js");
require("../lib/ng-material-floating-button/mfb/dist/mfb");
require("../lib/hotkeys/hotkeys.min.js");
require("../lib/timepickerdirective.min.js");
// Custom here maps
require("../lib/here-map-tracking/here-map-tracking.module.js");
require("../lib/here-map-tracking/here-map-tracking.service.js");
require("../lib/here-map-tracking/here-map-tracking.component.js");
// Dispatch Web app
require("./app");
require("./filters");
require("./directives");
require("./materialTheme");
require("./routes");
// Service imports
require("./services");
require("./components");
