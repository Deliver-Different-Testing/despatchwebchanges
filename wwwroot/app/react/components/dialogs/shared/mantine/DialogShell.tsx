/**
 * DialogShell (Mantine)
 *
 * The standard modal wrapper for the DFRNT dialog design language — the Mantine
 * counterpart to the MUI `shared/DialogShell`. Wraps `<Modal>` with the design
 * defaults: centered, no built-in close button (the header owns it), zero body
 * padding (header/content/footer control their own), the theme's extra-large
 * (28px) radius, and a clipped, fixed-ish width.
 *
 * Compose with <DialogHeader>, a content region and <DialogFooter> as children.
 */
import React from 'react';
import {Modal, type ModalProps} from '@mantine/core';

/**
 * Widths for the MUI `maxWidth` breakpoints the dialogs used to size by. Mantine
 * takes a number, so a dialog converted without one of these silently collapses
 * to the 560 default — pass `size={dialogSize.md}` where the MUI original said
 * `maxWidth="md"`.
 */
export const dialogSize = {
    sm: 560,
    md: 760,
    lg: 1000,
} as const;

export interface DialogShellProps extends Omit<ModalProps, 'title' | 'opened' | 'onClose'> {
    opened: boolean;
    onClose: () => void;
    /** Modal width. Defaults to `dialogSize.sm` (the design's ~480–600 band). */
    size?: ModalProps['size'];
}

export const DialogShell: React.FC<DialogShellProps> = ({
    opened,
    onClose,
    size = dialogSize.sm,
    children,
    styles,
    ...rest
}) => (
    <Modal
        opened={opened}
        onClose={onClose}
        size={size}
        centered
        withCloseButton={false}
        padding={0}
        radius="xl"
        overlayProps={{backgroundOpacity: 0.55, blur: 2}}
        {...rest}
        styles={{
            content: {overflow: 'hidden'},
            body: {padding: 0},
            ...styles,
        }}
    >
        {children}
    </Modal>
);

export default DialogShell;
