/**
 * JobDetailHeader - Toolbar with job identity, status, density toggle, edit mode, POD menu
 */

import React from 'react';
import {ActionIcon, Badge, Box, Group, Loader, Menu, Select, Text, Tooltip} from '@mantine/core';
import {
    Check, FileSpreadsheet, FileText, Handshake, LayoutGrid, Lock, LockOpen, Mail,
    EllipsisVertical, Rows2, Rows4, Columns3,
} from 'lucide-react';
import {Icon} from '../../icon/Icon';
import {resolvedStatusLabel, resolvedStatusTone, type StatusTone} from '../../../../utils/jobStatus';
import type {IJob} from '../JobDetails.types';
import type {RouteOption} from '../../../../interfaces/recurringJobs';
import type {OverlayDocument} from '../../../../services/jobDetailApi';

interface JobDetailHeaderProps {
    job: IJob;
    dense?: boolean;
    viewDensityLabel: string;
    isEditMode: boolean;
    routes: RouteOption[];
    onToggleDensity: () => void;
    onToggleEditMode: () => void;
    onResetFieldVisibility: () => void;
    onStatusClick: () => void;
    onPodReport: () => void;
    onPodSpreadsheet: () => void;
    onSendPodEmail: () => void;
    onLockToggle: () => void;
    onRouteChange: (routeId: number | null) => void;
    /** Extra overlay documents to offer below the POD options. */
    overlayDocuments?: OverlayDocument[];
    /** True while the overlay document list is being fetched. */
    overlayDocumentsLoading?: boolean;
    /** Called when the POD menu opens, to lazily fetch the overlay documents. */
    onOverlayMenuOpen?: () => void;
    /** Called when an available overlay document is selected. */
    onDownloadOverlay?: (documentType: string) => void;
}

/**
 * The status pill's meaning, exposed as `data-status-tone` so it can be asserted
 * without reaching into the palette (the colour may be re-tuned; the tone won't).
 */


const statusColors: Record<StatusTone, string> = {
    void: 'red',
    done: 'green',
    dispatched: 'brand',
    pending: 'orange',
};

const toolbarStyle = (dense?: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingInline: dense ? 12 : 16,
    height: dense ? 40 : 52,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: 'var(--mantine-color-default-border)',
    backgroundColor: 'var(--dd-surface-container)',
    borderLeftWidth: 3,
    borderLeftStyle: 'solid',
    borderLeftColor: 'var(--mantine-primary-color-filled)',
});

const jobNoStyle = (dense?: boolean): React.CSSProperties => ({
    fontSize: dense ? '1rem' : '1.125rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
});

const pillStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: '0.75rem',
    height: 26,
    letterSpacing: '0.02em',
};

const ICON_SIZE = 18;

