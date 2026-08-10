/**
 * DialogFooter (Mantine)
 *
 * The standard footer: a default (outlined) Cancel and a filled primary action,
 * both `miw={100}`, over a keyline top border. While `submitting` the confirm
 * button shows Mantine's built-in loader and both buttons disable. Buttons are
 * pill-shaped via the theme's Button default radius.
 */
import React from 'react';
import {Button, Group} from '@mantine/core';
import {dialogFooterBorder} from './styles';
import {DialogFooterProps} from "./DialogFooterProps";

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
    hideCancel = false,
    secondaryAction,
}) => (
    <Group
        justify="flex-end"
        gap="sm"
        px="lg"
        py="md"
        style={{borderTop: dialogFooterBorder, backgroundColor: 'var(--mantine-color-white)'}}
    >
        {!hideCancel && (
            <Button variant="default" onClick={onCancel} disabled={submitting} miw={100}>
                {cancelLabel}
            </Button>
        )}
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
