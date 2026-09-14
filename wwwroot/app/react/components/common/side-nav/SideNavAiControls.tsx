/**
 * The Auto-mate block in the side menu.
 *
 * Auto-mate reaches every page, so its switch belongs somewhere that reaches every
 * page too. The side menu is mounted by the app shell on all nine routes, the three
 * legacy AngularJS pages included, which makes this the one control that is always
 * two clicks away.
 *
 * The master switch is inline because turning AI off should never require finding a
 * dialog first; the five category toggles live behind "Choose what it does", where
 * the extra detail does not crowd the nav.
 *
 * `SideNav` is otherwise nothing but navigation, so this lives in its own component
 * and the nav list stays a list.
 */

import React from 'react';
import {Box, Group, Switch, Text, UnstyledButton} from '@mantine/core';
import {ChevronRight} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {AutoMateLogo} from '../auto-mate-logo/AutoMateLogo';
import {useAiPreferences} from '../../../hooks/useAiFeature';
import {setAiPreferences} from '../../../services/aiPreferenceStore';
import {aiAccentColor} from '../../../theme/designTokens';

export interface SideNavAiControlsProps {
    /** Opens the dialog holding the five category toggles. */
    onOpenSettings: () => void;
}

export const SideNavAiControls: React.FC<SideNavAiControlsProps> = ({onOpenSettings}) => {
    const preferences = useAiPreferences();

    const disabledCount = Object.values(preferences.categories).filter(v => v === false).length;

    return (
        <Box
            px={20}
            py={12}
            style={{borderTop: '1px solid var(--mantine-color-default-border)'}}
        >
            <Group justify="space-between" wrap="nowrap" gap={12}>
                <Group gap={8} wrap="nowrap">
                    <AutoMateLogo size={20}/>
                    <Text fz="sm" fw={600}>Auto-mate</Text>
                </Group>
                <Switch
                    checked={preferences.enabled}
                    aria-label="Auto-mate"
                    onChange={() => setAiPreferences({enabled: !preferences.enabled})}
                    style={{'--switch-bg': aiAccentColor} as React.CSSProperties}
                />
            </Group>

            <UnstyledButton onClick={onOpenSettings} mt={8} w="100%" disabled={!preferences.enabled}>
                <Group justify="space-between" wrap="nowrap" c="dimmed">
                    <Text fz="xs" opacity={preferences.enabled ? 1 : 0.5}>
                        {preferences.enabled
                            ? disabledCount > 0
                                ? `Choose what it does — ${disabledCount} off`
                                : 'Choose what it does'
                            : 'AI features are off'}
                    </Text>
                    {preferences.enabled && <Icon lucide={ChevronRight} size={14}/>}
                </Group>
            </UnstyledButton>
        </Box>
    );
};

export default SideNavAiControls;
