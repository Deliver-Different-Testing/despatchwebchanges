/**
 * Shared formatting helpers for inter-tenant job change requests.
 *
 * The backend stores `fieldName` as the JobChangeField enum string
 * (e.g. `PartnerAgreedRate`) and `currentValue` / `requestedValue` as raw
 * strings. Several fields encode richer payloads (addresses as JSON, prices
 * as decimals, dates as ISO timestamps) that need to be unpacked before the
 * value is shown to a human.
 *
 * Used by:
 *  - JobChangeRequestsForJob (per-job history panel)
 *  - JobChangeRequestDialog (helper hint + summary)
 *  - The Partner Approvals inbox
 *  - In-place pending badges on Job Details cards
 */

import {formatCurrency} from '../../utils/currencyUtils';
import {
    formatLongDateTime,
    getIanaTimezone,
    getTenantTimezone,
    getTimezoneAbbreviation,
    isUsCustomer,
    parseDateFromApi,
} from '../../utils/dateUtils';

export type JobChangeRequestCategory =
    | 'note'
    | 'reference'
    | 'contact'
    | 'tracking'
    | 'address'
    | 'rate'
    | 'commercial'
    | 'packages'
    | 'datetime'
    | 'flag';

export interface JobChangeRequestFieldMeta {
    /** Human-readable label shown in headings and badges. */
    label: string;
    /** Short helper line used in the dialog's "what does this do?" hint. */
    hint: string;
    /** Group bucket — used for grouping and color/icon mapping. */
    category: JobChangeRequestCategory;
    /** Approval mode under the v1 policy. */
    mode: 'auto' | 'manual';
    /** True for fields the policy flags `RequiresCommercialRefresh`. */
    commercial: boolean;
    /** Single-character icon glyph rendered next to the label. */
    glyph: string;
}

/**
 * Closed set mirroring DespatchWeb.Enums.JobChangeField. Keep in sync with the
 * backend enum AND with JobChangePolicyService.Evaluate. New fields added to
 * either must land here too or they render as the raw enum token.
 */
