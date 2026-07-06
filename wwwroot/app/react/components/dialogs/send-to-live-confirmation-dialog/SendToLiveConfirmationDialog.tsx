import React, {useState} from 'react';
import {alpha} from '@mui/material/styles';
import Box from '@mui/material/Box';
import DialogContent from '@mui/material/DialogContent';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';
import {DialogShell, DialogHeader, DialogFooter} from '../shared';

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
        <DialogShell open={open} onClose={handleClose}>
            <DialogHeader
                icon={<SendIcon/>}
                title="Send to Live"
                subtitle={`Release bulk job ${jobNo} to the live dispatch screen`}
                onClose={handleClose}
                closeDisabled={isSubmitting}
            />

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

            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleConfirm}
                confirmLabel={isSubmitting ? 'Sending...' : 'Send to Live'}
                confirmIcon={<SendIcon/>}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default SendToLiveConfirmationDialog;
