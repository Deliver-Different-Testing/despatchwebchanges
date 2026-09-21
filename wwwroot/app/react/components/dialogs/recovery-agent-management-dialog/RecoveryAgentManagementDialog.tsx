/**
 * React Recovery Agent Management Dialog
 *
 * Replaces the AngularJS recovery-agent-management-dialog. Lets despatch
 * users assign and manage recovery agents that search for lost packages at
 * specific airports.
 */

import React, {useEffect, useMemo, useState} from 'react';
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Button,
    Checkbox,
    Divider,
    Group,
    Loader,
    Paper,
    Select,
    Stack,
    Text,
    ThemeIcon,
    alpha,
} from '@mantine/core';
import {useDisclosure} from '@mantine/hooks';
import {
    Building2,
    Check,
    CircleDot,
    HardHat,
    Info,
    Pencil,
    Save,
    Search,
    TriangleAlert,
    User,
    UserMinus,
    UserPlus,
    Users,
    UsersRound,
} from 'lucide-react';
import {IconMapPin, IconPackage} from '@tabler/icons-react';
import {
    DialogShell,
    DialogHeader,
    DialogFooter,
    dialogContentBg,
    dialogSize,
    headerColors,
    headerOverlayColor,
} from '../shared/mantine';
import {Icon} from '../../common/icon/Icon';
import type {ShowToastFn} from '../../../services/toastService';
import type {Suggestion} from '../../../interfaces/job';
import type {
    AddAgentRecoveryRequest,
    RecoveryAgentJobViewModel,
    RecoveryAgentViewModel,
    UpdateAgentRecoveryRequest,
} from '../../../interfaces/nationwideJobs';

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

/** Mantine palette key per accent, so cards/chips tint consistently. */
type AccentColor = 'brand' | 'orange' | 'default';
type StatusColor = 'default' | 'info' | 'warning' | 'success';

const STATUS_LABELS: Record<string, string> = {
    assigned: 'Currently Assigned',
    searching: 'Currently Searching',
    pending: 'Pending Assignment',
    completed: 'Assignment Completed',
};

const STATUS_COLORS: Record<string, StatusColor> = {
    assigned: 'info',
    searching: 'warning',
    pending: 'default',
    completed: 'success',
};

const STATUS_BADGE_COLOR: Record<StatusColor, string> = {
    default: 'gray',
    info: 'reflex',
    warning: 'orange',
    success: 'green',
};

const captionProps = {size: 'xs', c: 'dimmed', tt: 'uppercase', style: {letterSpacing: 0.5}} as const;

const surfaceTint = alpha('var(--mantine-color-gray-6)', 0.04);

function getStatusLabel(status: string | undefined): string {
    if (!status) return 'Unknown Status';
    return STATUS_LABELS[status] || 'Unknown Status';
}

function getStatusColor(status: string | undefined): StatusColor {
    if (!status) return 'default';
    return STATUS_COLORS[status] || 'default';
}

function hasPrimaryRecoveryAgent(job: RecoveryAgentJobViewModel | null): boolean {
    if (!job?.recoveryJobs) return false;
    return job.recoveryJobs.some(rj =>
        rj.recoveryAgents?.some(agent => agent.primaryRecoveryAgent)
    );
}

