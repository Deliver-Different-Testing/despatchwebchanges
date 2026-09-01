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
import {ActionIcon, Alert, Box, Card, Progress, Stack, Text} from '@mantine/core';
import {CalendarX2, RefreshCw, ScrollText} from 'lucide-react';
import {Icon} from '../icon/Icon';
import classes from './RecurringDeliveryJourney.module.css';

import {useRecurringJobDeliveryJourney} from '../../../hooks/useRecurringJobsApi';
import {openJobInSearch} from '../../../services/navigationService';
import {PanelHeader} from '../panel-header';
import {RecurringJourneyBreakdown} from './RecurringJourneyBreakdown';
import {RecurringJourneyInfoStrip} from './RecurringJourneyInfoStrip';
import {RecurringJourneyRunList} from './RecurringJourneyRunList';
import {OpenJobConfirmDialog} from './OpenJobConfirmDialog';

interface RecurringDeliveryJourneyProps {
    bookingId: number | null;
}

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
        <Card withBorder p={0} style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0}}>
            <PanelHeader
                icon={<Icon lucide={ScrollText}/>}
                title="Recurring Log"
                badge="RECURRING"
                action={
                    <ActionIcon
                        variant="subtle"
                        c="inherit"
                        className={classes.headerAction}
                        onClick={() => refetch()}
                        aria-label="Refresh recurring log"
                        disabled={!bookingId || isFetching}
                    >
                        <Icon lucide={RefreshCw} size={16}/>
                    </ActionIcon>
                }
            />

            {isFetching && (
                <Progress.Root size={4} radius={0}>
                    <Progress.Section value={100} animated aria-label="Loading recurring log"/>
                </Progress.Root>
            )}

            <Box
                bg="var(--mantine-color-body)"
                style={{flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0}}
            >
                {!bookingId && (
                    <Stack align="center" justify="center" gap={12} py={40} px={24} c="dimmed" style={{flex: 1}}>
                        <Icon lucide={CalendarX2} size={40}/>
                        <Text fz="sm">
                            Select a recurring job to see its run history.
                        </Text>
                    </Stack>
                )}

                {bookingId && isError && (
                    <Alert color="red" m={16}>
                        Failed to load recurring log: {error?.message ?? 'unknown error'}
                    </Alert>
                )}

                {bookingId && !isError && data && (
                    <>
                        <RecurringJourneyBreakdown breakdown={data.breakdown} />
                        <RecurringJourneyInfoStrip />
                        {data.runs.length === 0 ? (
                            <Stack align="center" justify="center" gap={12} py={40} px={24} c="dimmed" style={{flex: 1}}>
                                <Text fz="sm">
                                    No runs yet — this recurring job hasn't been pushed live.
                                </Text>
                            </Stack>
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
                    <Stack align="center" justify="center" gap={12} py={40} px={24} c="dimmed" style={{flex: 1}}>
                        <Text fz="sm">Loading recurring log…</Text>
                    </Stack>
                )}
            </Box>

            {data && data.runs.length > 0 && (
                <Box
                    px={16}
                    py={10}
                    fz={11}
                    c="dimmed"
                    bg="var(--mantine-color-body)"
                    style={{borderTop: '1px solid var(--mantine-color-default-border)', flexShrink: 0}}
                >
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
