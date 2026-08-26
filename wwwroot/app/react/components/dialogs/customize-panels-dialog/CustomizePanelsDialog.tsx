/**
 * Customize Panels Dialog
 *
 * Dedicated home for dashboard panel visibility, split out of the gear
 * "Dashboard Settings" dialog and reachable via the Layouts menu's
 * "Customize panels…" entry.
 * Follows the canonical job-detail dialog design language (see CLAUDE.md →
 * "Dialog design language").
 */

import React, {useMemo, useState} from 'react';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import DashboardIcon from '@mui/icons-material/Dashboard';
import SaveIcon from '@mui/icons-material/Save';
import {alpha} from '@mui/material/styles';
import type {SxProps, Theme} from '@mui/material/styles';
import type {DashboardBox} from '../dashboard-settings-dialog/DashboardSettingsDialog';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';
import {SymbolIcon} from '../../common/symbol-icon';

export interface CustomizePanelsDialogProps {
    open: boolean;
    /** Layout name shown as the header subtitle. */
    title?: string;
    boxes: Record<string, DashboardBox>;
    /**
     * False for the read-only Default layout: the toggles are shown disabled with a
     * note, and Save is unavailable. Panel visibility belongs to a user layout.
     */
    layoutEditable?: boolean;
    onClose: () => void;
    onSave: (boxes: Record<string, DashboardBox>) => void;
}

const sectionPaperSx = {
    bgcolor: 'background.paper',
    borderRadius: 3,
    p: 1,
    border: '1px solid',
    borderColor: 'grey.200',
} satisfies SxProps<Theme>;

const sectionLabelSx = {
    color: 'text.secondary',
    fontWeight: 500,
    mb: 1,
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
        if (!layoutEditable) return;
        setBoxes((prev) => ({
            ...prev,
            [key]: {...prev[key], visible: !(prev[key]?.visible ?? true)},
        }));
    };

    const handleSave = () => onSave(boxes);

    return (
        <DialogShell open={open} onClose={onClose}>
            <DialogHeader
                icon={<DashboardIcon />}
                title="Customize panels"
                subtitle={title}
                onClose={onClose}
            />

            {/* Content */}
            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    {!layoutEditable && (
                        <Alert severity="info">
                            The Default layout is read-only. Save a layout of your own to choose
                            which panels appear.
                        </Alert>
                    )}
                    <Box>
                        <Typography variant="body2" sx={sectionLabelSx}>
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
                                                    disabled={!layoutEditable}
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
                                                        <SymbolIcon
                                                            name={box.icon}
                                                            aria-hidden
                                                            size={22} color="var(--mantine-primary-color-filled)"
                                                        />
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
                </Box>
            </DialogContent>

            <DialogFooter
                onCancel={onClose}
                onConfirm={handleSave}
                confirmLabel="Save"
                confirmIcon={<SaveIcon />}
                confirmDisabled={!layoutEditable}
            />
        </DialogShell>
    );
};

export default CustomizePanelsDialog;
