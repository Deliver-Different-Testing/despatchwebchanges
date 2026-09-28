/**
 * React Dashboard Settings Dialog
 *
 * The gear dialog behind Dispatch, Job Search and the dashboards: refresh
 * cadences and the classic/new page toggle. Panel visibility is not here — it
 * lives in the Customize Panels dialog, reached from the Layouts menu.
 * Auto-mate settings are not here either — they live on the global Settings
 * page, reached from the sidebar. Follows the dialog design language in CLAUDE.md.
 */

import React, {useState} from 'react';
import {Box, Divider, Group, Select, Paper, Stack, Text} from '@mantine/core';
import {Clock, IdCard, Settings, Sparkles} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
} from '../shared/mantine';
import {SectionHeading, SettingRadioGroup, SettingRow} from '../../common/settings-controls/SettingsControls';
import type {CourierDisplayMode} from '../../../interfaces';

const COURIER_DISPLAY_MODE_OPTIONS: {value: CourierDisplayMode; label: string}[] = [
    {value: 'off', label: 'Off'},
    {value: 'name', label: 'Show Courier Name'},
    {value: 'number', label: 'Show Courier Number'},
    {value: 'both', label: 'Show Name and Number'},
];

// Types that mirror the AngularJS interfaces
export interface RefreshOption {
    id: number;
    text: string;
}

/** A dashboard panel. Owned by the Customize Panels dialog, which imports this. */
export interface DashboardBox {
    name?: string;
    title?: string;
    icon?: string;
    description?: string;
    visible?: boolean;
}

export interface DashboardSettingsConfig {
    title: string;
    showRefreshInterval?: boolean;
    showDriverLocationRefresh?: boolean;
    /** Show the "Tasks" auto-refresh dropdown (its own independent cadence). */
    showTaskRefresh?: boolean;
    /** Show the "Use the new Nationwide" toggle (on by default). Nationwide settings only. */
    showNationwideBetaToggle?: boolean;
    /** Show the "Current Work title" courier display setting. Dispatch page only. */
    showCourierDisplayMode?: boolean;
}

export interface DashboardSettingsResult {
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    selectedTaskRefreshInterval?: RefreshOption;
    /** Set when `showNationwideBetaToggle` is true; the caller persists + redirects. */
    nationwideBetaEnabled?: boolean;
    /** Set when `showCourierDisplayMode` is true; the caller persists + applies it. */
    courierDisplayMode?: CourierDisplayMode;
}

export interface DashboardSettingsDialogProps {
    open: boolean;
    config: DashboardSettingsConfig;
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    selectedTaskRefreshInterval?: RefreshOption;
    refreshOptions: RefreshOption[];
    nationwideBetaEnabled?: boolean;
    selectedCourierDisplayMode?: CourierDisplayMode;
    onClose: () => void;
    onSave: (result: DashboardSettingsResult) => void;
}

/** One "how often does X refresh" row: a label, an explanation and an interval picker. */
function RefreshIntervalSetting({title, description, value, options, onChange}: {
    title: string;
    description: string;
    value: RefreshOption;
    options: RefreshOption[];
    onChange: (option: RefreshOption) => void;
}) {
    return (
        <Paper withBorder radius="md" p={16}>
            <Group justify="space-between" wrap="nowrap" gap={16}>
                <Box>
                    <Text fz="sm" fw={600}>{title}</Text>
                    <Text fz="sm" c="dimmed">{description}</Text>
                </Box>
                <Select
                    size="sm"
                    w={140}
                    aria-label={title}
                    allowDeselect={false}
                    /* Up to three of these render at once over the same options, and
                       Mantine keeps a closed dropdown mounted — without this every
                       interval sits in the DOM several times over. */
                    comboboxProps={{keepMounted: false}}
                    value={String(value.id)}
                    onChange={(selected) => {
                        const option = options.find((o) => String(o.id) === selected);
                        if (option) onChange(option);
                    }}
                    data={options.map((option) => ({value: String(option.id), label: option.text}))}
                />
            </Group>
        </Paper>
    );
}

