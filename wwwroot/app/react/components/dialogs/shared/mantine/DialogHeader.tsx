/**
 * DialogHeader (Mantine)
 *
 * The solid brand-fill header for the DFRNT dialog design language: a 40×40 icon
 * chip, a title (+ optional subtitle) and a close button, over a flat colour bar.
 * `variant` selects the fill (primary = Ink Blue on the US tenant, the brand gold
 * elsewhere; error = red, warning = orange, …) — see {@link headerColors}.
 *
 * Pass a plain icon element as `icon` (e.g. `icon={<Icon lucide={Bell} />}`); the
 * chip centres and sizes it.
 */
import React from 'react';
import {Box, CloseButton, Group, Text, ThemeIcon} from '@mantine/core';
import {dialogHeaderBorder, dialogStickyChromeStyle, headerChipProps, headerColors, headerOnColor} from './styles';
import {DialogHeaderProps} from "./DialogHeaderProps";
import classes from './DialogHeader.module.css';

export const DialogHeader: React.FC<DialogHeaderProps> = ({
    icon,
    title,
    subtitle,
    onClose,
    variant = 'primary',
    closeDisabled = false,
    actions,
}) => {
    const fg = headerOnColor(variant);
    return (
        <Group
            wrap="nowrap"
            gap="md"
            px="lg"
            py="sm"
            style={{
                backgroundColor: headerColors[variant].bg,
                color: fg,
                borderBottom: dialogHeaderBorder,
                ...dialogStickyChromeStyle('top'),
            }}
        >
            <ThemeIcon {...headerChipProps(variant)}>
                {icon}
            </ThemeIcon>
            <Box style={{flex: 1, minWidth: 0}}>
                {/* A real heading, so the dialog title is reachable by role and
                    can name the dialog for assistive tech. */}
                <Text component="h2" m={0} fw={600} fz="lg" c={fg}>{title}</Text>
                {subtitle != null && (
                    <Text fz="sm" c={fg} style={{opacity: 0.85}}>{subtitle}</Text>
                )}
            </Box>
            {actions}
            {/* Mantine's own close affordance for the icon and size ramp; hover
                is overridden to grow rather than wash, matching the app bar. */}
            <CloseButton
                onClick={onClose}
                disabled={closeDisabled}
                aria-label="Close dialog"
                c={fg}
                iconSize={20}
                className={classes.closeButton}
            />
        </Group>
    );
};

export default DialogHeader;
