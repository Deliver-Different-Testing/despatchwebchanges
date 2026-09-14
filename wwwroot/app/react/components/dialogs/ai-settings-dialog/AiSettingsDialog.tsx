/**
 * Auto-mate settings — the master switch and the five category toggles.
 *
 * Five categories rather than one switch per feature: fifteen toggles would be a
 * maintenance treadmill and nobody would read them. They are grouped by what the
 * operator gets, not by which endpoint serves it.
 *
 * Everything here is a **preference**: it decides what the app offers you. It is
 * not a permission — the server-side controls are `Anthropic:Enabled` and the AI
 * rate limiter.
 */

import React from 'react';
import {Alert, Box, Stack, Text} from '@mantine/core';
import {
    DialogFooter,
    DialogHeader,
    DialogShell,
    dialogContentBg,
    dialogSize,
} from '../shared/mantine';
import {SectionHeading, SettingRow} from '../../common/setting-row/SettingRow';
import {AutoMateLogo} from '../../common/auto-mate-logo/AutoMateLogo';
import {useAiPreferences} from '../../../hooks/useAiFeature';
import {AiFeatureCategory, setAiPreferences} from '../../../services/aiPreferenceStore';
import {aiAccentColor} from '../../../theme/designTokens';

interface CategoryCopy {
    key: AiFeatureCategory;
    title: string;
    description: string;
}

/**
 * Described by what the operator sees, not by the endpoint behind it — someone
 * deciding whether to keep a feature is not thinking about `SummarizeJob`.
 */
const CATEGORIES: CategoryCopy[] = [
    {
        key: 'briefings',
        title: 'Briefings and alerts',
        description: 'A short read on a job, your shift, operations or driver compliance — '
            + 'the verdict, what needs attention, and the blockers buried in the notes.',
    },
    {
        key: 'writing',
        title: 'Writing help',
        description: 'Drafts a message, an email, a POD email or a job note for you to edit '
            + 'before it sends. Nothing is ever sent on your behalf.',
    },
    {
        key: 'pricing',
        title: 'Pricing help',
        description: 'Suggests accessorial charges a job supports, and explains an existing '
            + 'price in plain words when a customer queries it.',
    },
    {
        key: 'formFilling',
        title: 'Filling forms from text',
        description: 'Reads a pasted booking into a new job, and turns a typed phrase into '
            + 'search criteria. It fills the form; you check it and submit.',
    },
    {
        key: 'triage',
        title: 'Queue triage',
        description: 'Orders your message inbox by what needs answering first, and flags a '
            + 'recommendation on pending change requests. You still decide.',
    },
];

export interface AiSettingsDialogProps {
    opened: boolean;
    onClose: () => void;
}

export const AiSettingsDialog: React.FC<AiSettingsDialogProps> = ({opened, onClose}) => {
    const preferences = useAiPreferences();

    const isCategoryOn = (key: AiFeatureCategory) => preferences.categories[key] !== false;

    const toggleCategory = (key: AiFeatureCategory) =>
        setAiPreferences({
            categories: {...preferences.categories, [key]: !isCategoryOn(key)},
        });

    const briefingsOn = preferences.enabled && isCategoryOn('briefings');

    return (
        <DialogShell opened={opened} onClose={onClose} size={dialogSize.md} label="Auto-mate settings">
            <DialogHeader
                icon={<AutoMateLogo size={24}/>}
                title="Auto-mate"
                subtitle="Choose which AI features you want. Applies to your account, everywhere you sign in."
                onClose={onClose}
            />

            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Stack gap="lg">
                    <Box>
                        <SectionHeading
                            icon={<AutoMateLogo size={22}/>}
                            title="Auto-mate"
                            accent={aiAccentColor}
                        />
                        <SettingRow
                            title="Use Auto-mate"
                            description="Turns every AI feature on or off, including any added later.
                                DespatchWeb works exactly the same without it."
                            accent={aiAccentColor}
                            checked={preferences.enabled}
                            onToggle={() => setAiPreferences({enabled: !preferences.enabled})}
                        />
                    </Box>

                    <Box>
                        <Text fz="sm" fw={600} mb={8}>What it does</Text>
                        <Stack gap={12}>
                            {CATEGORIES.map(category => (
                                <SettingRow
                                    key={category.key}
                                    title={category.title}
                                    description={category.description}
                                    accent={aiAccentColor}
                                    checked={preferences.enabled && isCategoryOn(category.key)}
                                    disabled={!preferences.enabled}
                                    onToggle={() => toggleCategory(category.key)}
                                />
                            ))}

                            {/* A sub-setting of briefings, so it follows that row rather
                                than standing as a sixth category. */}
                            <SettingRow
                                title="Open briefings automatically"
                                description="Shows the briefing expanded instead of waiting for a click."
                                accent={aiAccentColor}
                                checked={briefingsOn && preferences.autoOpen}
                                disabled={!briefingsOn}
                                onToggle={() => setAiPreferences({autoOpen: !preferences.autoOpen})}
                            />
                        </Stack>
                    </Box>

                    <Alert variant="light" color="gray" title="What Auto-mate never does">
                        <Text fz="sm">
                            It never sends a message, creates a job or changes a price on its own.
                            Every AI result is something you review first.
                        </Text>
                    </Alert>
                </Stack>
            </Box>

            <DialogFooter onCancel={onClose} cancelLabel="Done" hideConfirm/>
        </DialogShell>
    );
};

export default AiSettingsDialog;
