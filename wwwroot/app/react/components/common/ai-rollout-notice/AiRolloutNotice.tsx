/**
 * The one-time "Auto-mate is now on" notice.
 *
 * Auto-mate used to be opt-in and is now on by default. Turning a feature on for
 * people without telling them is the single thing every account of default-on AI
 * rollouts names as the cause of the backlash, so this says what changed, what it
 * does, and where the off switch is — once, then never again.
 *
 * Dismissal is stored in the server-side preference blob rather than localStorage,
 * so it is once per person rather than once per browser.
 */

import React from 'react';
import {Anchor, Button, Group, Paper, Stack, Text} from '@mantine/core';
import {AutoMateLogo} from '../auto-mate-logo/AutoMateLogo';
import {useAiPreferences} from '../../../hooks/useAiFeature';
import {setAiPreferences} from '../../../services/aiPreferenceStore';

export interface AiRolloutNoticeProps {
    onOpenSettings: () => void;
}

export const AiRolloutNotice: React.FC<AiRolloutNoticeProps> = ({onOpenSettings}) => {
    const preferences = useAiPreferences();

    // Nothing to announce to someone who has already turned Auto-mate off: they
    // made their choice, and it was honoured.
    if (preferences.noticeSeen || !preferences.enabled) {
        return null;
    }

    const dismiss = () => setAiPreferences({noticeSeen: true});

    const openSettings = () => {
        dismiss();
        onOpenSettings();
    };

    return (
        <Paper
            role="status"
            withBorder
            radius="md"
            p="md"
            m="md"
            style={{borderColor: 'var(--mantine-color-default-border)'}}
        >
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
                <Group gap={12} align="flex-start" wrap="nowrap">
                    <AutoMateLogo size={24}/>
                    <Stack gap={4}>
                        <Text fz="sm" fw={600}>Auto-mate is now on</Text>
                        <Text fz="sm" c="dimmed">
                            It briefs you on a job, drafts messages, explains prices and fills
                            forms from pasted text. It never sends, creates or changes anything
                            on its own — you review every result.{' '}
                            <Anchor component="button" type="button" fz="sm" onClick={openSettings}>
                                Choose what it does
                            </Anchor>
                            , or turn it off from the menu.
                        </Text>
                    </Stack>
                </Group>
                <Button variant="subtle" size="xs" onClick={dismiss}>Got it</Button>
            </Group>
        </Paper>
    );
};

export default AiRolloutNotice;
