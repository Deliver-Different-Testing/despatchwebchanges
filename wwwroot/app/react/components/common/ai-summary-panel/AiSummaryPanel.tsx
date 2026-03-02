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
    Tooltip,
    Typography,
} from '@mui/material';
import {
    AutoAwesome as AutoAwesomeIcon,
    ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon,
    Stop as StopIcon,
} from '@mui/icons-material';
import {AiSummaryResponse} from '../../../services/aiAssistantApi';

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
    accentColor = '#7c4dff',
}) => {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [hasFetched, setHasFetched] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

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
                <Box display="flex" alignItems="center">
                    {loading && (
                        <Tooltip title="Stop generating">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleStop();
                                }}
                            >
                                <StopIcon fontSize="small" />
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
                        <Box display="flex" alignItems="center" gap={1} py={1}>
                            <CircularProgress size={18} />
                            <Typography variant="body2" color="text.secondary">
                                Generating AI summary...
                            </Typography>
                        </Box>
                    )}

                    {error && (
                        <Typography variant="body2" color="error">
                            {error}
                        </Typography>
                    )}

                    {summary && (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                lineHeight: 1.7,
                                whiteSpace: 'pre-line',
                            }}
                        >
                            {summary}
                        </Typography>
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