/** The label + hint pair used by both "Set as Primary Recovery Agent" checkboxes. */
const primaryAgentLabel = (
    <Box>
        <Text size="sm" fw={600}>Set as Primary Recovery Agent</Text>
        <Text size="xs" c="dimmed">
            Primary agents take lead responsibility for recovery operations
        </Text>
    </Box>
);

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

    const [showAssignForm, {open: openAssignForm, close: closeAssignForm}] = useDisclosure(false);
    const [showEditForm, {open: openEditForm, close: closeEditForm}] = useDisclosure(false);

    const [selectedAirportId, setSelectedAirportId] = useState<number>(0);
    const [selectedAgentId, setSelectedAgentId] = useState<number>(0);
    const [isPrimaryRecoveryAgent, setIsPrimaryRecoveryAgent] = useState(false);

    const [editingAgent, setEditingAgent] = useState<RecoveryAgentViewModel | null>(null);
    const [editIsPrimaryRecoveryAgent, setEditIsPrimaryRecoveryAgent] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Re-seed local job state when the parent passes a different job, derived
    // during render rather than in an effect (avoids the extra post-paint commit).
    const [prevInitialJob, setPrevInitialJob] = useState(initialJob);
    if (initialJob !== prevInitialJob) {
        setPrevInitialJob(initialJob);
        setJob(initialJob);
    }

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
        closeAssignForm();
        setSelectedAirportId(0);
        setSelectedAgentId(0);
        setIsPrimaryRecoveryAgent(false);
        setAgentOptions([]);
    };

    const resetEditForm = () => {
        closeEditForm();
        setEditingAgent(null);
        setEditIsPrimaryRecoveryAgent(false);
    };

    const handleShowAssignForm = () => {
        openAssignForm();
        setIsPrimaryRecoveryAgent(false);
    };

    const handleShowEditForm = (agent: RecoveryAgentViewModel) => {
        setEditingAgent(agent);
        setEditIsPrimaryRecoveryAgent(agent.primaryRecoveryAgent || false);
        openEditForm();
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
        <DialogShell
            opened={open}
            onClose={handleCancel}
            size={dialogSize.lg}
            label="Lost Package Recovery"
            /* Escape must not bypass the unsaved-changes confirm */
            closeOnEscape={false}
        >
            <DialogHeader
                icon={<Icon lucide={Users}/>}
                title="Lost Package Recovery"
                subtitle={job ? `Job #${job.jobNumber}` : undefined}
                onClose={handleCancel}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                {!job ? (
                    <Group justify="center" py={64}>
                        <Loader size={40} role="progressbar" aria-label="Loading job"/>
                    </Group>
                ) : (
                    <>
                        {/* Package Information */}
                        <Paper withBorder radius="lg" mb="lg" style={{overflow: 'hidden'}}>
                            <Group
                                gap="sm"
                                px="md"
                                py="sm"
                                wrap="nowrap"
                                style={{
                                    backgroundColor: alpha('var(--mantine-color-brand-6)', 0.04),
                                    borderBottom: '1px solid var(--mantine-color-default-border)',
                                }}
                            >
                                <Box c="brand.6" style={{display: 'flex'}}>
                                    <Icon tabler={IconPackage} size={22}/>
                                </Box>
                                <Text fw={600}>Package Information</Text>
                            </Group>

                            {job.pickUpAddress && job.deliveryAddress && (
                                <Stack
                                    gap="sm"
                                    p="lg"
                                    style={{
                                        backgroundColor: headerColors.primary.bg,
                                        color: headerColors.primary.fg,
                                    }}
                                >
                                    <AddressRow
                                        icon={<Icon lucide={CircleDot} size={18}/>}
                                        label="Pickup Location"
                                        value={job.pickUpAddress.fullAddress}
                                    />
                                    <AddressRow
                                        icon={<Icon tabler={IconMapPin} size={18}/>}
                                        label="Delivery Location"
                                        value={job.deliveryAddress.fullAddress}
                                    />
                                </Stack>
                            )}

                            <Box
                                p="md"
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: 'var(--mantine-spacing-md)',
                                }}
                            >
                                <DetailCard
                                    icon={<Icon tabler={IconPackage} size={18}/>}
                                    label="Package Type"
                                    value={job.packageType}
                                />
                                <DetailCard
                                    icon={<Icon lucide={TriangleAlert} size={18}/>}
                                    label="Priority"
                                    value={job.priority}
                                    valueColor="orange.6"
                                />
                                <DetailCard
                                    icon={<Icon lucide={Search} size={18}/>}
                                    label="Last Known Location"
                                    value={job.lastKnownLocation}
                                />
                                <DetailCard
                                    icon={<Icon lucide={User} size={18}/>}
                                    label="Customer"
                                    value={job.customer}
                                />
                            </Box>
                        </Paper>

                        {/* Recovery Agents Section */}
                        <Group justify="space-between" mb="md" wrap="nowrap">
                            <Group gap="sm" wrap="nowrap">
                                <Box c="brand.6" style={{display: 'flex'}}>
                                    <Icon lucide={Users}/>
                                </Box>
                                <Text fw={600} fz="lg">Recovery Agents</Text>
                                {totalRecoveryAgents > 0 && (
                                    <Badge size="sm" fw={600}>{totalRecoveryAgents}</Badge>
                                )}
                            </Group>
                            {!isFormOpen && (
                                <Button
                                    leftSection={<Icon lucide={UserPlus}/>}
                                    onClick={handleShowAssignForm}
                                >
                                    Assign Agent
                                </Button>
                            )}
                        </Group>

                        {/* Assign Form */}
                        {showAssignForm && (
                            <Paper withBorder radius="lg" mb="lg" style={{overflow: 'hidden'}}>
                                <FormBar icon={<Icon lucide={UserPlus}/>} title="Assign Recovery Agent"/>

                                <Box p="md">
                                    <Alert color="reflex" icon={<Icon lucide={Info}/>} mb="md" radius="md">
                                        <Text size="sm" fw={600}>Recovery Agent Assignment</Text>
                                        <Text size="sm">
                                            This will assign a recovery agent to search for the package at the
                                            selected location.
                                        </Text>
                                    </Alert>

                                    <Box
                                        mb="md"
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                            gap: 'var(--mantine-spacing-md)',
                                        }}
                                    >
                                        <Select
                                            label="Airport Location"
                                            size="sm"
                                            data={airportOptions.map(a => ({value: String(a.id), label: a.text}))}
                                            value={selectedAirportId ? String(selectedAirportId) : null}
                                            onChange={(value) => handleAirportChange(Number(value) || 0)}
                                            comboboxProps={{keepMounted: false}}
                                        />
                                        <Select
                                            label="Available Agent"
                                            size="sm"
                                            disabled={!selectedAirportId}
                                            data={agentOptions.map(a => ({value: String(a.id), label: a.text}))}
                                            value={selectedAgentId ? String(selectedAgentId) : null}
                                            onChange={(value) => setSelectedAgentId(Number(value) || 0)}
                                            comboboxProps={{keepMounted: false}}
                                        />
                                    </Box>

                                    <Checkbox
                                        checked={isPrimaryRecoveryAgent}
                                        onChange={(e) => setIsPrimaryRecoveryAgent(e.currentTarget.checked)}
                                        label={primaryAgentLabel}
                                    />

                                    {isPrimaryRecoveryAgent && jobHasPrimary && (
                                        <Alert color="orange" icon={<Icon lucide={TriangleAlert}/>} mt="sm" radius="md">
                                            Setting this agent as primary will remove the current primary status from other agents.
                                        </Alert>
                                    )}
                                </Box>

                                <FormActions>
                                    <Button variant="subtle" color="gray" onClick={resetAssignForm} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                    <Button
                                        leftSection={<Icon lucide={Check}/>}
                                        loading={isSubmitting}
                                        onClick={handleAssignAgent}
                                        disabled={!selectedAirportId || !selectedAgentId}
                                    >
                                        Assign Agent
                                    </Button>
                                </FormActions>
                            </Paper>
                        )}

                        {/* Edit Form */}
                        {showEditForm && editingAgent && (
                            <Paper withBorder radius="lg" mb="lg" style={{overflow: 'hidden'}}>
                                <FormBar
                                    icon={<Icon lucide={Pencil}/>}
                                    title={`Edit Recovery Agent — ${editingAgent.agentName}`}
                                />

                                <Box p="md">
                                    <Checkbox
                                        checked={editIsPrimaryRecoveryAgent}
                                        onChange={(e) => setEditIsPrimaryRecoveryAgent(e.currentTarget.checked)}
                                        label={primaryAgentLabel}
                                    />

                                    {editIsPrimaryRecoveryAgent && jobHasPrimary && !editingAgent.primaryRecoveryAgent && (
                                        <Alert color="orange" icon={<Icon lucide={TriangleAlert}/>} mt="sm" radius="md">
                                            Setting this agent as primary will remove the current primary status from other agents.
                                        </Alert>
                                    )}
                                </Box>

                                <FormActions>
                                    <Button variant="subtle" color="gray" onClick={resetEditForm} disabled={isSubmitting}>
                                        Cancel
                                    </Button>
                                    <Button
                                        color="red"
                                        leftSection={<Icon lucide={UserMinus}/>}
                                        onClick={() => handleRemoveAgent(editingAgent)}
                                        disabled={isSubmitting}
                                    >
                                        Remove Agent
                                    </Button>
                                    <Button
                                        leftSection={<Icon lucide={Save}/>}
                                        loading={isSubmitting}
                                        onClick={handleUpdateAgent}
                                    >
                                        Save Changes
                                    </Button>
                                </FormActions>
                            </Paper>
                        )}

                        {/* Agent Cards */}
                        <Stack gap="md">
                            {/* Main Agent */}
                            {job.assignedAgent && (
                                <AgentCard
                                    title={job.assignedAgent.text}
                                    role="Primary Job Agent"
                                    statusLabel={getStatusLabel('assigned')}
                                    statusColor="info"
                                    accentColor="brand"
                                    icon={<Icon lucide={HardHat}/>}
                                    metaItems={[{icon: <Icon lucide={Building2} size={16}/>, text: 'Overall Job Responsibility'}]}
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
                                    accentColor={agent.primaryRecoveryAgent ? 'orange' : 'default'}
                                    icon={<Icon lucide={User}/>}
                                    metaItems={[
                                        {icon: <Icon tabler={IconMapPin} size={16}/>, text: agent.airport},
                                        {
                                            icon: <Icon lucide={Building2} size={16}/>,
                                            text: agent.primaryRecoveryAgent ? 'Lead Recovery Specialist' : 'Recovery Specialist',
                                        },
                                    ]}
                                    actions={
                                        <>
                                            <ActionIcon
                                                variant="subtle"
                                                color="gray"
                                                onClick={() => handleShowEditForm(agent)}
                                                aria-label={`Edit ${agent.agentName}`}
                                            >
                                                <Icon lucide={Pencil} size={18}/>
                                            </ActionIcon>
                                            <ActionIcon
                                                variant="subtle"
                                                color="red"
                                                onClick={() => handleRemoveAgent(agent)}
                                                aria-label={`Remove ${agent.agentName}`}
                                            >
                                                <Icon lucide={UserMinus} size={18}/>
                                            </ActionIcon>
                                        </>
                                    }
                                />
                            ))}

                            {/* Empty State */}
                            {!hasRecoveryJobs && !isFormOpen && (
                                <Paper
                                    radius="lg"
                                    py={40}
                                    px="lg"
                                    ta="center"
                                    style={{border: '1px dashed var(--mantine-color-default-border)'}}
                                >
                                        {/* An empty-state glyph in a tinted disc is `ThemeIcon variant="light"`. */}
                                        <ThemeIcon size={64} radius="xl" variant="light" color="gray" mx="auto" mb="md">
                                            <Icon lucide={UsersRound} size={32}/>
                                        </ThemeIcon>
                                    <Text fw={600} fz="lg" mb="xs">No Recovery Agents Assigned</Text>
                                    <Text size="sm" c="dimmed" mb="md" mx="auto" maw={480}>
                                        Get started by assigning recovery agents to specific locations where the package
                                        might be found.
                                    </Text>
                                    <Button leftSection={<Icon lucide={UserPlus}/>} onClick={handleShowAssignForm}>
                                        Assign First Recovery Agent
                                    </Button>
                                </Paper>
                            )}
                        </Stack>
                    </>
                )}
            </Box>
            <Divider/>
            {!isFormOpen && (
                <DialogFooter
                    onCancel={handleCancel}
                    onConfirm={onClose}
                    confirmLabel="Complete"
                    confirmIcon={<Icon lucide={Check}/>}
                    confirmDisabled={isSubmitting}
                    submitting={false}
                />
            )}
        </DialogShell>
    );
};

