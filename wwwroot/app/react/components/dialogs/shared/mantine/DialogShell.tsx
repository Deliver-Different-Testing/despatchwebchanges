import React, {useLayoutEffect, useRef, useState} from 'react';
import {Modal} from '@mantine/core';
import {useGlassAllowed} from '../../../../hooks/useGlassStrategy';
import glassClasses from './DialogGlass.module.css';
import {dialogModalShadow, dialogScrollRegionStyle, dialogShellStyles} from './styles';
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

/** Tracks a chrome band's rendered height so the scroll region can run underneath it. */
function useBandHeight() {
    const ref = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(0);
    useLayoutEffect(() => {
        const node = ref.current;
        if (!node) return;
        setHeight(node.offsetHeight);
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
        observer.observe(node);
        return () => observer.disconnect();
    });
    return [ref, height] as const;
}

/**
 * Whether scrolled content currently sits beneath the header (scrolled down) or the footer (more
 * below). Measured on scroll and after each render, committing state only on a change.
 */
function useContentBeneathBars() {
    const ref = useRef<HTMLDivElement>(null);
    const [beneath, setBeneath] = useState({top: false, bottom: false});
    const measure = () => {
        const node = ref.current;
        if (!node) return;
        const top = node.scrollTop > 0;
        const bottom = node.scrollHeight - node.scrollTop - node.clientHeight > 1;
        setBeneath(prev => prev.top === top && prev.bottom === bottom ? prev : {top, bottom});
    };
    useLayoutEffect(measure);
    return [ref, beneath, measure] as const;
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
    const glass = useGlassAllowed();
    const [headerRef, headerHeight] = useBandHeight();
    const [footerRef, footerHeight] = useBandHeight();
    const [scrollRef, beneath, measureBeneath] = useContentBeneathBars();
    // Glass bars float over the body: the scroll region is pulled under them by their own
    // height and padded back, so content still rests clear of the bars at scroll 0.
    const scrollStyle: React.CSSProperties = glass ? {
        ...dialogScrollRegionStyle,
        marginTop: -headerHeight,
        paddingTop: headerHeight,
        marginBottom: -footerHeight,
        paddingBottom: footerHeight,
    } : dialogScrollRegionStyle;
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
            shadow={dialogModalShadow}
            {...rest}
            styles={slotStyles}
        >
            <Modal.Overlay backgroundOpacity={0.32} {...overlayProps} />
            <Modal.Content aria-label={label}>
                <Modal.Body>
                    {glass && header.length > 0
                        ? <div ref={headerRef} className={`${glassClasses.bar} ${glassClasses.header}`} data-glass-active={beneath.top ? '' : undefined}>{header}</div>
                        : header}
                    {/* Stamped so a dialog's own tests can assert on the one
                        element that scrolls without reaching for a class name. */}
                    <div ref={scrollRef} data-dialog-scroll style={scrollStyle} onScroll={measureBeneath}>{body}</div>
                    {glass && footer.length > 0
                        ? <div ref={footerRef} className={`${glassClasses.bar} ${glassClasses.footer}`} data-glass-active={beneath.bottom ? '' : undefined}>{footer}</div>
                        : footer}
                </Modal.Body>
            </Modal.Content>
        </Modal.Root>
    );
};

export default DialogShell;
