/**
 * Paste a booking — the Auto-mate intake region at the top of Create Job.
 *
 * The operator pastes the email or phone note the booking arrived as, and
 * Auto-mate fills the form below. It fills; it never submits. Anything a human
 * still has to decide comes back in `unresolved` and is shown before the fields
 * are touched, because that list is the reason to look at the form at all.
 *
 * Renders nothing when the user has not opted into Auto-mate, so the dialog can
 * mount it unconditionally.
 */

import React, {useCallback, useState} from 'react';
import {Alert, Badge, Box, Collapse, Group, Paper, Text, Textarea, UnstyledButton} from '@mantine/core';
import {ChevronDown, CircleAlert, Sparkles} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {AiDraftButton} from '../../common/ai-draft-button/mantine/AiDraftButton';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {extractJobIntake} from '../../../services/aiAssistantApi';
import {JobIntakeResponse} from '../../../interfaces/ai';
import {useAiFeature} from '../../../hooks/useAiFeature';
import {sectionLabelProps, sectionPaperProps} from '../shared/mantine';

/** Longer than a booking ever is; the server truncates too, this just saves the round trip. */
const PASTE_MAX = 8000;

/** Below this the extraction was a guess, and saying so is more use than a number. */
const LOW_CONFIDENCE = 0.5;

export interface PasteBookingPanelProps {
    /** Fired with everything Auto-mate read, for the dialog to write into its fields. */
    onFilled: (result: JobIntakeResponse) => void;
    disabled?: boolean;
}

export const PasteBookingPanel: React.FC<PasteBookingPanelProps> = ({onFilled, disabled = false}) => {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [result, setResult] = useState<JobIntakeResponse | null>(null);
    const {runDraft, isDrafting, error} = useAiDraft();
    const aiEnabled = useAiFeature('formFilling');

    const handleFill = useCallback(async () => {
        const response = await runDraft(signal => extractJobIntake({text}, {signal}));
        if (!response) return;

        setResult(response);
        onFilled(response);
    }, [runDraft, text, onFilled]);

    if (!aiEnabled) {
        return null;
    }

    const lowConfidence = result !== null && result.confidence < LOW_CONFIDENCE;

    return (
        <Box>
            <Group justify="space-between" align="center" mb="xs" wrap="nowrap">
                <Text {...sectionLabelProps} mb={0}>Paste a booking</Text>
            </Group>
            <Paper {...sectionPaperProps}>
                <UnstyledButton
                    onClick={() => setOpen(o => !o)}
                    aria-expanded={open}
                    w="100%"
                >
                    <Group justify="space-between" wrap="nowrap">
                        <Group gap={8} wrap="nowrap">
                            <Icon lucide={Sparkles} size={16}/>
                            <Text fz="sm">
                                Paste the email or phone note and Auto-mate fills the form below
                            </Text>
                        </Group>
                        <Icon
                            lucide={ChevronDown}
                            size={16}
                            style={{transform: open ? 'rotate(180deg)' : undefined}}
                        />
                    </Group>
                </UnstyledButton>

                <Collapse expanded={open}>
                    <Textarea
                        mt="md"
                        label="Booking request"
                        placeholder="Paste the booking email, message or phone note here"
                        autosize
                        minRows={3}
                        maxRows={10}
                        maxLength={PASTE_MAX}
                        value={text}
                        onChange={e => setText(e.currentTarget.value)}
                        disabled={disabled || isDrafting}
                    />

                    <Group mt="sm" justify="space-between" wrap="nowrap">
                        <Text fz="xs" c="dimmed">
                            Auto-mate fills the fields. You check them and create the job.
                        </Text>
                        <AiDraftButton
                            category="formFilling"
                            label="Fill from text"
                            onClick={handleFill}
                            isDrafting={isDrafting}
                            disabled={disabled || text.trim().length === 0}
                        />
                    </Group>

                    {error && (
                        <Alert mt="sm" color="red" variant="light" icon={<Icon lucide={CircleAlert}/>}>
                            {error}
                        </Alert>
                    )}

                    {result && result.unresolved.length > 0 && (
                        <Alert
                            mt="sm"
                            color="yellow"
                            variant="light"
                            icon={<Icon lucide={CircleAlert}/>}
                            title="Check these before creating the job"
                        >
                            {result.unresolved.map((item, index) => (
                                <Text key={`${index}-${item}`} fz="sm">{item}</Text>
                            ))}
                        </Alert>
                    )}

                    {result && result.unresolved.length === 0 && (
                        <Alert mt="sm" color="teal" variant="light" title="Fields filled below">
                            <Group gap="xs">
                                <Text fz="sm">Check each one against the text you pasted.</Text>
                                {lowConfidence && (
                                    <Badge variant="light" color="yellow">Low confidence</Badge>
                                )}
                            </Group>
                        </Alert>
                    )}
                </Collapse>
            </Paper>
        </Box>
    );
};

export default PasteBookingPanel;
