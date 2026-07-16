/**
 * JobDetailHeader - Toolbar with job identity, status, density toggle, edit mode, POD menu
 */

import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import type {SxProps, Theme} from '@mui/material/styles';
import {monoFontFamily} from '../../../../theme/muiTheme';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import CheckIcon from '@mui/icons-material/Check';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import EmailIcon from '@mui/icons-material/Email';
import ViewWeekIcon from '@mui/icons-material/ViewWeek';
import DescriptionIcon from '@mui/icons-material/Description';
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

function getStatusColor(job: IJob): 'primary' | 'success' | 'error' | 'warning' | 'default' {
    if (job.void) return 'error';
    if (job.done) return 'success';
    if (job.dispatchTime) return 'primary';
    return 'warning';
}

const styles: Record<string, SxProps<Theme>> = {
    toolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        height: 52,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        borderLeft: 3,
        borderLeftColor: 'primary.main',
    },
    jobIdentity: {
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        mr: 'auto',
    },
    jobNo: {
        fontFamily: monoFontFamily,
        fontSize: '1.125rem',
        fontWeight: 700,
        color: 'text.primary',
        letterSpacing: '-0.02em',
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
    },
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
    const [podMenuAnchor, setPodMenuAnchor] = useState<HTMLElement | null>(null);
    const isDense = viewDensityLabel === 'Dense';

    const toolbarSx = dense ? {
        ...styles.toolbar as object,
        height: 40,
        px: 1.5,
    } : styles.toolbar;

    const jobNoSx = dense ? {
        ...styles.jobNo as object,
        fontSize: '1rem',
    } : styles.jobNo;

    // POD report/email options require a completed, non-recurring job. The menu is
    // always shown so PDF-overlay documents are reachable at any stage; these three
    // items render disabled (with an explanatory tooltip) until the job qualifies.
    const podEnabled = job.done && !job.preBook;
    const podDisabledReason = 'Available once the job is completed';

    const renderPodItem = (icon: React.ReactNode, label: string, onClick: () => void) => (
        podEnabled ? (
            <MenuItem onClick={() => {
                setPodMenuAnchor(null);
                onClick();
            }}>
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText>{label}</ListItemText>
            </MenuItem>
        ) : (
            // Disabled MenuItems don't fire pointer events, so wrap in a span for the tooltip.
            <Tooltip title={podDisabledReason} placement="left">
                <span>
                    <MenuItem disabled sx={{width: '100%'}}>
                        <ListItemIcon>{icon}</ListItemIcon>
                        <ListItemText>{label}</ListItemText>
                    </MenuItem>
                </span>
            </Tooltip>
        )
    );

    return (
        <Box sx={toolbarSx}>
            {/* Job identity */}
            <Box sx={styles.jobIdentity}>
                {/* Recurring jobs never had a real UcbkJobNumber to show — the
                    AngularJS detail template kept the header empty for them and
                    used synthetic 'Job #N' labels in the tabs instead. The React
                    port added this Typography unconditionally, which renders as
                    a blank slot for prebook jobs. Gate it on !preBook to restore
                    the AngularJS behaviour. */}
                {!job.preBook && (
                    <Typography sx={jobNoSx}>
                        {job.jobNo}
                    </Typography>
                )}
                {job.isPartnerJob && (
                    <Chip
                        icon={<HandshakeIcon sx={{fontSize: 14}}/>}
                        label="Partner Job"
                        size="small"
                        color="info"
                        variant="filled"
                        sx={{fontWeight: 600, fontSize: '0.75rem', height: 26, letterSpacing: '0.02em'}}
                    />
                )}
            </Box>

            {/* Actions */}
            <Box sx={styles.actions}>
                {/* Status Chip + Lock */}
                {!job.preBook && (
                    <Chip
                        label={job.statusName}
                        onClick={onStatusClick}
                        size="small"
                        color={getStatusColor(job)}
                        variant="filled"
                        clickable
                        sx={{fontWeight: 600, fontSize: '0.75rem', height: 26, letterSpacing: '0.02em'}}
                    />
                )}
                {/* Recurring Route assignment (US medical-courier tenants).
                    Compact Select sits to the left of the Lock icon, gated on
                    job.preBook (recurring jobs only) + routes.length > 0 (only
                    on tenants where the Routes table is populated). Empty value
                    represents "None" — cascades through booking tree server-
                    side via JobProperty.RouteId. No Tooltip wrapper: it
                    overlaid the open dropdown menu and obscured options. */}
                {job.preBook && routes.length > 0 && (
                    <FormControl size="small" sx={{minWidth: 180}}>
                        <Select
                            value={job.routeId ?? ''}
                            displayEmpty
                            aria-label="Recurring Route — cascades to all associated legs"
                            onChange={(e) => {
                                const raw = e.target.value;
                                const v = raw === null || raw === undefined ? '' : String(raw);
                                onRouteChange(v === '' || v === '0' ? null : Number(v));
                            }}
                            sx={{
                                fontSize: '0.8125rem',
                                height: 30,
                                '& .MuiSelect-select': {py: 0.5},
                            }}
                        >
                            <MenuItem value=""><em>No route</em></MenuItem>
                            {routes.map(r => (
                                <MenuItem key={r.id} value={r.id}>
                                    {r.text}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                )}

                {/* Lock is a LocalOnly field per PartnerJobGate — each tenant owns its
                    own copy independently. Don't disable on partner jobs: the field-level
                    edit guards handle cross-tenant protection, and showing "Locked —
                    managed by partner" here just conflates two distinct concepts. */}
                <Tooltip title={job.locked ? 'Unlock Job' : 'Lock Job'}>
                    <IconButton
                        size="small"
                        color={job.locked ? 'warning' : 'default'}
                        onClick={onLockToggle}
                    >
                        {job.locked
                            ? <LockIcon sx={{fontSize: ICON_SIZE}}/>
                            : <LockOpenIcon sx={{fontSize: ICON_SIZE}}/>
                        }
                    </IconButton>
                </Tooltip>

                {/* View Density Toggle */}
                <Tooltip title={`${isDense ? 'Normal' : 'Compact'} view`}>
                    <IconButton size="small" onClick={onToggleDensity}>
                        {isDense
                            ? <DensityMediumIcon sx={{fontSize: ICON_SIZE}}/>
                            : <DensitySmallIcon sx={{fontSize: ICON_SIZE}}/>
                        }
                    </IconButton>
                </Tooltip>

                {/* Edit Mode Toggle */}
                <Tooltip title={isEditMode ? 'Done editing' : 'Show/Hide fields'}>
                    <IconButton
                        size="small"
                        color={isEditMode ? 'primary' : 'default'}
                        onClick={onToggleEditMode}
                    >
                        {isEditMode
                            ? <CheckIcon sx={{fontSize: ICON_SIZE}}/>
                            : <DashboardCustomizeIcon sx={{fontSize: ICON_SIZE}}/>
                        }
                    </IconButton>
                </Tooltip>

                {/* Reset Button (edit mode only) */}
                {isEditMode && (
                    <Tooltip title="Reset to default layout">
                        <IconButton size="small" onClick={onResetFieldVisibility}>
                            <ViewWeekIcon sx={{fontSize: ICON_SIZE}}/>
                        </IconButton>
                    </Tooltip>
                )}

                {/* Documents menu — always shown so PDF-overlay documents are reachable
                    at any stage; the POD report/email items disable themselves until the
                    job is completed (see renderPodItem / podEnabled above). */}
                <Tooltip title="Documents">
                    <IconButton
                        size="small"
                        aria-label="Documents"
                        onClick={(e) => {
                            setPodMenuAnchor(e.currentTarget);
                            onOverlayMenuOpen?.();
                        }}
                    >
                        <MoreVertIcon sx={{fontSize: ICON_SIZE}}/>
                    </IconButton>
                </Tooltip>
                <Menu
                    anchorEl={podMenuAnchor}
                    open={Boolean(podMenuAnchor)}
                    onClose={() => setPodMenuAnchor(null)}
                >
                    {renderPodItem(<PictureAsPdfIcon fontSize="small"/>, 'Download as PDF', onPodReport)}
                    {renderPodItem(<TableChartIcon fontSize="small"/>, 'Download as Excel', onPodSpreadsheet)}
                    <Divider/>
                    {renderPodItem(<EmailIcon fontSize="small"/>, 'Email POD Report', onSendPodEmail)}

                    {/* Extra overlay documents (invoices, manifests, etc.). Every configured
                        document type is shown; those without a template for this job's client
                        render disabled rather than hidden. */}
                    {overlayDocumentsLoading && (
                        <MenuItem disabled>
                            <ListItemIcon><CircularProgress size={16}/></ListItemIcon>
                            <ListItemText>Loading documents…</ListItemText>
                        </MenuItem>
                    )}
                    {!overlayDocumentsLoading && overlayDocuments.length > 0 && <Divider/>}
                    {!overlayDocumentsLoading && overlayDocuments.map((doc) => (
                        doc.available ? (
                            <MenuItem
                                key={doc.documentType}
                                onClick={() => {
                                    setPodMenuAnchor(null);
                                    onDownloadOverlay?.(doc.documentType);
                                }}
                            >
                                <ListItemIcon><DescriptionIcon fontSize="small"/></ListItemIcon>
                                <ListItemText>{doc.displayName}</ListItemText>
                            </MenuItem>
                        ) : (
                            // Disabled MenuItems don't fire pointer events, so wrap in a span for the
                            // tooltip explaining why the document is unavailable for this job.
                            <Tooltip key={doc.documentType} title="No template configured for this job" placement="left">
                                <span>
                                    <MenuItem disabled sx={{width: '100%'}}>
                                        <ListItemIcon><DescriptionIcon fontSize="small"/></ListItemIcon>
                                        <ListItemText>{doc.displayName}</ListItemText>
                                    </MenuItem>
                                </span>
                            </Tooltip>
                        )
                    ))}
                </Menu>
            </Box>
        </Box>
    );
}