export function JobDetailHeader({
    job,
    dense,
    viewDensityLabel,
    isEditMode,
    routes,
    onToggleDensity,
    onToggleEditMode,
    onResetFieldVisibility,
    onStatusClick,
    onPodReport,
    onPodSpreadsheet,
    onSendPodEmail,
    onLockToggle,
    onRouteChange,
    overlayDocuments = [],
    overlayDocumentsLoading = false,
    onOverlayMenuOpen,
    onDownloadOverlay,
}: JobDetailHeaderProps) {
    const isDense = viewDensityLabel === 'Dense';
    const statusTone = resolvedStatusTone(job);

    // POD report/email options require a completed, non-recurring job. The menu is
    // always shown so PDF-overlay documents are reachable at any stage; these three
    // items render disabled (with an explanatory tooltip) until the job qualifies.
    const podEnabled = job.done && !job.preBook;
    const podDisabledReason = 'Available once the job is completed';

    const renderPodItem = (icon: React.ReactNode, label: string, onClick: () => void) => (
        podEnabled ? (
            <Menu.Item key={label} leftSection={icon} onClick={onClick}>
                {label}
            </Menu.Item>
        ) : (
            // Disabled items don't fire pointer events, so the tooltip needs a
            // wrapper that does.
            <Tooltip key={label} label={podDisabledReason} position="left">
                <span>
                    <Menu.Item disabled leftSection={icon} style={{width: '100%'}}>
                        {label}
                    </Menu.Item>
                </span>
            </Tooltip>
        )
    );

    return (
        <Box style={toolbarStyle(dense)}>
            {/* Job identity */}
            <Group gap="sm" mr="auto">
                {/* Recurring jobs never had a real UcbkJobNumber to show — the
                    AngularJS detail template kept the header empty for them and
                    used synthetic 'Job #N' labels in the tabs instead. The React
                    port added this unconditionally, which renders as a blank slot
                    for prebook jobs. Gate it on !preBook to restore the AngularJS
                    behaviour. */}
                {!job.preBook && (
                    <Text style={jobNoStyle(dense)}>{job.jobNo}</Text>
                )}
                {job.isPartnerJob && (
                    <Badge
                        color="reflex"
                        tt="none"
                        leftSection={<Icon lucide={Handshake} size={14}/>}
                        style={pillStyle}
                    >
                        Partner Job
                    </Badge>
                )}
            </Group>

            {/* Actions */}
            <Group gap={4}>
                {/* Status pill + Lock */}
                {!job.preBook && (
                    <Badge
                        component="button"
                        type="button"
                        color={statusColors[statusTone]}
                        data-status-tone={statusTone}
                        tt="none"
                        onClick={onStatusClick}
                        style={{...pillStyle, cursor: 'pointer'}}
                    >
                        {resolvedStatusLabel(job)}
                    </Badge>
                )}
                {/* Recurring Route assignment (US medical-courier tenants).
                    Compact Select sits to the left of the Lock icon, gated on
                    job.preBook (recurring jobs only) + routes.length > 0 (only
                    on tenants where the Routes table is populated). Empty value
                    represents "None" — cascades through booking tree server-
                    side via JobProperty.RouteId. No Tooltip wrapper: it
                    overlaid the open dropdown menu and obscured options. */}
                {job.preBook && routes.length > 0 && (
                    <Select
                        aria-label="Recurring Route — cascades to all associated legs"
                        placeholder="No route"
                        w={180}
                        size="xs"
                        clearable
                        data={routes.map(r => ({value: String(r.id), label: r.text}))}
                        value={job.routeId != null ? String(job.routeId) : null}
                        onChange={(value) => {
                            onRouteChange(value == null || value === '' || value === '0' ? null : Number(value));
                        }}
                        comboboxProps={{keepMounted: false}}
                    />
                )}

                {/* Lock is a LocalOnly field per PartnerJobGate — each tenant owns its
                    own copy independently. Don't disable on partner jobs: the field-level
                    edit guards handle cross-tenant protection, and showing "Locked —
                    managed by partner" here just conflates two distinct concepts. */}
                <Tooltip label={job.locked ? 'Unlock Job' : 'Lock Job'}>
                    <ActionIcon
                        variant="subtle"
                        size="md"
                        color={job.locked ? 'orange' : 'gray'}
                        data-locked={job.locked || undefined}
                        aria-label={job.locked ? 'Unlock Job' : 'Lock Job'}
                        onClick={onLockToggle}
                    >
                        <Icon lucide={job.locked ? Lock : LockOpen} size={ICON_SIZE}/>
                    </ActionIcon>
                </Tooltip>

                {/* View Density Toggle */}
                <Tooltip label={`${isDense ? 'Normal' : 'Compact'} view`}>
                    <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="md"
                        aria-label={`${isDense ? 'Normal' : 'Compact'} view`}
                        onClick={onToggleDensity}
                    >
                        <Icon lucide={isDense ? Rows2 : Rows4} size={ICON_SIZE}/>
                    </ActionIcon>
                </Tooltip>

                {/* Edit Mode Toggle */}
                <Tooltip label={isEditMode ? 'Done editing' : 'Show/Hide fields'}>
                    <ActionIcon
                        variant="subtle"
                        size="md"
                        color={isEditMode ? undefined : 'gray'}
                        data-edit-mode={isEditMode || undefined}
                        aria-label={isEditMode ? 'Done editing' : 'Show/Hide fields'}
                        onClick={onToggleEditMode}
                    >
                        <Icon lucide={isEditMode ? Check : LayoutGrid} size={ICON_SIZE}/>
                    </ActionIcon>
                </Tooltip>

                {/* Reset Button (edit mode only) */}
                {isEditMode && (
                    <Tooltip label="Reset to default layout">
                        <ActionIcon
                            variant="subtle"
                            color="gray"
                            size="md"
                            aria-label="Reset to default layout"
                            onClick={onResetFieldVisibility}
                        >
                            <Icon lucide={Columns3} size={ICON_SIZE}/>
                        </ActionIcon>
                    </Tooltip>
                )}

                {/* Documents menu — always shown so PDF-overlay documents are reachable
                    at any stage; the POD report/email items disable themselves until the
                    job is completed (see renderPodItem / podEnabled above). */}
                <Menu position="bottom-end" onOpen={onOverlayMenuOpen}>
                    <Menu.Target>
                        <Tooltip label="Documents">
                            <ActionIcon variant="subtle" color="gray" size="md" aria-label="Documents">
                                <Icon lucide={EllipsisVertical} size={ICON_SIZE}/>
                            </ActionIcon>
                        </Tooltip>
                    </Menu.Target>
                    <Menu.Dropdown>
                        {renderPodItem(<Icon lucide={FileText} size={16}/>, 'Download as PDF', onPodReport)}
                        {renderPodItem(<Icon lucide={FileSpreadsheet} size={16}/>, 'Download as Excel', onPodSpreadsheet)}
                        <Menu.Divider/>
                        {renderPodItem(<Icon lucide={Mail} size={16}/>, 'Email POD Report', onSendPodEmail)}

                        {/* Extra overlay documents (invoices, manifests, etc.). Every configured
                            document type is shown; those without a template for this job's client
                            render disabled rather than hidden. */}
                        {overlayDocumentsLoading && (
                            <Menu.Item disabled leftSection={<Loader size={16}/>}>
                                Loading documents…
                            </Menu.Item>
                        )}
                        {!overlayDocumentsLoading && overlayDocuments.length > 0 && <Menu.Divider/>}
                        {!overlayDocumentsLoading && overlayDocuments.map((doc) => (
                            doc.available ? (
                                <Menu.Item
                                    key={doc.documentType}
                                    leftSection={<Icon lucide={FileText} size={16}/>}
                                    onClick={() => onDownloadOverlay?.(doc.documentType)}
                                >
                                    {doc.displayName}
                                </Menu.Item>
                            ) : (
                                // Disabled items don't fire pointer events, so the tooltip
                                // explaining why needs a wrapper that does.
                                <Tooltip key={doc.documentType} label="No template configured for this job" position="left">
                                    <span>
                                        <Menu.Item disabled leftSection={<Icon lucide={FileText} size={16}/>} style={{width: '100%'}}>
                                            {doc.displayName}
                                        </Menu.Item>
                                    </span>
                                </Tooltip>
                            )
                        ))}
                    </Menu.Dropdown>
                </Menu>
            </Group>
        </Box>
    );
}
