/**
 * Shared settings-page/dialog building blocks: a section heading and a
 * click-anywhere toggle row. Used by DashboardSettingsDialog and SettingsPage
 * so the two surfaces read as one visual language.
 */

import React from 'react';
import {Box, Group, Paper, Radio, Stack, Switch, Text, ThemeIcon, Title, alpha} from '@mantine/core';
import styles from './SettingsControls.module.css';

/**
 * A concrete value, not a Mantine colour name: it feeds inline custom
 * properties and CSS strings, where a name does not resolve.
 */
export const BRAND_ACCENT = 'var(--mantine-primary-color-filled)';

/** The tinted square and heading each settings section leads with. */
export function SectionHeading({icon, title, accent = BRAND_ACCENT}: {
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
 * the click target. Five copies of this markup had drifted apart — the AI rows
 * carried a hover the panel rows did not, and each repeated the switch's
 * stopPropagation by hand.
 */
export function SettingRow({title, description, badge, accent = BRAND_ACCENT, checked, disabled, onToggle}: {
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

/**
 * One setting with several mutually-exclusive options: a title, an
 * explanation and a visible radio group (not a dropdown) — the options are
 * few enough, and the surface is a settings panel rather than a toolbar, so
 * every choice should be visible and comparable at a glance.
 */
export function SettingRadioGroup<T extends string>({title, description, value, options, onChange, accent = BRAND_ACCENT}: {
    title: string;
    description: React.ReactNode;
    value: T;
    options: {value: T; label: string}[];
    onChange: (value: T) => void;
    accent?: string;
}) {
    return (
        <Paper withBorder radius="md" p={16} style={{'--setting-accent': accent} as React.CSSProperties}>
            <Radio.Group
                label={<Text fz="sm" fw={600}>{title}</Text>}
                description={<Text fz="sm" c="dimmed">{description}</Text>}
                value={value}
                onChange={(next) => onChange(next as T)}
            >
                <Stack gap={8} mt={12}>
                    {options.map((option) => (
                        <Radio
                            key={option.value}
                            value={option.value}
                            label={option.label}
                            styles={{radio: {'--radio-color': accent} as React.CSSProperties}}
                        />
                    ))}
                </Stack>
            </Radio.Group>
        </Paper>
    );
}