// ──────────────────────────────────────────────────────────────────────────
// Internal helper components

/** The tinted title bar at the top of the assign/edit sub-forms. */
function FormBar({icon, title}: {icon: React.ReactNode; title: string}): React.ReactElement {
    return (
        <Group
            gap="sm"
            px="md"
            py="sm"
            wrap="nowrap"
            style={{
                backgroundColor: alpha('var(--mantine-color-brand-6)', 0.06),
                borderBottom: '1px solid var(--mantine-color-default-border)',
            }}
        >
            <Box c="brand.6" style={{display: 'flex'}}>{icon}</Box>
            <Text fw={600}>{title}</Text>
        </Group>
    );
}

/** The tinted action strip at the bottom of the assign/edit sub-forms. */
function FormActions({children}: {children: React.ReactNode}): React.ReactElement {
    return (
        <Group
            justify="flex-end"
            gap="xs"
            p="md"
            style={{
                backgroundColor: surfaceTint,
                borderTop: '1px solid var(--mantine-color-default-border)',
            }}
        >
            {children}
        </Group>
    );
}

/** A pickup/delivery line inside the brand-filled address block. */
function AddressRow({icon, label, value}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}): React.ReactElement {
    return (
        <Group gap="md" align="flex-start" wrap="nowrap">
            <ThemeIcon
                size={32}
                radius="lg"
                style={{'--ti-bg': headerOverlayColor(0.2), '--ti-color': 'inherit'} as React.CSSProperties}
            >
                {icon}
            </ThemeIcon>
            <Box style={{flex: 1, minWidth: 0}}>
                <Text size="xs" tt="uppercase" style={{opacity: 0.85, letterSpacing: 0.5}}>{label}</Text>
                <Text size="sm" mt={2}>{value}</Text>
            </Box>
        </Group>
    );
}

