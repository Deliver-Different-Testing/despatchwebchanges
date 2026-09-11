/**
 * DialogShell (Mantine)
 *
 * The standard modal wrapper for the DFRNT dialog design language — the Mantine
 * counterpart to the MUI `shared/DialogShell`. Wraps `<Modal>` with the design
 * defaults: centered, no built-in close button (the header owns it), zero body
 * padding (header/content/footer control their own), the theme's extra-large
 * (28px) radius, a scrollable body (see {@link dialogShellStyles}) and a
 * fixed-ish width.
 *
 * The overlay is a light, unblurred scrim on purpose: dialogs open over the
 * dispatch job list and users need to keep reading it while they edit. Dialogs
 * that genuinely want a heavy surround (the POD photo viewer) pass `overlayProps`.
 *
 * Compose with <DialogHeader>, a content region and <DialogFooter> as children.
 */
import React from 'react';
import {Modal} from '@mantine/core';
import {dialogScrollRegionStyle, dialogShellStyles} from './styles';
import {DialogHeader} from './DialogHeader';
import {DialogFooter} from './DialogFooter';
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

const isChrome = (node: React.ReactNode, kind: React.ElementType): boolean =>
    React.isValidElement(node) && node.type === kind;

/**
 * Splits the children into the three bands of the shell: a leading
 * `<DialogHeader>`, a trailing `<DialogFooter>` and the body in between. Only
 * the body scrolls, so the scrollbar belongs to it alone rather than running
 * the full height of the dialog beside the header bar.
 *
 * A dialog that nests its chrome (inside a fragment, say) simply keeps it in
 * the scrolling band, where the sticky chrome style still pins it — the same
 * behaviour as before this split.
 */
function splitChrome(children: React.ReactNode) {
    const items = React.Children.toArray(children);
    let first = 0;
    while (first < items.length && isChrome(items[first], DialogHeader)) first++;
    let last = items.length;
    while (last > first && isChrome(items[last - 1], DialogFooter)) last--;
    return {header: items.slice(0, first), body: items.slice(first, last), footer: items.slice(last)};
}

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
}) => {
    const {header, body, footer} = splitChrome(children);
    // Merged per slot, not per `styles` object: a caller overriding one property
    // of `content` must not drop the column layout the scrolling body sits in.
    const slotStyles = typeof styles === 'function' ? styles : {
        ...styles,
        content: {...dialogShellStyles.content, ...styles?.content},
        body: {...dialogShellStyles.body, ...styles?.body},
    };

    return (
        <Modal.Root
            opened={opened}
            onClose={onClose}
            size={size}
            centered
            padding={0}
            radius="xl"
            {...rest}
            styles={slotStyles}
        >
            <Modal.Overlay backgroundOpacity={0.25} {...overlayProps} />
            <Modal.Content aria-label={label}>
                <Modal.Body>
                    {header}
                    {/* Stamped so a dialog's own tests can assert on the one
                        element that scrolls without reaching for a class name. */}
                    <div data-dialog-scroll style={dialogScrollRegionStyle}>{body}</div>
                    {footer}
                </Modal.Body>
            </Modal.Content>
        </Modal.Root>
    );
};

export default DialogShell;
