/**
 * DisplaySettingsMenu
 *
 * The courier map's marker-settings trigger + popover: a live preview of the flag on top, two
 * one-click presets (Live/Classic), then individual controls for marker label, size, job count
 * and color mode. Deliberately does not repeat the satellite/roadmap/terrain picker — that
 * already lives in the map's own MapZoomViewControls rail; a preset here still drives it, via
 * CourierMapPage's ref.
 */

import React, {useState} from 'react';
import {ActionIcon, ColorInput, Divider, Group, Popover, SegmentedControl, Slider, Stack, Switch, Text, Tooltip, UnstyledButton, useMantineTheme} from '@mantine/core';
import {Settings} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {getMarkerColors} from '../CourierMapPage.types';
import {dfrntBrand} from '../../../theme/dfrntMantineTheme';
import {CLASSIC_TEMPLATE, LIVE_TEMPLATE, matchesTemplate} from '../CourierMapDisplaySettings';
import type {CourierMapDisplaySettings} from '../CourierMapDisplaySettings';
import {
    createCourierFlagSvg,
    DEFAULT_MARKER_SCALE,
    getCourierFlagLines,
    MARKER_SCALE_MAX,
    MARKER_SCALE_MIN,
} from '../../../components/common/here-map/courierFlagSvg';
import type {IAvailableCourierPosition} from '../../../../interfaces/courier.interface';

const ICON_SIZE = 20;

/** Matches the map's own fallback (`getMarkerColors`'s single-mode default) so the preview is accurate before a custom color is picked. */
const DEFAULT_FLAG_BG = '#228be6';
const DEFAULT_FLAG_TEXT = '#ffffff';

/** A stand-in driver so the preview can render through the real flag builder — name and code are
 * deliberately different so switching label mode visibly changes the preview. */
const PREVIEW_COURIER: IAvailableCourierPosition = {
    courierId: 0,
    courierName: 'Dave',
    channelId: 0,
    vehicleType: '',
    code: 'DT4',
    isUrgentArmyDriver: false,
    clearListAreaIDs: [],
    latitude: 0,
    longitude: 0,
    totalJobs: 4,
    overDueJobs: 0,
};

/** Preview-only magnification so the flag reads clearly in a narrow settings popover; purely
 * cosmetic — the size slider's effect is still visible relative to this baseline. */
const PREVIEW_ZOOM = 1.6;

const MARKER_SIZE_MARKS = [
    {value: MARKER_SCALE_MIN, label: 'S'},
    {value: DEFAULT_MARKER_SCALE, label: 'M'},
    {value: MARKER_SCALE_MAX, label: 'L'},
];

/** Quick-pick swatches: the app's own status/brand hexes, so a chosen flag color still reads as "this app" rather than an arbitrary color. */
const FLAG_COLOR_SWATCHES = [
    dfrntBrand.red, dfrntBrand.orange, dfrntBrand.gold, dfrntBrand.green,
    dfrntBrand.cyan, dfrntBrand.reflexBlue, dfrntBrand.purple, dfrntBrand.inkBlue,
];
const TEXT_COLOR_SWATCHES = [dfrntBrand.white, dfrntBrand.inkBlue];

/**
 * Per-option indicator colors for the settings menu's segmented controls, so the
 * highlighted pill is a distinct hue per choice rather than the same neutral fill —
 * a glance at the color tells you what's selected without reading the label.
 * "brand" tracks the tenant's actual primary (cyan/gold), so "Live" always reads as
 * this tenant's own live accent rather than a hardcoded one.
 */
const PRESET_COLORS: Record<'live' | 'classic', string> = {live: 'brand', classic: 'ink'};
const MARKER_LABEL_COLORS: Record<CourierMapDisplaySettings['markerLabel'], string> = {
    name: 'green', number: 'reflex', both: 'grape',
};
const COLOR_MODE_COLORS: Record<'status', string> = {status: 'orange'};

interface DisplaySettingsMenuProps {
    settings: CourierMapDisplaySettings;
    onChange: (settings: CourierMapDisplaySettings) => void;
}