export const DashboardSettingsDialog: React.FC<DashboardSettingsDialogProps> = ({
    open,
    config,
    selectedRefreshInterval: initialRefreshInterval,
    selectedDriverLocationRefreshInterval: initialDriverInterval,
    selectedTaskRefreshInterval: initialTaskInterval,
    refreshOptions,
    nationwideBetaEnabled: initialNationwideBetaEnabled,
    selectedCourierDisplayMode: initialCourierDisplayMode,
    onClose,
    onSave,
}) => {
    const [refreshInterval, setRefreshInterval] = useState<RefreshOption>(
        initialRefreshInterval ?? {id: 0, text: 'Disabled'}
    );
    const [driverLocationInterval, setDriverLocationInterval] = useState<RefreshOption>(
        initialDriverInterval ?? {id: 0, text: 'Disabled'}
    );
    const [taskInterval, setTaskInterval] = useState<RefreshOption>(
        initialTaskInterval ?? {id: 0, text: 'Disabled'}
    );
    const [nationwideBetaEnabled, setNationwideBetaEnabled] = useState<boolean>(
        initialNationwideBetaEnabled ?? true,
    );
    const [courierDisplayMode, setCourierDisplayMode] = useState<CourierDisplayMode>(
        initialCourierDisplayMode ?? 'off',
    );

    const handleSave = () => {
        onSave({
            selectedRefreshInterval: refreshInterval,
            selectedDriverLocationRefreshInterval: driverLocationInterval,
            selectedTaskRefreshInterval: taskInterval,
            nationwideBetaEnabled: config.showNationwideBetaToggle ? nationwideBetaEnabled : undefined,
            ...(config.showCourierDisplayMode ? {courierDisplayMode} : {}),
        });
    };

    /* Built as a list so the dividers land strictly between whichever sections
       a given page turned on — a per-section trailing rule left one dangling at
       the bottom whenever the last section was switched off. */
    const sections = [
        config.showRefreshInterval && (
            <Box p={24} key="autoRefresh">
                <SectionHeading icon={<Icon lucide={Clock}/>} title="Auto-refresh"/>

                <Stack gap={16}>
                    <RefreshIntervalSetting
                        title="Job list"
                        description="How often the job list checks for new and updated jobs"
                        value={refreshInterval}
                        options={refreshOptions}
                        onChange={setRefreshInterval}
                    />

                    {/* Tasks — an independent cadence from the job list's */}
                    {config.showTaskRefresh && (
                        <RefreshIntervalSetting
                            title="Tasks"
                            description="How often the Tasks panel checks for new and updated tasks"
                            value={taskInterval}
                            options={refreshOptions}
                            onChange={setTaskInterval}
                        />
                    )}

                    {config.showDriverLocationRefresh && (
                        <RefreshIntervalSetting
                            title="Driver locations"
                            description="How often driver positions update on the map"
                            value={driverLocationInterval}
                            options={refreshOptions}
                            onChange={setDriverLocationInterval}
                        />
                    )}
                </Stack>
            </Box>
        ),

        /* Nationwide version toggle — opt-in because the React Nationwide page
           is new and unproven. */
        config.showNationwideBetaToggle && (
            <Box p={24} key="nationwideVersion">
                <SectionHeading icon={<Icon lucide={Sparkles}/>} title="Nationwide version"/>
                <SettingRow
                    title="Try the new Nationwide"
                    description="A rebuilt Nationwide page — faster loads, modern dialogs, and saved
                        layouts that follow your account across browsers and computers. It is still
                        being proven, so the classic page stays the default: turn this on to try it,
                        and off again at any time if you hit a problem. Applies to your account only."
                    checked={nationwideBetaEnabled}
                    onToggle={() => setNationwideBetaEnabled((prev) => !prev)}
                />
            </Box>
        ),

        config.showCourierDisplayMode && (
            <Box p={24} key="courierDisplayMode">
                <SectionHeading icon={<Icon lucide={IdCard}/>} title="Current Work title"/>
                <SettingRadioGroup<CourierDisplayMode>
                    title="Courier info on the Current Work title"
                    description="Choose what shows once a courier is focused in the Current Work panel."
                    value={courierDisplayMode}
                    options={COURIER_DISPLAY_MODE_OPTIONS}
                    onChange={setCourierDisplayMode}
                />
            </Box>
        ),
    ].filter(Boolean);

    return (
        <DialogShell opened={open} onClose={onClose} size={dialogSize.md} label={config.title}>
            <DialogHeader
                icon={<Icon lucide={Settings}/>}
                title={config.title}
                subtitle="Choose how often your dashboard updates and which features are on"
                onClose={onClose}
            />
            {/* Content */}
            <Box bg={dialogContentBg}>
                {sections.map((section, index) => (
                    <React.Fragment key={(section as React.ReactElement).key}>
                        {index > 0 && <Divider/>}
                        {section}
                    </React.Fragment>
                ))}
            </Box>
            {/* Actions */}
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel="Save"
            />
        </DialogShell>
    );
};

export default DashboardSettingsDialog;
