/**
 * AiSummaryCard - Structured AI briefing card.
 *
 * Renders the new StructuredSummaryResponse: verdict + severity chip,
 * key-facts chip strip, "Needs attention" callouts, and optional timeline.
 * Used across job detail, task dashboard, overview, and driver compliance.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    ActionIcon, Alert, Badge, Box, Card, Collapse, CopyButton, Group, Loader, Skeleton, Stack, Text,
    Tooltip, UnstyledButton,
} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {
    Check, ChevronDown, ChevronUp, CircleAlert, CircleCheck, Copy, Info, OctagonAlert, RefreshCw,
    Square, TriangleAlert,
} from 'lucide-react';
import {Icon, type LucideIcon} from '../icon/Icon';
import {SummarySeverity, TimelineStatus} from '../../../services/aiAssistantApi';
import {AutoMateLogo} from '../auto-mate-logo/AutoMateLogo';
import {formatRelativeTime} from '../../../utils/dateUtils';
import type {AttentionItem, StructuredSummaryResponse, TimelineItem} from '../../../interfaces/ai';

interface AiSummaryCardProps {
    title: string;
    fetchSummary: (signal?: AbortSignal) => Promise<StructuredSummaryResponse>;
    /**
     * When true the card renders with a clickable header + chevron and starts
     * collapsed. The first fetch is deferred until the user expands it, so
     * tokens aren't burnt for users who don't open the panel. Subsequent
     * collapse/expand cycles preserve the already-loaded summary.
     *
     * Default (omitted): the card is always expanded and auto-fetches on
     * mount, matching the legacy behaviour used by the task dashboard,
     * overview, and driver compliance call sites.
     */
    collapsible?: boolean;
    /**
     * When true (and `collapsible`), the card starts expanded and fetches on
     * mount instead of waiting for the user to open it. Driven by the user's
     * "Open automatically" Auto-mate setting. Ignored for non-collapsible cards
     * (they're always expanded anyway).
     */
    autoOpen?: boolean;
}

/**
 * One table maps a severity to a Mantine colour, its glyph and its label. Every
 * tonal surface then comes from a `variant="light"` Badge or Alert rather than
 * three hand-mixed alphas per call site.
 */
const severityVisuals: Record<SummarySeverity | 'Ok', {color: string; label: string; glyph: LucideIcon}> = {
    Critical: {color: 'red', label: 'Critical', glyph: OctagonAlert},
    Urgent: {color: 'orange', label: 'Urgent', glyph: CircleAlert},
    Caution: {color: 'orange', label: 'Caution', glyph: TriangleAlert},
    Info: {color: 'reflex', label: 'Info', glyph: Info},
    Ok: {color: 'green', label: 'On track', glyph: CircleCheck},
};

const visualsFor = (severity: SummarySeverity | undefined) =>
    severityVisuals[severity ?? 'Info'] ?? severityVisuals.Ok;

function timelineColor(status: TimelineStatus): string {
    switch (status) {
        case 'Late': return 'red';
        case 'Warning': return 'orange';
        case 'Pending': return 'reflex';
        default: return 'green';
    }
}

/** The quiet section captions inside the card body. */
const overlineProps = {size: 'xs', tt: 'uppercase', lh: 1, c: 'dimmed'} as const;

function buildPlainTextCopy(summary: StructuredSummaryResponse): string {
    const lines: string[] = [summary.verdict];
    if (summary.keyFacts.length > 0) {
        lines.push('', summary.keyFacts.join(' · '));
    }
    if (summary.attention.length > 0) {
        lines.push('', 'Needs attention:');
        for (const item of summary.attention) {
            lines.push(`- ${item.headline} — ${item.action}`);
        }
    }
    if (summary.timeline.length > 0) {
        lines.push('', 'Timeline:');
        for (const item of summary.timeline) {
            lines.push(`- ${item.label}: ${item.detail}`);
        }
    }
    if (summary.highlights.length > 0) {
        lines.push('', 'Highlights:');
        for (const h of summary.highlights) {
            lines.push(`- ${h}`);
        }
    }
    return lines.join('\n');
}

