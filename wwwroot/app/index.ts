// vendor-core.ts - Angular core and essential dependencies
// This file is the entry point for the core vendor bundle

// Shared libraries - expose globally to avoid duplication in module bundles
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import * as windowsIana from "windows-iana";
dayjs.extend(utc);
dayjs.extend(timezone);
(window as any).dayjs = dayjs;
(window as any).windowsIana = windowsIana;

// Angular core
import "angular";
import "angular-animate";
import "angular-aria";
import "angular-messages";
import "angular-sanitize";
import "angular-material";
import "@uirouter/angularjs";
import "oclazyload";
