// Side-effect-only module: registers every dayjs plugin and locale the app requires at
// runtime - the wall-clock date path (utc, timezone), @mantine/dates (isoWeek)
// and explicit-format parsing (customParseFormat), plus five more kept
// registered deliberately. See tests/dayjsSetup.test.ts for the contract.
//
// Imported first by react/app/main.tsx and by tests/dayjsSetup.test.ts so both
// share one source of truth.
import dayjs from "dayjs";
import "dayjs/locale/en";
import "dayjs/locale/en-nz";
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
dayjs.locale("en");
