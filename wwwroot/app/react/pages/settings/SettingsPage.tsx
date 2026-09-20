/**
 * Global Settings page, reached from the sidebar.
 *
 * Account-wide preferences that used to be scattered across each dashboard's
 * gear-icon dialog live here instead — starting with Auto-mate, the AI
 * job-briefing feature. Each toggle applies immediately: this is a persistent
 * page, not a transient dialog, so there is no Save/Cancel step.
 */

import React, {useEffect, useState} from 'react';
import {Badge, Box, Stack, Title} from '@mantine/core';
import {SectionHeading, SettingRow} from '../../components/common/settings-controls/SettingsControls';
import {AutoMateLogo} from '../../components/common/auto-mate-logo/AutoMateLogo';
import {aiAccentColor} from '../../theme/designTokens';
import {
    isAiEnabled,
    isAiAutoOpenEnabled,
    setAiEnabled,
    setAiAutoOpenEnabled,
    loadAutoMateFromServer,
} from '../../../functions/aiSettings';

export const SettingsPage: React.FC = () => {
    const [aiEnabled, setAiEnabledState] = useState<boolean>(isAiEnabled);
    const [aiAutoOpen, setAiAutoOpenState] = useState<boolean>(isAiAutoOpenEnabled);

    // localStorage is a synchronous read-through cache of the server value, so
    // the toggles paint instantly from whatever this browser last saw, then
    // reconcile once the server round-trip resolves (same pattern as dispatch
    // layout sync) — this is what carries a setting to another device.
    useEffect(() => {
        void loadAutoMateFromServer().then(() => {
            setAiEnabledState(isAiEnabled());
            setAiAutoOpenState(isAiAutoOpenEnabled());
        });
    }, []);

    const toggleAiEnabled = () => {
        setAiEnabledState((prev) => {
            const next = !prev;
            setAiEnabled(next);
            return next;
        });
    };

    const toggleAiAutoOpen = () => {
        setAiAutoOpenState((prev) => {
            const next = !prev;
            setAiAutoOpenEnabled(next);
            return next;
        });
    };

    return (
        <Box p={24} maw={720}>
            <Title order={3} fw={600} mb={24}>Settings</Title>

            <Box>
                <SectionHeading
                    icon={<AutoMateLogo size={28}/>}
                    title="Auto-mate Settings"
                    accent={aiAccentColor}
                />

                <Stack gap={16}>
                    <SettingRow
                        title="Show Auto-mate briefings"
                        badge={
                            <Badge
                                size="xs"
                                c="white"
                                style={{'--badge-bg': aiAccentColor} as React.CSSProperties}
                            >
                                BETA
                            </Badge>
                        }
                        description="Adds a short AI briefing — verdict, what needs attention, and key facts —
                            to the job details, task dashboard, operations, and driver compliance pages.
                            Applies to your account only."
                        accent={aiAccentColor}
                        checked={aiEnabled}
                        onToggle={toggleAiEnabled}
                    />

                    {/* Only meaningful while briefings are on, so the row is
                        disabled and dimmed when they are off. */}
                    <SettingRow
                        title="Open automatically"
                        description="Opens the Auto-mate briefing expanded instead of waiting for a click.
                            Applies to your account only."
                        accent={aiAccentColor}
                        checked={aiAutoOpen}
                        disabled={!aiEnabled}
                        onToggle={toggleAiAutoOpen}
                    />
                </Stack>
            </Box>
        </Box>
    );
};

export default SettingsPage;