export const FIELD_META: Record<string, JobChangeRequestFieldMeta> = {
    // Auto — notes family
    Notes: {
        label: 'Notes',
        hint: 'Replaces the job notes immediately on both sides',
        category: 'note',
        mode: 'auto',
        commercial: false,
        glyph: '✎',
    },
    ProgressNote: {
        label: 'Progress Note',
        hint: 'Appended to job notes immediately on both sides',
        category: 'note',
        mode: 'auto',
        commercial: false,
        glyph: '✎',
    },
    PodNote: {
        label: 'POD Note',
        hint: 'Appended to job notes immediately on both sides',
        category: 'note',
        mode: 'auto',
        commercial: false,
        glyph: '✎',
    },

    // Auto — customer-visible non-rated
    ConNote: {
        label: 'Consignment Note',
        hint: 'Applies immediately; syncs to the partner',
        category: 'reference',
        mode: 'auto',
        commercial: false,
        glyph: '#',
    },
    RefA: {
        label: 'Reference A',
        hint: 'Applies immediately; syncs to the partner',
        category: 'reference',
        mode: 'auto',
        commercial: false,
        glyph: '#',
    },
    RefB: {
        label: 'Reference B',
        hint: 'Applies immediately; syncs to the partner',
        category: 'reference',
        mode: 'auto',
        commercial: false,
        glyph: '#',
    },
    OurRef: {
        label: 'Our Reference',
        hint: 'Applies immediately; syncs to the partner',
        category: 'reference',
        mode: 'auto',
        commercial: false,
        glyph: '#',
    },
    Attention: {
        label: 'Attention Flag',
        hint: 'Applies immediately; syncs to the partner',
        category: 'flag',
        mode: 'auto',
        commercial: false,
        glyph: '⚑',
    },
    TrackingMobile: {
        label: 'Tracking Mobile',
        hint: 'Applies immediately; syncs to the partner',
        category: 'tracking',
        mode: 'auto',
        commercial: false,
        glyph: '📱',
    },
    TrackingEmail: {
        label: 'Tracking Email',
        hint: 'Applies immediately; syncs to the partner',
        category: 'tracking',
        mode: 'auto',
        commercial: false,
        glyph: '✉',
    },
    TrackingMethod: {
        label: 'Tracking Method',
        hint: 'Applies immediately; syncs to the partner',
        category: 'tracking',
        mode: 'auto',
        commercial: false,
        glyph: '📡',
    },
    Barcode: {
        label: 'Barcode',
        hint: 'Applies immediately; syncs to the partner',
        category: 'reference',
        mode: 'auto',
        commercial: false,
        glyph: '#',
    },
    DeliverToLeaveID: {
        label: 'Signature Requirement',
        hint: 'Applies immediately; syncs to the partner',
        category: 'flag',
        mode: 'auto',
        commercial: false,
        glyph: '⚑',
    },

    // Manual — contact fields (no commercial refresh)
    FromContactName: {
        label: 'Pickup Contact Name',
        hint: 'Requires partner approval',
        category: 'contact',
        mode: 'manual',
        commercial: false,
        glyph: '👤',
    },
    FromContactPhone: {
        label: 'Pickup Contact Phone',
        hint: 'Requires partner approval',
        category: 'contact',
        mode: 'manual',
        commercial: false,
        glyph: '☎',
    },
    ToContactName: {
        label: 'Delivery Contact Name',
        hint: 'Requires partner approval',
        category: 'contact',
        mode: 'manual',
        commercial: false,
        glyph: '👤',
    },
    ToContactPhone: {
        label: 'Delivery Contact Phone',
        hint: 'Requires partner approval',
        category: 'contact',
        mode: 'manual',
        commercial: false,
        glyph: '☎',
    },

    // Manual — commercial / operational
    PartnerAgreedRate: {
        label: 'Agreed Rate',
        hint: 'Requires partner approval; locked after settlement',
        category: 'rate',
        mode: 'manual',
        commercial: true,
        glyph: '$',
    },
    Quantity: {
        label: 'Quantity',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'commercial',
        mode: 'manual',
        commercial: true,
        glyph: '#',
    },
    Speed: {
        label: 'Service Speed',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'commercial',
        mode: 'manual',
        commercial: true,
        glyph: '⏱',
    },
    Date: {
        label: 'Date',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'datetime',
        mode: 'manual',
        commercial: true,
        glyph: '📅',
    },
    Time: {
        label: 'Time',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'datetime',
        mode: 'manual',
        commercial: true,
        glyph: '🕒',
    },
    PuTime: {
        label: 'Pickup Time',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'datetime',
        mode: 'manual',
        commercial: true,
        glyph: '🕒',
    },
    DeliverBy: {
        label: 'Deliver By',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'datetime',
        mode: 'manual',
        commercial: true,
        glyph: '🕒',
    },
    BookedTime: {
        label: 'Booked Time',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'datetime',
        mode: 'manual',
        commercial: true,
        glyph: '📅',
    },
    AcceptedJobTypeID: {
        label: 'Job Type',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'commercial',
        mode: 'manual',
        commercial: true,
        glyph: '⚙',
    },
    Direct: {
        label: 'Direct Flag',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'flag',
        mode: 'manual',
        commercial: true,
        glyph: '⚑',
    },
    DGClass: {
        label: 'Dangerous Goods Class',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'flag',
        mode: 'manual',
        commercial: true,
        glyph: '⚠',
    },
    DGDocumentation: {
        label: 'Dangerous Goods Documentation',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'flag',
        mode: 'manual',
        commercial: true,
        glyph: '⚠',
    },
    Packages: {
        label: 'Packages',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'packages',
        mode: 'manual',
        commercial: true,
        glyph: '📦',
    },
    PickupAddress: {
        label: 'Pickup Address',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'address',
        mode: 'manual',
        commercial: true,
        glyph: '📍',
    },
    DeliveryAddress: {
        label: 'Delivery Address',
        hint: 'Requires partner approval; re-rates on approval',
        category: 'address',
        mode: 'manual',
        commercial: true,
        glyph: '📍',
    },
};

