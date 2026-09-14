/**
 * ChangeRequestTriage - advisory Auto-Mate recommendation for a pending job
 * change request. The approver triggers it on demand; the result is a
 * SUGGESTION only — the Approve/Reject buttons remain the human's decision.
 */

import React, {useState} from 'react';
import {Alert, Badge, Box, Group, Stack, Text} from '@mantine/core';
import {CircleCheck, CircleX, Info} from 'lucide-react';
import {Icon, type LucideIcon} from '../common/icon/Icon';
import {useAiDraft} from '../../hooks/useAiDraft';
import {AiDraftButton} from '../common/ai-draft-button/mantine/AiDraftButton';
import {triageChangeRequest} from '../../services/aiAssistantApi';
import type {ChangeRequestTriageResponse} from '../../interfaces/ai';

interface ChangeRequestTriageProps {
    requestId: number;
    jobId: number;
}

/** The recommendation's tone: approve reads green, reject red, anything else neutral. */
type Tone = 'approve' | 'reject' | 'other';

const tones: Record<Tone, {color: string; glyph: LucideIcon}> = {
    approve: {color: 'green', glyph: CircleCheck},
    reject: {color: 'red', glyph: CircleX},
    other: {color: 'reflex', glyph: Info},
};

function toneFor(action: string): Tone {
    if (action === 'approve') return 'approve';
    if (action === 'reject') return 'reject';
    return 'other';
}

export const ChangeRequestTriage: React.FC<ChangeRequestTriageProps> = ({requestId, jobId}) => {
    const {runDraft, isDrafting} = useAiDraft();
    const [result, setResult] = useState<ChangeRequestTriageResponse | null>(null);

    const handleClick = async () => {
        const r = await runDraft((signal) => triageChangeRequest(requestId, jobId, {signal}));
        if (r) setResult(r);
    };

    const tone = result ? tones[toneFor(result.recommendedAction)] : null;

    return (
        <Box style={{flexBasis: '100%', width: '100%'}}>
            <AiDraftButton
                category="triage"
                onClick={handleClick}
                isDrafting={isDrafting}
                label="Auto-Mate recommendation"
            />
            {result && tone && (
                <Alert
                    color={tone.color}
                    variant="light"
                    icon={<Icon lucide={tone.glyph} size={18}/>}
                    mt="xs"
                >
                    <Stack gap={4}>
                        <Group gap="xs" align="center">
                            <Badge size="sm" color={tone.color} tt="none">
                                {`AI: ${result.recommendedAction.toUpperCase()}`}
                            </Badge>
                            <Text size="xs" c="dimmed">
                                {Math.round(result.confidence * 100)}% confidence · suggestion only
                            </Text>
                        </Group>
                        <Text size="sm">{result.rationale}</Text>
                        {result.riskFactors.length > 0 && (
                            <Group gap={4} wrap="wrap">
                                {result.riskFactors.map((rf, i) => (
                                    <Badge key={`${rf}-${i}`} size="sm" variant="outline" color="gray" tt="none">
                                        {rf}
                                    </Badge>
                                ))}
                            </Group>
                        )}
                    </Stack>
                </Alert>
            )}
        </Box>
    );
};
