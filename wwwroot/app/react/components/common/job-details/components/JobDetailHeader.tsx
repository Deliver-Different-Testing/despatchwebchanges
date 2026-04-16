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
import type {SxProps, Theme} from '@mui/material/styles';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import CheckIcon from '@mui/icons-material/Check';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import EmailIcon from '@mui/icons-material/Email';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type {IJob} from '../JobDetails.types';

interface JobDetailHeaderProps {
    job: IJob;
    dense?: boolean;
    viewDensityLabel: string;
    isEditMode: boolean;
    aiEnabled: boolean;
    showAiPanel: boolean;
    onToggleDensity: () => void;
    onToggleEditMode: () => void;
    onResetFieldVisibility: () => void;
    onToggleAiPanel: () => void;
    onStatusClick: () => void;
    onPodReport: () => void;
    onPodSpreadsheet: () => void;
    onSendPodEmail: () => void;
    onLockToggle: () => void;
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
                                    aiEnabled,
                                    showAiPanel,
                                    onToggleDensity,
                                    onToggleEditMode,
                                    onResetFieldVisibility,
                                    onToggleAiPanel,
                                    onStatusClick,
                                    onPodReport,
                                    onPodSpreadsheet,
                                    onSendPodEmail,
                                    onLockToggle,
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
                {job.isPartnerJob && (
                    <Chip
                        icon={<HandshakeIcon sx={{fontSize: 14}}/>}
                        label="Partner Job"
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{fontWeight: 600, fontSize: '0.7rem', height: 26}}
                    />
                )}
                <Tooltip title={job.isPartnerJob ? 'Locked — managed by partner' : job.locked ? 'Unlock Job' : 'Lock Job'}>
                    <span>
                        <IconButton
                            size="small"
                            color={job.locked ? 'warning' : 'default'}
                            onClick={onLockToggle}
                            disabled={Boolean(job.isPartnerJob)}
                        >
                            {job.locked
                                ? <LockIcon sx={{fontSize: ICON_SIZE}}/>
                                : <LockOpenIcon sx={{fontSize: ICON_SIZE}}/>
                            }
                        </IconButton>
                    </span>
                </Tooltip>

                {/* AI Summary Panel Toggle */}
                {aiEnabled && (
                    <Tooltip title={showAiPanel ? 'Hide AI Summary' : 'AI Summary'}>
                        <IconButton
                            size="small"
                            color={showAiPanel ? 'primary' : 'default'}
                            onClick={onToggleAiPanel}
                        >
                            <AutoAwesomeIcon sx={{fontSize: ICON_SIZE}}/>
                        </IconButton>
                    </Tooltip>
                )}

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
                            <RestartAltIcon sx={{fontSize: ICON_SIZE}}/>
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