/** Lookup with safe fallback to a humanised version of the raw enum token. */
export function getFieldMeta(fieldName: string): JobChangeRequestFieldMeta {
    const meta = FIELD_META[fieldName];
    if (meta) return meta;
    // Fall back gracefully so a backend-added field doesn't render as garbage.
    return {
        label: fieldName.replace(/([a-z])([A-Z])/g, '$1 $2'),
        hint: 'Requires partner approval',
        category: 'flag',
        mode: 'manual',
        commercial: false,
        glyph: '•',
    };
}

/**
 * Render a raw value string from `tucJobChangeRequest.UjcrCurrentValue` /
 * `UjcrRequestedValue` as a human-friendly string.
 *
 * Addresses arrive as JSON blobs — we deserialise and produce a compact
 * one-line representation. Rates render as currency. IDs we can't resolve
 * locally (e.g. SpeedID) pass through, but the dialog and badges hydrate
 * them with the proper display name before calling this when they can.
 */
export function formatChangeRequestValue(fieldName: string, value: string | null | undefined): string {
    return formatChangeRequestValueWithTz(fieldName, value);
}

/**
 * Same as {@link formatChangeRequestValue} but accepts a timezone-text for
 * datetime-category fields so the rendered value carries its TZ context
 * (e.g. `15/Mar/2025 14:30 (NZDT)`). Other categories pass through. Falls
 * back to the tenant timezone when no value is provided.
 */
export function formatChangeRequestValueWithTz(
    fieldName: string,
    value: string | null | undefined,
    timezoneText?: string,
): string {
    if (value == null || value === '') return '—';
    const meta = getFieldMeta(fieldName);
    switch (meta.category) {
        case 'address':
            return formatAddressBlob(value);
        case 'rate':
            return formatRateValue(value);
        case 'datetime':
            return formatDateTimeValue(value, timezoneText);
        case 'flag':
            return formatFlagValue(value);
        case 'packages':
            return formatPackagesBlob(value);
        default:
            return value;
    }
}

/**
 * Which side of the job a datetime field belongs to. `DeliverBy` is the
 * delivery-side deadline; everything else (pickup time, booked/ready time,
 * the generic `Date`/`Time` fields) lives on the pickup side, matching
 * the existing JobDetails handlers (e.g. `handleReadyClick` uses
 * `j.pickUpTimeZone`).
 */
export type JobTimezoneSide = 'pickup' | 'delivery';

export function datetimeFieldSide(fieldName: string): JobTimezoneSide {
    return fieldName === 'DeliverBy' ? 'delivery' : 'pickup';
}

/**
 * Format the `requestedAt` audit timestamp for the hover tooltip on the
 * relative-age caption. Always renders in the tenant timezone with the
 * abbreviation so dispatchers across regions see a consistent reference.
 */
export function formatRequestedAtTooltip(isoDate: string): string {
    const parsed = parseDateFromApi(isoDate);
    if (!parsed.isValid()) return isoDate;
    const tz = getTenantTimezone();
    const inZone = parsed.tz(getIanaTimezone(tz));
    const formatted = formatLongDateTime(inZone);
    const abbrev = getTimezoneAbbreviation(tz);
    return abbrev ? `${formatted} ${abbrev}` : formatted;
}

/**
 * The backend serialises `AddressViewModel` (8 generic addressLine slots plus
 * `fullAddress`). `fullAddress` is the human form when populated; otherwise
 * we join non-empty lines with " · ".
 */
interface AddressLike {
    addressLine1?: string;
    addressLine2?: string;
    addressLine3?: string;
    addressLine4?: string;
    addressLine5?: string;
    addressLine6?: string;
    addressLine7?: string;
    addressLine8?: string;
    fullAddress?: string;
}

function formatAddressBlob(value: string): string {
    try {
        const parsed = JSON.parse(value) as AddressLike;
        if (parsed.fullAddress?.trim()) return parsed.fullAddress;
        return [
            parsed.addressLine1, parsed.addressLine2, parsed.addressLine3, parsed.addressLine4,
            parsed.addressLine5, parsed.addressLine6, parsed.addressLine7, parsed.addressLine8,
        ].filter(line => line && line.trim()).join(' · ');
    } catch {
        return value;
    }
}

