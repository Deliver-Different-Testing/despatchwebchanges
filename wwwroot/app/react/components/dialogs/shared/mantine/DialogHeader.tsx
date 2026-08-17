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
import {dialogStickyChromeStyle, headerChipProps, headerColors, headerOnColor} from './styles';
import {DialogHeaderProps} from "./DialogHeaderProps";

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
            {/* Mantine's own close affordance — it brings the icon, the size ramp
                and the hover, so the header only has to set the on-colour. */}
            <CloseButton
                onClick={onClose}
                disabled={closeDisabled}
                aria-label="Close dialog"
                c={fg}
                iconSize={20}
            />
        </Group>
    );
};

export default DialogHeader;
