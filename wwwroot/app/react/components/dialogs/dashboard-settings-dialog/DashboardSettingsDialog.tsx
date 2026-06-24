/**
 * React Dashboard Settings Dialog
 *
 * A modern replacement for the AngularJS dashboard-settings-dialog using MUI components.
 */

import React, {useState, useMemo} from 'react';
import {alpha} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import FormControl from '@mui/material/FormControl';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import SettingsIcon from '@mui/icons-material/Settings';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InfoIcon from '@mui/icons-material/Info';
import ScienceIcon from '@mui/icons-material/Science';
import {aiAccentColor} from '../../../theme/designTokens';
import {AutoMateLogo} from '../../common/auto-mate-logo/AutoMateLogo';

// Types that mirror the AngularJS interfaces
export interface RefreshOption {
    id: number;
    text: string;
}

export interface DashboardBox {
    name?: string;
    title?: string;
    icon?: string;
    description?: string;
    visible?: boolean;
}

export interface DashboardSettingsConfig {
    title: string;
    showRefreshInterval?: boolean;
    showDriverLocationRefresh?: boolean;
    showDashboards?: boolean;
    showAiToggle?: boolean;
    /** Show the "Try the React (BETA) Job Search" toggle. Job Search settings only. */
    showJobSearchBetaToggle?: boolean;
    /**
     * Replace the Dashboard panels section with a notice that panel options have
     * moved to the Layouts menu → Customize panels. Set where the dedicated
     * Customize Panels dialog owns visibility (currently Job Search).
     */
    panelsMovedNotice?: boolean;
}

export interface DashboardSettingsResult {
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    boxes?: Record<string, DashboardBox>;
    aiEnabled?: boolean;
    /** Set when `showJobSearchBetaToggle` is true; the caller persists + redirects. */
    jobSearchBetaEnabled?: boolean;
}

export interface DashboardSettingsDialogProps {
    open: boolean;
    config: DashboardSettingsConfig;
    boxes: Record<string, DashboardBox>;
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    refreshOptions: RefreshOption[];
    aiEnabled?: boolean;
    jobSearchBetaEnabled?: boolean;
    onClose: () => void;
    onSave: (result: DashboardSettingsResult) => void;
}

