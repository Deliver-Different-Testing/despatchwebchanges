/**
 * React Recovery Agent Management Dialog
 *
 * Replaces the AngularJS recovery-agent-management-dialog. Lets despatch
 * users assign and manage recovery agents that search for lost packages at
 * specific airports.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {alpha} from '@mui/material/styles';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import BusinessIcon from '@mui/icons-material/Business';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DoneIcon from '@mui/icons-material/Done';
import EditIcon from '@mui/icons-material/Edit';
import GroupIcon from '@mui/icons-material/Group';
import GroupOffIcon from '@mui/icons-material/GroupOff';
import InfoIcon from '@mui/icons-material/Info';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import PackageIcon from '@mui/icons-material/Inventory';
import PersonIcon from '@mui/icons-material/Person';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import SaveIcon from '@mui/icons-material/Save';
import EngineeringIcon from '@mui/icons-material/Engineering';
import WarningIcon from '@mui/icons-material/Warning';
import type {ShowToastFn} from '../../../services/toastService';
import type {
    AddAgentRecoveryRequest,
    RecoveryAgentJobViewModel,
    RecoveryAgentViewModel,
    Suggestion,
    UpdateAgentRecoveryRequest,
} from '../../../services/nationwideApi';

export interface RecoveryAgentManagementDialogProps {
    open: boolean;
    job: RecoveryAgentJobViewModel | null;
    onClose: () => void;
    onLoadAirports: () => Promise<Suggestion[]>;
    onLoadAgentsForAirport: (airportId: number) => Promise<Suggestion[]>;
    onAddAgent: (request: AddAgentRecoveryRequest) => Promise<void>;
    onUpdateAgent: (request: UpdateAgentRecoveryRequest) => Promise<void>;
    onRemoveAgent: (recoveryId: number) => Promise<void>;
    onRefresh: () => Promise<RecoveryAgentJobViewModel>;
    showToast: ShowToastFn;
}

const STATUS_LABELS: Record<string, string> = {
    assigned: 'Currently Assigned',
    searching: 'Currently Searching',
    pending: 'Pending Assignment',
    completed: 'Assignment Completed',
};

const STATUS_COLORS: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
    assigned: 'info',
    searching: 'warning',
    pending: 'default',
    completed: 'success',
};

function getStatusLabel(status: string | undefined): string {
    if (!status) return 'Unknown Status';
    return STATUS_LABELS[status] || 'Unknown Status';
}

function getStatusColor(status: string | undefined): 'default' | 'info' | 'warning' | 'success' {
    if (!status) return 'default';
    return STATUS_COLORS[status] || 'default';
}

function hasPrimaryRecoveryAgent(job: RecoveryAgentJobViewModel | null): boolean {
    if (!job?.recoveryJobs) return false;
    return job.recoveryJobs.some(rj =>
        rj.recoveryAgents?.some(agent => agent.primaryRecoveryAgent)
    );
}

export const RecoveryAgentManagementDialog: React.FC<RecoveryAgentManagementDialogProps> = ({
    open,
    job: initialJob,
    onClose,
    onLoadAirports,
    onLoadAgentsForAirport,
    onAddAgent,
    onUpdateAgent,
    onRemoveAgent,
    onRefresh,
    showToast,
}) => {
    const [job, setJob] = useState<RecoveryAgentJobViewModel | null>(initialJob);
    const [airportOptions, setAirportOptions] = useState<Suggestion[]>([]);
    const [agentOptions, setAgentOptions] = useState<Suggestion[]>([]);

    const [showAssignForm, setShowAssignForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);

    const [selectedAirportId, setSelectedAirportId] = useState<number>(0);
    const [selectedAgentId, setSelectedAgentId] = useState<number>(0);
    const [isPrimaryRecoveryAgent, setIsPrimaryRecoveryAgent] = useState(false);

    const [editingAgent, setEditingAgent] = useState<RecoveryAgentViewModel | null>(null);
    const [editIsPrimaryRecoveryAgent, setEditIsPrimaryRecoveryAgent] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setJob(initialJob);
    }, [initialJob]);

    useEffect(() => {
        if (!open) return;
        onLoadAirports()
            .then(setAirportOptions)
            .catch((error) => {
                console.error('Error loading airports:', error);
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reload on open transition
    }, [open]);

    const selectedAirport = useMemo(
        () => airportOptions.find(a => a.id === selectedAirportId),
        [airportOptions, selectedAirportId]
    );
    const selectedAgent = useMemo(
        () => agentOptions.find(a => a.id === selectedAgentId),
        [agentOptions, selectedAgentId]
    );

    const jobHasPrimary = hasPrimaryRecoveryAgent(job);

    const handleAirportChange = async (airportId: number) => {
        setSelectedAirportId(airportId);
        setSelectedAgentId(0);
        if (!airportId) {
            setAgentOptions([]);
            return;
        }
        try {
            const agents = await onLoadAgentsForAirport(airportId);
            setAgentOptions(agents);
        } catch (error) {
            console.error('Error loading agents for airport:', error);
            setAgentOptions([]);
        }
    };

    const resetAssignForm = () => {
        setShowAssignForm(false);
        setSelectedAirportId(0);
        setSelectedAgentId(0);
        setIsPrimaryRecoveryAgent(false);
        setAgentOptions([]);
    };

    const resetEditForm = () => {
        setShowEditForm(false);
        setEditingAgent(null);
        setEditIsPrimaryRecoveryAgent(false);
    };

    const handleShowAssignForm = () => {
        setShowAssignForm(true);
        setIsPrimaryRecoveryAgent(false);
    };

    const handleShowEditForm = (agent: RecoveryAgentViewModel) => {
        setEditingAgent(agent);
        setEditIsPrimaryRecoveryAgent(agent.primaryRecoveryAgent || false);
        setShowEditForm(true);
    };

    const handleAssignAgent = async () => {
        if (!job || !selectedAirport || !selectedAgent) {
            showToast('Please select both airport and agent', 'warning');
            return;
        }

        const agentText = selectedAgent.text;
        const airportText = selectedAirport.text;
        const wasPrimary = isPrimaryRecoveryAgent;

        setIsSubmitting(true);
        try {
            await onAddAgent({
                jobId: job.jobId,
                agentId: selectedAgent.id,
                airportId: selectedAirport.id,
                isPrimaryRecoveryAgent: wasPrimary,
            });

            const refreshed = await onRefresh();
            setJob(refreshed);
            resetAssignForm();

            const agentTypeText = wasPrimary ? 'primary recovery agent' : 'recovery agent';
            showToast(
                `${agentText} has been assigned as ${agentTypeText} to search at ${airportText}`,
                'success'
            );
        } catch (error) {
            console.error('Error assigning agent:', error);
            showToast('Failed to assign agent. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateAgent = async () => {
        if (!editingAgent) {
            showToast('No agent selected for update', 'warning');
            return;
        }

        setIsSubmitting(true);
        try {
            await onUpdateAgent({
                recoveryId: editingAgent.recoveryId,
                isPrimaryRecoveryAgent: editIsPrimaryRecoveryAgent,
            });

            const refreshed = await onRefresh();
            setJob(refreshed);

            const statusText = editIsPrimaryRecoveryAgent ? 'set as primary recovery agent' : 'updated';
            showToast(`${editingAgent.agentName} has been ${statusText}`, 'success');
            resetEditForm();
        } catch (error) {
            console.error('Error updating agent:', error);
            showToast('Failed to update agent. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveAgent = async (agent: RecoveryAgentViewModel) => {
        const confirmed = window.confirm(
            `Are you sure you want to remove ${agent.agentName} from this recovery assignment?`
        );
        if (!confirmed) return;

        setIsSubmitting(true);
        try {
            await onRemoveAgent(agent.recoveryId);
            const refreshed = await onRefresh();
            setJob(refreshed);

            if (editingAgent?.recoveryId === agent.recoveryId) {
                resetEditForm();
            }

            showToast(`${agent.agentName} has been removed from the recovery assignment`, 'success');
        } catch (error) {
            console.error('Error removing agent:', error);
            showToast('Failed to remove agent. Please try again.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCancel = () => {
        const hasUnsavedAssign = showAssignForm && (selectedAirportId || selectedAgentId || isPrimaryRecoveryAgent);
        const hasUnsavedEdit = showEditForm && editingAgent;
        if (hasUnsavedAssign || hasUnsavedEdit) {
            const confirmed = window.confirm('You have unsaved changes. Are you sure you want to cancel?');
            if (!confirmed) return;
        }
        resetAssignForm();
        resetEditForm();
        onClose();
    };

    const totalRecoveryAgents = useMemo(() => {
        if (!job?.recoveryJobs) return 0;
        return job.recoveryJobs.reduce(
            (total, rj) => total + (rj.recoveryAgents?.length || 0),
            0
        );
    }, [job]);

    const hasRecoveryJobs = (job?.recoveryJobs?.length ?? 0) > 0;
    const isFormOpen = showAssignForm || showEditForm;

    return (
        <Dialog
            open={open}
            onClose={handleCancel}
            maxWidth="md"
            fullWidth
            disableEscapeKeyDown
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 3,
                        overflow: 'hidden',
                        minWidth: {xs: '95%', sm: '90%', md: 800},
                        maxWidth: 1100,
                        width: '90%',
                    },
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <GroupIcon sx={{fontSize: 28}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h5" fontWeight={600}>
                        Lost Package Recovery
                    </Typography>
                    {job && (
                        <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                            Job #{job.jobNumber}
                        </Typography>
                    )}
                </Box>
                <IconButton
                    onClick={handleCancel}
                    aria-label="Cancel"
                    sx={{
                        color: 'white',
                        '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{p: 3, bgcolor: 'background.default'}}>
                {!job ? (
                    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8}}>
                        <CircularProgress size={40} />
                    </Box>
                ) : (
                    <>
                        {/* Package Information */}
                        <Paper
                            elevation={0}
                            sx={(theme) => ({
                                mb: 3,
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                                overflow: 'hidden',
                            })}
                        >
                            <Box
                                sx={(theme) => ({
                                    px: 2.5,
                                    py: 2,
                                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1.5,
                                })}
                            >
                                <PackageIcon sx={{color: 'primary.main', fontSize: 22}} />
                                <Typography variant="subtitle1" fontWeight={600}>
                                    Package Information
                                </Typography>
                            </Box>

                            {job.pickUpAddress && job.deliveryAddress && (
                                <Box
                                    sx={(theme) => ({
                                        p: 3,
                                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                                        color: 'white',
                                    })}
                                >
                                    <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 2, mb: 1.5}}>
                                        <Box
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 1,
                                                bgcolor: 'rgba(255,255,255,0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <RadioButtonCheckedIcon sx={{color: 'white', fontSize: 18}} />
                                        </Box>
                                        <Box sx={{flex: 1, minWidth: 0}}>
                                            <Typography variant="caption" sx={{opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5}}>
                                                Pickup Location
                                            </Typography>
                                            <Typography variant="body2" sx={{mt: 0.25}}>
                                                {job.pickUpAddress.fullAddress}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 2}}>
                                        <Box
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                borderRadius: 1,
                                                bgcolor: 'rgba(255,255,255,0.2)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}
                                        >
                                            <LocationOnIcon sx={{color: 'white', fontSize: 18}} />
                                        </Box>
                                        <Box sx={{flex: 1, minWidth: 0}}>
                                            <Typography variant="caption" sx={{opacity: 0.85, textTransform: 'uppercase', letterSpacing: 0.5}}>
                                                Delivery Location
                                            </Typography>
                                            <Typography variant="body2" sx={{mt: 0.25}}>
                                                {job.deliveryAddress.fullAddress}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            )}

                            <Box
                                sx={{
                                    p: 2.5,
                                    display: 'grid',
                                    gridTemplateColumns: {xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)'},
                                    gap: 2,
                                }}
                            >
                                <DetailCard
                                    icon={<Inventory2Icon fontSize="small" />}
                                    label="Package Type"
                                    value={job.packageType}
                                />
                                <DetailCard
                                    icon={<PriorityHighIcon fontSize="small" />}
                                    label="Priority"
                                    value={job.priority}
                                    valueColor="warning.main"
                                />
                                <DetailCard
                                    icon={<LocationSearchingIcon fontSize="small" />}
                                    label="Last Known Location"
                                    value={job.lastKnownLocation}
                                />
                                <DetailCard
                                    icon={<PersonIcon fontSize="small" />}
                                    label="Customer"
                                    value={job.customer}
                                />
                            </Box>
                        </Paper>

                        {/* Recovery Agents Section */}
                        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2}}>
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
                                <GroupIcon sx={{color: 'primary.main'}} />
                                <Typography variant="h6" fontWeight={600}>
                                    Recovery Agents
                                </Typography>
                                {totalRecoveryAgents > 0 && (
                                    <Chip
                                        label={totalRecoveryAgents}
                                        size="small"
                                        color="primary"
                                        sx={{fontWeight: 600}}
                                    />
                                )}
                            </Box>
                            {!isFormOpen && (
                                <Button
                                    variant="contained"
                                    startIcon={<PersonAddIcon />}
                                    onClick={handleShowAssignForm}
                                >
                                    Assign Agent
                                </Button>
                            )}
                        </Box>

                        {/* Assign Form */}
                        {showAssignForm && (
                            <Paper
                                elevation={0}
                                sx={(theme) => ({
                                    mb: 3,
                                    borderRadius: 3,
                                    border: `1px solid ${theme.palette.divider}`,
                                    overflow: 'hidden',
                                })}
                            >
                                <Box
                                    sx={(theme) => ({
                                        px: 2.5,
                                        py: 1.75,
                                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                                        borderBottom: `1px solid ${theme.palette.divider}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                    })}
                                >
                                    <PersonAddIcon sx={{color: 'primary.main'}} />
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Assign Recovery Agent
                                    </Typography>
                                </Box>

                                <Box sx={{p: 2.5}}>
                                    <Alert
                                        severity="info"
                                        icon={<InfoIcon />}
                                        sx={{mb: 2.5, borderRadius: 2}}
                                    >
                                        <Typography variant="body2" fontWeight={600}>
                                            Recovery Agent Assignment
                                        </Typography>
                                        <Typography variant="body2">
                                            This will assign a recovery agent to search for the package at the
                                            selected location.
                                        </Typography>
                                    </Alert>

                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: {xs: '1fr', sm: '1fr 1fr'},
                                            gap: 2,
                                            mb: 2.5,
                                        }}
                                    >
                                        <FormControl fullWidth size="small">
                                            <InputLabel id="recovery-airport-label">Airport Location</InputLabel>
                                            <Select
                                                labelId="recovery-airport-label"
                                                label="Airport Location"
                                                value={selectedAirportId || ''}
                                                onChange={(e) => handleAirportChange(Number(e.target.value))}
                                            >
                                                {airportOptions.map((airport) => (
                                                    <MenuItem key={airport.id} value={airport.id}>
                                                        {airport.text}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>

                                        <FormControl fullWidth size="small" disabled={!selectedAirportId}>
                                            <InputLabel id="recovery-agent-label">Available Agent</InputLabel>
                                            <Select
                                                labelId="recovery-agent-label"
                                                label="Available Agent"
                                                value={selectedAgentId || ''}
                                                onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                                            >
                                                {agentOptions.map((agent) => (
                                                    <MenuItem key={agent.id} value={agent.id}>
                                                        {agent.text}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Box>

                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={isPrimaryRecoveryAgent}
                                                onChange={(e) => setIsPrimaryRecoveryAgent(e.target.checked)}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>
                                                    Set as Primary Recovery Agent
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Primary agents take lead responsibility for recovery operations
                                                </Typography>
                                            </Box>
                                        }
                                    />

                                    {isPrimaryRecoveryAgent && jobHasPrimary && (
                                        <Alert
                                            severity="warning"
                                            icon={<WarningIcon />}
                                            sx={{mt: 1.5, borderRadius: 2}}
                                        >
                                            Setting this agent as primary will remove the current primary status from other agents.
                                        </Alert>
                                    )}
                                </Box>

                                <Box
                                    sx={(theme) => ({
                                        p: 2,
                                        bgcolor: alpha(theme.palette.grey[500], 0.04),
                                        borderTop: `1px solid ${theme.palette.divider}`,
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: 1,
                                    })}
                                >
                                    <Button onClick={resetAssignForm} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={
                                            isSubmitting ? (
                                                <CircularProgress size={18} color="inherit" />
                                            ) : (
                                                <CheckIcon />
                                            )
                                        }
                                        onClick={handleAssignAgent}
                                        disabled={!selectedAirportId || !selectedAgentId || isSubmitting}
                                    >
                                        Assign Agent
                                    </Button>
                                </Box>
                            </Paper>
                        )}

                        {/* Edit Form */}
                        {showEditForm && editingAgent && (
                            <Paper
                                elevation={0}
                                sx={(theme) => ({
                                    mb: 3,
                                    borderRadius: 3,
                                    border: `1px solid ${theme.palette.divider}`,
                                    overflow: 'hidden',
                                })}
                            >
                                <Box
                                    sx={(theme) => ({
                                        px: 2.5,
                                        py: 1.75,
                                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                                        borderBottom: `1px solid ${theme.palette.divider}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                    })}
                                >
                                    <EditIcon sx={{color: 'primary.main'}} />
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        Edit Recovery Agent — {editingAgent.agentName}
                                    </Typography>
                                </Box>

                                <Box sx={{p: 2.5}}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={editIsPrimaryRecoveryAgent}
                                                onChange={(e) => setEditIsPrimaryRecoveryAgent(e.target.checked)}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="body2" fontWeight={600}>
                                                    Set as Primary Recovery Agent
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Primary agents take lead responsibility for recovery operations
                                                </Typography>
                                            </Box>
                                        }
                                    />

                                    {editIsPrimaryRecoveryAgent && jobHasPrimary && !editingAgent.primaryRecoveryAgent && (
                                        <Alert
                                            severity="warning"
                                            icon={<WarningIcon />}
                                            sx={{mt: 1.5, borderRadius: 2}}
                                        >
                                            Setting this agent as primary will remove the current primary status from other agents.
                                        </Alert>
                                    )}
                                </Box>

                                <Box
                                    sx={(theme) => ({
                                        p: 2,
                                        bgcolor: alpha(theme.palette.grey[500], 0.04),
                                        borderTop: `1px solid ${theme.palette.divider}`,
                                        display: 'flex',
                                        justifyContent: 'flex-end',
                                        gap: 1,
                                    })}
                                >
                                    <Button onClick={resetEditForm} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="error"
                                        startIcon={<PersonRemoveIcon />}
                                        onClick={() => handleRemoveAgent(editingAgent)}
                                        disabled={isSubmitting}
                                    >
                                        Remove Agent
                                    </Button>
                                    <Button
                                        variant="contained"
                                        startIcon={
                                            isSubmitting ? (
                                                <CircularProgress size={18} color="inherit" />
                                            ) : (
                                                <SaveIcon />
                                            )
                                        }
                                        onClick={handleUpdateAgent}
                                        disabled={isSubmitting}
                                    >
                                        Save Changes
                                    </Button>
                                </Box>
                            </Paper>
                        )}

                        {/* Agent Cards */}
                        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                            {/* Main Agent */}
                            {job.assignedAgent && (
                                <AgentCard
                                    title={job.assignedAgent.text}
                                    role="Primary Job Agent"
                                    statusLabel={getStatusLabel('assigned')}
                                    statusColor="info"
                                    accentColor="primary"
                                    icon={<EngineeringIcon />}
                                    metaItems={[{icon: <BusinessIcon fontSize="small" />, text: 'Overall Job Responsibility'}]}
                                />
                            )}

                            {/* Recovery Agents */}
                            {job.recoveryJobs?.flatMap(rj => rj.recoveryAgents ?? []).map((agent) => (
                                <AgentCard
                                    key={agent.recoveryId}
                                    title={agent.agentName}
                                    role={agent.primaryRecoveryAgent ? 'Primary Recovery Agent' : 'Recovery Agent'}
                                    statusLabel={getStatusLabel(agent.assignStatus)}
                                    statusColor={getStatusColor(agent.assignStatus)}
                                    accentColor={agent.primaryRecoveryAgent ? 'warning' : 'default'}
                                    icon={<PersonIcon />}
                                    metaItems={[
                                        {icon: <LocationOnIcon fontSize="small" />, text: agent.airport},
                                        {
                                            icon: <BusinessIcon fontSize="small" />,
                                            text: agent.primaryRecoveryAgent ? 'Lead Recovery Specialist' : 'Recovery Specialist',
                                        },
                                    ]}
                                    actions={
                                        <>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleShowEditForm(agent)}
                                                aria-label={`Edit ${agent.agentName}`}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => handleRemoveAgent(agent)}
                                                aria-label={`Remove ${agent.agentName}`}
                                            >
                                                <PersonRemoveIcon fontSize="small" />
                                            </IconButton>
                                        </>
                                    }
                                />
                            ))}

                            {/* Empty State */}
                            {!hasRecoveryJobs && !isFormOpen && (
                                <Paper
                                    elevation={0}
                                    sx={(theme) => ({
                                        borderRadius: 3,
                                        border: `1px dashed ${theme.palette.divider}`,
                                        py: 5,
                                        px: 3,
                                        textAlign: 'center',
                                    })}
                                >
                                    <Box
                                        sx={(theme) => ({
                                            width: 64,
                                            height: 64,
                                            borderRadius: '50%',
                                            bgcolor: alpha(theme.palette.grey[500], 0.08),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            mx: 'auto',
                                            mb: 2,
                                        })}
                                    >
                                        <GroupOffIcon sx={{fontSize: 32, color: 'grey.400'}} />
                                    </Box>
                                    <Typography variant="h6" fontWeight={600} sx={{mb: 1}}>
                                        No Recovery Agents Assigned
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{mb: 2.5, maxWidth: 480, mx: 'auto'}}>
                                        Get started by assigning recovery agents to specific locations where the package
                                        might be found.
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        startIcon={<PersonAddIcon />}
                                        onClick={handleShowAssignForm}
                                    >
                                        Assign First Recovery Agent
                                    </Button>
                                </Paper>
                            )}
                        </Box>
                    </>
                )}
            </DialogContent>

            <Divider />

            <DialogActions sx={{p: 2, gap: 1}}>
                {!isFormOpen && (
                    <>
                        <Button onClick={handleCancel} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<DoneIcon />}
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Complete
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
};

