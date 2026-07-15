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
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import type {SxProps, Theme} from '@mui/material';

import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import LocalAirportIcon from '@mui/icons-material/LocalAirport';
import FlightLandIcon from '@mui/icons-material/FlightLand';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import HandshakeIcon from '@mui/icons-material/Handshake';
import ScheduleIcon from '@mui/icons-material/Schedule';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LinkIcon from '@mui/icons-material/Link';

interface IconMarker {
    kind: 'icon';
    icon: React.ReactElement;
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

const iconMarker = (el: React.ReactElement): IconMarker => ({kind: 'icon', icon: el});
const dotMarker = (color: string): DotMarker => ({kind: 'dot', color});

/** Flight legs, keyed by the last character of the job number (see `getFlightIcon`). */
export const FLIGHT_INDICATORS = {
    pickup: {label: 'Flight Pickup', description: 'Pickup leg', marker: iconMarker(<FlightTakeoffIcon fontSize="small" sx={{color: 'info.main'}}/>)},
    job: {label: 'Flight Job', description: 'In-flight', marker: iconMarker(<LocalAirportIcon fontSize="small" sx={{color: 'info.main'}}/>)},
    delivery: {label: 'Flight Delivery', description: 'Delivery leg', marker: iconMarker(<FlightLandIcon fontSize="small" sx={{color: 'info.main'}}/>)},
    unknown: {label: 'Unknown', description: 'Leg not known', marker: iconMarker(<QuestionMarkIcon fontSize="small" sx={{color: 'info.main'}}/>)},
} satisfies Record<string, IndicatorDef>;

export const INDICATORS = {
    chilled: {label: 'Chilled', description: 'Needs a temperature-controlled (chilled or frozen) vehicle.', marker: iconMarker(<AcUnitIcon fontSize="small" sx={{color: 'info.main'}}/>)},
    multiPart: {label: 'Multi-Part', description: 'The parent of several linked deliveries grouped as one job.', marker: iconMarker(<AccountTreeIcon fontSize="small" sx={{color: 'text.secondary'}}/>)},
    partner: {label: 'Partner Job', description: 'Shared with a network partner.', marker: iconMarker(<HandshakeIcon fontSize="small" sx={{color: 'primary.main'}}/>)},
    latePickup: {label: 'Late Pickup', description: 'Pickup is overdue.', marker: iconMarker(<ScheduleIcon fontSize="small" sx={{color: 'error.main'}}/>)},
    lateDelivery: {label: 'Late Delivery', description: 'Delivery is overdue.', marker: iconMarker(<LocalShippingIcon fontSize="small" sx={{color: 'error.main'}}/>)},
    urgent: {label: 'Urgent', description: 'Due to be delivered within the next 30 minutes.', marker: dotMarker('error.main')},
    inTransit: {label: 'In Transit', description: 'Picked up and on the way.', marker: dotMarker('warning.main')},
    done: {label: 'Done', description: 'Delivered — job complete.', marker: dotMarker('success.main')},
    active: {label: 'Active', description: 'Ready to dispatch — no courier assigned yet.', marker: dotMarker('info.main')},
    related: {label: 'Related job', description: "Linked to the job you've selected.", marker: iconMarker(<LinkIcon sx={{fontSize: 16, color: '#7986cb'}}/>)},
} satisfies Record<string, IndicatorDef>;

const tableDotSx = (color: string): SxProps<Theme> => ({width: 8, height: 8, borderRadius: '50%', bgcolor: color, mx: 'auto'});
const legendDotSx = (color: string): SxProps<Theme> => ({width: 10, height: 10, borderRadius: '50%', bgcolor: color});

/** Render an indicator as it appears in a table cell: tooltip-wrapped, dots carry the priority-dot test id. */
export function renderTableIndicator(def: IndicatorDef): React.ReactElement {
    const glyph = def.marker.kind === 'dot'
        ? <Box data-testid="priority-dot" sx={tableDotSx(def.marker.color)}/>
        : def.marker.icon;
    return <Tooltip title={def.label}>{glyph}</Tooltip>;
}

/** Render just the marker glyph for the legend (no tooltip; dots are drawn slightly larger for legibility). */
export function renderLegendMarker(marker: IndicatorMarker): React.ReactNode {
    return marker.kind === 'dot' ? <Box sx={legendDotSx(marker.color)}/> : marker.icon;
}
