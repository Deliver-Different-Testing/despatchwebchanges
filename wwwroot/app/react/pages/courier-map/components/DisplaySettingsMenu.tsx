/**
 * DisplaySettingsMenu
 *
 * The courier map's display-settings trigger + popover: two one-click presets (Live/Classic)
 * plus individual controls for marker label, job count and color mode. Deliberately does not
 * repeat the satellite/roadmap/terrain picker — that already lives in the map's own
 * MapZoomViewControls rail; a preset here still drives it, via CourierMapPage's ref.
 */

import React, {useState} from 'react';
import {ActionIcon, Divider, Group, Popover, SegmentedControl, Stack, Switch, Text, Tooltip} from '@mantine/core';
import {Settings} from 'lucide-react';
import {Icon} from '../../../components/common/icon/Icon';
import {CLASSIC_TEMPLATE, LIVE_TEMPLATE, matchesTemplate} from '../CourierMapDisplaySettings';
import type {CourierMapDisplaySettings} from '../CourierMapDisplaySettings';

const ICON_SIZE = 20;

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
                </Stack>
            </Popover.Dropdown>
        </Popover>
    );
}
