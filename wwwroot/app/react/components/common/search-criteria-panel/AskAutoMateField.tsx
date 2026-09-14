/**
 * Ask Auto-mate — one line of dispatcher shorthand, turned into search criteria.
 *
 * It fills the form below it and stops. The dispatcher sees the chips and dates
 * populate, adjusts anything wrong, and presses Search themselves, so a misread
 * query costs a glance rather than a wrong result set.
 *
 * Anything the server could not place is shown underneath: an unmatched name and
 * an ignored word are both things the dispatcher has to handle, and silently
 * dropping either is the failure that matters here.
 */

import React, {useCallback, useState} from 'react';
import {ActionIcon, Stack, Text, TextInput, Tooltip} from '@mantine/core';
import {Sparkles} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {parseSearchQuery} from '../../../services/aiAssistantApi';
import {SearchCriteriaResponse} from '../../../interfaces/ai';
import {useAiFeature} from '../../../hooks/useAiFeature';
import {criteriaFieldProps, groupLabelProps} from '../filter-fields';

export interface AskAutoMateFieldProps {
    /** Fired with the resolved criteria for the panel to write into its fields. */
    onParsed: (criteria: SearchCriteriaResponse) => void;
}

export const AskAutoMateField: React.FC<AskAutoMateFieldProps> = ({onParsed}) => {
    const [query, setQuery] = useState('');
    const [result, setResult] = useState<SearchCriteriaResponse | null>(null);
    const {runDraft, isDrafting, error} = useAiDraft();
    const aiEnabled = useAiFeature('formFilling');

    const handleAsk = useCallback(async () => {
        if (!query.trim()) return;

        const response = await runDraft(signal => parseSearchQuery({query}, {signal}));
        if (!response) return;

        setResult(response);
        onParsed(response);
    }, [runDraft, query, onParsed]);

    const handleKeyUp = useCallback((event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
            event.stopPropagation();
            void handleAsk();
        }
    }, [handleAsk]);

    if (!aiEnabled) {
        return null;
    }

    const unplaced = [
        ...(result?.unmatchedNames ?? []).map(name => `No match for "${name}"`),
        ...(result?.ignored ?? []).map(item => `"${item.term}" — ${item.reason}`),
    ];

    return (
        <Stack gap={6} miw={0}>
            <Text {...groupLabelProps}>Ask Auto-mate</Text>
            <TextInput
                {...criteriaFieldProps}
                aria-label="Ask Auto-mate"
                placeholder='e.g. "Smith deliveries last week"'
                value={query}
                onChange={event => setQuery(event.currentTarget.value)}
                onKeyUp={handleKeyUp}
                disabled={isDrafting}
                rightSection={
                    <Tooltip label="Fill the search below" withinPortal>
                        <ActionIcon
                            variant="subtle"
                            color="grape"
                            aria-label="Fill the search from this"
                            loading={isDrafting}
                            disabled={query.trim().length === 0}
                            onClick={handleAsk}
                        >
                            <Icon lucide={Sparkles} size={16}/>
                        </ActionIcon>
                    </Tooltip>
                }
            />
            <Text fz="xs" c="dimmed">Fills the search below. You still press Search.</Text>

            {error && <Text fz="xs" c="red">{error}</Text>}

            {unplaced.map(line => (
                <Text key={line} fz="xs" c="dimmed">{line}</Text>
            ))}
        </Stack>
    );
};

export default AskAutoMateField;
