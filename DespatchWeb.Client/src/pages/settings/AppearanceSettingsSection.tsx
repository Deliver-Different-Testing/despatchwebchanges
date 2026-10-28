import React, {useEffect, useRef, useState} from 'react';
import {Button, Group, Radio, SimpleGrid, Stack, Text, TextInput, Tooltip, UnstyledButton} from '@mantine/core';
import {RotateCcw, Save} from 'lucide-react';
import {ActionButton, ACTION_BUTTON_GLYPH_SIZE} from '../../components/common/action-button';
import {Icon} from '../../components/common/icon/Icon';
import {saveUserAppearance, useAppearance} from '../../hooks/useAppearance';
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
import {AppearancePreview, DFRNT_DEFAULT_COLORS} from './AppearancePreview';
import classes from './AppearanceSettingsSection.module.css';

type ContrastChoice = ContrastPreference | 'default';

const CONTRAST_LABELS: Record<ContrastPreference, string> = {
    auto: 'Device setting',
    standard: 'Standard',
    high: 'High',
};

const CONTRAST_DESCRIPTIONS: Record<ContrastPreference, string> = {
    auto: 'Follows your computer.',
    standard: 'The normal look.',
    high: 'Stronger text and borders.',
};

const COLOR_FIELDS: {field: AppearanceColorField; label: string; description: string; where: string; suggestions: string[]}[] = [
    {
        field: 'primary',
        label: 'Primary colour',
        description: 'The app bar, buttons, selected rows and highlights.',
        where: 'with text on the app bar and buttons',
        suggestions: ['#3bc7f4', '#f4c430', '#2a4eff', '#0b7d44', '#824ae0', '#211f40'],
    },
    {
        field: 'secondary',
        label: 'Secondary colour',
        description: 'Links and information accents.',
        where: 'with text on this colour',
        suggestions: ['#2a4eff', '#1b31a8', '#6c3bbe', '#0b7d44', '#0f6f96', '#a12e6b'],
    },
    {
        field: 'textLight',
        label: 'Text colour in the light theme',
        description: 'Body text on light backgrounds.',
        where: 'on light backgrounds',
        suggestions: ['#0d0c2c', '#000000', '#292524', '#132279', '#3b2f2f'],
    },
    {
        field: 'textDark',
        label: 'Text colour in the dark theme',
        description: 'Body text on dark backgrounds.',
        where: 'on dark backgrounds',
        suggestions: ['#e6e1e9', '#ffffff', '#f2f0f5', '#fcefc4', '#d4dcff'],
    },
];

/** Key-order-independent snapshot of a settings object, for change detection. */
function snapshot(settings: AppearanceSettings | null): string {
    return JSON.stringify(Object.entries(settings ?? {}).sort());
}

interface ColorFieldProps {
    field: AppearanceColorField;
    label: string;
    description: string;
    where: string;
    suggestions: string[];
    value: string;
    companyValue: string;
    highContrast: boolean;
    onChange: (value: string) => void;
}

function ColorField({field, label, description, where, suggestions, value, companyValue, highContrast, onChange}: ColorFieldProps) {
    const trimmed = value.trim().toLowerCase();
    const isSet = trimmed !== '';
    const valid = isHexColor(trimmed);
    const shown = valid ? trimmed : companyValue;
    const check = valid ? checkAppearanceColor(field, trimmed, highContrast) : null;
    const fix = check && !check.passes ? fixAppearanceColor(field, trimmed, highContrast) : null;
    const passingSuggestions = suggestions.filter(hex => checkAppearanceColor(field, hex, highContrast).passes);
    const statusId = `appearance-${field}-contrast`;

    let error: string | undefined;
    if (isSet && !valid) error = 'Enter a colour code like #2a4eff.';
    else if (check && !check.passes) error = `Low contrast ${where} (${check.ratio.toFixed(1)}:1). Needs ${check.min}:1 or more.`;

    return (
        <div className={classes.field}>
            <Group align="flex-start" gap="sm" wrap="nowrap">
                <label className={classes.swatch} style={{background: shown}}>
                    <input
                        type="color"
                        aria-label={`Pick ${label.toLowerCase()}`}
                        value={shown}
                        onChange={e => onChange(e.target.value)}
                        className={classes.swatchInput}
                    />
                </label>
                <TextInput
                    label={label}
                    description={description}
                    placeholder={`Company default, ${companyValue}`}
                    value={value}
                    onChange={e => onChange(e.currentTarget.value)}
                    error={error}
                    aria-describedby={statusId}
                    spellCheck={false}
                    style={{flex: 1}}
                />
            </Group>

            <div className={classes.fieldFoot}>
                <div id={statusId} aria-live="polite" className={classes.status}>
                    {check?.passes && (
                        <Text size="xs" c="dimmed">Good contrast {where} ({check.ratio.toFixed(1)}:1).</Text>
                    )}
                    {!isSet && <Text size="xs" c="dimmed">Using the company default.</Text>}
                    {fix && (
                        <Button
                            size="compact-xs"
                            variant="light"
                            leftSection={<span className={classes.fixChip} style={{background: fix}} aria-hidden/>}
                            onClick={() => onChange(fix)}
                        >
                            Use {fix} instead
                        </Button>
                    )}
                </div>

                <Group gap={6} wrap="wrap" role="group" aria-label={`Suggested ${label.toLowerCase()}s`}>
                    {passingSuggestions.map(hex => (
                        <Tooltip key={hex} label={hex} withArrow openDelay={300}>
                            <UnstyledButton
                                className={classes.chip}
                                data-selected={trimmed === hex || undefined}
                                style={{background: hex}}
                                aria-label={`Suggested ${hex}`}
                                aria-pressed={trimmed === hex}
                                onClick={() => onChange(hex)}
                            />
                        </Tooltip>
                    ))}
                    {isSet && (
                        <Button variant="subtle" size="compact-xs" onClick={() => onChange('')}>
                            Use company default
                        </Button>
                    )}
                </Group>
            </div>
        </div>
    );
}