export const DashboardSettingsDialog: React.FC<DashboardSettingsDialogProps> = ({
    open,
    config,
    boxes: initialBoxes,
    selectedRefreshInterval: initialRefreshInterval,
    selectedDriverLocationRefreshInterval: initialDriverInterval,
    refreshOptions,
    aiEnabled: initialAiEnabled,
    jobSearchBetaEnabled: initialJobSearchBetaEnabled,
    onClose,
    onSave,
}) => {
    const [refreshInterval, setRefreshInterval] = useState<RefreshOption>(
        initialRefreshInterval ?? {id: 0, text: 'Disabled'}
    );
    const [driverLocationInterval, setDriverLocationInterval] = useState<RefreshOption>(
        initialDriverInterval ?? {id: 0, text: 'Disabled'}
    );
    const [aiEnabled, setAiEnabled] = useState<boolean>(initialAiEnabled ?? false);
    const [jobSearchBetaEnabled, setJobSearchBetaEnabled] = useState<boolean>(
        initialJobSearchBetaEnabled ?? false,
    );
    const [boxes, setBoxes] = useState<Record<string, DashboardBox>>(() => {
        // Deep clone the boxes
        const cloned: Record<string, DashboardBox> = {};
        for (const key of Object.keys(initialBoxes)) {
            cloned[key] = {...initialBoxes[key]};
        }
        return cloned;
    });

    const boxList = useMemo(() => {
        return Object.entries(boxes).map(([key, box]) => ({
            key,
            ...box,
        }));
    }, [boxes]);

    const handleToggleBox = (boxKey: string) => {
        setBoxes((prev) => ({
            ...prev,
            [boxKey]: {
                ...prev[boxKey],
                visible: !prev[boxKey]?.visible,
            },
        }));
    };

    const handleSave = () => {
        onSave({
            selectedRefreshInterval: refreshInterval,
            selectedDriverLocationRefreshInterval: driverLocationInterval,
            boxes,
            aiEnabled,
            jobSearchBetaEnabled: config.showJobSearchBetaToggle ? jobSearchBetaEnabled : undefined,
        });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 3,
                        overflow: 'hidden',
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
                    <SettingsIcon sx={{fontSize: 28}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h5" sx={{
                        fontWeight: 600
                    }}>
                        {config.title}
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        Choose what appears on your dashboard and how often it updates
                    </Typography>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{
                        color: 'white',
                        '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </Box>
            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                {/* Auto-Refresh Section */}
                {config.showRefreshInterval && (
                    <Box sx={{p: 3}}>
                        <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{
                                alignItems: "center",
                                mb: 2
                            }}>
                            <Box
                                sx={(theme) => ({
                                    width: 36,
                                    height: 36,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                })}
                            >
                                <ScheduleIcon color="primary" />
                            </Box>
                            <Typography variant="h6" sx={{
                                fontWeight: 600
                            }}>
                                Auto-refresh
                            </Typography>
                        </Stack>

                        <Stack spacing={2}>
                            {/* Job List Refresh */}
                            <Paper
                                elevation={0}
                                sx={(theme) => ({
                                    p: 2,
                                    borderRadius: 2,
                                    border: `1px solid ${theme.palette.divider}`,
                                    bgcolor: 'white',
                                })}
                            >
                                <Stack
                                    direction="row"
                                    sx={{
                                        alignItems: "center",
                                        justifyContent: "space-between"
                                    }}>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{
                                            fontWeight: 600
                                        }}>
                                            Job list
                                        </Typography>
                                        <Typography variant="body2" sx={{
                                            color: "text.secondary"
                                        }}>
                                            How often the job list checks for new and updated jobs
                                        </Typography>
                                    </Box>
                                    <FormControl size="small" sx={{minWidth: 140}}>
                                        <Select
                                            value={refreshInterval.id}
                                            onChange={(e) => {
                                                const option = refreshOptions.find(
                                                    (o) => o.id === e.target.value
                                                );
                                                if (option) setRefreshInterval(option);
                                            }}
                                        >
                                            {refreshOptions.map((option) => (
                                                <MenuItem key={option.id} value={option.id}>
                                                    {option.text}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Stack>
                            </Paper>

                            {/* Driver Location Refresh */}
                            {config.showDriverLocationRefresh && (
                                <Paper
                                    elevation={0}
                                    sx={(theme) => ({
                                        p: 2,
                                        borderRadius: 2,
                                        border: `1px solid ${theme.palette.divider}`,
                                        bgcolor: 'white',
                                    })}
                                >
                                    <Stack
                                        direction="row"
                                        sx={{
                                            alignItems: "center",
                                            justifyContent: "space-between"
                                        }}>
                                        <Box>
                                            <Typography variant="subtitle2" sx={{
                                                fontWeight: 600
                                            }}>
                                                Driver locations
                                            </Typography>
                                            <Typography variant="body2" sx={{
                                                color: "text.secondary"
                                            }}>
                                                How often driver positions update on the map
                                            </Typography>
                                        </Box>
                                        <FormControl size="small" sx={{minWidth: 140}}>
                                            <Select
                                                value={driverLocationInterval.id}
                                                onChange={(e) => {
                                                    const option = refreshOptions.find(
                                                        (o) => o.id === e.target.value
                                                    );
                                                    if (option) setDriverLocationInterval(option);
                                                }}
                                            >
                                                {refreshOptions.map((option) => (
                                                    <MenuItem key={option.id} value={option.id}>
                                                        {option.text}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                </Paper>
                            )}
                        </Stack>
                    </Box>
                )}

                {config.showRefreshInterval && <Divider />}

                {/* AI Features Section */}
                {config.showAiToggle && (
                    <Box sx={{p: 3}}>
                        <Stack
                            direction="row"
                            spacing={1.5}
                            sx={{
                                alignItems: "center",
                                mb: 2
                            }}>
                            <Box
                                sx={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(aiAccentColor, 0.1),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <AutoMateLogo size={28} />
                            </Box>
                            <Typography variant="h6" sx={{
                                fontWeight: 600
                            }}>
                                Auto-mate Briefings
                            </Typography>
                        </Stack>

                        <Paper
                            elevation={0}
                            onClick={() => setAiEnabled((prev) => !prev)}
                            sx={(theme) => ({
                                p: 2,
                                borderRadius: 2,
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    borderColor: aiAccentColor,
                                    bgcolor: alpha(aiAccentColor, 0.02),
                                },
                            })}
                        >
                            <Stack
                                direction="row"
                                sx={{
                                    alignItems: "center",
                                    justifyContent: "space-between"
                                }}>
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="subtitle2" sx={{
                                            fontWeight: 600
                                        }}>
                                            Show Auto-mate briefings
                                        </Typography>
                                        <Chip
                                            label="BETA"
                                            size="small"
                                            sx={{
                                                height: 18,
                                                fontSize: '0.625rem',
                                                fontWeight: 700,
                                                bgcolor: aiAccentColor,
                                                color: '#fff',
                                            }}
                                        />
                                    </Box>
                                    <Typography variant="body2" sx={{
                                        color: "text.secondary"
                                    }}>
                                        Adds a short AI briefing — verdict, what needs attention, and key facts —
                                        to the job details, task dashboard, operations, and driver compliance pages.
                                        Applies to your account only.
                                    </Typography>
                                </Box>
                                <Switch
                                    checked={aiEnabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => setAiEnabled((prev) => !prev)}
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                            color: aiAccentColor,
                                        },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                            backgroundColor: aiAccentColor,
                                        },
                                    }}
                                />
                            </Stack>
                        </Paper>
                    </Box>
                )}

                {config.showAiToggle && <Divider />}

                {/* Job Search BETA toggle — opt-in for the React rebuild of /jobSearch.
                    Only rendered when the caller (V1/V2 controller) sets
                    `showJobSearchBetaToggle: true`. Caller persists localStorage
                    and triggers the route redirect after Save. */}
                {config.showJobSearchBetaToggle && (
                    <Box sx={{p: 3}}>
                        <Stack direction="row" spacing={1.5} sx={{alignItems: 'center', mb: 2}}>
                            <Box
                                sx={(theme) => ({
                                    width: 36,
                                    height: 36,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                })}
                            >
                                <ScienceIcon color="primary" />
                            </Box>
                            <Typography variant="h6" sx={{fontWeight: 600}}>
                                Try the new Job Search
                            </Typography>
                        </Stack>

                        <Paper
                            elevation={0}
                            onClick={() => setJobSearchBetaEnabled((prev) => !prev)}
                            sx={(theme) => ({
                                p: 2,
                                borderRadius: 2,
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: 'white',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    borderColor: theme.palette.primary.main,
                                    bgcolor: alpha(theme.palette.primary.main, 0.02),
                                },
                            })}
                        >
                            <Stack direction="row" sx={{alignItems: 'center', justifyContent: 'space-between'}}>
                                <Box>
                                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1}}>
                                        <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                                            Use the new Job Search
                                        </Typography>
                                        <Chip
                                            label="BETA"
                                            size="small"
                                            sx={(theme) => ({
                                                height: 18,
                                                fontSize: '0.625rem',
                                                fontWeight: 700,
                                                bgcolor: theme.palette.primary.main,
                                                color: '#fff',
                                            })}
                                        />
                                    </Box>
                                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                        Opens the rebuilt Job Search page — faster filtering, quicker loads, and
                                        modern dialogs. Switch back to the classic page any time. Applies to your
                                        account only.
                                    </Typography>
                                </Box>
                                <Switch
                                    checked={jobSearchBetaEnabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => setJobSearchBetaEnabled((prev) => !prev)}
                                />
                            </Stack>
                        </Paper>
                    </Box>
                )}

                {config.showJobSearchBetaToggle && <Divider />}

                {/* Dashboard Panels Section */}
                <Box sx={{p: 3}}>
                    <Stack
                        direction="row"
                        spacing={1.5}
                        sx={{
                            alignItems: "center",
                            mb: 1
                        }}>
                        <Box
                            sx={(theme) => ({
                                width: 36,
                                height: 36,
                                borderRadius: 1.5,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            })}
                        >
                            <DashboardIcon color="primary" />
                        </Box>
                        <Typography variant="h6" sx={{
                            fontWeight: 600
                        }}>
                            Dashboard panels
                        </Typography>
                    </Stack>

                    {config.panelsMovedNotice ? (
                        <Alert severity="info" sx={{ml: 6}}>
                            Panel options have moved. Use the Layouts menu in the toolbar, then
                            <strong> Customize panels</strong>, to choose which panels appear.
                        </Alert>
                    ) : config.showDashboards ? (
                        <>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: "text.secondary",
                                    mb: 2,
                                    ml: 6
                                }}>
                                Choose which panels appear on your dashboard
                            </Typography>

                            <Stack spacing={1}>
                                {boxList.map((box) => (
                                    <Paper
                                        key={box.key}
                                        elevation={0}
                                        onClick={() => handleToggleBox(box.key)}
                                        sx={(theme) => ({
                                            p: 2,
                                            borderRadius: 2,
                                            border: `1px solid ${theme.palette.divider}`,
                                            bgcolor: 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                borderColor: theme.palette.primary.main,
                                                bgcolor: alpha(theme.palette.primary.main, 0.02),
                                            },
                                        })}
                                    >
                                        <Stack
                                            direction="row"
                                            spacing={2}
                                            sx={{
                                                alignItems: "center"
                                            }}
                                        >
                                            <Box
                                                sx={(theme) => ({
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 1.5,
                                                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                })}
                                            >
                                                <DashboardIcon
                                                    sx={(theme) => ({
                                                        color: theme.palette.primary.main,
                                                        fontSize: 22,
                                                    })}
                                                />
                                            </Box>
                                            <Box sx={{flex: 1}}>
                                                <Typography variant="subtitle2" sx={{
                                                    fontWeight: 600
                                                }}>
                                                    {box.title || box.name}
                                                </Typography>
                                                {box.description && (
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            color: "text.secondary"
                                                        }}
                                                    >
                                                        {box.description}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Switch
                                                checked={box.visible ?? true}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => handleToggleBox(box.key)}
                                                color="primary"
                                            />
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        </>
                    ) : (
                        /* Empty state when custom layout not available */
                        (<Paper
                            elevation={0}
                            sx={(theme) => ({
                                p: 4,
                                borderRadius: 2,
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: 'white',
                                textAlign: 'center',
                            })}
                        >
                            <Box
                                sx={(theme) => ({
                                    width: 56,
                                    height: 56,
                                    borderRadius: 2,
                                    bgcolor: alpha(theme.palette.info.main, 0.1),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mx: 'auto',
                                    mb: 2,
                                })}
                            >
                                <InfoIcon sx={(theme) => ({fontSize: 28, color: theme.palette.info.main})} />
                            </Box>
                            <Typography variant="body1" sx={{
                                color: "text.secondary"
                            }}>
                                Panel visibility is only available with a custom layout.
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: "text.secondary",
                                    mt: 0.5
                                }}>
                                Create a custom layout to choose which panels appear.
                            </Typography>
                        </Paper>)
                    )}
                </Box>
            </DialogContent>
            {/* Actions */}
            <DialogActions
                sx={(theme) => ({
                    px: 3,
                    py: 2,
                    bgcolor: 'white',
                    borderTop: `1px solid ${theme.palette.divider}`,
                    gap: 1,
                })}
            >
                <Button onClick={onClose} variant="outlined" sx={{minWidth: 100}}>
                    Cancel
                </Button>
                <Button onClick={handleSave} variant="contained" sx={{minWidth: 100}}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DashboardSettingsDialog;
