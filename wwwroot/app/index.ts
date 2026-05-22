// vendor-core.ts - Angular core and essential dependencies
// This file is the entry point for the core vendor bundle

// Shared libraries - expose globally to avoid duplication in module bundles
import dayjs from "dayjs";
import "./vendor-core-dayjs";
import "dayjs/locale/en";
import * as windowsIana from "windows-iana";
dayjs.locale("en");
window.dayjs = dayjs;
window.windowsIana = windowsIana;

// Angular core
import "angular";
import "angular-animate";
import "angular-aria";
import "angular-messages";
import "angular-sanitize";
import "angular-material";
import "@uirouter/angularjs";
import "oclazyload";