// ──────────────────────────────────────────────────────────────────────────
// Internal helper components

interface DetailCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueColor?: string;
}

function DetailCard({icon, label, value, valueColor}: DetailCardProps): React.ReactElement {
    return (
        <Box
            sx={(theme) => ({
                p: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.grey[500], 0.04),
                border: `1px solid ${theme.palette.divider}`,
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start',
            })}
        >
            <Box
                sx={(theme) => ({
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                })}
            >
                {icon}
            </Box>
            <Box sx={{minWidth: 0}}>
                <Typography
                    variant="caption"
                    sx={{color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block'}}
                >
                    {label}
                </Typography>
                <Typography variant="body2" fontWeight={500} sx={{color: valueColor || 'text.primary', mt: 0.25}}>
                    {value || '—'}
                </Typography>
            </Box>
        </Box>
    );
}

interface AgentCardProps {
    title: string;
    role: string;
    statusLabel: string;
    statusColor: 'default' | 'info' | 'warning' | 'success';
    accentColor: 'primary' | 'warning' | 'default';
    icon: React.ReactNode;
    metaItems: {icon: React.ReactNode; text: string}[];
    actions?: React.ReactNode;
}

function AgentCard({
    title,
    role,
    statusLabel,
    statusColor,
    accentColor,
    icon,
    metaItems,
    actions,
}: AgentCardProps): React.ReactElement {
    return (
        <Paper
            elevation={0}
            sx={(theme) => {
                const borderColor =
                    accentColor === 'default'
                        ? theme.palette.divider
                        : alpha(theme.palette[accentColor].main, 0.4);
                const bgTint =
                    accentColor === 'default'
                        ? 'transparent'
                        : alpha(theme.palette[accentColor].main, 0.03);
                return {
                    p: 2.5,
                    borderRadius: 3,
                    border: `1px solid ${borderColor}`,
                    bgcolor: bgTint,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1.5,
                };
            }}
        >
            <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 2}}>
                <Box
                    sx={(theme) => {
                        if (accentColor === 'default') {
                            return {
                                width: 48,
                                height: 48,
                                borderRadius: 2,
                                bgcolor: alpha(theme.palette.grey[500], 0.12),
                                color: 'text.secondary',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                            };
                        }
                        return {
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette[accentColor].main, 0.12),
                            color: theme.palette[accentColor].main,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        };
                    }}
                >
                    {icon}
                </Box>
                <Box sx={{flex: 1, minWidth: 0}}>
                    <Typography variant="subtitle1" fontWeight={600} noWrap>
                        {title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{mb: 0.75}}>
                        {role}
                    </Typography>
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 2, color: 'text.secondary'}}>
                        {metaItems.map((meta, index) => (
                            <Box key={index} sx={{display: 'flex', alignItems: 'center', gap: 0.5}}>
                                {meta.icon}
                                <Typography variant="caption">{meta.text}</Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
                {actions && <Box sx={{display: 'flex', gap: 0.5}}>{actions}</Box>}
            </Box>

            <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
                <Chip
                    label={statusLabel}
                    size="small"
                    color={statusColor === 'default' ? undefined : statusColor}
                    sx={{fontWeight: 500}}
                />
            </Box>
        </Paper>
    );
}

export default RecoveryAgentManagementDialog;
