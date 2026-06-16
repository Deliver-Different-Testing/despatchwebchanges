/**
 * One timeline row in the Recurring Log.
 *
 * Layout mirrors the spec mockup:
 *   [status dot]  date . . . . . . . POD block
 *                 Parent <chip>
 *                 [child chip] [child chip] ...
 *                 distance · status meta
 */

import React from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RouteIcon from '@mui/icons-material/Route';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import BlockIcon from '@mui/icons-material/Block';
import ScheduleIcon from '@mui/icons-material/Schedule';
import type {SxProps, Theme} from '@mui/material/styles';
import type {RecurringJourneyRun, RecurringJourneyStatus} from './RecurringDeliveryJourney.types';
import {getTenantTimezone, getTimezoneAbbreviation} from '../../../utils/dateUtils';

interface RecurringJourneyRunRowProps {
    run: RecurringJourneyRun;
    onParentClick: (jobId: number, jobNumber: string) => void;
    onChildClick: (jobId: number, jobNumber: string) => void;
}

const rowSx = {
    display: 'grid',
    gridTemplateColumns: '32px 1fr',
    gap: 1.25,
    px: 2,
    py: 1.25,
    position: 'relative',
    '&:hover': {bgcolor: 'action.hover'},
} satisfies SxProps<Theme>;

const dotBaseSx = {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '3px solid',
    borderColor: 'background.paper',
    mt: 0.5,
    ml: '7px',
    zIndex: 1,
    position: 'relative',
} satisfies SxProps<Theme>;

function dotSxForStatus(status: RecurringJourneyStatus): SxProps<Theme> {
    return (theme: Theme) => {
        const tone = statusColor(status, theme);
        return {
            ...dotBaseSx,
            bgcolor: tone,
            boxShadow: `0 0 0 2px ${tone}`,
        };
    };
}

function statusColor(status: RecurringJourneyStatus, theme: Theme): string {
    switch (status) {
        case 'Completed': return theme.palette.success.main;
        case 'InProgress': return theme.palette.warning.main;
        case 'Voided': return theme.palette.error.main;
        case 'Pending':
        default: return theme.palette.grey[400];
    }
}

function statusLabel(status: RecurringJourneyStatus): string {
    switch (status) {
        case 'Completed': return 'Completed';
        case 'InProgress': return 'In progress';
        case 'Voided': return 'Voided';
        case 'Pending':
        default: return 'Pending';
    }
}

function StatusIcon({status}: {status: RecurringJourneyStatus}) {
    switch (status) {
        case 'Completed': return <CheckCircleIcon sx={{fontSize: 13}} />;
        case 'InProgress': return <AutorenewIcon sx={{fontSize: 13}} />;
        case 'Voided': return <BlockIcon sx={{fontSize: 13}} />;
        case 'Pending':
        default: return <ScheduleIcon sx={{fontSize: 13}} />;
    }
}

const parentLabelSx = {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'text.secondary',
    fontWeight: 600,
} satisfies SxProps<Theme>;

const metaSx = {
    mt: 0.75,
    fontSize: 11,
    color: 'text.secondary',
    display: 'flex',
    gap: 1.25,
    flexWrap: 'wrap',
} satisfies SxProps<Theme>;

const metaItemSx = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 0.5,
} satisfies SxProps<Theme>;

export const RecurringJourneyRunRow: React.FC<RecurringJourneyRunRowProps> = ({
    run,
    onParentClick,
    onChildClick,
}) => {
    const timezone = getTenantTimezone();
    const tzAbbr = getTimezoneAbbreviation(timezone);

    return (
        <Box sx={rowSx}>
            <Box sx={dotSxForStatus(run.status)} />
            <Box sx={{minWidth: 0}}>
                <Box sx={{display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1}}>
                    <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                        {run.serviceDate.format('MMM D, YYYY')}
                    </Typography>
                    <PodBlock run={run} tzAbbr={tzAbbr} />
                </Box>

                <Stack direction="row" spacing={1} sx={{mt: 0.75, alignItems: 'center'}}>
                    <Typography sx={parentLabelSx}>Parent</Typography>
                    <Chip
                        label={run.parentJobNumber}
                        size="small"
                        variant="outlined"
                        color="primary"
                        clickable
                        onClick={() => onParentClick(run.parentJobId, run.parentJobNumber)}
                        sx={{fontWeight: 700}}
                    />
                </Stack>

                {run.children.length > 0 && (
                    <Box sx={{mt: 0.75, display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                        {run.children.map((child, idx) => {
                            const isAccent = idx === 0 || idx === run.children.length - 1;
                            return (
                                <Chip
                                    key={child.jobId}
                                    label={child.jobNumber}
                                    size="small"
                                    variant="outlined"
                                    color={isAccent ? 'primary' : 'default'}
                                    clickable
                                    onClick={() => onChildClick(child.jobId, child.jobNumber)}
                                />
                            );
                        })}
                    </Box>
                )}

                <Box sx={metaSx}>
                    {run.miles != null && (
                        <Box sx={metaItemSx}>
                            <RouteIcon sx={{fontSize: 13}} />
                            <span>{run.miles} mi</span>
                        </Box>
                    )}
                    <Box sx={metaItemSx}>
                        <StatusIcon status={run.status} />
                        <span>{statusLabel(run.status)}</span>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

const podLabelSx = {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: '0.5px',
    color: 'text.secondary',
    textTransform: 'uppercase',
} satisfies SxProps<Theme>;

const podBlockSx = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '1px',
    lineHeight: 1.3,
    textAlign: 'right',
    minWidth: 0,
} satisfies SxProps<Theme>;

function PodBlock({run, tzAbbr}: {run: RecurringJourneyRun; tzAbbr: string}) {
    if (run.pod) {
        return (
            <Box sx={podBlockSx}>
                <Typography component="span" sx={podLabelSx}>POD</Typography>
                <Typography component="span" sx={{fontSize: 11, fontWeight: 600, color: 'text.primary', whiteSpace: 'nowrap'}}>
                    {run.pod.time.format('MMM D · HH:mm')} {tzAbbr}
                </Typography>
                {run.pod.signedBy && (
                    <Typography component="span" sx={{fontSize: 10, color: 'text.secondary', whiteSpace: 'nowrap', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis'}}>
                        {run.pod.signedBy}
                    </Typography>
                )}
            </Box>
        );
    }

    const dimmedLabel = run.status === 'Pending' ? '— scheduled —' : '— awaiting POD —';
    return (
        <Box sx={podBlockSx}>
            <Typography component="span" sx={podLabelSx}>POD</Typography>
            <Typography component="span" sx={{fontSize: 11, fontStyle: 'italic', color: 'text.disabled'}}>
                {dimmedLabel}
            </Typography>
        </Box>
    );
}

export default RecurringJourneyRunRow;
