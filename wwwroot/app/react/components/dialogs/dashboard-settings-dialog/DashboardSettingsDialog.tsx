/**
 * React Dashboard Settings Dialog
 *
 * A modern replacement for the AngularJS dashboard-settings-dialog using MUI components.
 */

import React, {useState, useMemo} from 'react';
import {alpha} from '@mui/material/styles';
import DialogContent from '@mui/material/DialogContent';
import Chip from '@mui/material/Chip';
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
import SettingsIcon from '@mui/icons-material/Settings';
import ScheduleIcon from '@mui/icons-material/Schedule';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InfoIcon from '@mui/icons-material/Info';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';
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
    /** Show the "Tasks" auto-refresh dropdown (its own independent cadence). */
    showTaskRefresh?: boolean;
    showDashboards?: boolean;
    showAiToggle?: boolean;
    /** Show the "Use the new Job Search" toggle (on by default). Job Search settings only. */
    showJobSearchBetaToggle?: boolean;
    /** Show the "Use the new Dispatch" toggle (on by default). Dispatch settings only. */
    showDispatchBetaToggle?: boolean;
    /**
     * Replace the Dashboard panels section with a notice that panel options have
     * moved to the Layouts menu → Customize panels. Set where the dedicated
     * Customize Panels dialog owns visibility (currently Job Search).
     */
    panelsMovedNotice?: boolean;
    /**
     * Render the Dashboard panels section at all. Defaults to shown; set `false`
     * to drop the section entirely (e.g. Dispatch, where panels are managed only
     * from the Layouts menu → Customize panels).
     */
    showPanels?: boolean;
}

export interface DashboardSettingsResult {
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    selectedTaskRefreshInterval?: RefreshOption;
    boxes?: Record<string, DashboardBox>;
    aiEnabled?: boolean;
    /** When true, the Auto-mate briefing opens expanded automatically instead of click-to-open. */
    aiAutoOpen?: boolean;
    /** Set when `showJobSearchBetaToggle` is true; the caller persists + redirects. */
    jobSearchBetaEnabled?: boolean;
    /** Set when `showDispatchBetaToggle` is true; the caller persists + redirects. */
    dispatchBetaEnabled?: boolean;
}

export interface DashboardSettingsDialogProps {
    open: boolean;
    config: DashboardSettingsConfig;
    boxes: Record<string, DashboardBox>;
    selectedRefreshInterval?: RefreshOption;
    selectedDriverLocationRefreshInterval?: RefreshOption;
    selectedTaskRefreshInterval?: RefreshOption;
    refreshOptions: RefreshOption[];
    aiEnabled?: boolean;
    aiAutoOpen?: boolean;
    jobSearchBetaEnabled?: boolean;
    dispatchBetaEnabled?: boolean;
    onClose: () => void;
    onSave: (result: DashboardSettingsResult) => void;
}

