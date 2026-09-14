/**
 * The shared building blocks for a settings panel: a section heading and a
 * toggle row.
 *
 * These lived privately inside `DashboardSettingsDialog`, where a comment already
 * recorded that five copies of the row markup had drifted apart. The Auto-mate
 * settings dialog would have been the sixth, so they moved here instead.
 */

import React from 'react';
import {Box, Group, Paper, Switch, Text, ThemeIcon, Title, alpha} from '@mantine/core';
import styles from './SettingRow.module.css';

/**
 * A concrete value, not a Mantine colour name: it feeds inline custom
 * properties and CSS strings, where a name does not resolve.
 */
export const SETTING_BRAND_ACCENT = 'var(--mantine-primary-color-filled)';

/** The tinted square and heading each settings section leads with. */
export function SectionHeading({icon, title, accent = SETTING_BRAND_ACCENT}: {
    icon: React.ReactNode;
    title: string;
    accent?: string;
}) {
    return (
        <Group gap={12} wrap="nowrap" mb={16}>
            <ThemeIcon
                size={36}
                radius="md"
                style={{'--ti-bg': alpha(accent, 0.1), '--ti-color': accent} as React.CSSProperties}
            >
                {icon}
            </ThemeIcon>
            <Title order={5} fw={600}>{title}</Title>
        </Group>
    );
}

/**
 * One setting: a title, an explanation and a control, in a card that is itself
 * the click target.
 */
export function SettingRow({title, description, badge, accent = SETTING_BRAND_ACCENT, checked, disabled, onToggle}: {
    title: string;
    description: React.ReactNode;
    badge?: React.ReactNode;
    accent?: string;
    checked: boolean;
    /** Dims the row and stops both the card and the switch responding. */
    disabled?: boolean;
    onToggle: () => void;
}) {
    return (
        <Paper
            data-setting-row
            data-clickable={disabled ? undefined : true}
            className={styles.settingRow}
            withBorder
            radius="md"
            p={16}
            onClick={disabled ? undefined : onToggle}
            style={{
                '--setting-accent': accent,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
            } as React.CSSProperties}
        >
            <Group justify="space-between" wrap="nowrap" gap={16}>
                <Box>
                    <Group gap={8}>
                        <Text fz="sm" fw={600}>{title}</Text>
                        {badge}
                    </Group>
                    <Text fz="sm" c="dimmed">{description}</Text>
                </Box>
                <Switch
                    checked={checked}
                    disabled={disabled}
                    aria-label={title}
                    /* The card already toggles; without this a click on the switch counts twice. */
                    onClick={(e) => e.stopPropagation()}
                    onChange={onToggle}
                    style={{'--switch-bg': accent} as React.CSSProperties}
                />
            </Group>
        </Paper>
    );
}
