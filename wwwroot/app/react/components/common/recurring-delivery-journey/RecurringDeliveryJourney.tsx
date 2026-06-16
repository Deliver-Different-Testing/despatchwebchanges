/**
 * Recurring Log panel — the right column of the recurring-jobs page.
 *
 * Shows one entry per live job spawned from the selected recurring booking,
 * plus a breakdown count (Total / Completed / Voided / Pending). Clicking a
 * parent or child chip prompts the user to open that job in Job Search.
 *
 * Wire-level naming is "DeliveryJourney" (matching the backend) but the
 * user-facing label is "Recurring Log".
 */

import React, {useCallback, useState} from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import type {SxProps, Theme} from '@mui/material/styles';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import RefreshIcon from '@mui/icons-material/Refresh';
import EventBusyIcon from '@mui/icons-material/EventBusy';

import {useRecurringJobDeliveryJourney} from '../../../hooks/useRecurringJobsApi';
import {openJobInSearch} from '../../../services/navigationService';
import {RecurringJourneyBreakdown} from './RecurringJourneyBreakdown';
import {RecurringJourneyInfoStrip} from './RecurringJourneyInfoStrip';
import {RecurringJourneyRunList} from './RecurringJourneyRunList';
import {OpenJobConfirmDialog} from './OpenJobConfirmDialog';

interface RecurringDeliveryJourneyProps {
    bookingId: number | null;
}

const cardSx = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
} satisfies SxProps<Theme>;

const headerSx = ((theme: Theme) => ({
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: 'white',
    px: 2,
    py: 1.25,
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    flexShrink: 0,
})) satisfies SxProps<Theme>;

const iconBadgeSx = {
    width: 36,
    height: 36,
    borderRadius: 1.5,
    bgcolor: 'rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
} satisfies SxProps<Theme>;

const headerActionSx = {
    color: 'white',
    '&:hover': {bgcolor: 'rgba(255,255,255,0.15)'},
} satisfies SxProps<Theme>;

const recurringChipSx = {
    color: 'white',
    fontWeight: 700,
    fontSize: 10,
    letterSpacing: '0.6px',
    bgcolor: 'rgba(255,255,255,0.18)',
    border: 'none',
    height: 20,
} satisfies SxProps<Theme>;

const bodySx = {
    flex: 1,
    overflow: 'auto',
    bgcolor: 'background.paper',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
} satisfies SxProps<Theme>;

const emptyStateSx = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'text.secondary',
    py: 5,
    px: 3,
    gap: 1.5,
    flex: 1,
} satisfies SxProps<Theme>;

const footerSx = ((theme: Theme) => ({
    borderTop: `1px solid ${theme.palette.divider}`,
    px: 2,
    py: 1.25,
    bgcolor: theme.palette.background.default,
    fontSize: 11,
    color: theme.palette.text.secondary,
    flexShrink: 0,
})) satisfies SxProps<Theme>;

export const RecurringDeliveryJourney: React.FC<RecurringDeliveryJourneyProps> = ({bookingId}) => {
    const {data, isLoading, isError, error, refetch, isFetching} =
        useRecurringJobDeliveryJourney(bookingId);

    const [confirmTarget, setConfirmTarget] = useState<{jobId: number; jobNumber: string} | null>(null);

    const handleParentClick = useCallback((jobId: number, jobNumber: string) => {
        setConfirmTarget({jobId, jobNumber});
    }, []);

    const handleChildClick = useCallback((jobId: number, jobNumber: string) => {
        setConfirmTarget({jobId, jobNumber});
    }, []);

    const handleConfirm = useCallback(() => {
        if (confirmTarget) {
            openJobInSearch(confirmTarget.jobId);
        }
        setConfirmTarget(null);
    }, [confirmTarget]);

    const handleCancel = useCallback(() => setConfirmTarget(null), []);

    return (
        <Card variant="outlined" sx={cardSx}>
            <Box sx={headerSx}>
                <Box sx={iconBadgeSx}>
                    <HistoryEduIcon sx={{fontSize: 20}} />
                </Box>
                <Box sx={{flex: 1, display: 'flex', alignItems: 'center', gap: 1}}>
                    <Typography variant="subtitle1" sx={{fontWeight: 600}}>
                        Recurring Log
                    </Typography>
                    <Chip label="RECURRING" size="small" sx={recurringChipSx} />
                </Box>
                <IconButton
                    size="small"
                    onClick={() => refetch()}
                    sx={headerActionSx}
                    aria-label="Refresh recurring log"
                    disabled={!bookingId || isFetching}
                >
                    <RefreshIcon fontSize="small" />
                </IconButton>
            </Box>

            {isFetching && <LinearProgress />}

            <Box sx={bodySx}>
                {!bookingId && (
                    <Box sx={emptyStateSx}>
                        <EventBusyIcon sx={{fontSize: 40, color: 'text.disabled'}} />
                        <Typography variant="body2">
                            Select a recurring job to see its run history.
                        </Typography>
                    </Box>
                )}

                {bookingId && isError && (
                    <Alert severity="error" sx={{m: 2}}>
                        Failed to load recurring log: {error?.message ?? 'unknown error'}
                    </Alert>
                )}

                {bookingId && !isError && data && (
                    <>
                        <RecurringJourneyBreakdown breakdown={data.breakdown} />
                        <RecurringJourneyInfoStrip />
                        {data.runs.length === 0 ? (
                            <Box sx={emptyStateSx}>
                                <Typography variant="body2">
                                    No runs yet — this recurring job hasn't been pushed live.
                                </Typography>
                            </Box>
                        ) : (
                            <RecurringJourneyRunList
                                runs={data.runs}
                                onParentClick={handleParentClick}
                                onChildClick={handleChildClick}
                            />
                        )}
                    </>
                )}

                {bookingId && isLoading && !data && (
                    <Box sx={emptyStateSx}>
                        <Typography variant="body2">Loading recurring log…</Typography>
                    </Box>
                )}
            </Box>

            {data && data.runs.length > 0 && (
                <Box sx={footerSx}>
                    Latest run: <strong>{data.runs[0].parentJobNumber}</strong>
                    {' · '}
                    {data.runs[0].serviceDate.format('MMM D, YYYY')}
                </Box>
            )}

            <OpenJobConfirmDialog
                open={confirmTarget != null}
                jobId={confirmTarget?.jobId ?? null}
                jobNumber={confirmTarget?.jobNumber ?? null}
                onCancel={handleCancel}
                onConfirm={handleConfirm}
            />
        </Card>
    );
};

export default RecurringDeliveryJourney;
