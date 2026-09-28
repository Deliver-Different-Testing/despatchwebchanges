/**
 * Job List Legend Dialog
 *
 * Explains the markers shown in the job list's first (priority) column. Each row
 * shows exactly one marker — the highest-priority one that applies — so the
 * sections are ordered to mirror that precedence (job type → attention →
 * status). Opened from the info button in the priority column header.
 *
 * All labels, descriptions and glyphs come from `./jobListIndicators`, the same
 * source the table renders from, so the legend can never drift from reality.
 */
import React from 'react';
import {Alert, Box, Group, Paper, Stack, Text} from '@mantine/core';
import {Info} from 'lucide-react';

import {Icon} from '../common/icon/Icon';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    sectionLabelProps,
    sectionPaperProps,
} from '../dialogs/shared/mantine';
import type {IndicatorDef} from './jobListIndicators';
import {FLIGHT_INDICATORS, INDICATORS, renderLegendMarker} from './jobListIndicators';

const MarkerGutter: React.FC<{children: React.ReactNode}> = ({children}) => (
    <Box
        style={{
            width: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
        }}
    >
        {children}
    </Box>
);

const LegendRow: React.FC<{def: IndicatorDef}> = ({def}) => (
    <Group align="flex-start" gap="sm" wrap="nowrap">
        <MarkerGutter>{renderLegendMarker(def.marker)}</MarkerGutter>
        <Box>
            <Text size="sm" fw={600}>{def.label}</Text>
            <Text size="xs" c="dimmed">{def.description}</Text>
        </Box>
    </Group>
);

// Flight is the one indicator with several variants; collapse the legs into a
// single row rather than repeating "Flight …" four times.
const FlightLegendRow: React.FC = () => {
    const legs = [FLIGHT_INDICATORS.pickup, FLIGHT_INDICATORS.job, FLIGHT_INDICATORS.delivery];
    return (
        <Group align="flex-start" gap="sm" wrap="nowrap">
            <MarkerGutter>{renderLegendMarker(FLIGHT_INDICATORS.job.marker)}</MarkerGutter>
            <Box>
                <Text size="sm" fw={600}>Flight</Text>
                <Text size="xs" c="dimmed" mb={6}>
                    Air freight job — the icon shows which leg this is:
                </Text>
                <Group gap="md" style={{rowGap: 4}}>
                    {legs.map((leg) => (
                        <Group key={leg.label} gap={4} wrap="nowrap">
                            {renderLegendMarker(leg.marker)}
                            <Text size="xs" c="dimmed">{leg.description}</Text>
                        </Group>
                    ))}
                </Group>
            </Box>
        </Group>
    );
};

const LegendSection: React.FC<{title: string; children: React.ReactNode}> = ({title, children}) => (
    <Box>
        <Text {...sectionLabelProps}>{title}</Text>
        <Paper {...sectionPaperProps}>
            <Stack gap="sm">{children}</Stack>
        </Paper>
    </Box>
);

export interface JobListLegendDialogProps {
    open: boolean;
    onClose: () => void;
}

export const JobListLegendDialog: React.FC<JobListLegendDialogProps> = ({open, onClose}) => (
    <DialogShell opened={open} onClose={onClose} label="Column legend">
        <DialogHeader
            icon={<Icon lucide={Info}/>}
            title="Column legend"
            subtitle="What the dots and icons mean"
            onClose={onClose}
        />
        <Box style={{backgroundColor: dialogContentBg}} p="lg">
            <Stack gap="lg">
                <Alert color="cyan" variant="light">
                    Each job shows a single marker here — the highest-priority one that applies.
                </Alert>
                <LegendSection title="Job type">
                    <FlightLegendRow/>
                    <LegendRow def={INDICATORS.chilled}/>
                    <LegendRow def={INDICATORS.multiPart}/>
                    <LegendRow def={INDICATORS.partner}/>
                </LegendSection>
                <LegendSection title="Needs attention">
                    <LegendRow def={INDICATORS.latePickup}/>
                    <LegendRow def={INDICATORS.lateDelivery}/>
                </LegendSection>
                <LegendSection title="Status">
                    <LegendRow def={INDICATORS.urgent}/>
                    <LegendRow def={INDICATORS.inTransit}/>
                    <LegendRow def={INDICATORS.done}/>
                    <LegendRow def={INDICATORS.active}/>
                </LegendSection>
                <LegendSection title="Context">
                    <LegendRow def={INDICATORS.related}/>
                </LegendSection>
            </Stack>
        </Box>
        <DialogFooter hideCancel onConfirm={onClose} confirmLabel="Close"/>
    </DialogShell>
);

export default JobListLegendDialog;
