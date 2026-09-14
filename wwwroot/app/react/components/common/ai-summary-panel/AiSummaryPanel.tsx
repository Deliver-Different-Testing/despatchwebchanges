/**
 * AiSummaryPanel - Reusable collapsible AI summary card.
 *
 * Displays an AI-generated summary with loading, error, and collapsed states.
 * Used across Task Dashboard, Overview, Compliance, and other pages.
 * Supports cancellation of in-flight requests via AbortSignal.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    ActionIcon, alpha, Badge, Box, Card, Collapse, Group, Loader, Skeleton, Text, Tooltip,
} from '@mantine/core';
import {ChevronDown, ChevronUp, Copy, Square} from 'lucide-react';
import {Icon} from '../icon/Icon';
import classes from './AiSummaryPanel.module.css';
import {aiAccentColor} from '../../../theme/designTokens';
import {formatRelativeTime} from '../../../utils/dateUtils';
import {AiMarkdownRenderer} from './AiMarkdownRenderer';
import {AutoMateLogo} from '../auto-mate-logo/AutoMateLogo';
import type {AiSummaryResponse} from '../../../interfaces/ai';

interface AiSummaryPanelProps {
    title: string;
    fetchSummary: (signal?: AbortSignal) => Promise<AiSummaryResponse>;
    /** Auto-fetch on mount */
    autoFetch?: boolean;
    /** Accent color for the header stripe */
    accentColor?: string;
}

export const AiSummaryPanel: React.FC<AiSummaryPanelProps> = ({
    title,
    fetchSummary,
    autoFetch = false,
    accentColor = aiAccentColor,
}) => {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const [, setTick] = useState(0);
    const [copyTooltip, setCopyTooltip] = useState('Copy to clipboard');
    const abortControllerRef = useRef<AbortController | null>(null);

    // Compute relative time during render — cheap arithmetic, no need for useMemo.
    // The interval below forces periodic re-renders to keep it fresh.
    const relativeTime = generatedAt ? formatRelativeTime(generatedAt) : '';

    // Periodic tick to refresh relative time display
    useEffect(() => {
        if (!generatedAt) return;
        const interval = setInterval(() => setTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, [generatedAt]);

    const loadSummary = useCallback(async () => {
        // Abort any in-flight request
        abortControllerRef.current?.abort();

        const controller = new AbortController();
        abortControllerRef.current = controller;

        setLoading(true);
        setError(null);
        try {
            const response = await fetchSummary(controller.signal);
            setSummary(response.summary);
            setHasFetched(true);
            setGeneratedAt(new Date());
        } catch (e: unknown) {
            if (e instanceof Error && (e.name === 'AbortError' || e.name === 'CanceledError') || controller.signal.aborted) {
                return;
            }
            const message = e instanceof Error ? e.message : 'Failed to generate Auto-mate summary';
            setError(message);
        } finally {
            if (abortControllerRef.current === controller) {
                setLoading(false);
            }
        }
    }, [fetchSummary]);

    const handleStop = useCallback(() => {
        abortControllerRef.current?.abort();
        abortControllerRef.current = null;
        setLoading(false);
    }, []);

    const handleToggle = useCallback(() => {
        const willExpand = !expanded;
        setExpanded(willExpand);
        if (willExpand && !hasFetched && !loading) {
            return loadSummary();
        }
    }, [expanded, hasFetched, loading, loadSummary]);

    const handleCopy = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!summary) return;
        try {
            await navigator.clipboard.writeText(summary);
            setCopyTooltip('Copied!');
        } catch {
            setCopyTooltip('Copy failed');
        }
        setTimeout(() => setCopyTooltip('Copy to clipboard'), 2000);
    }, [summary]);

    // Auto-fetch on mount if requested
    useEffect(() => {
        if (autoFetch && !hasFetched && !loading) {
            setExpanded(true);
            void loadSummary();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Abort in-flight request on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    return (
        <Card
            radius="lg"
            shadow="xs"
            data-testid="ai-summary-card"
            style={{
                overflow: 'hidden',
                borderLeft: `4px solid ${accentColor}`,
            }}
        >
            {/* Header */}
            <Box
                onClick={handleToggle}
                className={classes.header}
                style={{
                    '--accent-tint': alpha(accentColor, 0.04),
                    '--accent-tint-hover': alpha(accentColor, 0.08),
                } as React.CSSProperties & Record<`--${string}`, string>}
            >
                <Group gap={8} wrap="nowrap">
                    <AutoMateLogo size={24} />
                    <Text fz="sm" fw={600}>
                        {title}
                    </Text>
                    <Badge
                        h={18}
                        fz="0.625rem"
                        fw={700}
                        style={{backgroundColor: accentColor, color: '#fff'}}
                    >
                        BETA
                    </Badge>
                </Group>
                <Group gap={4} wrap="nowrap">
                    {generatedAt && !loading && (
                        <Text fz="xs" c="dimmed" mr={4}>
                            {relativeTime}
                        </Text>
                    )}
                    {loading && (
                        <Loader size={16} mr={4} role="progressbar" aria-label="Generating summary" />
                    )}
                    {loading && (
                        <Tooltip label="Stop generating">
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                aria-label="Stop generating"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStop();
                                }}
                            >
                                <Icon lucide={Square} size={18} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                    {summary && !loading && (
                        // Hand-rolled rather than Mantine's <CopyButton>: this reports a
                        // *failure* ("Copy failed") too, which CopyButton's copied-flag
                        // render prop cannot express.
                        <Tooltip label={copyTooltip}>
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                size="sm"
                                aria-label="Copy to clipboard"
                                onClick={handleCopy}
                            >
                                <Icon lucide={Copy} size={16} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                    <Icon lucide={expanded ? ChevronUp : ChevronDown} />
                </Group>
            </Box>

            {/* Content */}
            <Collapse expanded={expanded}>
                <Box pt={8} pb={16} px={16}>
                    {loading && !summary && (
                        <Box py={8}>
                            <Group gap={8} mb={8} wrap="nowrap">
                                <AutoMateLogo size={32} animated />
                                <Text fz="sm" c="dimmed">
                                    Auto-mate is thinking…
                                </Text>
                            </Group>
                            {['90%', '75%', '60%', '80%'].map((w) => (
                                <Skeleton key={w} height={8} width={w} my={6} data-testid="ai-summary-skeleton" />
                            ))}
                        </Box>
                    )}

                    {error && (
                        <Text fz="sm" c="var(--mantine-color-red-6)">
                            {error}
                        </Text>
                    )}

                    {summary && <AiMarkdownRenderer content={summary} />}

                    {!loading && !error && !summary && (
                        <Text fz="sm" c="dimmed">
                            Click to generate an Auto-mate summary.
                        </Text>
                    )}
                </Box>
            </Collapse>
        </Card>
    );
};
