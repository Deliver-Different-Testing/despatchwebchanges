/**
 * Job Change Requests — per-job history panel.
 *
 * Mounted inside <JobDetails/> when the job is an inter-tenant partner job.
 * Lists every <see cref="tucJobChangeRequest"/> row for the current job
 * (any status), with inline Approve / Reject when this tenant is the
 * approval party for a Pending row.
 */

import React, {useEffect, useState, useCallback} from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import {alpha} from '@mui/material/styles';
import {jobChangeRequestApi, type JobChangeRequestDto} from '../../services/jobChangeRequestApi';

export interface JobChangeRequestsForJobProps {
    jobId: number;
    /** Local tenant identity used to gate Approve / Reject. Default "OwnerTenant". */
    localPartyType?: string;
    /** Notify parent that a row was approved or rejected — for refreshing the surrounding job-detail view. */
    onChanged?: () => void;
}

type StatusColor = 'default' | 'warning' | 'success' | 'error' | 'info';

const statusColor = (status: string): StatusColor => {
    switch (status) {
        case 'Pending':
            return 'warning';
        case 'Approved':
            return 'info';
        case 'Applied':
            return 'success';
        case 'Rejected':
        case 'Cancelled':
            return 'error';
        default:
            return 'default';
    }
};

export const JobChangeRequestsForJob: React.FC<JobChangeRequestsForJobProps> = ({
    jobId,
    localPartyType = 'OwnerTenant',
    onChanged,
}) => {
    const [rows, setRows] = useState<JobChangeRequestDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actingOn, setActingOn] = useState<number | null>(null);

    const load = useCallback(async () => {
        if (!jobId) return;
        setLoading(true);
        setError('');
        try {
            const data = await jobChangeRequestApi.forJob(jobId);
            setRows(data);
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Failed to load change requests');
        } finally {
            setLoading(false);
        }
    }, [jobId]);

    useEffect(() => { void load(); }, [load]);

    const handleApprove = useCallback(async (row: JobChangeRequestDto) => {
        setActingOn(row.id);
        try {
            await jobChangeRequestApi.approve({requestId: row.id, rowVersion: row.rowVersion});
            await load();
            onChanged?.();
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Approve failed');
        } finally {
            setActingOn(null);
        }
    }, [load, onChanged]);

    const handleReject = useCallback(async (row: JobChangeRequestDto) => {
        setActingOn(row.id);
        try {
            await jobChangeRequestApi.reject({requestId: row.id, rowVersion: row.rowVersion});
            await load();
            onChanged?.();
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Reject failed');
        } finally {
            setActingOn(null);
        }
    }, [load, onChanged]);

    const handleCancel = useCallback(async (row: JobChangeRequestDto) => {
        setActingOn(row.id);
        try {
            await jobChangeRequestApi.cancel({requestId: row.id, rowVersion: row.rowVersion});
            await load();
            onChanged?.();
        } catch (e) {
            setError((e as {message?: string})?.message ?? 'Cancel failed');
        } finally {
            setActingOn(null);
        }
    }, [load, onChanged]);

    if (loading) {
        return (
            <Card variant="outlined">
                <CardContent sx={{display: 'flex', alignItems: 'center', gap: 1, py: 2}}>
                    <CircularProgress size={16}/>
                    <Typography variant="body2" color="text.secondary">Loading change requests…</Typography>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    if (rows.length === 0) {
        return (
            <Card variant="outlined">
                <CardContent sx={{py: 2}}>
                    <Typography variant="body2" color="text.secondary">
                        No partner change requests for this job.
                    </Typography>
                </CardContent>
            </Card>
        );
    }

    return (
        <Stack spacing={1.5}>
            {rows.map(r => {
                const canAct = r.status === 'Pending' && r.approvalPartyType === localPartyType;
                return (
                    <Card key={r.id} variant="outlined" sx={(theme) => ({
                        borderLeft: 3,
                        borderLeftColor: `${statusColor(r.status)}.main`,
                        bgcolor: r.status === 'Pending'
                            ? alpha(theme.palette.warning.main, 0.04)
                            : 'background.paper',
                    })}>
                        <CardContent sx={{py: 1.5, '&:last-child': {pb: 1.5}}}>
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 0.5}}>
                                <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                                    {r.fieldName}
                                </Typography>
                                <Chip
                                    label={r.status}
                                    size="small"
                                    color={statusColor(r.status)}
                                    variant={r.status === 'Pending' ? 'filled' : 'outlined'}
                                />
                                {r.requiresCommercialRefresh && (
                                    <Chip size="small" label="$" color="warning" variant="outlined" sx={{ml: 'auto'}}/>
                                )}
                            </Box>

                            <Typography variant="body2" sx={{mb: 0.5}}>
                                <Box component="span" sx={{color: 'text.secondary'}}>From </Box>
                                <Box component="span" sx={{fontFamily: 'monospace'}}>{r.currentValue ?? '—'}</Box>
                                <Box component="span" sx={{color: 'text.secondary'}}>{' → '}</Box>
                                <Box component="span" sx={{fontFamily: 'monospace', fontWeight: 600}}>
                                    {r.requestedValue ?? '—'}
                                </Box>
                            </Typography>

                            {r.reason && (
                                <Typography variant="caption" color="text.secondary" sx={{display: 'block'}}>
                                    {r.reason}
                                </Typography>
                            )}

                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mt: 1}}>
                                <Typography variant="caption" color="text.secondary">
                                    {r.origin === 'Local' ? 'You requested' : 'Partner requested'}
                                    {' · '}
                                    {new Date(r.requestedAt).toLocaleString()}
                                </Typography>
                                {canAct && (
                                    <Box sx={{ml: 'auto', display: 'flex', gap: 1}}>
                                        <Button
                                            size="small"
                                            variant="contained"
                                            color="success"
                                            onClick={() => handleApprove(r)}
                                            disabled={actingOn !== null}
                                        >Approve</Button>
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="error"
                                            onClick={() => handleReject(r)}
                                            disabled={actingOn !== null}
                                        >Reject</Button>
                                    </Box>
                                )}
                                {r.status === 'Pending' && !canAct && r.origin === 'Local' && (
                                    <Box sx={{ml: 'auto', display: 'flex', gap: 1, alignItems: 'center'}}>
                                        <Chip
                                            size="small"
                                            label="Awaiting partner"
                                            variant="outlined"
                                        />
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            color="warning"
                                            onClick={() => handleCancel(r)}
                                            disabled={actingOn !== null}
                                        >Cancel</Button>
                                    </Box>
                                )}
                                {r.status === 'Pending' && !canAct && r.origin !== 'Local' && (
                                    <Chip
                                        size="small"
                                        label="Awaiting partner"
                                        variant="outlined"
                                        sx={{ml: 'auto'}}
                                    />
                                )}
                            </Box>
                        </CardContent>
                    </Card>
                );
            })}
        </Stack>
    );
};
