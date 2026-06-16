/**
 * Confirm dialog shown when the user clicks a parent or child chip in the
 * Recurring Log timeline. Confirming opens the live job in Job Search in a
 * new tab via openJobInSearch (navigationService.ts).
 *
 * Visual language follows the project's dialog conventions in CLAUDE.md:
 * gradient header, white footer with minWidth: 100 buttons.
 */

import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import type {SxProps, Theme} from '@mui/material/styles';

interface OpenJobConfirmDialogProps {
    open: boolean;
    jobId: number | null;
    jobNumber: string | null;
    onCancel: () => void;
    onConfirm: () => void;
}

const paperSx = {
    borderRadius: 2,
    overflow: 'hidden',
    minWidth: 420,
    maxWidth: 520,
} satisfies SxProps<Theme>;

const headerSx = ((theme: Theme) => ({
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
    color: 'white',
    px: 3,
    py: 2,
    display: 'flex',
    alignItems: 'center',
    gap: 2,
})) satisfies SxProps<Theme>;

const iconBadgeSx = {
    width: 44,
    height: 44,
    borderRadius: 1.5,
    bgcolor: 'rgba(255,255,255,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
} satisfies SxProps<Theme>;

const closeButtonSx = {
    color: 'white',
    '&:hover': {bgcolor: 'rgba(255,255,255,0.1)'},
} satisfies SxProps<Theme>;

const actionsSx = ((theme: Theme) => ({
    px: 3,
    py: 2,
    bgcolor: 'white',
    borderTop: `1px solid ${theme.palette.divider}`,
    gap: 1,
})) satisfies SxProps<Theme>;

export const OpenJobConfirmDialog: React.FC<OpenJobConfirmDialogProps> = ({
    open,
    jobId,
    jobNumber,
    onCancel,
    onConfirm,
}) => {
    const displayNumber = jobNumber ?? (jobId != null ? `#${jobId}` : '');

    return (
        <Dialog
            open={open}
            onClose={onCancel}
            maxWidth="xs"
            fullWidth
            slotProps={{
                paper: {elevation: 24, sx: paperSx},
            }}
        >
            <Box sx={headerSx}>
                <Box sx={iconBadgeSx}>
                    <OpenInNewIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{fontWeight: 600}}>
                        Open job {displayNumber}
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        Job Search will open in a new tab
                    </Typography>
                </Box>
                <IconButton onClick={onCancel} sx={closeButtonSx} aria-label="Close dialog">
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3}}>
                    <Typography variant="body1">
                        Open the live job <strong>{displayNumber}</strong> in Job Search? It will open in a new browser tab so you can keep this recurring log open.
                    </Typography>
                </Box>
            </DialogContent>

            <DialogActions sx={actionsSx}>
                <Button onClick={onCancel} variant="outlined" sx={{minWidth: 100}}>
                    Cancel
                </Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    color="primary"
                    startIcon={<OpenInNewIcon />}
                    sx={{minWidth: 100}}
                >
                    Open Job
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default OpenJobConfirmDialog;
