/**
 * courierFlagSvg
 *
 * The courier flag — the labelled pill on a pin stem drawn for each available courier — shared by
 * the dispatch map and the courier map so the two never drift apart. Pure string builders with no
 * HERE dependency: the callers wrap the markup in an `H.map.Icon`.
 *
 * The palette is a parameter rather than an import because the two maps colour their flags
 * differently on purpose — the dispatch map uses fixed MD3 tonal containers, the courier map derives
 * its colours from the Mantine theme so the flags follow dark mode.
 */

import type {IAvailableCourierPosition} from '../../../../interfaces/courier.interface';

export type CourierStatus = 'noJobs' | 'hasJobs' | 'overdue';

export interface CourierFlagColors {
    bg: string;
    text: string;
    border: string;
}

export interface CourierFlagLines {
    /** Driver and job counts, e.g. "Dave 4/1". Always present. */
    primary: string;
    /** Last delivery, e.g. "Ponsonby · 12m". Null when the courier has no completed job. */
    secondary: string | null;
}

/** Overall flag height, which drives the marker anchor — the stem tip must sit on the GPS point. */
export const COURIER_FLAG_HEIGHT = {oneLine: 36, twoLine: 50} as const;
export const COURIER_FLAG_LARGE_HEIGHT = 58;

const PILL_ONE_LINE_HEIGHT = 22;
const PILL_TWO_LINE_HEIGHT = 36;
const STEM_LENGTH = 11;
const PILL_X = 4;
const MIN_PILL_WIDTH = 50;
const MAX_PILL_WIDTH = 190;
// Roboto 12px semibold averages a shade under 7px per glyph; the secondary line is 10px.
const PRIMARY_CHAR_WIDTH = 7;
const SECONDARY_CHAR_WIDTH = 6;
const TEXT_PADDING = 16;

/** Whole minutes since the courier's last delivery, or null when there is no usable timestamp. */
export function lastDeliveryMinutes(lastDeliveryTime: string | null | undefined): number | null {
    if (!lastDeliveryTime) return null;

    const completed = new Date(lastDeliveryTime).getTime();
    if (isNaN(completed)) return null;

    // Clamp at zero: a tenant clock slightly ahead of the browser must not render "-3m".
    return Math.max(0, Math.floor((Date.now() - completed) / 60_000));
}

export function getCourierFlagLines(courier: IAvailableCourierPosition): CourierFlagLines {
    const firstName = (courier.courierName || '').split(' ')[0];
    const primary = courier.overDueJobs > 0
        ? `${firstName} ${courier.totalJobs}/${courier.overDueJobs}`
        : `${firstName} ${courier.totalJobs}`;

    const minutes = lastDeliveryMinutes(courier.lastDeliveryTime);
    if (minutes === null) {
        // No completed delivery to report — the flag stays the compact single-line pill.
        return {primary, secondary: null};
    }

    const city = courier.lastDeliveryCity?.trim();
    return {primary, secondary: city ? `${city} · ${minutes}m` : `${minutes}m`};
}

export function getCourierStatus(courier: IAvailableCourierPosition): CourierStatus {
    if (courier.totalJobs === 0) return 'noJobs';
    if (courier.overDueJobs > 0) return 'overdue';
    return 'hasJobs';
}

/**
 * Icon cache key. It must include the secondary line: the minute count ticks between polls and a
 * key that ignored it would serve a stale icon forever.
 */
export function courierFlagCacheKey(
    lines: CourierFlagLines, status: CourierStatus, largeView: boolean
): string {
    return `${lines.primary}_${lines.secondary ?? ''}_${status}_${largeView}`;
}

/** Marker anchor for a flag — x on the stem, y at its tip so the flag hangs above the GPS point. */
export function courierFlagAnchor(lines: CourierFlagLines, largeView: boolean): {x: number; y: number} {
    if (largeView) return {x: PILL_X, y: COURIER_FLAG_LARGE_HEIGHT};
    return {x: PILL_X, y: flagHeight(lines)};
}

function flagHeight(lines: CourierFlagLines): number {
    return lines.secondary ? COURIER_FLAG_HEIGHT.twoLine : COURIER_FLAG_HEIGHT.oneLine;
}

function pillWidth(lines: CourierFlagLines): number {
    const primary = lines.primary.length * PRIMARY_CHAR_WIDTH + TEXT_PADDING;
    const secondary = lines.secondary
        ? lines.secondary.length * SECONDARY_CHAR_WIDTH + TEXT_PADDING
        : 0;

    return Math.max(MIN_PILL_WIDTH, Math.min(Math.max(primary, secondary), MAX_PILL_WIDTH));
}

/**
 * Material Design 3 tonal label on a rounded pin stem. One line when the courier has no last
 * delivery, two when they do.
 */
