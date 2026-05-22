// Side-effect-only module: registers every dayjs plugin that vendor-core (and
// the @mui/x-date-pickers AdapterDayjs it serves) requires at runtime.
//
// Imported by wwwroot/app/index.ts (vendor-core bundle) and by
// wwwroot/app/tests/vendor-core-dayjs.test.ts so both code paths share one
// source of truth — adding a plugin here propagates to both automatically.
//
// build.ts's createGlobalShimPlugin stubs `dayjs/plugin/*` imports to no-ops
// for non-vendor-core bundles, so these extends MUST live in vendor-core.
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import localizedFormat from "dayjs/plugin/localizedFormat";
import isoWeek from "dayjs/plugin/isoWeek";
import weekday from "dayjs/plugin/weekday";
import advancedFormat from "dayjs/plugin/advancedFormat";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isBetween from "dayjs/plugin/isBetween";
import weekOfYear from "dayjs/plugin/weekOfYear";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);
dayjs.extend(isoWeek);
dayjs.extend(weekday);
dayjs.extend(advancedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);
dayjs.extend(weekOfYear);
