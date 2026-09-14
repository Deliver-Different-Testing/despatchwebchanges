/**
 * "Why does this cost what it does?" — the Auto-mate card at the foot of the
 * price breakdown.
 *
 * Written for a dispatcher with a customer on the phone: the headline is the
 * sentence they say first, and `queryRisks` pairs the component most likely to be
 * disputed with the evidence in this job that answers it.
 *
 * The fetch is deferred until the card is opened. A breakdown opened to edit one
 * line is the common case, and there is no reason for it to spend tokens.
 */

import React, {useCallback, useState} from 'react';
import {Alert, Box, Collapse, Group, Loader, Paper, Stack, Text, UnstyledButton} from '@mantine/core';
import {ChevronDown, CircleAlert} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {AutoMateLogo} from '../../common/auto-mate-logo/AutoMateLogo';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {explainPrice} from '../../../services/aiAssistantApi';
import {PriceExplanationResponse} from '../../../interfaces/ai';
import {useAiFeature} from '../../../hooks/useAiFeature';
import {formatCurrency} from '../../../utils/currencyUtils';

export interface PriceExplanationCardProps {
    jobId: number;
    isPrebook: boolean;
    isArchived?: boolean;
}

export const PriceExplanationCard: React.FC<PriceExplanationCardProps> = ({
    jobId,
    isPrebook,
    isArchived = false,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [explanation, setExplanation] = useState<PriceExplanationResponse | null>(null);
    const {runDraft, isDrafting, error} = useAiDraft();
    const aiEnabled = useAiFeature('pricing');

    const handleToggle = useCallback(async () => {
        const next = !expanded;
        setExpanded(next);

        // Deferred, and fetched once: re-opening the card reuses what it has.
        if (!next || explanation || isDrafting) return;

        const response = await runDraft(
            signal => explainPrice(jobId, isPrebook, isArchived, {signal}));
        if (response) setExplanation(response);
    }, [expanded, explanation, isDrafting, runDraft, jobId, isPrebook, isArchived]);

    if (!aiEnabled) {
        return null;
    }

    return (
        <Box px="lg" pb="md">
            <Paper withBorder radius="md" p="md">
                <UnstyledButton onClick={handleToggle} aria-expanded={expanded} w="100%">
                    <Group justify="space-between" wrap="nowrap">
                        <Group gap={8} wrap="nowrap">
                            <AutoMateLogo size={18}/>
                            <Text fz="sm" fw={500}>Explain this price</Text>
                        </Group>
                        <Group gap={8} wrap="nowrap">
                            {isDrafting && <Loader size="xs" aria-label="Explaining this price"/>}
                            <Icon
                                lucide={ChevronDown}
                                size={16}
                                style={{transform: expanded ? 'rotate(180deg)' : undefined}}
                            />
                        </Group>
                    </Group>
                </UnstyledButton>

                <Collapse expanded={expanded}>
                    {error && (
                        <Alert mt="sm" color="red" variant="light" icon={<Icon lucide={CircleAlert}/>}>
                            {error}
                        </Alert>
                    )}

                    {explanation && (
                        <Stack gap="sm" mt="sm">
                            <Text fz="sm" fw={600}>{explanation.headline}</Text>

                            {explanation.lines.map(line => (
                                <Group key={line.name} gap="sm" align="flex-start" wrap="nowrap">
                                    <Text fz="sm" fw={500} miw={120}>{formatCurrency(line.amount)}</Text>
                                    <Box>
                                        <Text fz="sm" fw={500}>{line.name}</Text>
                                        <Text fz="xs" c="dimmed">{line.explanation}</Text>
                                    </Box>
                                </Group>
                            ))}

                            {explanation.queryRisks.length > 0 && (
                                <Alert color="yellow" variant="light" title="Likely to be queried">
                                    <Stack gap={4}>
                                        {explanation.queryRisks.map(risk => (
                                            <Text key={risk.component} fz="sm">
                                                <Text component="span" fw={600}>{risk.component}</Text>
                                                {' — '}{risk.evidence}
                                            </Text>
                                        ))}
                                    </Stack>
                                </Alert>
                            )}

                            {explanation.caveats.map(caveat => (
                                <Text key={caveat} fz="xs" c="dimmed">{caveat}</Text>
                            ))}
                        </Stack>
                    )}
                </Collapse>
            </Paper>
        </Box>
    );
};

export default PriceExplanationCard;