/**
 * Multi-line form of {@link formatAddressBlob} for side-by-side address
 * comparisons in the pending-changes card. Prefers the addressLine1..8 slots
 * when present (they already represent rows), and only falls back to
 * splitting `fullAddress` on commas/newlines when no per-line data exists.
 */
export function formatAddressLines(value: string | null | undefined): string[] {
    if (value == null || value === '') return [];
    try {
        const parsed = JSON.parse(value) as AddressLike;
        const lines = [
            parsed.addressLine1, parsed.addressLine2, parsed.addressLine3, parsed.addressLine4,
            parsed.addressLine5, parsed.addressLine6, parsed.addressLine7, parsed.addressLine8,
        ].filter((line): line is string => !!line && line.trim().length > 0);
        if (lines.length > 0) return lines;
        if (parsed.fullAddress?.trim()) {
            return parsed.fullAddress.split(/\r?\n|,\s*/).map(s => s.trim()).filter(Boolean);
        }
        return [];
    } catch {
        return [value];
    }
}

function formatRateValue(value: string): string {
    const num = Number(value);
    if (Number.isFinite(num)) return formatCurrency(num);
    return value;
}

/**
 * Format a datetime-category value, optionally projected into a specific
 * timezone. The timezone abbreviation (e.g. "(PST)") is appended so the
 * dispatcher knows which side of the country the time refers to. New
 * Zealand tenants get no suffix per `getTimezoneAbbreviation`'s NZ rule.
 */
function formatDateTimeValue(value: string, timezoneText?: string): string {
    const parsed = parseDateFromApi(value);
    if (!parsed.isValid()) return value;
    const tz = timezoneText && timezoneText.trim() ? timezoneText : getTenantTimezone();
    const inZone = parsed.tz(getIanaTimezone(tz));
    const formatted = formatLongDateTime(inZone);
    const abbrev = getTimezoneAbbreviation(tz);
    return abbrev ? `${formatted} ${abbrev}` : formatted;
}

function formatFlagValue(value: string): string {
    if (value === 'true' || value === '1') return 'On';
    if (value === 'false' || value === '0') return 'Off';
    return value;
}

/**
 * The backend stores the Packages change-request payload as the JSON
 * serialised by EditParcelDimensionsDialog: `{ parcels: ParcelDimensions[],
 * weight?: number }`. We collapse it to a single tidy line so it fits in the
 * locked summary card, the history panel rows, and pending-change badges.
 */
interface PackagesLike {
    parcels?: Array<{itemName?: string; weight?: number}>;
    weight?: number;
}

function formatPackagesBlob(value: string): string {
    try {
        const parsed = JSON.parse(value) as PackagesLike;
        const count = parsed.parcels?.length ?? 0;
        const parcelLabel = `${count} parcel${count === 1 ? '' : 's'}`;
        if (parsed.weight != null && Number.isFinite(parsed.weight) && parsed.weight > 0) {
            const unit = isUsCustomer() ? 'lbs' : 'kg';
            return `${parcelLabel} · ${parsed.weight} ${unit}`;
        }
        return parcelLabel;
    } catch {
        return value;
    }
}

/**
 * Relative-time formatter that doesn't pull in a heavy library.
 * Returns short forms like "3m", "2h", "5d" suitable for chips.
 */
export function relativeAgeShort(isoDate: string | Date): string {
    const then = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
    const ms = Date.now() - then.getTime();
    if (ms < 0) return 'just now';
    const minutes = Math.floor(ms / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

/**
 * Aging level used to color age chips. Tier 2 of the review:
 *   < 24h  → fresh
 *   24h–72h → amber ("review soon")
 *   > 72h  → red ("overdue")
 */
export type AgingLevel = 'fresh' | 'stale' | 'overdue';

export function ageLevel(isoDate: string | Date): AgingLevel {
    const then = typeof isoDate === 'string' ? new Date(isoDate) : isoDate;
    const hours = (Date.now() - then.getTime()) / 3_600_000;
    if (hours > 72) return 'overdue';
    if (hours > 24) return 'stale';
    return 'fresh';
}