/**
 * The user's own contrast level and colours, layered over the company default a tenant admin
 * sets in the Configurator's Branding page — same controls and checks as that page, so a colour
 * that passes here passes there. A live light/dark preview shows the result before saving.
 */
export const AppearanceSettingsSection: React.FC = () => {
    const {user, tenant, systemPrefersMoreContrast} = useAppearance();
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
    const blocked = COLOR_FIELDS.some(({field}) => {
        const value = draft[field];
        return !!value && (!isHexColor(value) || !checkAppearanceColor(field, value, highContrast).passes);
    });
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
            toastService.showSuccessToast('Colours and contrast saved');
        } catch {
            toastService.showErrorToast("Couldn't save your colours and contrast. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const reset = async () => {
        setSaving(true);
        try {
            await saveUserAppearance(null);
            setDraft({});
            toastService.showSuccessToast('Colours and contrast reset to your company’s');
        } catch {
            toastService.showErrorToast("Couldn't reset your colours and contrast. Check your connection and try again.");
        } finally {
            setSaving(false);
        }
    };

    const companyContrast = CONTRAST_LABELS[tenant?.contrast ?? 'auto'];
    const contrastChoices: {value: ContrastChoice; label: string; description: string}[] = [
        {value: 'default', label: 'Company default', description: `Currently ${companyContrast.toLowerCase()}.`},
        ...(Object.keys(CONTRAST_LABELS) as ContrastPreference[]).map(value => ({
            value,
            label: CONTRAST_LABELS[value],
            description: CONTRAST_DESCRIPTIONS[value],
        })),
    ];

    return (
        <div className={classes.layout}>
            <Stack gap="xl" className={classes.form}>
                <section aria-labelledby="appearance-colours-heading">
                    <Text id="appearance-colours-heading" fw={600} fz="md">Colours</Text>
                    <Text size="sm" c="dimmed" mb="md">
                        Leave a colour empty to use your company’s. Each colour needs enough contrast to read
                        easily before you can save it. Status colours, like Late and Completed, never change.
                    </Text>
                    <Stack gap="lg">
                        {COLOR_FIELDS.map(f => (
                            <ColorField
                                key={f.field}
                                {...f}
                                value={draft[f.field] ?? ''}
                                companyValue={tenant?.[f.field] ?? DFRNT_DEFAULT_COLORS[f.field]}
                                highContrast={highContrast}
                                onChange={value => update({[f.field]: value.toLowerCase()})}
                            />
                        ))}
                    </Stack>
                </section>

                <section aria-labelledby="appearance-contrast-heading">
                    <Text id="appearance-contrast-heading" fw={600} fz="md" mb="sm">Contrast</Text>
                    <Radio.Group
                        aria-labelledby="appearance-contrast-heading"
                        value={draft.contrast ?? 'default'}
                        onChange={choice => update({contrast: choice === 'default' ? undefined : choice as ContrastPreference})}
                    >
                        <SimpleGrid cols={{base: 2, sm: 4}} spacing="xs">
                            {contrastChoices.map(choice => (
                                <Radio.Card
                                    key={choice.value}
                                    value={choice.value}
                                    px="sm"
                                    py={8}
                                    radius="md"
                                    className={classes.contrastCard}
                                    aria-label={choice.label}
                                >
                                    <Group wrap="nowrap" align="flex-start" gap={8}>
                                        <Radio.Indicator size="xs" mt={2}/>
                                        <div>
                                            <Text fw={600} size="xs">{choice.label}</Text>
                                            <Text size="xs" c="dimmed" lh={1.3}>{choice.description}</Text>
                                        </div>
                                    </Group>
                                </Radio.Card>
                            ))}
                        </SimpleGrid>
                    </Radio.Group>
                </section>

                <Group justify="space-between" gap="sm">
                    <ActionButton
                        leftSection={<Icon lucide={RotateCcw} size={ACTION_BUTTON_GLYPH_SIZE}/>}
                        onClick={reset}
                        disabled={saving || !user}
                    >
                        Reset to company default
                    </ActionButton>
                    <Group gap="sm">
                        {blocked && <Text size="xs" c="red">Fix the highlighted colours to save.</Text>}
                        <ActionButton
                            leftSection={<Icon lucide={Save} size={ACTION_BUTTON_GLYPH_SIZE}/>}
                            onClick={save}
                            disabled={saving || !dirty || blocked}
                        >
                            Save colours and contrast
                        </ActionButton>
                    </Group>
                </Group>
            </Stack>

            <div className={classes.preview}>
                <AppearancePreview draft={draft} company={tenant} highContrast={highContrast}/>
            </div>
        </div>
    );
};
