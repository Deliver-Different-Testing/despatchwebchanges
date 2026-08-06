/**
 * CascadeDateConfirmDialog
 *
 * Asks whether a date change on a family parent should also move its linked jobs, listing
 * exactly which ones will move and which will not. Locked and partner legs are shown but
 * cannot be cascaded to, so the user can see the whole blast radius before anything is
 * written.
 */
import React from 'react';
import type {SxProps, Theme} from '@mui/material';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import DialogContent from '@mui/material/DialogContent';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import {DialogShell, DialogHeader, DialogFooter, sectionPaperSx} from '../shared';
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

const memberRowSx = {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    py: 1,
    '&:not(:last-of-type)': {borderBottom: '1px solid', borderColor: 'divider'},
} satisfies SxProps<Theme>;

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
        <DialogShell open={open} onClose={submitting ? undefined : onCancel}>
            <DialogHeader
                icon={<EventRepeatIcon/>}
                title="Apply date to linked jobs?"
                subtitle={`${jobNumber} · ${cascadable.length} linked job${cascadable.length === 1 ? '' : 's'}`}
                onClose={onCancel}
                variant="warning"
                closeDisabled={submitting}
            />
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    <Alert severity="info">
                        {jobNumber} moves to <strong>{newDateLabel}</strong>. Each linked job keeps its own
                        time — only the date changes.
                    </Alert>

                    <Paper elevation={0} sx={sectionPaperSx}>
                        {members.length === 0 && (
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                No linked jobs found.
                            </Typography>
                        )}
                        {members.map((member) => {
                            const reason = reasonLabel(member);
                            return (
                                <Box
                                    key={member.jobId}
                                    sx={{...memberRowSx, opacity: member.cascadable ? 1 : 0.6}}
                                >
                                    <Typography variant="body2" sx={{flex: 1, fontWeight: 500}}>
                                        {member.jobNo ?? `Job ${member.jobId}`}
                                    </Typography>
                                    {reason && <Chip size="small" variant="outlined" label={reason}/>}
                                </Box>
                            );
                        })}
                    </Paper>

                    {blocked.length > 0 && (
                        <Alert severity="warning">
                            {blocked.length} linked job{blocked.length === 1 ? '' : 's'} will not be changed.
                        </Alert>
                    )}
                </Box>
            </DialogContent>
            <DialogFooter
                onCancel={onCancel}
                onConfirm={() => onChoose('all')}
                confirmLabel={`Apply to all ${cascadable.length + 1} jobs`}
                confirmDisabled={cascadable.length === 0}
                submitting={submitting}
                secondaryAction={
                    <Button
                        variant="outlined"
                        onClick={() => onChoose('self')}
                        disabled={submitting}
                        sx={{minWidth: 100, minHeight: 44}}
                    >
                        This job only
                    </Button>
                }
            />
        </DialogShell>
    );
};

export default CascadeDateConfirmDialog;