export const AiSummaryCard: React.FC<AiSummaryCardProps> = ({title, fetchSummary, collapsible, autoOpen}) => {
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<StructuredSummaryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const [highlightsOpen, {toggle: toggleHighlights}] = useDisclosure(false);
    const [, setTick] = useState(0);
    // In collapsible mode the card starts collapsed; the first expand kicks
    // off the fetch. Non-collapsible callers stay always-open. With autoOpen
    // a collapsible card starts expanded and fetches on mount.
    const [expanded, setExpanded] = useState(!collapsible || !!autoOpen);
    const hasFetchedRef = useRef(false);
    const abortRef = useRef<AbortController | null>(null);

    const relativeTime = generatedAt ? formatRelativeTime(generatedAt) : '';

    useEffect(() => {
        if (!generatedAt) return;
        const interval = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, [generatedAt]);

    const loadSummary = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError(null);
        try {
            const response = await fetchSummary(controller.signal);
            setSummary(response);
            setGeneratedAt(new Date());
        } catch (e: unknown) {
            if (
                (e instanceof Error && (e.name === 'AbortError' || e.name === 'CanceledError'))
                || controller.signal.aborted
            ) {
                return;
            }
            setError(e instanceof Error ? e.message : 'Failed to generate Auto-mate summary');
        } finally {
            if (abortRef.current === controller) {
                setLoading(false);
            }
        }
    }, [fetchSummary]);

    const handleStop = useCallback(() => {
        abortRef.current?.abort();
        abortRef.current = null;
        setLoading(false);
    }, []);

    const handleRefresh = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        await loadSummary();
    }, [loadSummary]);


    // First-fetch trigger. Non-collapsible cards start expanded, so this
    // fires on mount and matches the legacy behaviour. Collapsible cards
    // start collapsed and only fetch when the user first opens them.
    useEffect(() => {
        if (!expanded) return;
        if (hasFetchedRef.current) return;
        hasFetchedRef.current = true;

        void loadSummary();
    }, [expanded]);

    // Abort any in-flight fetch on unmount.
    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    const handleToggleExpanded = useCallback(() => {
        if (!collapsible) return;
        setExpanded(v => !v);
    }, [collapsible]);

    const visuals = visualsFor(summary?.severity);
    const accent = `var(--mantine-color-${visuals.color}-6)`;

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
                onClick={collapsible ? handleToggleExpanded : undefined}
                onKeyDown={collapsible ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleExpanded();
                    }
                } : undefined}
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
                    <Badge size="xs" color={visuals.color} fw={700}>BETA</Badge>
                    {summary && (
                        <Badge size="sm" variant="light" color={visuals.color} tt="none" fw={600}>
                            {summary.severity === 'Ok' ? 'On track' : summary.severity}
                        </Badge>
                    )}
                </Group>
                <Group gap={4}>
                    {generatedAt && !loading && (
                        <Text size="xs" c="dimmed" mr={4}>{relativeTime}</Text>
                    )}
                    {loading && (
                        <>
                            <Loader size={16} mr={4}/>
                            <Tooltip label="Stop generating">
                                <ActionIcon
                                    variant="subtle"
                                    color="gray"
                                    size="sm"
                                    onClick={(e) => {e.stopPropagation(); handleStop();}}
                                    aria-label="Stop generating"
                                >
                                    <Icon lucide={Square} size={18}/>
                                </ActionIcon>
                            </Tooltip>
                        </>
                    )}
                    {!loading && summary && (
                        <Tooltip label="Refresh">
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                onClick={handleRefresh}
                                aria-label="Refresh summary"
                            >
                                <Icon lucide={RefreshCw} size={18}/>
                            </ActionIcon>
                        </Tooltip>
                    )}
                    {/* `CopyButton` owns the copied flag and its reset timeout, so the
                        card carries no clipboard state of its own. */}
                    {!loading && summary && (
                        <CopyButton value={buildPlainTextCopy(summary)} timeout={2000}>
                            {({copied, copy}) => (
                                <Tooltip label={copied ? 'Copied!' : 'Copy briefing'}>
                                    <ActionIcon
                                        variant="subtle"
                                        color={copied ? 'green' : 'gray'}
                                        size="sm"
                                        onClick={(e) => {e.stopPropagation(); copy();}}
                                        aria-label="Copy briefing"
                                    >
                                        <Icon lucide={copied ? Check : Copy} size={16}/>
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </CopyButton>
                    )}
                    {collapsible && (
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="sm"
                            tabIndex={-1}
                            aria-label={expanded ? 'Collapse Auto-mate briefing' : 'Expand Auto-mate briefing'}
                            onClick={(e) => {e.stopPropagation(); handleToggleExpanded();}}
                        >
                            <Icon lucide={expanded ? ChevronUp : ChevronDown} size={20}/>
                        </ActionIcon>
                    )}
                </Group>
            </Group>
            <Collapse expanded={expanded}>
                <Stack gap="sm" px="md" py="sm">
                    {loading && !summary && (
                        <Box>
                            <Group gap="xs" mb="xs">
                                <AutoMateLogo size={32} animated/>
                                <Text size="sm" c="dimmed">Auto-mate is thinking…</Text>
                            </Group>
                            <Skeleton height={28} width="80%"/>
                            <Skeleton height={12} width="60%" mt={4}/>
                            <Skeleton height={48} mt="xs" radius="xs"/>
                            <Skeleton height={48} mt="xs" radius="xs"/>
                        </Box>
                    )}

                    {error && <Text size="sm" c="red">{error}</Text>}

                    {summary && (
                        <>
                            <Text fz="md" fw={600} style={{lineHeight: 1.4}}>{summary.verdict}</Text>

                            {summary.keyFacts.length > 0 && (
                                <Group gap={6} wrap="wrap">
                                    {summary.keyFacts.map((fact, i) => (
                                        <Badge key={`${fact}-${i}`} size="sm" variant="default" tt="none">
                                            {fact}
                                        </Badge>
                                    ))}
                                </Group>
                            )}

                            {summary.attention.length > 0 && (
                                <Stack gap="xs" mt={4}>
                                    <Text {...overlineProps} style={{letterSpacing: 0.5}}>Needs attention</Text>
                                    {summary.attention.map((item, i) => (
                                        <AttentionCallout key={`${item.headline}-${i}`} item={item}/>
                                    ))}
                                </Stack>
                            )}

                            {summary.timeline.length > 0 && (
                                <Stack gap={4} mt={4}>
                                    <Text {...overlineProps} style={{letterSpacing: 0.5}}>Timeline</Text>
                                    <Group gap={6} wrap="wrap">
                                        {summary.timeline.map((item, i) => (
                                            <TimelinePill key={`${item.label}-${i}`} item={item}/>
                                        ))}
                                    </Group>
                                </Stack>
                            )}

                            {summary.highlights.length > 0 && (
                                <Box>
                                    <UnstyledButton
                                        onClick={toggleHighlights}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            color: 'var(--mantine-color-dimmed)',
                                        }}
                                    >
                                        <Text {...overlineProps} style={{letterSpacing: 0.5}}>
                                            Highlights ({summary.highlights.length})
                                        </Text>
                                        <Icon lucide={highlightsOpen ? ChevronUp : ChevronDown} size={16}/>
                                    </UnstyledButton>
                                    <Collapse expanded={highlightsOpen}>
                                        <Stack component="ul" gap={2} pl="lg" m={0} mt={4}>
                                            {summary.highlights.map((h, i) => (
                                                <li key={`${h}-${i}`}>
                                                    <Text size="sm">{h}</Text>
                                                </li>
                                            ))}
                                        </Stack>
                                    </Collapse>
                                </Box>
                            )}
                        </>
                    )}
                </Stack>
            </Collapse>
        </Card>
    );
};

/**
 * One "needs attention" row. A tinted, icon-led callout with a headline and a
 * body line is exactly Mantine's `Alert`, so the severity only has to pick a
 * colour — the fill, border and icon slot come from the component.
 */
const AttentionCallout: React.FC<{item: AttentionItem}> = ({item}) => {
    const visuals = visualsFor(item.severity);
    return (
        <Alert
            color={visuals.color}
            variant="light"
            radius="md"
            icon={<Icon lucide={visuals.glyph} size={18}/>}
            title={item.headline}
            p={10}
        >
            <Text size="sm" c="dimmed">{item.action}</Text>
        </Alert>
    );
};

const TimelinePill: React.FC<{item: TimelineItem}> = ({item}) => (
    <Badge size="sm" variant="light" color={timelineColor(item.status)} tt="none">
        <Box component="span" style={{fontWeight: 600}}>{item.label}</Box>
        <Box component="span" style={{opacity: 0.85}}> · {item.detail}</Box>
    </Badge>
);
