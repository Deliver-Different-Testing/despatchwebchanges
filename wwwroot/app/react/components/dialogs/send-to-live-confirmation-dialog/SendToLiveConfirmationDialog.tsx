import React, {useState} from 'react';
import {Alert, Box, Text} from '@mantine/core';
import {Send} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogFooter, DialogHeader, DialogShell, dialogContentBg} from '../shared/mantine';

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
        } catch(error) {
           console.error("Something went wrong: ", error);
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
        <DialogShell opened={open} onClose={handleClose} label="Send to Live">
            <DialogHeader
                icon={<Icon lucide={Send}/>}
                title="Send to Live"
                subtitle={`Release bulk job ${jobNo} to the live dispatch screen`}
                onClose={handleClose}
                closeDisabled={isSubmitting}
            />

            {/* Content */}
            <Box p="lg" style={{backgroundColor: dialogContentBg}}>
                <Alert color="reflex" variant="light">
                    <Text size="sm">
                        Bulk job <strong>{jobNo}</strong> will be released and become visible on the live dispatch screen.
                    </Text>
                </Alert>
            </Box>

            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleConfirm}
                confirmLabel={isSubmitting ? 'Sending...' : 'Send to Live'}
                confirmIcon={<Icon lucide={Send} size={16}/>}
                submitting={isSubmitting}
            />
        </DialogShell>
    );
};

export default SendToLiveConfirmationDialog;
