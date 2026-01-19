// vendor-core.ts - Angular core and essential dependencies
// This file is the entry point for the core vendor bundle

// Shared libraries - expose globally to avoid duplication in module bundles
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import localizedFormat from "dayjs/plugin/localizedFormat";
import isoWeek from "dayjs/plugin/isoWeek";
import weekday from "dayjs/plugin/weekday";
import "dayjs/locale/en";
import * as windowsIana from "windows-iana";
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.locale("en");
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
