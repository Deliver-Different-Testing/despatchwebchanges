/**
 * DialogHeader (Mantine)
 *
 * The solid brand-fill header for the DFRNT dialog design language: a 40×40 icon
 * chip, a title (+ optional subtitle) and a close button, over a flat colour bar.
 * `variant` selects the fill (primary = Ink Blue, error = red, warning = orange,
 * …) — see {@link headerColors}. Single DFRNT brand: no tenant branching.
 *
 * Pass a plain icon element as `icon` (e.g. `icon={<Icon lucide={Bell} />}`); the
 * chip centres and sizes it.
 */
import React from 'react';
import {ActionIcon, Box, Group, Text, alpha} from '@mantine/core';
import {X} from 'lucide-react';
import {DEFAULT_ICON_STROKE} from '../../../common/icon/Icon';
import {headerColors, type HeaderVariant} from './styles';

export interface DialogHeaderProps {
    icon: React.ReactNode;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    onClose: () => void;
    /** Fill palette — "error"/"warning" for destructive/cautionary dialogs. Defaults to "primary". */
    variant?: HeaderVariant;
    /** Disables the close button (e.g. while a submit is in flight). */
    closeDisabled?: boolean;
}

export const DialogHeader: React.FC<DialogHeaderProps> = ({
    icon,
    title,
    subtitle,
    onClose,
    variant = 'primary',
    closeDisabled = false,
}) => {
    const {bg, fg} = headerColors[variant];
    return (
        <Group wrap="nowrap" gap="md" px="lg" py="sm" style={{backgroundColor: bg, color: fg}}>
            <Box
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    backgroundColor: alpha(fg, 0.18),
                    color: fg,
                }}
            >
                {icon}
            </Box>
            <Box style={{flex: 1, minWidth: 0}}>
                <Text fw={600} fz="lg" c={fg}>{title}</Text>
                {subtitle != null && (
                    <Text fz="sm" c={fg} style={{opacity: 0.85}}>{subtitle}</Text>
                )}
            </Box>
            <ActionIcon
                variant="subtle"
                onClick={onClose}
                disabled={closeDisabled}
                aria-label="Close dialog"
                style={{color: fg}}
            >
                <X size={20} strokeWidth={DEFAULT_ICON_STROKE}/>
            </ActionIcon>
        </Group>
    );
};

export default DialogHeader;
