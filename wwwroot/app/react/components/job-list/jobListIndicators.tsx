/**
 * Job-list priority-column indicators — single source of truth.
 *
 * The job list's first column shows exactly ONE marker per row: the coloured
 * status dots (mirroring the top stats-header categories) or a job-type icon.
 * Both the table (`getPriorityIndicator` / `getFlightIcon` in JobListTable.tsx)
 * and the legend dialog (JobListLegendDialog.tsx) render from the definitions
 * below, so the two can never drift.
 *
 * The order of the branches in `getPriorityIndicator` is the precedence — the
 * first matching indicator is the one shown for a row — and the legend is
 * ordered to mirror it (job type → attention → status).
 */
import React from 'react';
import {Box, Tooltip} from '@mantine/core';
import {Handshake, Link as LinkIcon, Network} from 'lucide-react';
import {
    IconClock,
    IconPlane,
    IconPlaneArrival,
    IconPlaneDeparture,
    IconQuestionMark,
    IconSnowflake,
    IconTruck,
} from '@tabler/icons-react';

import {Icon} from '../common/icon/Icon';

interface IconMarker {
    kind: 'icon';
    icon: React.ReactElement;
    /**
     * Stable hook for tests. The MUI originals were reached through
     * `@mui/icons-material`'s generated `data-testid`s (`HandshakeIcon`, …);
     * Lucide and Tabler emit none, so each marker names itself instead.
     */
    testId: string;
}

interface DotMarker {
    kind: 'dot';
    color: string;
}

export type IndicatorMarker = IconMarker | DotMarker;

export interface IndicatorDef {
    /** Tooltip text shown in the table cell — also the legend label. */
    label: string;
    /** Plain-language explanation shown in the legend. */
    description: string;
    marker: IndicatorMarker;
}

const iconMarker = (testId: string, el: React.ReactElement): IconMarker => ({kind: 'icon', icon: el, testId});
const dotMarker = (color: string): DotMarker => ({kind: 'dot', color});

const INFO = 'var(--mantine-color-reflex-5)';
const ERROR = 'var(--mantine-color-red-5)';
const WARNING = 'var(--mantine-color-orange-5)';
const SUCCESS = 'var(--mantine-color-green-5)';
const BRAND = 'var(--mantine-color-brand-5)';
const MUTED = 'var(--mantine-color-dimmed)';
/** The related-job link — a lighter step of the info ramp, so it reads as secondary to it. */
const RELATED = 'var(--mantine-color-reflex-3)';

/** Flight legs, keyed by the last character of the job number (see `getFlightIcon`). */
export const FLIGHT_INDICATORS = {
    pickup: {label: 'Flight Pickup', description: 'Pickup leg', marker: iconMarker('flight-pickup', <Icon tabler={IconPlaneDeparture} color={INFO}/>)},
    job: {label: 'Flight Job', description: 'In-flight', marker: iconMarker('flight-job', <Icon tabler={IconPlane} color={INFO}/>)},
    delivery: {label: 'Flight Delivery', description: 'Delivery leg', marker: iconMarker('flight-delivery', <Icon tabler={IconPlaneArrival} color={INFO}/>)},
    unknown: {label: 'Unknown', description: 'Leg not known', marker: iconMarker('flight-unknown', <Icon tabler={IconQuestionMark} color={INFO}/>)},
} satisfies Record<string, IndicatorDef>;

export const INDICATORS = {
    chilled: {label: 'Chilled', description: 'Needs a temperature-controlled (chilled or frozen) vehicle.', marker: iconMarker('chilled', <Icon tabler={IconSnowflake} color={INFO}/>)},
    multiPart: {label: 'Multi-Part', description: 'The parent of several linked deliveries grouped as one job.', marker: iconMarker('multi-part', <Icon lucide={Network} color={MUTED}/>)},
    partner: {label: 'Partner Job', description: 'Shared with a network partner.', marker: iconMarker('partner', <Icon lucide={Handshake} color={BRAND}/>)},
    latePickup: {label: 'Late Pickup', description: 'Pickup is overdue.', marker: iconMarker('late-pickup', <Icon tabler={IconClock} color={ERROR}/>)},
    lateDelivery: {label: 'Late Delivery', description: 'Delivery is overdue.', marker: iconMarker('late-delivery', <Icon tabler={IconTruck} color={ERROR}/>)},
    urgent: {label: 'Urgent', description: 'Due to be delivered within the next 30 minutes.', marker: dotMarker(ERROR)},
    inTransit: {label: 'In Transit', description: 'Picked up and on the way.', marker: dotMarker(WARNING)},
    done: {label: 'Done', description: 'Delivered — job complete.', marker: dotMarker(SUCCESS)},
    active: {label: 'Active', description: 'Ready to dispatch — no courier assigned yet.', marker: dotMarker(INFO)},
    related: {label: 'Related job', description: "Linked to the job you've selected.", marker: iconMarker('related', <Icon lucide={LinkIcon} size={16} color={RELATED}/>)},
} satisfies Record<string, IndicatorDef>;

const dotStyle = (color: string, size: number): React.CSSProperties => ({
    width: size,
    height: size,
    borderRadius: '50%',
    backgroundColor: color,
});

/** Render an indicator as it appears in a table cell: tooltip-wrapped, dots carry the priority-dot test id. */
export function renderTableIndicator(def: IndicatorDef): React.ReactElement {
    const marker = def.marker;
    const glyph = marker.kind === 'dot'
        ? <Box style={{...dotStyle(marker.color, 8), margin: '0 auto'}}/>
        : marker.icon;
    // Mantine's Tooltip attaches a ref to its child, and neither `Icon` nor a bare
    // element from the map forwards one — so the glyph is wrapped rather than
    // cloned directly. The test id rides on the wrapper for the same reason.
    return (
        <Tooltip label={def.label} withArrow>
            <Box
                component="span"
                data-testid={marker.kind === 'dot' ? 'priority-dot' : `indicator-${marker.testId}`}
                style={{display: 'inline-flex', alignItems: 'center'}}
            >
                {glyph}
            </Box>
        </Tooltip>
    );
}

/** Render just the marker glyph for the legend (no tooltip; dots are drawn slightly larger for legibility). */
export function renderLegendMarker(marker: IndicatorMarker): React.ReactNode {
    return marker.kind === 'dot'
        ? <Box style={dotStyle(marker.color, 10)}/>
        : <Box component="span" data-testid={`indicator-${marker.testId}`} style={{display: 'inline-flex'}}>{marker.icon}</Box>;
}
