/**
 * The Auto-mate chip on a conversation row: what the sender wants, and how long
 * it can wait. Advisory — it orders the dispatcher's attention and nothing else.
 *
 * Only Critical and Urgent get a coloured fill. A list where every row shouts is
 * a list with no ordering in it, so Soon and Routine stay quiet.
 */

import React from 'react';
import {Badge, Group, Text, Tooltip} from '@mantine/core';
import {InboxTriageItem, MessageUrgency} from '../../../interfaces/ai';

const URGENCY_COLOR: Record<MessageUrgency, string> = {
    Critical: 'red',
    Urgent: 'orange',
    Soon: 'gray',
    Routine: 'gray',
};

/** Loud only where it earns it. */
const URGENCY_VARIANT: Record<MessageUrgency, string> = {
    Critical: 'filled',
    Urgent: 'light',
    Soon: 'outline',
    Routine: 'outline',
};

export interface TriageChipProps {
    item: InboxTriageItem;
}

export const TriageChip: React.FC<TriageChipProps> = ({item}) => (
    <Group gap={6} wrap="nowrap" mt={2} data-triage-urgency={item.urgency}>
        <Tooltip label={`Auto-mate: ${item.intent}`} withinPortal>
            <Badge
                size="xs"
                color={URGENCY_COLOR[item.urgency]}
                variant={URGENCY_VARIANT[item.urgency]}
            >
                {item.urgency}
            </Badge>
        </Tooltip>
        <Text fz="xs" c="dimmed" truncate style={{flex: 1}}>{item.summary}</Text>
    </Group>
);

export default TriageChip;
