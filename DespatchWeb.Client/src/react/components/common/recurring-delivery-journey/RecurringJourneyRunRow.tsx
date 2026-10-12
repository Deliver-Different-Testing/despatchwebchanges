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
import {Badge, Box, Group, Stack, Text} from '@mantine/core';
import {Ban, CheckCircle2, Clock, RefreshCw, Route} from 'lucide-react';
import {Icon} from '../icon/Icon';
import type {RecurringJourneyRun, RecurringJourneyStatus} from './RecurringDeliveryJourney.types';
import {getTenantTimezone, getTimezoneAbbreviation} from '../../../utils/dateUtils';
import classes from './RecurringDeliveryJourney.module.css';

interface RecurringJourneyRunRowProps {
    run: RecurringJourneyRun;
    onParentClick: (jobId: number, jobNumber: string) => void;
    onChildClick: (jobId: number, jobNumber: string) => void;
}

/**
 * Concrete values rather than Mantine colour names: the dot feeds both a
 * background and a `box-shadow` ring string, neither of which resolves a name.
 */
function statusColor(status: RecurringJourneyStatus): string {
    switch (status) {
        case 'Completed': return 'var(--mantine-color-green-6)';
        case 'InProgress': return 'var(--mantine-color-yellow-6)';
        case 'Voided': return 'var(--mantine-color-red-6)';
        case 'Pending':
        default: return 'var(--mantine-color-gray-4)';
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
        case 'Completed': return <Icon lucide={CheckCircle2} size={13}/>;
        case 'InProgress': return <Icon lucide={RefreshCw} size={13}/>;
        case 'Voided': return <Icon lucide={Ban} size={13}/>;
        case 'Pending':
        default: return <Icon lucide={Clock} size={13}/>;
    }
}

export const RecurringJourneyRunRow: React.FC<RecurringJourneyRunRowProps> = ({
    run,
    onParentClick,
    onChildClick,
}) => {
    const timezone = getTenantTimezone();
    const tzAbbr = getTimezoneAbbreviation(timezone);
    const tone = statusColor(run.status);

    return (
        <Box
            className={classes.runRow}
            px={16}
            py={10}
            style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr',
                gap: 10,
                position: 'relative',
            }}
        >
            {/* The ring lifts the dot off the rail running behind it. */}
            <Box
                w={14}
                h={14}
                mt={4}
                ml={7}
                style={{
                    borderRadius: '50%',
                    border: '3px solid var(--mantine-color-body)',
                    backgroundColor: tone,
                    zIndex: 1,
                    position: 'relative',
                }}
            />
            <Box miw={0}>
                <Group align="flex-start" justify="space-between" gap={8} wrap="nowrap">
                    <Text fz="sm" fw={600}>
                        {run.serviceDate.format('MMM D, YYYY')}
                    </Text>
                    <PodBlock run={run} tzAbbr={tzAbbr}/>
                </Group>

                <Group gap={8} mt={6} align="center">
                    <Text fz={10} fw={600} tt="uppercase" c="dimmed" style={{letterSpacing: '0.5px'}}>
                        Parent
                    </Text>
                    <Badge
                        component="button"
                        type="button"
                        size="sm"
                        fw={700}
                        tt="none"
                        style={{cursor: 'pointer'}}
                        onClick={() => onParentClick(run.parentJobId, run.parentJobNumber)}
                    >
                        {run.parentJobNumber}
                    </Badge>
                </Group>

                {run.children.length > 0 && (
                    <Group gap={4} mt={6}>
                        {run.children.map((child, idx) => {
                            const isAccent = idx === 0 || idx === run.children.length - 1;
                            return (
                                <Badge
                                    key={child.jobId}
                                    component="button"
                                    type="button"
                                    size="sm"
                                    tt="none"
                                    color={isAccent ? undefined : 'gray'}
                                    style={{cursor: 'pointer'}}
                                    onClick={() => onChildClick(child.jobId, child.jobNumber)}
                                >
                                    {child.jobNumber}
                                </Badge>
                            );
                        })}
                    </Group>
                )}

                <Group gap={10} mt={6} fz={11} c="dimmed">
                    {run.miles != null && (
                        <Group gap={4} wrap="nowrap" component="span">
                            <Icon lucide={Route} size={13}/>
                            <span>{run.miles} mi</span>
                        </Group>
                    )}
                    <Group gap={4} wrap="nowrap" component="span">
                        <StatusIcon status={run.status}/>
                        <span>{statusLabel(run.status)}</span>
                    </Group>
                </Group>
            </Box>
        </Box>
    );
};

function PodBlock({run, tzAbbr}: {run: RecurringJourneyRun; tzAbbr: string}) {
    const label = (
        <Text component="span" fz={8} fw={700} tt="uppercase" c="dimmed" style={{letterSpacing: '0.5px'}}>
            POD
        </Text>
    );

    if (run.pod) {
        return (
            <Stack align="flex-end" gap={1} miw={0} ta="right" style={{lineHeight: 1.3}}>
                {label}
                <Text component="span" fz={11} fw={600} style={{whiteSpace: 'nowrap'}}>
                    {run.pod.time.format('MMM D · HH:mm')} {tzAbbr}
                </Text>
                {run.pod.signedBy && (
                    <Text component="span" fz={10} c="dimmed" maw={130} truncate>
                        {run.pod.signedBy}
                    </Text>
                )}
            </Stack>
        );
    }

    const dimmedLabel = run.status === 'Pending' ? '— scheduled —' : '— awaiting POD —';
    return (
        <Stack align="flex-end" gap={1} miw={0} ta="right" style={{lineHeight: 1.3}}>
            {label}
            <Text component="span" fz={11} c="dimmed" fs="italic">
                {dimmedLabel}
            </Text>
        </Stack>
    );
}

export default RecurringJourneyRunRow;
