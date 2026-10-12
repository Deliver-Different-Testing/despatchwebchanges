/**
 * The app's raised-chip button: an opaque lozenge with a hairline border and a
 * small shadow, sitting on a card bar. It is the pressable counterpart to
 * `SegmentedToggle`'s indicator — same surface, same accent ladder — so a chip
 * always means "a thing you can press", whether it is one of a set or on its own.
 *
 * Pass `selected` to make it a multi-select toggle: it reports `aria-pressed`
 * and takes the accent border and fill. Leave it off for a plain action, so no
 * pressed state is announced for a button that has none.
 *
 * `variant="filled"` is the second gear: a solid brand lozenge for the one
 * primary action on a bar. It shares the chip's band, radius and press, and
 * lets Mantine own the fill. A primary action is not a toggle — `selected`
 * belongs to the chip gear.
 *
 * Forwards its ref so it can be a `Menu.Target`.
 */

import React from 'react';
import {Button, type ButtonProps} from '@mantine/core';

import classes from './ActionButton.module.css';
import {
    actionButtonAccent,
    actionButtonHeight,
    type ActionButtonSize,
    type ActionButtonVariant,
} from './actionButtonTokens';

// `Button` is polymorphic, so its props are composed by hand: the styling props
// it accepts, plus the native button attributes, minus the three this component
// owns (`variant`, `size`) or re-types (`color`, `style`).
export interface ActionButtonProps
    extends Omit<ButtonProps, 'color' | 'variant' | 'size' | 'style'>,
        Omit<React.ComponentPropsWithoutRef<'button'>, 'color' | 'style'> {
    /** Toggle state. Omit entirely for a plain action button. */
    selected?: boolean;
    /** `chip` is the default raised surface; `filled` is the bar's primary action. */
    variant?: ActionButtonVariant;
    /** `default` sits on a card bar; `compact` sits inside a table row. */
    size?: ActionButtonSize;
    /**
     * A Mantine colour key. On a chip it accents the selected state; on a filled
     * button it is the fill. Defaults to `brand`.
     */
    color?: string;
    style?: React.CSSProperties;
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
    function ActionButton(
        {selected, variant = 'chip', size = 'default', color = 'brand', className, style, children, ...rest},
        ref,
    ) {
        const filled = variant === 'filled';
        return (
            <Button
                ref={ref}
                variant={filled ? 'filled' : 'default'}
                color={filled ? color : undefined}
                size="compact-sm"
                className={[classes.root, filled ? classes.filled : classes.chip, className].filter(Boolean).join(' ')}
                aria-pressed={selected}
                data-selected={selected || undefined}
                // The gear and band are unreachable through the class names (CSS
                // modules mock to `{}` in Jest), so both are published as attributes.
                data-ab-variant={variant}
                data-ab-size={size}
                style={{
                    // Typed to admit the custom properties — `CSSProperties` alone
                    // cannot be indexed by `--*`, which makes the vars unassertable.
                    '--ab-height': `${actionButtonHeight(size)}px`,
                    '--ab-accent': actionButtonAccent(color),
                    ...style,
                } as React.CSSProperties}
                {...rest}
            >
                {children}
            </Button>
        );
    },
);

export default ActionButton;
