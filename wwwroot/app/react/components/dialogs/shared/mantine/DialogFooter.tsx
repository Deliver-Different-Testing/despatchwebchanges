/**
 * DialogFooter (Mantine)
 *
 * The standard footer: a default (outlined) Cancel and a filled primary action,
 * both `miw={100}`, over a keyline top border. While `submitting` the confirm
 * button shows Mantine's built-in loader and both buttons disable. Buttons are
 * pill-shaped via the theme's Button default radius.
 */
import React from 'react';
import {Button, type ButtonProps, Group} from '@mantine/core';
import {dialogFooterBorder} from './styles';

export interface DialogFooterProps {
    onCancel: () => void;
    onConfirm: () => void;
    confirmLabel: React.ReactNode;
    cancelLabel?: React.ReactNode;
    /** Icon shown before the confirm label (hidden by the loader while submitting). */
    confirmIcon?: React.ReactNode;
    /** Mantine theme colour for the confirm button. Defaults to the theme primary (Cyan). */
    confirmColor?: ButtonProps['color'];
    /** Disables the confirm button independently of `submitting`. */
    confirmDisabled?: boolean;
    /** When true, shows a loader on confirm and disables both buttons. */
    submitting?: boolean;
    /** Drops the confirm button entirely — for view-only dialogs that only need a close. */
    hideConfirm?: boolean;
    /** Extra control rendered between Cancel and Confirm (e.g. a "Skip" or "Reset"). */
    secondaryAction?: React.ReactNode;
}

export const DialogFooter: React.FC<DialogFooterProps> = ({
    onCancel,
    onConfirm,
    confirmLabel,
    cancelLabel = 'Cancel',
    confirmIcon,
    confirmColor,
    confirmDisabled = false,
    submitting = false,
    hideConfirm = false,
    secondaryAction,
}) => (
    <Group
        justify="flex-end"
        gap="sm"
        px="lg"
        py="md"
        style={{borderTop: dialogFooterBorder, backgroundColor: 'var(--mantine-color-white)'}}
    >
        <Button variant="default" onClick={onCancel} disabled={submitting} miw={100}>
            {cancelLabel}
        </Button>
        {secondaryAction}
        {!hideConfirm && (
            <Button
                onClick={onConfirm}
                color={confirmColor}
                loading={submitting}
                disabled={confirmDisabled}
                leftSection={confirmIcon}
                miw={100}
            >
                {confirmLabel}
            </Button>
        )}
    </Group>
);

export default DialogFooter;