export const DashboardSettingsDialog: React.FC<DashboardSettingsDialogProps> = ({
    open,
    config,
    boxes: initialBoxes,
    selectedRefreshInterval: initialRefreshInterval,
    selectedDriverLocationRefreshInterval: initialDriverInterval,
    selectedTaskRefreshInterval: initialTaskInterval,
    refreshOptions,
    aiEnabled: initialAiEnabled,
    aiAutoOpen: initialAiAutoOpen,
    jobSearchBetaEnabled: initialJobSearchBetaEnabled,
    dispatchBetaEnabled: initialDispatchBetaEnabled,
    onClose,
    onSave,
}) => {
    const [refreshInterval, setRefreshInterval] = useState<RefreshOption>(
        initialRefreshInterval ?? {id: 0, text: 'Disabled'}
    );
    const [driverLocationInterval, setDriverLocationInterval] = useState<RefreshOption>(
        initialDriverInterval ?? {id: 0, text: 'Disabled'}
    );
    const [taskInterval, setTaskInterval] = useState<RefreshOption>(
        initialTaskInterval ?? {id: 0, text: 'Disabled'}
    );
    const [aiEnabled, setAiEnabled] = useState<boolean>(initialAiEnabled ?? false);
    const [aiAutoOpen, setAiAutoOpen] = useState<boolean>(initialAiAutoOpen ?? false);
    const [jobSearchBetaEnabled, setJobSearchBetaEnabled] = useState<boolean>(
        initialJobSearchBetaEnabled ?? true,
    );
    const [dispatchBetaEnabled, setDispatchBetaEnabled] = useState<boolean>(
        initialDispatchBetaEnabled ?? true,
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
            selectedTaskRefreshInterval: taskInterval,
            boxes,
            aiEnabled,
            aiAutoOpen,
            jobSearchBetaEnabled: config.showJobSearchBetaToggle ? jobSearchBetaEnabled : undefined,
            dispatchBetaEnabled: config.showDispatchBetaToggle ? dispatchBetaEnabled : undefined,
        });
    };

    return (
        <DialogShell
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        overflow: 'hidden',
                    },
                },
            }}
        >
            <DialogHeader
                icon={<SettingsIcon/>}
                title={config.title}
                subtitle="Choose what appears on your dashboard and how often it updates"
                onClose={onClose}
            />
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
                                    bgcolor: 'background.paper',
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

                            {/* Tasks Refresh — independent of the Job list cadence */}
                            {config.showTaskRefresh && (
                                <Paper
                                    elevation={0}
                                    sx={(theme) => ({
                                        p: 2,
                                        borderRadius: 2,
                                        border: `1px solid ${theme.palette.divider}`,
                                        bgcolor: 'background.paper',
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
                                                Tasks
                                            </Typography>
                                            <Typography variant="body2" sx={{
                                                color: "text.secondary"
                                            }}>
                                                How often the Tasks panel checks for new and updated tasks
                                            </Typography>
                                        </Box>
                                        <FormControl size="small" sx={{minWidth: 140}}>
                                            <Select
                                                value={taskInterval.id}
                                                onChange={(e) => {
                                                    const option = refreshOptions.find(
                                                        (o) => o.id === e.target.value
                                                    );
                                                    if (option) setTaskInterval(option);
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

                            {/* Driver Location Refresh */}
                            {config.showDriverLocationRefresh && (
                                <Paper
                                    elevation={0}
                                    sx={(theme) => ({
                                        p: 2,
                                        borderRadius: 2,
                                        border: `1px solid ${theme.palette.divider}`,
                                        bgcolor: 'background.paper',
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
                                Auto-mate Settings
                            </Typography>
                        </Stack>

                        <Stack spacing={2}>
                            <Paper
                                elevation={0}
                                onClick={() => setAiEnabled((prev) => !prev)}
                                sx={(theme) => ({
                                    p: 2,
                                    borderRadius: 2,
                                    border: `1px solid ${theme.palette.divider}`,
                                    bgcolor: 'background.paper',
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
                                                    color: 'common.white',
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

                            {/* Open automatically — only meaningful while briefings are on,
                                so the row is disabled/dimmed when "Show Auto-mate briefings"
                                is off. */}
                            <Paper
                                elevation={0}
                                onClick={aiEnabled ? () => setAiAutoOpen((prev) => !prev) : undefined}
                                sx={(theme) => ({
                                    p: 2,
                                    borderRadius: 2,
                                    border: `1px solid ${theme.palette.divider}`,
                                    bgcolor: 'background.paper',
                                    cursor: aiEnabled ? 'pointer' : 'default',
                                    opacity: aiEnabled ? 1 : 0.5,
                                    transition: 'all 0.2s ease',
                                    ...(aiEnabled && {
                                        '&:hover': {
                                            borderColor: aiAccentColor,
                                            bgcolor: alpha(aiAccentColor, 0.02),
                                        },
                                    }),
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
                                            Open automatically
                                        </Typography>
                                        <Typography variant="body2" sx={{
                                            color: "text.secondary"
                                        }}>
                                            Opens the Auto-mate briefing expanded instead of waiting for a click.
                                            Applies to your account only.
                                        </Typography>
                                    </Box>
                                    <Switch
                                        checked={aiAutoOpen}
                                        disabled={!aiEnabled}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => setAiAutoOpen((prev) => !prev)}
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
                        </Stack>
                    </Box>
                )}

                {config.showAiToggle && <Divider />}

                {/* Job Search version toggle — the React rebuild of /jobSearch is
                    now the default; this switches back to the classic page.
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
                                <AutoAwesomeIcon color="primary" />
                            </Box>
                            <Typography variant="h6" sx={{fontWeight: 600}}>
                                Job Search version
                            </Typography>
                        </Stack>

                        <Paper
                            elevation={0}
                            onClick={() => setJobSearchBetaEnabled((prev) => !prev)}
                            sx={(theme) => ({
                                p: 2,
                                borderRadius: 2,
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: 'background.paper',
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
                                    <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                                        Use the new Job Search
                                    </Typography>
                                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                        The rebuilt Job Search is now the default — faster filtering, quicker loads,
                                        and modern dialogs. Turn this off to go back to the classic page. Applies to
                                        your account only.
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

                {/* Dispatch version toggle — the React rebuild of the home/dispatch
                    page is now the default; this switches back to the classic
                    page. Only rendered when the caller (home controller /
                    dispatchV2 route) sets `showDispatchBetaToggle: true`. Caller
                    persists localStorage and triggers the route redirect after Save. */}
                {config.showDispatchBetaToggle && (
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
                                <AutoAwesomeIcon color="primary" />
                            </Box>
                            <Typography variant="h6" sx={{fontWeight: 600}}>
                                Dispatch version
                            </Typography>
                        </Stack>

                        <Paper
                            elevation={0}
                            onClick={() => setDispatchBetaEnabled((prev) => !prev)}
                            sx={(theme) => ({
                                p: 2,
                                borderRadius: 2,
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: 'background.paper',
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
                                    <Typography variant="subtitle2" sx={{fontWeight: 600}}>
                                        Use the new Dispatch
                                    </Typography>
                                    <Typography variant="body2" sx={{color: 'text.secondary'}}>
                                        The rebuilt Dispatch is now the default — faster loads, modern dialogs, and
                                        more customisation options like choosing your columns. Saved layouts follow
                                        your account, so they persist across browsers and computers. Turn this off to
                                        go back to the classic page. Applies to your account only.
                                    </Typography>
                                </Box>
                                <Switch
                                    checked={dispatchBetaEnabled}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => setDispatchBetaEnabled((prev) => !prev)}
                                />
                            </Stack>
                        </Paper>
                    </Box>
                )}

                {config.showDispatchBetaToggle && config.showPanels !== false && <Divider />}

                {/* Dashboard Panels Section */}
                {config.showPanels !== false && (
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
                                            bgcolor: 'background.paper',
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
                                bgcolor: 'background.paper',
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
                )}
            </DialogContent>
            {/* Actions */}
            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel="Save"
            />
        </DialogShell>
    );
};

export default DashboardSettingsDialog;
