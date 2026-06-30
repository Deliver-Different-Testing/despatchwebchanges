/**
 * AiBlockersCard - Auto-Mate note blocker/tag extraction.
 *
 * Renders an ExtractBlockersResponse as a chip strip of delivery/pickup
 * blockers pulled from a job's notes. Mirrors AiSummaryCard's collapsible
 * fetch/loading/error/abort lifecycle.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import type {Theme} from '@mui/material/styles';
import {ExtractBlockersResponse, SummarySeverity} from '../../../services/aiAssistantApi';
import {AutoMateLogo} from '../auto-mate-logo/AutoMateLogo';

interface AiBlockersCardProps {
    title: string;
    fetchBlockers: (signal?: AbortSignal) => Promise<ExtractBlockersResponse>;
    collapsible?: boolean;
    autoOpen?: boolean;
}

function severityColor(severity: SummarySeverity, theme: Theme): string {
    switch (severity) {
        case 'Critical':
        case 'Urgent':
            return theme.palette.error.main;
        case 'Caution':
            return theme.palette.warning.main;
        case 'Info':
            return theme.palette.info.main;
        default:
            return theme.palette.success.main;
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

    return (
        <Card sx={(theme) => ({
            borderRadius: 3,
            boxShadow: 1,
            overflow: 'hidden',
            borderLeft: `4px solid ${hasBlockers ? theme.palette.warning.main : theme.palette.success.main}`,
        })}>
            <Box
                onClick={collapsible ? toggle : undefined}
                role={collapsible ? 'button' : undefined}
                tabIndex={collapsible ? 0 : undefined}
                aria-expanded={collapsible ? expanded : undefined}
                sx={(theme) => ({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1.25,
                    bgcolor: alpha(hasBlockers ? theme.palette.warning.main : theme.palette.success.main, 0.08),
                    cursor: collapsible ? 'pointer' : undefined,
                    userSelect: collapsible ? 'none' : undefined,
                })}
            >
                <Stack direction="row" spacing={1} sx={{alignItems: 'center'}}>
                    <AutoMateLogo size={24} />
                    <Typography variant="subtitle2" sx={{fontWeight: 600, color: 'text.primary'}}>{title}</Typography>
                    <Chip label="BETA" size="small" sx={{height: 18, fontSize: '0.625rem', fontWeight: 700}} />
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{alignItems: 'center'}}>
                    {loading && <CircularProgress size={16} sx={{mr: 0.5}} />}
                    {!loading && data && (
                        <Tooltip title="Refresh">
                            <IconButton size="small" onClick={handleRefresh} sx={{p: 0.5}} aria-label="Refresh blockers">
                                <RefreshIcon sx={{fontSize: 18}} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {collapsible && (
                        <IconButton
                            size="small"
                            tabIndex={-1}
                            sx={{p: 0.5}}
                            aria-label={expanded ? 'Collapse blockers' : 'Expand blockers'}
                            onClick={(e) => {e.stopPropagation(); toggle();}}
                        >
                            {expanded ? <ExpandLessIcon sx={{fontSize: 20}} /> : <ExpandMoreIcon sx={{fontSize: 20}} />}
                        </IconButton>
                    )}
                </Stack>
            </Box>
            <Collapse in={expanded}>
                <Box sx={{px: 2, py: 1.5}}>
                    {loading && !data && (
                        <>
                            <Skeleton variant="text" width="50%" />
                            <Skeleton variant="rectangular" height={28} sx={{mt: 1, borderRadius: 1}} />
                        </>
                    )}
                    {error && <Typography variant="body2" color="error">{error}</Typography>}
                    {data && !hasBlockers && (
                        <Typography variant="body2" sx={{color: 'text.secondary'}}>
                            No blockers detected in the notes.
                        </Typography>
                    )}
                    {hasBlockers && (
                        <Stack spacing={1}>
                            <Typography variant="body2" sx={{color: 'text.secondary'}}>{data!.summary}</Typography>
                            <Stack direction="row" spacing={0.75} sx={{flexWrap: 'wrap', rowGap: 0.75}}>
                                {data!.blockers.map((b, i) => (
                                    <Tooltip key={`${b.tag}-${i}`} title={b.evidence || ''}>
                                        <Chip
                                            label={b.tag}
                                            size="small"
                                            variant="outlined"
                                            sx={(theme) => {
                                                const color = severityColor(b.severity, theme);
                                                return {
                                                    color,
                                                    borderColor: alpha(color, 0.5),
                                                    bgcolor: alpha(color, 0.08),
                                                };
                                            }}
                                        />
                                    </Tooltip>
                                ))}
                            </Stack>
                        </Stack>
                    )}
                </Box>
            </Collapse>
        </Card>
    );
};
