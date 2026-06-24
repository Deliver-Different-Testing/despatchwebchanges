/**
 * Customize Panels Dialog
 *
 * Dedicated home for dashboard panel visibility, split out of the gear
 * "Dashboard Settings" dialog. Reachable only via the Layouts menu's
 * "Customize panels…" entry. Follows the canonical job-detail dialog design
 * language (see CLAUDE.md → "Dialog design language").
 */

import React, {useMemo, useState} from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import CloseIcon from '@mui/icons-material/Close';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SaveIcon from '@mui/icons-material/Save';
import {alpha} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import type {DashboardBox} from '../dashboard-settings-dialog/DashboardSettingsDialog';

export interface CustomizePanelsDialogProps {
    open: boolean;
    /** Layout name shown as the header subtitle. */
    title?: string;
    boxes: Record<string, DashboardBox>;
    /** False on the read-only Default layout — shows an info note instead of toggles. */
    layoutEditable?: boolean;
    onClose: () => void;
    onSave: (boxes: Record<string, DashboardBox>) => void;
}

const sectionPaperSx = {
    bgcolor: 'white',
    borderRadius: 3,
    p: 1,
    border: '1px solid',
    borderColor: 'grey.200',
} satisfies SxProps<Theme>;

export const CustomizePanelsDialog: React.FC<CustomizePanelsDialogProps> = ({
    open,
    title,
    boxes: initialBoxes,
    layoutEditable = true,
    onClose,
    onSave,
}) => {
    const [boxes, setBoxes] = useState<Record<string, DashboardBox>>(() => {
        const cloned: Record<string, DashboardBox> = {};
        for (const key of Object.keys(initialBoxes)) {
            cloned[key] = {...initialBoxes[key]};
        }
        return cloned;
    });

    const boxList = useMemo(
        () => Object.entries(boxes).map(([key, box]) => ({key, ...box})),
        [boxes],
    );

    const handleToggle = (key: string) => {
        setBoxes((prev) => ({
            ...prev,
            [key]: {...prev[key], visible: !(prev[key]?.visible ?? true)},
        }));
    };

    const handleSave = () => onSave(boxes);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {borderRadius: 2, overflow: 'hidden', minWidth: 480, maxWidth: 600},
                },
            }}
        >
            {/* Header */}
            <Box
                sx={(theme) => ({
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: 'white',
                    px: 3,
                    py: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                })}
            >
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(255,255,255,0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <DashboardIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{fontWeight: 600}}>
                        Customize panels
                    </Typography>
                    {title && (
                        <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                            {title}
                        </Typography>
                    )}
                </Box>
                <IconButton
                    onClick={onClose}
                    aria-label="Close dialog"
                    sx={{color: 'white', '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'}}}
                >
                    <CloseIcon />
                </IconButton>
            </Box>

            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    {layoutEditable ? (
                        <Box>
                            <Typography variant="body2" sx={{color: 'text.secondary', fontWeight: 500, mb: 1}}>
                                Choose which panels appear on your dashboard
                            </Typography>
                            <Paper elevation={0} sx={sectionPaperSx}>
                                <List disablePadding>
                                    {boxList.map((box) => (
                                        <ListItem
                                            key={box.key}
                                            secondaryAction={
                                                <Switch
                                                    edge="end"
                                                    color="primary"
                                                    checked={box.visible ?? true}
                                                    onChange={() => handleToggle(box.key)}
                                                    slotProps={{input: {'aria-label': box.title || box.name || box.key}}}
                                                />
                                            }
                                        >
                                            <ListItemIcon sx={{minWidth: 0, mr: 2}}>
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
                                                    {box.icon ? (
                                                        <Box
                                                            component="span"
                                                            className="material-symbols-outlined"
                                                            aria-hidden
                                                            sx={{fontSize: 22, color: 'primary.main'}}
                                                        >
                                                            {box.icon}
                                                        </Box>
                                                    ) : (
                                                        <DashboardIcon sx={{fontSize: 22, color: 'primary.main'}} />
                                                    )}
                                                </Box>
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={box.title || box.name}
                                                secondary={box.description}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Paper>
                        </Box>
                    ) : (
                        <Alert severity="info">
                            Panel visibility is only available with a custom layout. Create or select a
                            custom layout to choose which panels appear.
                        </Alert>
                    )}
                </Box>
            </DialogContent>

            {/* Footer */}
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
                <Button
                    onClick={handleSave}
                    variant="contained"
                    color="primary"
                    startIcon={<SaveIcon />}
                    disabled={!layoutEditable}
                    sx={{minWidth: 100}}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CustomizePanelsDialog;
