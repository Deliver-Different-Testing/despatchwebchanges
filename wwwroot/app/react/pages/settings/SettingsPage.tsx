/**
 * Global Settings page, reached from the sidebar.
 *
 * Account-wide preferences that used to be scattered across each dashboard's
 * gear-icon dialog live here instead — starting with Auto-mate, the AI
 * job-briefing feature. Each toggle applies immediately: this is a persistent
 * page, not a transient dialog, so there is no Save/Cancel step.
 */

import React, {useEffect, useState} from 'react';
import {Badge, Box, Group, Stack, Text, Title} from '@mantine/core';
import {MapPin, RotateCcw} from 'lucide-react';
import {SectionHeading, SettingRow} from '../../components/common/settings-controls/SettingsControls';
import {AutoMateLogo} from '../../components/common/auto-mate-logo/AutoMateLogo';
import {Icon} from '../../components/common/icon/Icon';
import {ActionButton, ACTION_BUTTON_GLYPH_SIZE} from '../../components/common/action-button';
import {aiAccentColor} from '../../theme/designTokens';
import {
    isAiEnabled,
    isAiAutoOpenEnabled,
    setAiEnabled,
    setAiAutoOpenEnabled,
    loadAutoMateFromServer,
} from '../../../functions/aiSettings';
import {AddressFormatEditor} from './AddressFormatEditor';
import {parseAddressFormatJson, serializeAddressFormatJson} from '../../components/job-list/jobAddressFormat';
import type {AddressFieldKey} from '../../interfaces/address';
import {StaffPreferenceKey} from '../../../enums/staff-preference-key.enum';
import {deletePreference, getPreference, savePreference} from '../../services/preferencesApi';
import {getTenantAddressFormatDefault} from '../../services/tenantSettingsApi';

export const SettingsPage: React.FC = () => {
    const [aiEnabled, setAiEnabledState] = useState<boolean>(isAiEnabled);
    const [aiAutoOpen, setAiAutoOpenState] = useState<boolean>(isAiAutoOpenEnabled);

    // Address format: the user's own StaffPreference override when set, else
    // pre-filled from the tenant default so editing starts from something
    // sensible. `hasOverride` tracks which of those is currently showing, so
    // "Reset to default" only does something when there is one.
    const [addressFields, setAddressFields] = useState<AddressFieldKey[]>([]);
    const [hasAddressOverride, setHasAddressOverride] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const userFields = parseAddressFormatJson(await getPreference(StaffPreferenceKey.DispatchAddressFormat));
            if (userFields.length) {
                if (!cancelled) {
                    setAddressFields(userFields);
                    setHasAddressOverride(true);
                }
                return;
            }
            const tenantFields = parseAddressFormatJson(await getTenantAddressFormatDefault());
            if (!cancelled) {
                setAddressFields(tenantFields);
                setHasAddressOverride(false);
            }
        })().catch((error) => console.error('Failed to load address format settings:', error));
        return () => {
            cancelled = true;
        };
    }, []);

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

    const handleAddressFieldsChange = (fields: AddressFieldKey[]) => {
        setAddressFields(fields);
        setHasAddressOverride(true);
        void savePreference(StaffPreferenceKey.DispatchAddressFormat, serializeAddressFormatJson(fields))
            .catch((error) => console.error('Failed to save address format preference:', error));
    };

    const handleResetAddressFormat = () => {
        setHasAddressOverride(false);
        void deletePreference(StaffPreferenceKey.DispatchAddressFormat)
            .catch((error) => console.error('Failed to reset address format preference:', error));
        void getTenantAddressFormatDefault()
            .then((tenantJson) => setAddressFields(parseAddressFormatJson(tenantJson)))
            .catch((error) => console.error('Failed to load tenant address format default:', error));
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

            <Box mt={32}>
                <SectionHeading
                    icon={<Icon lucide={MapPin} size={20}/>}
                    title="Address Format"
                />

                <Text fz="sm" c="dimmed" mb={12}>
                    Choose which address fields show on the job list, and in what order.
                    Applies to your account only — your tenant admin sets the default everyone
                    else sees.
                </Text>

                <AddressFormatEditor fields={addressFields} onChange={handleAddressFieldsChange}/>

                <Group justify="flex-end" mt={8}>
                    <ActionButton
                        leftSection={<Icon lucide={RotateCcw} size={ACTION_BUTTON_GLYPH_SIZE}/>}
                        onClick={handleResetAddressFormat}
                        disabled={!hasAddressOverride}
                    >
                        Reset to default
                    </ActionButton>
                </Group>
            </Box>
        </Box>
    );
};

export default SettingsPage;
