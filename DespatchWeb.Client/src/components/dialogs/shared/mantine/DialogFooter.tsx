/**
 * DialogFooter (Mantine)
 *
 * The standard footer: a default (outlined) Cancel and a filled primary action,
 * both `miw={100}`, over a keyline top border. While `submitting` the confirm
 * button shows Mantine's built-in loader and both buttons disable. Below the `xs`
 * breakpoint the actions stack full-width, primary on top.
 */
import React from 'react';
import {Button, Flex} from '@mantine/core';
import {dialogFooterBg, dialogFooterBorder, dialogStickyChromeStyle} from './styles';
import {DialogFooterProps} from "./DialogFooterProps";
import {useGlassAllowed} from '../../../../hooks/useGlassStrategy';

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
}) => {
    const glass = useGlassAllowed();
    return (
    <Flex
        direction={{base: 'column-reverse', xs: 'row'}}
        align={{base: 'stretch', xs: 'center'}}
        justify="flex-end"
        wrap="wrap"
        gap="sm"
        px="lg"
        py="md"
        style={{
            borderTop: dialogFooterBorder,
            backgroundColor: glass ? 'transparent' : dialogFooterBg,
            ...dialogStickyChromeStyle('bottom'),
        }}
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
    </Flex>
    );
};

export default DialogFooter;
