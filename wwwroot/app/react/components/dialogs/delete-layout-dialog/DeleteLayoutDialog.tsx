/**
 * DeleteLayoutDialog Component
 *
 * Replaces the native `window.confirm('Delete layout ...?')` used by the Job
 * Search (v2) toolbar's per-layout delete action. Purely confirms the intent —
 * removal/persistence is handled by the caller. Follows the canonical
 * destructive-dialog design language (error palette; see VoidJobConfirmationDialog).
 */

import React from 'react';
import {Alert, Box, Text} from '@mantine/core';
import {Trash2} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {dialogContentBg, DialogFooter, DialogHeader, DialogShell} from '../shared/mantine';
import {DeleteLayoutDialogProps} from "./DeleteLayoutDialogProps";

export const DeleteLayoutDialog: React.FC<DeleteLayoutDialogProps> = ({
    open,
    layoutName,
    onClose,
    onConfirm,
}) => (
    <DialogShell opened={open} onClose={onClose} label="Delete Layout">
        <DialogHeader
            variant="error"
            icon={<Icon lucide={Trash2}/>}
            title="Delete Layout"
            subtitle={layoutName}
            onClose={onClose}
        />

        {/* Content */}
        <Box p="lg" style={{backgroundColor: dialogContentBg}}>
            <Alert color="orange" variant="light">
                <Text size="sm">
                    You are about to delete the layout <strong>{layoutName}</strong>. This cannot be undone, and you&apos;ll be switched back to the Default layout.
                </Text>
            </Alert>
        </Box>

        <DialogFooter
            onCancel={onClose}
            onConfirm={onConfirm}
            confirmLabel="Delete"
            confirmColor="red"
            confirmIcon={<Icon lucide={Trash2} size={16}/>}
        />
    </DialogShell>
);

export default DeleteLayoutDialog;