interface DetailCardProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    valueColor?: string;
}

function DetailCard({icon, label, value, valueColor}: DetailCardProps): React.ReactElement {
    return (
        <Group
            gap="sm"
            align="flex-start"
            wrap="nowrap"
            p="md"
            style={{
                borderRadius: 'var(--mantine-radius-md)',
                backgroundColor: surfaceTint,
                border: '1px solid var(--mantine-color-default-border)',
            }}
        >
            <ThemeIcon size={32} radius="lg" variant="light" color="brand">
                {icon}
            </ThemeIcon>
            <Box style={{minWidth: 0}}>
                <Text {...captionProps} display="block">{label}</Text>
                <Text size="sm" fw={500} c={valueColor} mt={2}>{value || '—'}</Text>
            </Box>
        </Group>
    );
}

interface AgentCardProps {
    title: string;
    role: string;
    statusLabel: string;
    statusColor: StatusColor;
    accentColor: AccentColor;
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
    const isNeutral = accentColor === 'default';
    const accentVar = `var(--mantine-color-${accentColor}-6)`;

    return (
        <Paper
            p="md"
            radius="lg"
            style={{
                border: `1px solid ${isNeutral ? 'var(--mantine-color-default-border)' : alpha(accentVar, 0.4)}`,
                backgroundColor: isNeutral ? 'transparent' : alpha(accentVar, 0.03),
            }}
        >
            <Group gap="md" align="flex-start" wrap="nowrap">
                <ThemeIcon
                    size={48}
                    radius="md"
                    c={isNeutral ? 'dimmed' : `${accentColor}.6`}
                    style={{
                        '--ti-bg': isNeutral
                            ? alpha('var(--mantine-color-gray-6)', 0.12)
                            : alpha(accentVar, 0.12),
                    } as React.CSSProperties}
                >
                    {icon}
                </ThemeIcon>
                <Box style={{flex: 1, minWidth: 0}}>
                    <Text fw={600} truncate>{title}</Text>
                    <Text size="sm" c="dimmed" mb={6}>{role}</Text>
                    <Group gap="md" c="dimmed">
                        {metaItems.map((meta, index) => (
                            <Group key={index} gap={4} wrap="nowrap">
                                <Box style={{display: 'flex'}}>{meta.icon}</Box>
                                <Text size="xs">{meta.text}</Text>
                            </Group>
                        ))}
                    </Group>
                </Box>
                {actions && <Group gap={4} wrap="nowrap">{actions}</Group>}
            </Group>
            <Group justify="flex-end" mt="sm">
                <Badge size="sm" fw={500} color={STATUS_BADGE_COLOR[statusColor]} variant="light">
                    {statusLabel}
                </Badge>
            </Group>
        </Paper>
    );
}

export default RecoveryAgentManagementDialog;
