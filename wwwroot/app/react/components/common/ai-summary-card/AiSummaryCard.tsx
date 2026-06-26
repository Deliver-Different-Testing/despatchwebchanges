/**
 * AiSummaryCard - Structured AI briefing card.
 *
 * Renders the new StructuredSummaryResponse: verdict + severity chip,
 * key-facts chip strip, "Needs attention" callouts, and optional timeline.
 * Used across job detail, task dashboard, overview, and driver compliance.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {alpha} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import StopIcon from '@mui/icons-material/Stop';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
    AttentionItem,
    StructuredSummaryResponse,
    SummarySeverity,
    TimelineItem,
    TimelineStatus,
} from '../../../services/aiAssistantApi';
import {AutoMateLogo} from '../auto-mate-logo/AutoMateLogo';
import {formatRelativeTime} from '../../../utils/dateUtils';

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

interface SeverityVisuals {
    color: string;
    bg: string;
    label: string;
    Icon: React.ComponentType<{sx?: SxProps<Theme>; fontSize?: 'inherit' | 'small' | 'medium' | 'large'}>;
}

function severityVisuals(severity: SummarySeverity, theme: Theme): SeverityVisuals {
    switch (severity) {
        case 'Critical':
            return {
                color: theme.palette.error.main,
                bg: alpha(theme.palette.error.main, 0.08),
                label: 'Critical',
                Icon: ReportProblemIcon,
            };
        case 'Urgent':
            return {
                color: theme.palette.warning.dark,
                bg: alpha(theme.palette.warning.main, 0.12),
                label: 'Urgent',
                Icon: ErrorOutlineIcon,
            };
        case 'Caution':
            return {
                color: theme.palette.warning.main,
                bg: alpha(theme.palette.warning.main, 0.08),
                label: 'Caution',
                Icon: WarningAmberIcon,
            };
        case 'Info':
            return {
                color: theme.palette.info.main,
                bg: alpha(theme.palette.info.main, 0.08),
                label: 'Info',
                Icon: InfoOutlinedIcon,
            };
        default:
            return {
                color: theme.palette.success.main,
                bg: alpha(theme.palette.success.main, 0.08),
                label: 'On track',
                Icon: CheckCircleOutlineIcon,
            };
    }
}

function timelineColor(status: TimelineStatus, theme: Theme): string {
    switch (status) {
        case 'Late': return theme.palette.error.main;
        case 'Warning': return theme.palette.warning.main;
        case 'Pending': return theme.palette.info.main;
        default: return theme.palette.success.main;
    }
}

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
    const [highlightsOpen, setHighlightsOpen] = useState(false);
    const [, setTick] = useState(0);
    const [copyTooltip, setCopyTooltip] = useState('Copy briefing');
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

    const handleCopy = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!summary) return;
        const text = buildPlainTextCopy(summary);
        try {
            await navigator.clipboard.writeText(text);
            setCopyTooltip('Copied!');
        } catch {
            setCopyTooltip('Copy failed');
        }
        setTimeout(() => setCopyTooltip('Copy briefing'), 2000);
    }, [summary]);

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

    return (
        <Card sx={(theme) => {
            const v = summary ? severityVisuals(summary.severity, theme) : severityVisuals('Info', theme);
            return {
                borderRadius: 3,
                boxShadow: 1,
                overflow: 'hidden',
                borderLeft: `4px solid ${v.color}`,
            };
        }}>
            <Box
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
                sx={(theme) => {
                    const v = summary ? severityVisuals(summary.severity, theme) : severityVisuals('Info', theme);
                    return {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1.25,
                        bgcolor: v.bg,
                        cursor: collapsible ? 'pointer' : undefined,
                        userSelect: collapsible ? 'none' : undefined,
                    };
                }}>
                <Stack direction="row" spacing={1} sx={{
                    alignItems: "center"
                }}>
                    <AutoMateLogo size={24} />
                    <Typography
                        variant="subtitle2"
                        sx={{
                            fontWeight: 600,
                            color: "text.primary"
                        }}>
                        {title}
                    </Typography>
                    <Chip
                        label="BETA"
                        size="small"
                        sx={(theme) => {
                            const v = summary ? severityVisuals(summary.severity, theme) : severityVisuals('Info', theme);
                            return {
                                height: 18,
                                fontSize: '0.625rem',
                                fontWeight: 700,
                                bgcolor: v.color,
                                color: '#fff',
                            };
                        }}
                    />
                    {summary && (
                        <Chip
                            label={(() => {
                                /* show severity unless trivially Ok */
                                return summary.severity === 'Ok' ? 'On track' : summary.severity;
                            })()}
                            size="small"
                            sx={(theme) => {
                                const v = severityVisuals(summary.severity, theme);
                                return {
                                    height: 20,
                                    fontWeight: 600,
                                    bgcolor: alpha(v.color, 0.16),
                                    color: v.color,
                                    border: `1px solid ${alpha(v.color, 0.4)}`,
                                };
                            }}
                        />
                    )}
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{
                    alignItems: "center"
                }}>
                    {generatedAt && !loading && (
                        <Typography
                            variant="caption"
                            sx={{
                                color: "text.disabled",
                                mr: 0.5
                            }}>
                            {relativeTime}
                        </Typography>
                    )}
                    {loading && (
                        <>
                            <CircularProgress size={16} sx={{mr: 0.5}} />
                            <Tooltip title="Stop generating">
                                <IconButton
                                    size="small"
                                    onClick={(e) => {e.stopPropagation(); handleStop();}}
                                    sx={{p: 0.5}}
                                    aria-label="Stop generating"
                                >
                                    <StopIcon sx={{fontSize: 18}} />
                                </IconButton>
                            </Tooltip>
                        </>
                    )}
                    {!loading && summary && (
                        <Tooltip title="Refresh">
                            <IconButton size="small" onClick={handleRefresh} sx={{p: 0.5}} aria-label="Refresh summary">
                                <RefreshIcon sx={{fontSize: 18}} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {!loading && summary && (
                        <Tooltip title={copyTooltip}>
                            <IconButton size="small" onClick={handleCopy} sx={{p: 0.5}} aria-label="Copy briefing">
                                <ContentCopyIcon sx={{fontSize: 16}} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {collapsible && (
                        <IconButton
                            size="small"
                            tabIndex={-1}
                            sx={{p: 0.5}}
                            aria-label={expanded ? 'Collapse Auto-mate briefing' : 'Expand Auto-mate briefing'}
                            onClick={(e) => {e.stopPropagation(); handleToggleExpanded();}}
                        >
                            {expanded ? <ExpandLessIcon sx={{fontSize: 20}} /> : <ExpandMoreIcon sx={{fontSize: 20}} />}
                        </IconButton>
                    )}
                </Stack>
            </Box>
            <Collapse in={expanded} unmountOnExit={false}>
            <Box sx={{px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5}}>
                {loading && !summary && (
                    <Box>
                        <Stack direction="row" spacing={1} sx={{alignItems: 'center', mb: 1}}>
                            <AutoMateLogo size={32} animated />
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                Auto-mate is thinking…
                            </Typography>
                        </Stack>
                        <Skeleton variant="text" width="80%" height={28} />
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="rectangular" height={48} sx={{mt: 1, borderRadius: 1}} />
                        <Skeleton variant="rectangular" height={48} sx={{mt: 1, borderRadius: 1}} />
                    </Box>
                )}

                {error && (
                    <Typography variant="body2" color="error">{error}</Typography>
                )}

                {summary && (
                    <>
                        <Typography
                            variant="subtitle1"
                            sx={{
                                fontWeight: 600,
                                lineHeight: 1.4
                            }}>
                            {summary.verdict}
                        </Typography>

                        {summary.keyFacts.length > 0 && (
                            <Stack
                                direction="row"
                                spacing={0.75}
                                sx={{
                                    flexWrap: "wrap",
                                    rowGap: 0.75
                                }}>
                                {summary.keyFacts.map((fact, i) => (
                                    <Chip
                                        key={`${fact}-${i}`}
                                        label={fact}
                                        size="small"
                                        sx={{bgcolor: 'background.paper'}}
                                    />
                                ))}
                            </Stack>
                        )}

                        {summary.attention.length > 0 && (
                            <Stack spacing={1} sx={{mt: 0.5}}>
                                <Typography
                                    variant="overline"
                                    sx={{
                                        color: "text.secondary",
                                        lineHeight: 1,
                                        letterSpacing: 0.5
                                    }}>
                                    Needs attention
                                </Typography>
                                {summary.attention.map((item, i) => (
                                    <AttentionCallout key={`${item.headline}-${i}`} item={item} />
                                ))}
                            </Stack>
                        )}

                        {summary.timeline.length > 0 && (
                            <Stack spacing={0.5} sx={{mt: 0.5}}>
                                <Typography
                                    variant="overline"
                                    sx={{
                                        color: "text.secondary",
                                        lineHeight: 1,
                                        letterSpacing: 0.5
                                    }}>
                                    Timeline
                                </Typography>
                                <Stack
                                    direction="row"
                                    spacing={0.75}
                                    sx={{
                                        flexWrap: "wrap",
                                        rowGap: 0.75
                                    }}>
                                    {summary.timeline.map((item, i) => (
                                        <TimelinePill key={`${item.label}-${i}`} item={item} />
                                    ))}
                                </Stack>
                            </Stack>
                        )}

                        {summary.highlights.length > 0 && (
                            <Box>
                                <Box
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setHighlightsOpen(v => !v)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            setHighlightsOpen(v => !v);
                                        }
                                    }}
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 0.5,
                                        cursor: 'pointer',
                                        userSelect: 'none',
                                        color: 'text.secondary',
                                    }}
                                >
                                    <Typography variant="overline" sx={{lineHeight: 1, letterSpacing: 0.5}}>
                                        Highlights ({summary.highlights.length})
                                    </Typography>
                                    {highlightsOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                </Box>
                                <Collapse in={highlightsOpen}>
                                    <Stack component="ul" sx={{pl: 3, m: 0, mt: 0.5}} spacing={0.25}>
                                        {summary.highlights.map((h, i) => (
                                            <li key={`${h}-${i}`}>
                                                <Typography variant="body2">{h}</Typography>
                                            </li>
                                        ))}
                                    </Stack>
                                </Collapse>
                            </Box>
                        )}
                    </>
                )}
            </Box>
            </Collapse>
        </Card>
    );
};