export function DisplaySettingsMenu({settings, onChange}: DisplaySettingsMenuProps) {
    const [opened, setOpened] = useState(false);
    const theme = useMantineTheme();

    const markerScale = settings.markerScale ?? DEFAULT_MARKER_SCALE;
    const previewColors = getMarkerColors(
        theme,
        settings.colorMode,
        settings.colorMode === 'single'
            ? {bg: settings.singleColor ?? DEFAULT_FLAG_BG, text: settings.singleTextColor ?? DEFAULT_FLAG_TEXT}
            : undefined,
    ).active;
    const previewLine = getCourierFlagLines(PREVIEW_COURIER, {
        markerLabel: settings.markerLabel,
        showJobCount: settings.showJobCount,
    }).primary;
    const previewSvg = createCourierFlagSvg({primary: previewLine, secondary: null}, previewColors, markerScale * PREVIEW_ZOOM);

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md">
            <Popover.Target>
                <Tooltip label="Marker settings" position="right">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="md"
                        radius={0}
                        aria-label="Marker settings"
                        onClick={() => setOpened((o) => !o)}
                    >
                        <Icon lucide={Settings} size={ICON_SIZE}/>
                    </ActionIcon>
                </Tooltip>
            </Popover.Target>

            <Popover.Dropdown>
                <Stack gap="sm" miw={220}>
                    <Stack gap={4} align="center">
                        <div
                            data-testid="marker-preview"
                            style={{padding: '6px 0 2px'}}
                            dangerouslySetInnerHTML={{__html: previewSvg}}
                        />
                    </Stack>

                    <Divider/>

                    <Group gap="xs" grow>
                        <SegmentedControl
                            size="xs"
                            fullWidth
                            value={matchesTemplate(settings, LIVE_TEMPLATE) ? 'live'
                                : matchesTemplate(settings, CLASSIC_TEMPLATE) ? 'classic' : ''}
                            onChange={(value) => onChange(value === 'live' ? LIVE_TEMPLATE : CLASSIC_TEMPLATE)}
                            color={PRESET_COLORS[matchesTemplate(settings, LIVE_TEMPLATE) ? 'live' : 'classic']}
                            data={[
                                {label: 'Live', value: 'live'},
                                {label: 'Classic', value: 'classic'},
                            ]}
                        />
                    </Group>

                    <Divider/>

                    <Stack gap={4}>
                        <Text size="xs" fw={600} c="dimmed">Marker label</Text>
                        <SegmentedControl
                            size="xs"
                            fullWidth
                            value={settings.markerLabel}
                            onChange={(value) => onChange({...settings, markerLabel: value as CourierMapDisplaySettings['markerLabel']})}
                            color={MARKER_LABEL_COLORS[settings.markerLabel]}
                            data={[
                                {label: 'Name', value: 'name'},
                                {label: 'Number', value: 'number'},
                                {label: 'Both', value: 'both'},
                            ]}
                        />
                    </Stack>

                    <Stack gap={4}>
                        <Group justify="space-between" gap="xs">
                            <Text size="xs" fw={600} c="dimmed">Marker size</Text>
                            <Text size="xs" c="dimmed">{Math.round(markerScale * 100)}%</Text>
                        </Group>
                        <Slider
                            size="xs"
                            aria-label="Marker size"
                            min={MARKER_SCALE_MIN}
                            max={MARKER_SCALE_MAX}
                            step={0.25}
                            value={markerScale}
                            onChange={(value) => onChange({...settings, markerScale: value})}
                            marks={MARKER_SIZE_MARKS}
                            label={(value) => `${Math.round(value * 100)}%`}
                            mb={18}
                        />
                    </Stack>

                    <Switch
                        label="Show job count"
                        checked={settings.showJobCount}
                        onChange={(event) => onChange({...settings, showJobCount: event.currentTarget.checked})}
                    />

                    <Stack gap={4}>
                        <Text size="xs" fw={600} c="dimmed">Marker color</Text>
                        <SegmentedControl
                            size="xs"
                            fullWidth
                            value={settings.colorMode}
                            onChange={(value) => onChange({...settings, colorMode: value as CourierMapDisplaySettings['colorMode']})}
                            color={settings.colorMode === 'status' ? COLOR_MODE_COLORS.status : (settings.singleColor ?? DEFAULT_FLAG_BG)}
                            data={[
                                {label: 'Color by status', value: 'status'},
                                {label: 'Single color', value: 'single'},
                            ]}
                        />
                    </Stack>

                    {settings.colorMode === 'single' && (
                        <Stack gap={4}>
                            <Group justify="space-between" gap="xs">
                                <Text size="xs" fw={600} c="dimmed">Custom colors</Text>
                                {(settings.singleColor || settings.singleTextColor) && (
                                    <UnstyledButton
                                        onClick={() => onChange({...settings, singleColor: undefined, singleTextColor: undefined})}
                                    >
                                        <Text size="xs" c="blue">Reset</Text>
                                    </UnstyledButton>
                                )}
                            </Group>
                            <ColorInput
                                size="xs"
                                label="Flag color"
                                placeholder="Default blue"
                                value={settings.singleColor ?? DEFAULT_FLAG_BG}
                                onChange={(value) => onChange({...settings, singleColor: value || undefined})}
                                swatches={FLAG_COLOR_SWATCHES}
                                swatchesPerRow={8}
                                popoverProps={{withinPortal: false}}
                            />
                            <ColorInput
                                size="xs"
                                label="Text color"
                                placeholder="Default white"
                                value={settings.singleTextColor ?? DEFAULT_FLAG_TEXT}
                                onChange={(value) => onChange({...settings, singleTextColor: value || undefined})}
                                swatches={TEXT_COLOR_SWATCHES}
                                swatchesPerRow={2}
                                popoverProps={{withinPortal: false}}
                            />
                        </Stack>
                    )}
                </Stack>
            </Popover.Dropdown>
        </Popover>
    );
}
