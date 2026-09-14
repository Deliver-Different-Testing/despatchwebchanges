/**
 * React Dashboard Settings Dialog
 *
 * The gear dialog behind Dispatch, Job Search and the dashboards: refresh
 * cadences and the classic/new page toggles. Panel visibility is not here — it
 * lives in the Customize Panels dialog, reached from the Layouts menu, and the
 * Auto-mate settings live in their own dialog off the side menu. Follows the
 * dialog design language in CLAUDE.md.
 */

import React, {useState} from 'react';
import {
    Box,
    Divider,
    Group,
    Paper,
    Select,
    Stack,
    Text,
} from '@mantine/core';
import {Clock, Settings, Sparkles} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
} from '../shared/mantine';
import {SectionHeading, SettingRow} from '../../common/setting-row/SettingRow';

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
    /** Show the "Use the new Job Search" toggle (on by default). Job Search settings only. */
    showJobSearchBetaToggle?: boolean;
    /** Show the "Use the new Dispatch" toggle (on by default). Dispatch settings only. */
    showDispatchBetaToggle?: boolean;
    /** Show the "Use the new Nationwide" toggle (on by default). Nationwide settings only. */
    showNationwideBetaToggle?: boolean;
}

export interface DashboardSettingsResult {
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    selectedTaskRefreshInterval?: RefreshOption;
    /** Set when `showJobSearchBetaToggle` is true; the caller persists + redirects. */
    jobSearchBetaEnabled?: boolean;
    /** Set when `showDispatchBetaToggle` is true; the caller persists + redirects. */
    dispatchBetaEnabled?: boolean;
    /** Set when `showNationwideBetaToggle` is true; the caller persists + redirects. */
    nationwideBetaEnabled?: boolean;
}

export interface DashboardSettingsDialogProps {
    open: boolean;
    config: DashboardSettingsConfig;
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    selectedTaskRefreshInterval?: RefreshOption;
    refreshOptions: RefreshOption[];
    jobSearchBetaEnabled?: boolean;
    dispatchBetaEnabled?: boolean;
    nationwideBetaEnabled?: boolean;
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
    jobSearchBetaEnabled: initialJobSearchBetaEnabled,
    dispatchBetaEnabled: initialDispatchBetaEnabled,
    nationwideBetaEnabled: initialNationwideBetaEnabled,
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
    const [jobSearchBetaEnabled, setJobSearchBetaEnabled] = useState<boolean>(
        initialJobSearchBetaEnabled ?? true,
    );
    const [dispatchBetaEnabled, setDispatchBetaEnabled] = useState<boolean>(
        initialDispatchBetaEnabled ?? true,
    );
    const [nationwideBetaEnabled, setNationwideBetaEnabled] = useState<boolean>(
        initialNationwideBetaEnabled ?? true,
    );

    const handleSave = () => {
        onSave({
            selectedRefreshInterval: refreshInterval,
            selectedDriverLocationRefreshInterval: driverLocationInterval,
            selectedTaskRefreshInterval: taskInterval,
            jobSearchBetaEnabled: config.showJobSearchBetaToggle ? jobSearchBetaEnabled : undefined,
            dispatchBetaEnabled: config.showDispatchBetaToggle ? dispatchBetaEnabled : undefined,
            nationwideBetaEnabled: config.showNationwideBetaToggle ? nationwideBetaEnabled : undefined,
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

        /* Job Search version toggle — the React rebuild of /jobSearch is now the
           default; this switches back to the classic page. Caller persists
           localStorage and triggers the route redirect after Save. */
        config.showJobSearchBetaToggle && (
            <Box p={24} key="jobSearchVersion">
                <SectionHeading icon={<Icon lucide={Sparkles}/>} title="Job Search version"/>
                <SettingRow
                    title="Use the new Job Search"
                    description="The rebuilt Job Search is now the default — faster filtering, quicker loads,
                        and modern dialogs. Turn this off to go back to the classic page. Applies to
                        your account only."
                    checked={jobSearchBetaEnabled}
                    onToggle={() => setJobSearchBetaEnabled((prev) => !prev)}
                />
            </Box>
        ),

        /* Nationwide version toggle — opt-in, unlike the other two, because the
           React Nationwide page is new and unproven. */
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

        /* Dispatch version toggle — same deal for the home/dispatch page. */
        config.showDispatchBetaToggle && (
            <Box p={24} key="dispatchVersion">
                <SectionHeading icon={<Icon lucide={Sparkles}/>} title="Dispatch version"/>
                <SettingRow
                    title="Use the new Dispatch"
                    description="The rebuilt Dispatch is now the default — faster loads, modern dialogs, and
                        more customisation options like choosing your columns. Saved layouts follow
                        your account, so they persist across browsers and computers. Turn this off to
                        go back to the classic page. Applies to your account only."
                    checked={dispatchBetaEnabled}
                    onToggle={() => setDispatchBetaEnabled((prev) => !prev)}
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
