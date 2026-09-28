/**
 * AiBlockersCard - Auto-Mate note blocker/tag extraction.
 *
 * Renders an ExtractBlockersResponse as a chip strip of delivery/pickup
 * blockers pulled from a job's notes. Mirrors AiSummaryCard's collapsible
 * fetch/loading/error/abort lifecycle.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActionIcon, Badge, Box, Card, Collapse, Group, Loader, Skeleton, Stack, Text, Tooltip} from '@mantine/core';
import {ChevronDown, ChevronUp, RefreshCw} from 'lucide-react';
import {Icon} from '../icon/Icon';
import {SummarySeverity} from '../../../services/aiAssistantApi';
import {AutoMateLogo} from '../auto-mate-logo/AutoMateLogo';
import type {ExtractBlockersResponse} from '../../../interfaces/ai';

interface AiBlockersCardProps {
    title: string;
    fetchBlockers: (signal?: AbortSignal) => Promise<ExtractBlockersResponse>;
    collapsible?: boolean;
    autoOpen?: boolean;
}

/**
 * A blocker's severity picks a Mantine colour, so the chips can be plain
 * `Badge variant="light"` — the tonal fill, border and text tint all come from
 * the variant rather than three hand-mixed alphas.
 */
function severityColor(severity: SummarySeverity): string {
    switch (severity) {
        case 'Critical':
        case 'Urgent':
            return 'red';
        case 'Caution':
            return 'orange';
        case 'Info':
            return 'reflex';
        default:
            return 'green';
    }
}

export const AiBlockersCard: React.FC<AiBlockersCardProps> = ({title, fetchBlockers, collapsible, autoOpen}) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ExtractBlockersResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [expanded, setExpanded] = useState(!collapsible || !!autoOpen);
    const hasFetchedRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    const load = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);
        try {
            const response = await fetchBlockers(controller.signal);
            setData(response);
        } catch (e: unknown) {
            if (
                (e instanceof Error && (e.name === 'AbortError' || e.name === 'CanceledError'))
                || controller.signal.aborted
            ) {
                return;
            }
            setError(e instanceof Error ? e.message : 'Failed to extract blockers');
        } finally {
            if (abortRef.current === controller) {
                setLoading(false);
            }
        }
    }, [fetchBlockers]);

    useEffect(() => {
        if (!expanded || hasFetchedRef.current) return;
        hasFetchedRef.current = true;
        void load();
    }, [expanded, load]);

    useEffect(() => () => abortRef.current?.abort(), []);

    const toggle = useCallback(() => {
        if (collapsible) setExpanded(v => !v);
    }, [collapsible]);

    const handleRefresh = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        void load();
    }, [load]);

    const hasBlockers = !!data && data.blockers.length > 0;
    // Amber while something is blocking, green once the notes come back clean.
    const stateColor = hasBlockers ? 'orange' : 'green';
    const accent = `var(--mantine-color-${stateColor}-6)`;

    return (
        <Card
            radius="lg"
            shadow="xs"
            padding={0}
            style={{overflow: 'hidden', borderLeft: `4px solid ${accent}`}}
        >
            <Group
                justify="space-between"
                px="md"
                py={10}
                onClick={collapsible ? toggle : undefined}
                role={collapsible ? 'button' : undefined}
                tabIndex={collapsible ? 0 : undefined}
                aria-expanded={collapsible ? expanded : undefined}
                style={{
                    backgroundColor: `color-mix(in srgb, ${accent} 8%, transparent)`,
                    cursor: collapsible ? 'pointer' : undefined,
                    userSelect: collapsible ? 'none' : undefined,
                }}
            >
                <Group gap="xs">
                    <AutoMateLogo size={24}/>
                    <Text size="sm" fw={600}>{title}</Text>
                    <Badge size="xs" variant="default" fw={700}>BETA</Badge>
                </Group>
                <Group gap={4}>
                    {loading && <Loader size={16} mr={4}/>}
                    {!loading && data && (
                        <Tooltip label="Refresh">
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                onClick={handleRefresh}
                                aria-label="Refresh blockers"
                            >
                                <Icon lucide={RefreshCw} size={18}/>
                            </ActionIcon>
                        </Tooltip>
                    )}
                    {collapsible && (
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            tabIndex={-1}
                            aria-label={expanded ? 'Collapse blockers' : 'Expand blockers'}
                            onClick={(e) => {e.stopPropagation(); toggle();}}
                        >
                            <Icon lucide={expanded ? ChevronUp : ChevronDown} size={20}/>
                        </ActionIcon>
                    )}
                </Group>
            </Group>
            <Collapse expanded={expanded}>
                <Box px="md" py="sm">
                    {loading && !data && (
                        <>
                            <Skeleton height={12} width="50%"/>
                            <Skeleton height={28} mt="xs" radius="xs"/>
                        </>
                    )}
                    {error && <Text size="sm" c="red">{error}</Text>}
                    {data && !hasBlockers && (
                        <Text size="sm" c="dimmed">No blockers detected in the notes.</Text>
                    )}
                    {hasBlockers && (
                        <Stack gap="xs">
                            <Text size="sm" c="dimmed">{data!.summary}</Text>
                            <Group gap={6} wrap="wrap">
                                {data!.blockers.map((b, i) => (
                                    <Tooltip key={`${b.tag}-${i}`} label={b.evidence || ''} disabled={!b.evidence}>
                                        <Badge size="sm" variant="light" tt="none" color={severityColor(b.severity)}>
                                            {b.tag}
                                        </Badge>
                                    </Tooltip>
                                ))}
                            </Group>
                        </Stack>
                    )}
                </Box>
            </Collapse>
        </Card>
    );
};
