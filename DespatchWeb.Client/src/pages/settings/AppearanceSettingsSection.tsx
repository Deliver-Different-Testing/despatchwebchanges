import React, {useEffect, useRef, useState} from 'react';
import {Badge, Box, Button, ColorInput, Group, Paper, Stack, Text} from '@mantine/core';
import {SettingRadioGroup} from '../../components/common/settings-controls/SettingsControls';
import {saveUserAppearance, useAppearance} from '../../hooks/useAppearance';
import {useColorMode} from '../../hooks/useColorMode';
import {toastService} from '../../services/toastService';
import {
    checkAppearanceColor,
    fixAppearanceColor,
    isHexColor,
    mergeAppearance,
    resolveHighContrast,
    type AppearanceColorField,
    type AppearanceSettings,
    type ContrastPreference,
} from '../../theme/appearance';

type ContrastChoice = ContrastPreference | 'default';

const CONTRAST_LABELS: Record<ContrastPreference, string> = {
    auto: 'Follow device setting',
    standard: 'Standard',
    high: 'High',
};

const COLOR_FIELDS: {field: AppearanceColorField; label: string; description: string; swatches: string[]}[] = [
    {
        field: 'primary',
        label: 'Primary colour',
        description: 'Buttons, selected rows and highlights.',
        swatches: ['#3bc7f4', '#f4c430', '#2a4eff', '#0b7d44', '#824ae0', '#211f40'],
    },
    {
        field: 'secondary',
        label: 'Secondary colour',
        description: 'Links and information accents.',
        swatches: ['#2a4eff', '#1b31a8', '#6c3bbe', '#0b7d44', '#3bc7f4', '#f4c430'],
    },
    {
        field: 'textLight',
        label: 'Text colour in the light theme',
        description: 'Body text on light backgrounds.',
        swatches: ['#0d0c2c', '#000000', '#292524', '#132279', '#44403c'],
    },
    {
        field: 'textDark',
        label: 'Text colour in the dark theme',
        description: 'Body text on dark backgrounds.',
        swatches: ['#ffffff', '#f2f0f5', '#e7e5e4', '#d4dcff', '#fcefc4'],
    },
];

/** Key-order-independent snapshot of a settings object, for change detection. */
function snapshot(settings: AppearanceSettings | null): string {
    return JSON.stringify(Object.entries(settings ?? {}).sort());
}

/**
 * The user's own contrast level and colours, layered over the company default a tenant admin
 * sets in the Configurator. Every colour is checked against WCAG before it can be saved, with a
 * one-click fix to the nearest colour that passes.
 */
