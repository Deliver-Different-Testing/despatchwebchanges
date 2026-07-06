/**
 * Confirm dialog shown when the user clicks a parent or child chip in the
 * Recurring Log timeline. Confirming opens the live job in Job Search in a
 * new tab via openJobInSearch (navigationService.ts).
 *
 * Visual language follows the project's dialog conventions in CLAUDE.md:
 * gradient header, white footer with minWidth: 100 buttons.
 */

import React from 'react';
import Box from '@mui/material/Box';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type {SxProps, Theme} from '@mui/material/styles';
import {DialogShell, DialogHeader, DialogFooter} from '../../dialogs/shared';

interface OpenJobConfirmDialogProps {
    open: boolean;
    jobId: number | null;
    jobNumber: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

const paperSx = {
    minWidth: 420,
    maxWidth: 520,
} satisfies SxProps<Theme>;

export const OpenJobConfirmDialog: React.FC<OpenJobConfirmDialogProps> = ({
    open,
    jobId,
    jobNumber,
    onCancel,
    onConfirm,
}) => {
    const displayNumber = jobNumber ?? (jobId != null ? `#${jobId}` : '');

    return (
        <DialogShell
            open={open}
            onClose={onCancel}
            maxWidth="xs"
            slotProps={{paper: {sx: paperSx}}}
        >
            <DialogHeader
                icon={<OpenInNewIcon/>}
                title={`Open job ${displayNumber}`}
                subtitle="Job Search will open in a new tab"
                onClose={onCancel}
            />

            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3}}>
                    <Typography variant="body1">
                        Open the live job <strong>{displayNumber}</strong> in Job Search? It will open in a new browser tab so you can keep this recurring log open.
                    </Typography>
                </Box>
            </DialogContent>

            <DialogFooter
                onCancel={onCancel}
                onConfirm={onConfirm}
                confirmLabel="Open Job"
                confirmIcon={<OpenInNewIcon/>}
            />
        </DialogShell>
    );
};

export default OpenJobConfirmDialog;
