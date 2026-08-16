/**
 * DialogShell (Mantine)
 *
 * The standard modal wrapper for the DFRNT dialog design language — the Mantine
 * counterpart to the MUI `shared/DialogShell`. Wraps `<Modal>` with the design
 * defaults: centered, no built-in close button (the header owns it), zero body
 * padding (header/content/footer control their own), the theme's extra-large
 * (28px) radius, and a clipped, fixed-ish width.
 *
 * The overlay is a light, unblurred scrim on purpose: dialogs open over the
 * dispatch job list and users need to keep reading it while they edit. Dialogs
 * that genuinely want a heavy surround (the POD photo viewer) pass `overlayProps`.
 *
 * Compose with <DialogHeader>, a content region and <DialogFooter> as children.
 */
import React from 'react';
import {Modal} from '@mantine/core';
import {DialogShellProps} from "./DialogShellProps";

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

/**
 * Composed from `Modal.Root`/`Overlay`/`Content`/`Body` rather than the `Modal`
 * shorthand purely so `label` can reach the `role="dialog"` element — `Modal`
 * forwards its extra props to the root, which is not the dialog node.
 */
export const DialogShell: React.FC<DialogShellProps> = ({
    opened,
    onClose,
    size = dialogSize.sm,
    label,
    children,
    styles,
    overlayProps,
    ...rest
}) => (
    <Modal.Root
        opened={opened}
        onClose={onClose}
        size={size}
        centered
        padding={0}
        radius="xl"
        {...rest}
        styles={{
            content: {overflow: 'hidden'},
            body: {padding: 0},
            ...styles,
        }}
    >
        <Modal.Overlay backgroundOpacity={0.25} {...overlayProps} />
        <Modal.Content aria-label={label}>
            <Modal.Body>{children}</Modal.Body>
        </Modal.Content>
    </Modal.Root>
);

export default DialogShell;
