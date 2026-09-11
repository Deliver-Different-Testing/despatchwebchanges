/**
 * Generic confirm / acknowledge dialog (DFRNT / Mantine).
 *
 * The AngularJS pages reached for `$mdDialog.confirm` and `$mdDialog.alert` in
 * several places that had no React counterpart — sending an agent quote, the
 * "Flight Assignment Required" notice, and a couple of others. Every existing
 * React confirm is purpose-built for one job, so this is the shared one.
 */

import React from 'react';
import {Stack, Text} from '@mantine/core';
import {CircleAlert, TriangleAlert} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogSize} from '../shared/mantine';

export interface ConfirmDialogProps {
    opened: boolean;
    title: string;
    /** Body copy. Pass a node for anything richer than a sentence. */
    message: React.ReactNode;
    /** Omit to render an acknowledge-only dialog with no Cancel. */
    onConfirm?: () => void;
    onClose: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
    /** `warning` for a cautionary confirm, `error` for a destructive one. */
    variant?: 'primary' | 'warning' | 'error';
    submitting?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    opened,
    title,
    message,
    onConfirm,
    onClose,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'primary',
    submitting = false,
}) => {
    // Acknowledge-only: no choice to make, so no Cancel to make it look like one.
    const acknowledgeOnly = !onConfirm;

    return (
        <DialogShell opened={opened} onClose={onClose} size={dialogSize.sm} label={title}>
            <DialogHeader
                icon={<Icon lucide={variant === 'primary' ? CircleAlert : TriangleAlert}/>}
                title={title}
                onClose={onClose}
                variant={variant}
                closeDisabled={submitting}
            />

            <Stack p="md">
                {typeof message === 'string' ? <Text>{message}</Text> : message}
            </Stack>

            <DialogFooter
                onCancel={onClose}
                onConfirm={acknowledgeOnly ? onClose : onConfirm}
                confirmLabel={acknowledgeOnly ? 'OK' : confirmLabel}
                cancelLabel={cancelLabel}
                hideCancel={acknowledgeOnly}
                submitting={submitting}
            />
        </DialogShell>
    );
};

export default ConfirmDialog;