export function createCourierFlagSvg(lines: CourierFlagLines, colors: CourierFlagColors): string {
    const textWidth = pillWidth(lines);
    const totalWidth = textWidth + 6;
    const pillHeight = lines.secondary ? PILL_TWO_LINE_HEIGHT : PILL_ONE_LINE_HEIGHT;
    const height = flagHeight(lines);
    const centreX = PILL_X + textWidth / 2;
    const radius = PILL_ONE_LINE_HEIGHT / 2;

    const secondary = lines.secondary
        ? `<text x="${centreX}" y="31" font-family="Roboto, Arial, sans-serif" font-size="10" `
          + `font-weight="500" fill="${colors.text}" fill-opacity="0.85" text-anchor="middle">`
          + `${escapeXml(lines.secondary)}</text>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" viewBox="0 0 ${totalWidth} ${height}">
            <defs>
                <filter id="flagShadow" x="-30%" y="-30%" width="160%" height="160%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.24"/>
                </filter>
            </defs>
            <line x1="4" y1="${2 + pillHeight}" x2="4" y2="${2 + pillHeight + STEM_LENGTH}" stroke="${colors.border}" stroke-width="2.5" stroke-linecap="round"/>
            <rect x="4" y="2" width="${textWidth}" height="${pillHeight}" rx="${radius}" ry="${radius}" fill="${colors.bg}" stroke="${colors.border}" stroke-width="1" filter="url(#flagShadow)"/>
            <text x="${centreX}" y="17" font-family="Roboto, Arial, sans-serif" font-size="12" font-weight="600" fill="${colors.text}" text-anchor="middle">${escapeXml(lines.primary)}</text>
            ${secondary}
        </svg>`;
}

/** The large-view pennant. Same content, bigger target for scanning a busy map at a glance. */
export function createLargeCourierFlagSvg(lines: CourierFlagLines, colors: CourierFlagColors): string {
    const width = Math.max(96, Math.min(
        Math.max(lines.primary.length * 8, (lines.secondary?.length ?? 0) * SECONDARY_CHAR_WIDTH) + 28,
        MAX_PILL_WIDTH));
    const pennantRight = width - 4;

    const secondary = lines.secondary
        ? `<text x="${(8 + pennantRight) / 2}" y="32" font-family="Roboto, Arial, sans-serif" `
          + `font-size="10" font-weight="500" fill="${colors.text}" fill-opacity="0.9" `
          + `text-anchor="middle">${escapeXml(lines.secondary)}</text>`
        : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${COURIER_FLAG_LARGE_HEIGHT}" viewBox="0 0 ${width} ${COURIER_FLAG_LARGE_HEIGHT}">
            <defs>
                <filter id="largeFlagShadow" x="-20%" y="-30%" width="140%" height="170%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.24"/>
                </filter>
            </defs>
            <line x1="4" y1="4" x2="4" y2="${COURIER_FLAG_LARGE_HEIGHT - 2}" stroke="${colors.border}" stroke-width="3" stroke-linecap="round"/>
            <path d="M8,4 L${pennantRight},4 L${pennantRight - 8},22 L${pennantRight},40 L8,40 Z" fill="${colors.bg}" stroke="#FFFFFF" stroke-width="2" filter="url(#largeFlagShadow)"/>
            <text x="${(8 + pennantRight) / 2}" y="${lines.secondary ? 19 : 26}" font-family="Roboto, Arial, sans-serif" font-size="12" font-weight="bold" fill="${colors.text}" text-anchor="middle">${escapeXml(lines.primary)}</text>
            ${secondary}
        </svg>`;
}

/**
 * The hover card shared by both maps. Kept here beside the flag so the two never drift: the bubble
 * chrome comes from createMapTooltipElement and this fills its content region.
 */
export function createCourierTooltipHtml(courier: IAvailableCourierPosition): string {
    const overdue = courier.overDueJobs > 0
        ? `<span style="color: #E53935; font-weight: bold;">Overdue Jobs: ${courier.overDueJobs}</span><br>`
        : '';

    const minutes = lastDeliveryMinutes(courier.lastDeliveryTime);
    const lastDelivery = minutes === null
        ? ''
        : `Last delivery: ${escapeXml(courier.lastDeliveryCity) || 'Unknown'}<br>`
          + `${minutes} min${minutes === 1 ? '' : 's'} ago<br>`;

    return `
                <strong>${escapeXml(courier.courierName)}</strong><br>
                ${courier.isUrgentArmyDriver ? 'Fleet: UA<br>' : ''}
                ${courier.vehicleType ? `Vehicle: ${escapeXml(courier.vehicleType)}<br>` : ''}
                <strong>Total Jobs: ${courier.totalJobs}</strong><br>
                ${overdue}
                ${lastDelivery}
            `;
}

/**
 * The markup is an SVG string handed straight to H.map.Icon, so it never passes through the DOM
 * sanitiser a tooltip would get — escape by hand rather than via a detached element.
 */
function escapeXml(text: string | null | undefined): string {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
