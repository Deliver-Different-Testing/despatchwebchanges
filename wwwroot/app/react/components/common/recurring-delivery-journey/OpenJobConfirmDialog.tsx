/**
 * Confirm dialog shown when the user clicks a parent or child chip in the
 * Recurring Log timeline. Confirming opens the live job in Job Search in a
 * new tab via openJobInSearch (navigationService.ts).
 *
 * Composed from the shared Mantine dialog primitives per CLAUDE.md.
 */

import React from 'react';
import {Box, Text} from '@mantine/core';
import {ExternalLink} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg, dialogSize} from '../../dialogs/shared/mantine';

interface OpenJobConfirmDialogProps {
    open: boolean;
    jobId: number | null;
    jobNumber: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

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
            opened={open}
            onClose={onCancel}
            size={dialogSize.sm}
            label={`Open job ${displayNumber}`}
        >
            <DialogHeader
                icon={<Icon lucide={ExternalLink}/>}
                title={`Open job ${displayNumber}`}
                subtitle="Job Search will open in a new tab"
                onClose={onCancel}
            />

            <Box p={24} bg={dialogContentBg}>
                <Text>
                    Open the live job <strong>{displayNumber}</strong> in Job Search? It will open in a new browser tab so you can keep this recurring log open.
                </Text>
            </Box>

            <DialogFooter
                onCancel={onCancel}
                onConfirm={onConfirm}
                confirmLabel="Open Job"
                confirmIcon={<Icon lucide={ExternalLink}/>}
            />
        </DialogShell>
    );
};

export default OpenJobConfirmDialog;
