/**
 * JobDetailHeader - Toolbar with job identity, status, density toggle, edit mode, AI, POD menu
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
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import type {SxProps, Theme} from '@mui/material/styles';
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
import type {IJob} from '../JobDetails.types';
import type {RouteOption} from '../../../../interfaces/recurringJobs';

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

    return (
        <Box sx={toolbarSx}>
            {/* Job identity */}
            <Box sx={styles.jobIdentity}>
                <Typography sx={jobNoSx}>
                    {job.jobNo}
                </Typography>
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
                    side via JobProperty.RouteId. */}
                {job.preBook && routes.length > 0 && (
                    <Tooltip title="Recurring Route — cascades to all associated legs">
                        <FormControl size="small" sx={{minWidth: 180}}>
                            <Select
                                value={job.routeId ?? ''}
                                displayEmpty
                                aria-label="Recurring Route"
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
                    </Tooltip>
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

                {/* POD Report Menu */}
                {job.done && !job.preBook && (
                    <>
                        <Tooltip title="POD Report">
                            <IconButton
                                size="small"
                                onClick={(e) => setPodMenuAnchor(e.currentTarget)}
                            >
                                <MoreVertIcon sx={{fontSize: ICON_SIZE}}/>
                            </IconButton>
                        </Tooltip>
                        <Menu
                            anchorEl={podMenuAnchor}
                            open={Boolean(podMenuAnchor)}
                            onClose={() => setPodMenuAnchor(null)}
                        >
                            <MenuItem onClick={() => {
                                setPodMenuAnchor(null);
                                onPodReport();
                            }}>
                                <ListItemIcon><PictureAsPdfIcon fontSize="small"/></ListItemIcon>
                                <ListItemText>Download as PDF</ListItemText>
                            </MenuItem>
                            <MenuItem onClick={() => {
                                setPodMenuAnchor(null);
                                onPodSpreadsheet();
                            }}>
                                <ListItemIcon><TableChartIcon fontSize="small"/></ListItemIcon>
                                <ListItemText>Download as Excel</ListItemText>
                            </MenuItem>
                            <Divider/>
                            <MenuItem onClick={() => {
                                setPodMenuAnchor(null);
                                onSendPodEmail();
                            }}>
                                <ListItemIcon><EmailIcon fontSize="small"/></ListItemIcon>
                                <ListItemText>Email POD Report</ListItemText>
                            </MenuItem>
                        </Menu>
                    </>
                )}
            </Box>
        </Box>
    );
}
