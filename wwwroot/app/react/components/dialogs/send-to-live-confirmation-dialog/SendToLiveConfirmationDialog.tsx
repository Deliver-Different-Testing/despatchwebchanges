import React, {useState} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';

export interface SendToLiveConfirmationDialogProps {
    open: boolean;
    jobNo: string;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

export const SendToLiveConfirmationDialog: React.FC<SendToLiveConfirmationDialogProps> = ({
    open,
    jobNo,
    onClose,
    onConfirm,
}) => {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async (): Promise<void> => {
        setIsSubmitting(true);
        try {
            await onConfirm();
        } catch {
            // Parent surfaces failures (e.g. via toast); the dialog closes regardless.
        } finally {
            setIsSubmitting(false);
            onClose();
        }
    };

    const handleClose = (): void => {
        if (isSubmitting) return;
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            slotProps={{
                paper: {
                    elevation: 24,
                    sx: {
                        borderRadius: 2,
                        overflow: 'hidden',
                        minWidth: 480,
                        maxWidth: 600,
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
                    <SendIcon sx={{fontSize: 24}} />
                </Box>
                <Box sx={{flex: 1}}>
                    <Typography variant="h6" sx={{fontWeight: 600}}>
                        Send to Live
                    </Typography>
                    <Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>
                        Release bulk job {jobNo} to the live dispatch screen
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleClose}
                    disabled={isSubmitting}
                    aria-label="Close dialog"
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
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    <Paper
                        elevation={0}
                        sx={(theme) => ({
                            p: 2,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.info.main, 0.08),
                            borderLeft: `4px solid ${theme.palette.info.main}`,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                        })}
                    >
                        <InfoIcon sx={(theme) => ({color: theme.palette.info.dark, fontSize: 20})} />
                        <Typography variant="body2" sx={{color: 'text.primary'}}>
                            Bulk job <strong>{jobNo}</strong> will be released and become visible on the live dispatch screen.
                        </Typography>
                    </Paper>
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
                <Button
                    onClick={handleClose}
                    variant="outlined"
                    disabled={isSubmitting}
                    sx={{minWidth: 100}}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="primary"
                    disabled={isSubmitting}
                    startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                    sx={{minWidth: 120}}
                >
                    {isSubmitting ? 'Sending...' : 'Send to Live'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SendToLiveConfirmationDialog;
