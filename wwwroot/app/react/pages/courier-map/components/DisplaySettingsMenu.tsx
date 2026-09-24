/**
 * DisplaySettingsMenu
 *
 * The courier map's display-settings trigger + popover: two one-click presets (Live/Classic)
 * plus individual controls for marker label, job count and color mode. Deliberately does not
 * repeat the satellite/roadmap/terrain picker — that already lives in the map's own
 * MapZoomViewControls rail; a preset here still drives it, via CourierMapPage's ref.
 */

import React, {useState} from 'react';
import {ActionIcon, ColorInput, Divider, Group, Popover, SegmentedControl, Stack, Switch, Text, Tooltip, UnstyledButton} from '@mantine/core';
import {Settings} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {darkenHex} from '../CourierMapPage.types';
import {dfrntBrand} from '../../../theme/dfrntMantineTheme';
import {CLASSIC_TEMPLATE, LIVE_TEMPLATE, matchesTemplate} from '../CourierMapDisplaySettings';
import type {CourierMapDisplaySettings} from '../CourierMapDisplaySettings';

const ICON_SIZE = 20;

/** Same darken fraction the live map applies to a custom flag's border — keeps the preview honest. */
const PREVIEW_BORDER_DARKEN_AMOUNT = 0.2;

/** Matches the map's own fallback (`getMarkerColors`'s single-mode default) so the preview is accurate before a custom color is picked. */
const DEFAULT_FLAG_BG = '#228be6';
const DEFAULT_FLAG_TEXT = '#ffffff';

/** Quick-pick swatches: the app's own status/brand hexes, so a chosen flag color still reads as "this app" rather than an arbitrary color. */
const FLAG_COLOR_SWATCHES = [
    dfrntBrand.red, dfrntBrand.orange, dfrntBrand.gold, dfrntBrand.green,
    dfrntBrand.cyan, dfrntBrand.reflexBlue, dfrntBrand.purple, dfrntBrand.inkBlue,
];
const TEXT_COLOR_SWATCHES = [dfrntBrand.white, dfrntBrand.inkBlue];

/** The same pill-on-a-stem shape `createCourierFlagSvg` draws on the live map, at settings-menu scale. */
function FlagPreview({bg, text}: {bg: string; text: string}) {
    const border = darkenHex(bg, PREVIEW_BORDER_DARKEN_AMOUNT);
    return (
        <Group gap={0} align="stretch" wrap="nowrap" style={{alignSelf: 'flex-start'}}>
            <Stack gap={0} align="flex-start">
                <div
                    style={{
                        background: bg,
                        color: text,
                        border: `1px solid ${border}`,
                        borderRadius: 999,
                        padding: '3px 12px',
                        fontSize: 11,
                        fontWeight: 600,
                        lineHeight: 1.3,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.24)',
                        whiteSpace: 'nowrap',
                    }}
                >
                    Dave 4
                </div>
                <div style={{width: 2, height: 10, marginLeft: 10, background: border}}/>
            </Stack>
        </Group>
    );
}

interface DisplaySettingsMenuProps {
    settings: CourierMapDisplaySettings;
    onChange: (settings: CourierMapDisplaySettings) => void;
}

export function DisplaySettingsMenu({settings, onChange}: DisplaySettingsMenuProps) {
    const [opened, setOpened] = useState(false);

    return (
        <Popover opened={opened} onChange={setOpened} position="bottom-start" withinPortal shadow="md">
            <Popover.Target>
                <Tooltip label="Display settings" position="right">
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="md"
                        radius={0}
                        aria-label="Display settings"
                        onClick={() => setOpened((o) => !o)}
                    >
                        <Icon lucide={Settings} size={ICON_SIZE}/>
                    </ActionIcon>
                </Tooltip>
            </Popover.Target>

            <Popover.Dropdown>
                <Stack gap="sm" miw={220}>
                    <Group gap="xs" grow>
                        <SegmentedControl
                            size="xs"
                            fullWidth
                            value={matchesTemplate(settings, LIVE_TEMPLATE) ? 'live'
                                : matchesTemplate(settings, CLASSIC_TEMPLATE) ? 'classic' : ''}
                            onChange={(value) => onChange(value === 'live' ? LIVE_TEMPLATE : CLASSIC_TEMPLATE)}
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
                            data={[
                                {label: 'Name', value: 'name'},
                                {label: 'Number', value: 'number'},
                                {label: 'Both', value: 'both'},
                            ]}
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
                            <FlagPreview
                                bg={settings.singleColor ?? DEFAULT_FLAG_BG}
                                text={settings.singleTextColor ?? DEFAULT_FLAG_TEXT}
                            />
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
