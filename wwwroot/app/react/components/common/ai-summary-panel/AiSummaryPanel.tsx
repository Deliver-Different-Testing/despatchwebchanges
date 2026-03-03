/**
 * AiSummaryPanel - Reusable collapsible AI summary card.
 *
 * Displays an AI-generated summary with loading, error, and collapsed states.
 * Used across Task Dashboard, Overview, Compliance, and other pages.
 * Supports cancellation of in-flight requests via AbortSignal.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
    Box,
    Card,
    CardContent,
    Collapse,
    CircularProgress,
    IconButton,
    Skeleton,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    AutoAwesome as AutoAwesomeIcon,
    ContentCopy as ContentCopyIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    Stop as StopIcon,
} from '@mui/icons-material';
import {AiSummaryResponse} from '../../../services/aiAssistantApi';
import {AiMarkdownRenderer} from './AiMarkdownRenderer';

interface AiSummaryPanelProps {
    title: string;
    fetchSummary: (signal?: AbortSignal) => Promise<AiSummaryResponse>;
    /** Auto-fetch on mount */
    autoFetch?: boolean;
    /** Accent color for the header stripe */
    accentColor?: string;
}

function formatRelativeTime(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export const AiSummaryPanel: React.FC<AiSummaryPanelProps> = ({
    title,
    fetchSummary,
    autoFetch = false,
    accentColor = '#7c4dff',
}) => {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
    const [relativeTime, setRelativeTime] = useState<string>('');
    const [copyTooltip, setCopyTooltip] = useState('Copy to clipboard');
    const abortControllerRef = useRef<AbortController | null>(null);

    // Update relative time every 30 seconds
    useEffect(() => {
        if (!generatedAt) return;
        setRelativeTime(formatRelativeTime(generatedAt));
        const interval = setInterval(() => {
            setRelativeTime(formatRelativeTime(generatedAt));
        }, 30000);
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
        } catch (e: any) {
            if (e?.name === 'AbortError' || e?.name === 'CanceledError' || controller.signal.aborted) {
                return;
            }
            const message = e?.message || 'Failed to generate AI summary';
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
            loadSummary();
        }
    }, [expanded, hasFetched, loading, loadSummary]);

    const handleCopy = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!summary) return;
        try {
            await navigator.clipboard.writeText(summary);
            setCopyTooltip('Copied!');
            setTimeout(() => setCopyTooltip('Copy to clipboard'), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = summary;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopyTooltip('Copied!');
            setTimeout(() => setCopyTooltip('Copy to clipboard'), 2000);
        }
    }, [summary]);

    // Auto-fetch on mount if requested
    useEffect(() => {
        if (autoFetch && !hasFetched && !loading) {
            setExpanded(true);
            loadSummary();
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
            sx={{
                borderRadius: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                overflow: 'hidden',
                borderLeft: `4px solid ${accentColor}`,
            }}
        >
            {/* Header */}
            <Box
                onClick={handleToggle}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1.25,
                    cursor: 'pointer',
                    userSelect: 'none',
                    bgcolor: 'rgba(124, 77, 255, 0.04)',
                    '&:hover': {bgcolor: 'rgba(124, 77, 255, 0.08)'},
                }}
            >
                <Box display="flex" alignItems="center" gap={1}>
                    <AutoAwesomeIcon sx={{fontSize: 20, color: accentColor}} />
                    <Typography variant="subtitle2" fontWeight={600} color="text.primary">
                        {title}
                    </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5}>
                    {generatedAt && !loading && (
                        <Typography variant="caption" color="text.disabled" sx={{mr: 0.5}}>
                            {relativeTime}
                        </Typography>
                    )}
                    {loading && (
                        <CircularProgress size={16} sx={{mr: 0.5}} />
                    )}
                    {loading && (
                        <Tooltip title="Stop generating">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStop();
                                }}
                                sx={{p: 0.5}}
                            >
                                <StopIcon sx={{fontSize: 18}} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {summary && !loading && (
                        <Tooltip title={copyTooltip}>
                            <IconButton size="small" onClick={handleCopy} sx={{p: 0.5}}>
                                <ContentCopyIcon sx={{fontSize: 16}} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
            </Box>

            {/* Content */}
            <Collapse in={expanded}>
                <CardContent sx={{pt: 1, pb: 2, px: 2}}>
                    {loading && !summary && (
                        <Box py={1}>
                            <Skeleton variant="text" width="90%" />
                            <Skeleton variant="text" width="75%" />
                            <Skeleton variant="text" width="60%" />
                            <Skeleton variant="text" width="80%" />
                        </Box>
                    )}

                    {error && (
                        <Typography variant="body2" color="error">
                            {error}
                        </Typography>
                    )}

                    {summary && (
                        <AiMarkdownRenderer content={summary} />
                    )}

                    {!loading && !error && !summary && (
                        <Typography variant="body2" color="text.disabled">
                            Click to generate an AI summary.
                        </Typography>
                    )}
                </CardContent>
            </Collapse>
        </Card>
    );
};
