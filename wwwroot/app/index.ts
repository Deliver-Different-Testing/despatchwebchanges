// vendor-core: shared libraries exposed as window globals so the SPA bundle does not duplicate them.
import dayjs from "dayjs";
import "./vendor-core-dayjs";
import "dayjs/locale/en";
import "dayjs/locale/en-nz";
import * as windowsIana from "windows-iana";
dayjs.locale("en");
window.dayjs = dayjs;
window.windowsIana = windowsIana;