export const AppearanceSettingsSection: React.FC = () => {
    const {user, tenant, systemPrefersMoreContrast} = useAppearance();
    const {mode} = useColorMode();
    const [draft, setDraft] = useState<AppearanceSettings>(user ?? {});
    const [saving, setSaving] = useState(false);

    // Follow a change that arrives from the server or another tab, unless it would clobber unsaved edits.
    const savedJson = snapshot(user);
    const lastSavedJson = useRef(savedJson);
    useEffect(() => {
        setDraft(current => (snapshot(current) === lastSavedJson.current ? user ?? {} : current));
        lastSavedJson.current = savedJson;
    }, [savedJson, user]);

    const highContrast = resolveHighContrast(mergeAppearance(tenant, draft).contrast, systemPrefersMoreContrast);
    const checks = COLOR_FIELDS.map(({field}) => {
        const value = draft[field];
        if (!value) return null;
        return isHexColor(value) ? checkAppearanceColor(field, value, highContrast) : 'invalid' as const;
    });
    const blocked = checks.some(check => check === 'invalid' || (check !== null && !check.passes));
    const dirty = snapshot(draft) !== savedJson;

    const update = (patch: Partial<AppearanceSettings>) => {
        setDraft(current => {
            const next = {...current, ...patch};
            for (const key of Object.keys(next) as (keyof AppearanceSettings)[]) {
                if (!next[key]) delete next[key];
            }
            return next;
        });
    };

    const save = async () => {
        setSaving(true);
        try {
            await saveUserAppearance(draft);
            toastService.showSuccessToast('Appearance saved');
        } catch {
            toastService.showErrorToast("Couldn't save appearance. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const reset = async () => {
        setSaving(true);
        try {
            await saveUserAppearance(null);
            setDraft({});
            toastService.showSuccessToast('Appearance reset to the company default');
        } catch {
            toastService.showErrorToast("Couldn't reset appearance. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const contrastOptions: {value: ContrastChoice; label: string}[] = [
        {value: 'default', label: `Company default (${CONTRAST_LABELS[tenant?.contrast ?? 'auto']})`},
        ...(Object.keys(CONTRAST_LABELS) as ContrastPreference[]).map(value => ({value, label: CONTRAST_LABELS[value]})),
    ];

    const previewText = (mode === 'light' ? draft.textLight : draft.textDark) ?? 'var(--mantine-color-text)';

    return (
        <Stack gap={16}>
            <SettingRadioGroup<ContrastChoice>
                title="Contrast"
                description="High contrast makes faded text full-strength, strengthens borders and coloured labels, and turns off Liquid Glass. Follow device setting uses your operating system's contrast setting."
                value={draft.contrast ?? 'default'}
                options={contrastOptions}
                onChange={choice => update({contrast: choice === 'default' ? undefined : choice})}
            />

            <Paper withBorder radius="md" p={16}>
                <Stack gap={16}>
                    <Box>
                        <Text fz="sm" fw={600}>Colours</Text>
                        <Text fz="sm" c="dimmed">
                            Leave a colour empty to use the company default. Status colours (such as late,
                            completed and void) stay the same for everyone.
                        </Text>
                    </Box>

                    {COLOR_FIELDS.map(({field, label, description, swatches}, i) => {
                        const check = checks[i];
                        const companyValue = tenant?.[field];
                        return (
                            <Box key={field}>
                                <ColorInput
                                    label={label}
                                    description={description}
                                    value={draft[field] ?? ''}
                                    placeholder={companyValue ? `Company default (${companyValue})` : 'Company default'}
                                    format="hex"
                                    swatches={swatches.filter(hex => checkAppearanceColor(field, hex, highContrast).passes)}
                                    swatchesPerRow={6}
                                    withEyeDropper={false}
                                    onChange={value => update({[field]: value.toLowerCase()})}
                                />
                                {check === 'invalid' && (
                                    <Text size="xs" c="red" mt={4} role="alert">Enter a colour as #rrggbb.</Text>
                                )}
                                {check && check !== 'invalid' && !check.passes && (
                                    <Group gap="xs" mt={4}>
                                        <Text size="xs" c="red" role="alert">
                                            Contrast {check.ratio.toFixed(1)}:1. Needs at least {check.min}:1.
                                        </Text>
                                        <Button
                                            size="compact-xs"
                                            variant="light"
                                            onClick={() => update({[field]: fixAppearanceColor(field, draft[field]!, highContrast) ?? undefined})}
                                        >
                                            Use nearest accessible colour
                                        </Button>
                                    </Group>
                                )}
                                {check && check !== 'invalid' && check.passes && (
                                    <Text size="xs" c="dimmed" mt={4}>Contrast {check.ratio.toFixed(1)}:1</Text>
                                )}
                            </Box>
                        );
                    })}

                    <Paper withBorder radius="sm" p={12} aria-label="Preview">
                        <Text fz="xs" c="dimmed" mb={6}>Preview</Text>
                        <Group gap="sm" wrap="wrap">
                            <Text fz="sm" style={{color: previewText}}>Job 10234 · Collected 9:40am</Text>
                            <Text fz="sm" style={{color: draft.secondary ?? 'var(--mantine-color-anchor)'}}>View details</Text>
                            <Badge size="sm" variant="light" color="green">Completed</Badge>
                            <Button size="compact-sm" color={draft.primary ?? 'brand'}>Dispatch</Button>
                        </Group>
                    </Paper>
                </Stack>
            </Paper>

            <Group justify="flex-end" gap="sm">
                <Button variant="default" onClick={reset} disabled={saving || !user}>
                    Reset to company default
                </Button>
                <Button onClick={save} loading={saving} disabled={!dirty || blocked}>
                    Save appearance
                </Button>
            </Group>
        </Stack>
    );
};
