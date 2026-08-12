/**
 * The low-emphasis text button that opens a menu or popover from a panel card
 * bar. Was duplicated verbatim between the Tasks "Filters" control and Driver
 * Locations' "Trucks: On".
 *
 * The current value stays in the label ("Trucks: On", "Filters (2)") so the bar
 * reports the panel's configuration without being opened.
 *
 * Use this when the options are too many or too long for a `SegmentedToggle`;
 * two or three short options belong in the toggle, where the choice is visible
 * without a click.
 */

import React from 'react';
import {Button} from '@mantine/core';
import {ChevronDown} from 'lucide-react';

import {Icon} from '../icon/Icon';
import classes from './PanelControls.module.css';
import {PANEL_CONTROL_GLYPH_SIZE, PANEL_CONTROL_HEIGHT, panelTextButtonStyle} from './panelControlTokens';

export interface HeaderMenuButtonProps extends Omit<React.ComponentPropsWithoutRef<'button'>, 'children'> {
    children: React.ReactNode;
    /** Leading glyph, sized to {@link PANEL_CONTROL_GLYPH_SIZE} by the caller. */
    icon?: React.ReactNode;
    /** Drives `aria-expanded` — pass the menu's open state. */
    opened?: boolean;
}

export const HeaderMenuButton = React.forwardRef<HTMLButtonElement, HeaderMenuButtonProps>(
    function HeaderMenuButton({children, icon, opened, ...rest}, ref) {
        // `rest` is spread last so a Menu/Popover target's injected handler and
        // aria state win over the defaults below.
        return (
            <Button
                ref={ref}
                size="compact-sm"
                h={PANEL_CONTROL_HEIGHT}
                variant="subtle"
                leftSection={icon}
                rightSection={<Icon lucide={ChevronDown} size={PANEL_CONTROL_GLYPH_SIZE}/>}
                aria-haspopup="true"
                aria-expanded={opened ? 'true' : undefined}
                className={classes.control}
                style={panelTextButtonStyle}
                {...rest}
            >
                {children}
            </Button>
        );
    },
);

export default HeaderMenuButton;
