/**
 * CascadeDateConfirmDialog
 *
 * Asks whether a date change on a family parent should also move its linked jobs, listing
 * exactly which ones will move and which will not. Locked and partner legs are shown but
 * cannot be cascaded to, so the user can see the whole blast radius before anything is
 * written.
 */
import React from 'react';
import {Alert, Badge, Box, Button, Divider, Group, Paper, Stack, Text} from '@mantine/core';
import {CalendarSync, Info, TriangleAlert} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps,
} from '../shared/mantine';
import type {DateCascadeFamilyMember} from '../../../services/jobDetailApi';

export type CascadeChoice = 'self' | 'all';

export interface CascadeDateConfirmDialogProps {
    open: boolean;
    /** The parent job being edited. */
    jobNumber: string;
    /** The new date, already formatted for display. */
    newDateLabel: string;
    members: DateCascadeFamilyMember[];
    submitting?: boolean;
    onCancel: () => void;
    onChoose: (choice: CascadeChoice) => void;
}

function reasonLabel(member: DateCascadeFamilyMember): string | null {
    if (member.locked) return 'Locked';
    if (member.isPartnerJob) return 'Managed by partner';
    return null;
}

export const CascadeDateConfirmDialog: React.FC<CascadeDateConfirmDialogProps> = ({
    open,
    jobNumber,
    newDateLabel,
    members,
    submitting = false,
    onCancel,
    onChoose,
}) => {
    const cascadable = members.filter((m) => m.cascadable);
    const blocked = members.filter((m) => !m.cascadable);

    return (
        <DialogShell
            opened={open}
            onClose={submitting ? () => {} : onCancel}
            label="Apply date to linked jobs?"
        >
            <DialogHeader
                icon={<Icon lucide={CalendarSync}/>}
                title="Apply date to linked jobs?"
                subtitle={`${jobNumber} · ${cascadable.length} linked job${cascadable.length === 1 ? '' : 's'}`}
                onClose={onCancel}
                variant="warning"
                closeDisabled={submitting}
            />
            <Box p="lg" bg={dialogContentBg}>
                <Stack gap="lg">
                    <Alert color="reflex" variant="light" icon={<Icon lucide={Info} size={18}/>}>
                        {jobNumber} moves to <strong>{newDateLabel}</strong>. Each linked job keeps its own
                        time — only the date changes.
                    </Alert>

                    <Paper {...sectionPaperProps}>
                        {members.length === 0 && (
                            <Text size="sm" c="dimmed">No linked jobs found.</Text>
                        )}
                        {/* Real `Divider`s between rows rather than a
                            `:not(:last-of-type)` rule, so no stylesheet is needed. */}
                        {members.map((member, index) => {
                            const reason = reasonLabel(member);
                            return (
                                <React.Fragment key={member.jobId}>
                                    {index > 0 && <Divider/>}
                                    <Group
                                        gap="xs"
                                        py="xs"
                                        wrap="nowrap"
                                        style={{opacity: member.cascadable ? 1 : 0.6}}
                                    >
                                        <Text size="sm" fw={500} style={{flex: 1}}>
                                            {member.jobNo ?? `Job ${member.jobId}`}
                                        </Text>
                                        {reason && (
                                            <Badge size="sm" variant="outline" color="gray" tt="none">{reason}</Badge>
                                        )}
                                    </Group>
                                </React.Fragment>
                            );
                        })}
                    </Paper>

                    {blocked.length > 0 && (
                        <Alert color="orange" variant="light" icon={<Icon lucide={TriangleAlert} size={18}/>}>
                            {blocked.length} linked job{blocked.length === 1 ? '' : 's'} will not be changed.
                        </Alert>
                    )}
                </Stack>
            </Box>
            <DialogFooter
                onCancel={onCancel}
                onConfirm={() => onChoose('all')}
                confirmLabel={`Apply to all ${cascadable.length + 1} jobs`}
                confirmDisabled={cascadable.length === 0}
                submitting={submitting}
                secondaryAction={
                    <Button
                        variant="default"
                        onClick={() => onChoose('self')}
                        disabled={submitting}
                        miw={100}
                    >
                        This job only
                    </Button>
                }
            />
        </DialogShell>
    );
};

export default CascadeDateConfirmDialog;