const AttentionCallout: React.FC<{item: AttentionItem}> = ({item}) => (
    <Paper
        elevation={0}
        sx={(theme) => {
            const v = severityVisuals(item.severity, theme);
            return {
                p: 1.25,
                borderRadius: 1.5,
                borderLeft: `4px solid ${v.color}`,
                bgcolor: v.bg,
                display: 'flex',
                gap: 1,
            };
        }}
    >
        {(() => {
            // Inline IIFE to compute Icon once per render
            return null;
        })()}
        <Box sx={(theme) => {
            const v = severityVisuals(item.severity, theme);
            return {color: v.color, display: 'flex', alignItems: 'flex-start', pt: 0.25};
        }}>
            {(() => {
                const Severity = item.severity;
                if (Severity === 'Critical') return <ReportProblemIcon fontSize="small" />;
                if (Severity === 'Urgent') return <ErrorOutlineIcon fontSize="small" />;
                if (Severity === 'Caution') return <WarningAmberIcon fontSize="small" />;
                if (Severity === 'Info') return <InfoOutlinedIcon fontSize="small" />;
                return <CheckCircleOutlineIcon fontSize="small" />;
            })()}
        </Box>
        <Box>
            <Typography variant="body2" sx={{
                fontWeight: 600
            }}>{item.headline}</Typography>
            <Typography variant="body2" sx={{
                color: "text.secondary"
            }}>{item.action}</Typography>
        </Box>
    </Paper>
);

const TimelinePill: React.FC<{item: TimelineItem}> = ({item}) => (
    <Chip
        size="small"
        label={
            <Box component="span" sx={{display: 'inline-flex', alignItems: 'center', gap: 0.5}}>
                <Box component="span" sx={{fontWeight: 600}}>{item.label}</Box>
                <Box component="span" sx={{opacity: 0.85}}>· {item.detail}</Box>
            </Box>
        }
        sx={(theme) => {
            const color = timelineColor(item.status, theme);
            return {
                bgcolor: alpha(color, 0.1),
                color,
                border: `1px solid ${alpha(color, 0.35)}`,
            };
        }}
    />
);
