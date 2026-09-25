/**
 * The icon button for a panel card bar — 32px band, tooltip, and grow-on-hover.
 * Replaces the `ActionIcon` + `Tooltip` + hover-variable trio that was
 * hand-repeated in three places (once with a hover that never fired).
 *
 * Forwards its ref so it can be a `Menu.Target`.
 */

import React from 'react';
import {ActionIcon, Tooltip} from '@mantine/core';

import classes from './PanelControls.module.css';
import {PANEL_CONTROL_HEIGHT, panelIconButtonClassName} from './panelControlTokens';

export interface HeaderActionIconProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'children'> {
    /** Names the button and, unless `tooltip` overrides it, labels the tooltip. */
    label: string;
    /** Longer tooltip text when the accessible name should stay terse. */
    tooltip?: React.ReactNode;
    children: React.ReactNode;
}

export const HeaderActionIcon = React.forwardRef<HTMLButtonElement, HeaderActionIconProps>(
    function HeaderActionIcon({label, tooltip, children, className, ...rest}, ref) {
        // Everything but the four named props passes straight through: a
        // `Menu.Target` clones this element to inject its own click handler,
        // `aria-haspopup`/`aria-expanded`, and its own (empty) `className` — the
        // last of those must be merged rather than spread after ours, or it wipes
        // out the grow-on-hover class and leaves this the one control on the bar
        // that still washes blue on hover.
        return (
            <Tooltip label={tooltip ?? label} withArrow>
                <ActionIcon
                    ref={ref}
                    size={PANEL_CONTROL_HEIGHT}
                    radius="xl"
                    variant="subtle"
                    aria-label={label}
                    {...rest}
                    className={`${classes.control} ${panelIconButtonClassName} ${className ?? ''}`}
                >
                    {children}
                </ActionIcon>
            </Tooltip>
        );
    },
);

export default HeaderActionIcon;
