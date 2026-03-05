import React, {useState} from 'react';
import {
    alpha,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    TextField,
    Typography,
    useTheme,
} from '@mui/material';
import {
    Close as CloseIcon,
    Check as CheckIcon,
    Send as SendIcon,
    Description as DescriptionIcon,
    Lock as LockIcon,
    AttachFile as AttachFileIcon,
} from '@mui/icons-material';

export interface SendPodJobData {
    jobId: number;
    jobNo: string;
    clientName: string;
    driverName: string;
    deliveryAddress: string;
    deliveryDateTime: string;
    bookingContactEmail?: string;
    trackingEmail?: string;
}

export interface SendPodRequest {
    jobId: number;
    recipients: string[];
    subject: string;
    body: string;
}

interface SendPodDialogProps {
    open: boolean;
    jobData: SendPodJobData;
    onClose: () => void;
    onSend: (data: SendPodRequest) => void;
    sending: boolean;
    sent: boolean;
}

function buildSubject(jobData: SendPodJobData): string {
    return `Proof of Delivery \u2013 Booking ${jobData.jobNo} for ${jobData.clientName}`;
}

function buildBody(jobData: SendPodJobData): string {
    return `Dear Sir/Madam,

Please find attached the Proof of Delivery (POD) document for the following delivery:

Booking reference: ${jobData.jobNo}
Delivered to: ${jobData.deliveryAddress}
Delivery date/time: ${jobData.deliveryDateTime}
Driver: ${jobData.driverName}

If you have any questions regarding this delivery, please don't hesitate to contact us.

Kind regards`;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Split a field that may contain multiple emails separated by ; or , */
function parseEmailField(field?: string): string[] {
    if (!field) return [];
    return field
        .split(/[;,]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e && isValidEmail(e));
}

export const SendPodDialog: React.FC<SendPodDialogProps> = ({
    open,
    jobData,
    onClose,
    onSend,
    sending,
    sent,
}) => {
    const theme = useTheme();
    const [recipients, setRecipients] = useState<string[]>([]);
    const [useBooking, setUseBooking] = useState(false);
    const [useTracking, setUseTracking] = useState(false);
    const [freeInput, setFreeInput] = useState('');
    const [freeError, setFreeError] = useState('');

    const subject = buildSubject(jobData);
    const body = buildBody(jobData);

    const bookingEmails = parseEmailField(jobData.bookingContactEmail);
    const trackingEmails = parseEmailField(jobData.trackingEmail);
    // Remove any tracking emails that are already in booking emails
    const uniqueTrackingEmails = trackingEmails.filter((e) => !bookingEmails.includes(e));
    const showBookingCheckbox = bookingEmails.length > 0;
    const showTrackingCheckbox = uniqueTrackingEmails.length > 0;

    const addRecipient = (email: string) => {
        const clean = email.trim().toLowerCase();
        if (!clean) return;
        if (!isValidEmail(clean)) {
            setFreeError('Invalid email address');
            return;
        }
        if (recipients.includes(clean)) {
            setFreeError('Already added');
            return;
        }
        setRecipients((r) => [...r, clean]);
        setFreeError('');
    };

    const removeRecipient = (email: string) => {
        setRecipients((r) => r.filter((x) => x !== email));
        // If all booking emails are removed, uncheck
        if (bookingEmails.includes(email) && !bookingEmails.some((e) => e !== email && recipients.includes(e))) {
            setUseBooking(false);
        }
        if (uniqueTrackingEmails.includes(email) && !uniqueTrackingEmails.some((e) => e !== email && recipients.includes(e))) {
            setUseTracking(false);
        }
    };

    const toggleBooking = () => {
        if (useBooking) {
            setRecipients((r) => r.filter((x) => !bookingEmails.includes(x)));
            setUseBooking(false);
        } else {
            const toAdd = bookingEmails.filter((e) => !recipients.includes(e));
            if (toAdd.length > 0) setRecipients((r) => [...r, ...toAdd]);
            setUseBooking(true);
        }
    };

    const toggleTracking = () => {
        if (useTracking) {
            setRecipients((r) => r.filter((x) => !uniqueTrackingEmails.includes(x)));
            setUseTracking(false);
        } else {
            const toAdd = uniqueTrackingEmails.filter((e) => !recipients.includes(e));
            if (toAdd.length > 0) setRecipients((r) => [...r, ...toAdd]);
            setUseTracking(true);
        }
    };

    const handleFreeKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addFreeEmail();
        }
    };

    const addFreeEmail = () => {
        if (!freeInput.trim()) return;
        addRecipient(freeInput);
        if (isValidEmail(freeInput.trim())) setFreeInput('');
    };

    const handleSend = () => {
        if (recipients.length === 0) return;
        onSend({
            jobId: jobData.jobId,
            recipients,
            subject,
            body,
        });
    };

    const handleClose = () => {
        // Reset state on close
        setRecipients([]);
        setUseBooking(false);
        setUseTracking(false);
        setFreeInput('');
        setFreeError('');
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
                    sx: {
                        borderRadius: '14px',
                        overflow: 'hidden',
                        maxHeight: 'calc(100vh - 48px)',
                    },
                },
            }}
        >
            {/* Header */}
            <DialogTitle
                sx={{
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                    p: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <Box sx={{display: 'flex', alignItems: 'center', gap: '14px'}}>
                    <Box
                        sx={{
                            width: 42,
                            height: 42,
                            borderRadius: '10px',
                            background: alpha(theme.palette.primary.contrastText, 0.15),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                        }}
                    >
                        <DescriptionIcon sx={{color: theme.palette.primary.contrastText, fontSize: 20}}/>
                    </Box>
                    <Box>
                        <Typography
                            sx={{
                                color: theme.palette.primary.contrastText,
                                fontWeight: 700,
                                fontSize: 17,
                                letterSpacing: '-0.2px',
                            }}
                        >
                            Send Proof of Delivery
                        </Typography>
                        <Typography
                            sx={{
                                color: alpha(theme.palette.primary.contrastText, 0.65),
                                fontSize: 13,
                                mt: '2px',
                            }}
                        >
                            Booking {jobData.jobNo} &middot; {jobData.clientName}
                        </Typography>
                    </Box>
                </Box>
                <IconButton
                    onClick={handleClose}
                    sx={{
                        background: alpha(theme.palette.primary.contrastText, 0.15),
                        color: alpha(theme.palette.primary.contrastText, 0.8),
                        width: 34,
                        height: 34,
                        '&:hover': {background: alpha(theme.palette.primary.contrastText, 0.25)},
                    }}
                >
                    <CloseIcon sx={{fontSize: 18}}/>
                </IconButton>
            </DialogTitle>

            {/* Body */}
            <DialogContent sx={{p: '20px 22px 8px', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                {/* Recipients section */}
                <Box sx={{mb: '14px'}}>
                    <Typography
                        sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: '#8a9099',
                            mb: 0,
                        }}
                    >
                        Recipients
                    </Typography>

                    {showBookingCheckbox && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                p: '9px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                border: '1.5px solid #eef0f3',
                                mb: '6px',
                                background: '#fafbfc',
                            }}
                            onClick={toggleBooking}
                        >
                            <Checkbox
                                checked={useBooking}
                                size="small"
                                sx={{
                                    p: 0,
                                    color: '#c5c9d0',
                                    '&.Mui-checked': {color: theme.palette.primary.main},
                                }}
                            />
                            <Box>
                                <Typography sx={{fontSize: 14, fontWeight: 500, color: '#1a1d23'}}>
                                    Booking {bookingEmails.length > 1 ? 'emails' : 'email'}
                                </Typography>
                                {bookingEmails.map((email) => (
                                    <Typography key={email} sx={{fontSize: 12, color: '#6b7280', fontFamily: 'monospace'}}>
                                        {email}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    )}

                    {showTrackingCheckbox && (
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                p: '9px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                userSelect: 'none',
                                border: '1.5px solid #eef0f3',
                                mb: '6px',
                                background: '#fafbfc',
                            }}
                            onClick={toggleTracking}
                        >
                            <Checkbox
                                checked={useTracking}
                                size="small"
                                sx={{
                                    p: 0,
                                    color: '#c5c9d0',
                                    '&.Mui-checked': {color: theme.palette.primary.main},
                                }}
                            />
                            <Box>
                                <Typography sx={{fontSize: 14, fontWeight: 500, color: '#1a1d23'}}>
                                    Tracking {uniqueTrackingEmails.length > 1 ? 'emails' : 'email'}
                                </Typography>
                                {uniqueTrackingEmails.map((email) => (
                                    <Typography key={email} sx={{fontSize: 12, color: '#6b7280', fontFamily: 'monospace'}}>
                                        {email}
                                    </Typography>
                                ))}
                            </Box>
                        </Box>
                    )}

                    <Box sx={{borderTop: '1px solid #eef0f3', my: '10px'}}/>

                    <Box sx={{display: 'flex', gap: '8px'}}>
                        <TextField
                            size="small"
                            type="email"
                            placeholder="Add another email address\u2026"
                            value={freeInput}
                            onChange={(e) => {
                                setFreeInput(e.target.value);
                                setFreeError('');
                            }}
                            onKeyDown={handleFreeKeyDown}
                            error={!!freeError}
                            sx={{
                                flex: 1,
                                '& .MuiOutlinedInput-root': {
                                    borderRadius: '8px',
                                    background: '#fafbfc',
                                    fontSize: 14,
                                },
                            }}
                        />
                        <Button
                            variant="outlined"
                            onClick={addFreeEmail}
                            sx={{
                                borderRadius: '8px',
                                border: '1.5px solid #dde1e7',
                                background: '#f3f4f6',
                                color: '#374151',
                                fontSize: 14,
                                fontWeight: 600,
                                textTransform: 'none',
                                whiteSpace: 'nowrap',
                                '&:hover': {background: '#e5e7eb', border: '1.5px solid #dde1e7'},
                            }}
                        >
                            Add
                        </Button>
                    </Box>
                    {freeError ? (
                        <Typography sx={{fontSize: 12, color: '#e05252', mt: '5px'}}>
                            {freeError}
                        </Typography>
                    ) : (
                        <Typography sx={{fontSize: 12, color: '#9ca3af', mt: '5px'}}>
                            Press Enter or comma to add multiple
                        </Typography>
                    )}
                </Box>

                {/* Recipient chips */}
                {recipients.length > 0 && (
                    <Box sx={{mb: '14px'}}>
                        <Typography
                            sx={{
                                fontSize: 11,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: '#8a9099',
                                mb: '6px',
                            }}
                        >
                            Sending to ({recipients.length})
                        </Typography>
                        <Box sx={{display: 'flex', flexWrap: 'wrap', gap: '6px'}}>
                            {recipients.map((r) => (
                                <Chip
                                    key={r}
                                    label={r}
                                    onDelete={() => removeRecipient(r)}
                                    sx={{
                                        background: alpha(theme.palette.primary.main, 0.08),
                                        color: theme.palette.primary.dark,
                                        border: `1.5px solid ${alpha(theme.palette.primary.main, 0.3)}`,
                                        borderRadius: '20px',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        '& .MuiChip-deleteIcon': {
                                            color: theme.palette.primary.dark,
                                            '&:hover': {color: theme.palette.primary.main},
                                        },
                                    }}
                                />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Email preview */}
                <Box sx={{mb: '14px'}}>
                    <Typography
                        sx={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.08em',
                            color: '#8a9099',
                            mb: '6px',
                        }}
                    >
                        Email preview
                    </Typography>

                    <Box
                        sx={{
                            border: '1.5px solid #e2e6ec',
                            borderRadius: '10px',
                            background: '#f8fafb',
                            overflow: 'hidden',
                            position: 'relative',
                        }}
                    >
                        {/* Subject */}
                        <Box sx={{display: 'flex', alignItems: 'flex-start', gap: '12px', p: '10px 14px'}}>
                            <Typography
                                sx={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.07em',
                                    color: '#9ca3af',
                                    minWidth: 72,
                                    pt: '1px',
                                    flexShrink: 0,
                                }}
                            >
                                Subject
                            </Typography>
                            <Typography sx={{fontSize: 13, fontWeight: 600, color: '#1a1d23', lineHeight: 1.45}}>
                                {subject}
                            </Typography>
                        </Box>
                        <Box sx={{borderTop: '1px solid #e2e6ec', mx: '14px'}}/>

                        {/* Attachment */}
                        <Box sx={{display: 'flex', alignItems: 'flex-start', gap: '12px', p: '10px 14px'}}>
                            <Typography
                                sx={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.07em',
                                    color: '#9ca3af',
                                    minWidth: 72,
                                    pt: '1px',
                                    flexShrink: 0,
                                }}
                            >
                                Attachment
                            </Typography>
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    background: '#fff',
                                    border: '1.5px solid #dde1e7',
                                    borderRadius: '6px',
                                    p: '3px 9px',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: '#374151',
                                }}
                            >
                                <AttachFileIcon sx={{fontSize: 13}}/>
                                POD_{jobData.jobNo}.pdf
                            </Box>
                        </Box>
                        <Box sx={{borderTop: '1px solid #e2e6ec', mx: '14px'}}/>

                        {/* Body */}
                        <Box
                            sx={{
                                p: '12px 14px 40px',
                                fontSize: 13,
                                color: '#374151',
                                lineHeight: 1.7,
                                whiteSpace: 'pre-wrap',
                            }}
                        >
                            {body}
                        </Box>

                        {/* Lock badge */}
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 10,
                                right: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: 11,
                                color: '#9ca3af',
                                fontWeight: 600,
                                letterSpacing: '0.04em',
                            }}
                        >
                            <LockIcon sx={{fontSize: 11}}/>
                            Read-only template
                        </Box>
                    </Box>
                </Box>
            </DialogContent>

            {/* Footer */}
            <DialogActions
                sx={{
                    p: '14px 22px 18px',
                    borderTop: '1px solid #f0f1f3',
                }}
            >
                <Button
                    onClick={handleClose}
                    sx={{
                        borderRadius: '8px',
                        border: '1.5px solid #dde1e7',
                        background: 'transparent',
                        color: '#6b7280',
                        fontSize: 14,
                        fontWeight: 600,
                        textTransform: 'none',
                        px: '18px',
                    }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSend}
                    disabled={recipients.length === 0 || sending}
                    sx={{
                        borderRadius: '8px',
                        background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                        color: theme.palette.primary.contrastText,
                        fontSize: 14,
                        fontWeight: 700,
                        textTransform: 'none',
                        px: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        '&:hover': {
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.dark} 100%)`,
                        },
                        '&.Mui-disabled': {
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                            color: theme.palette.primary.contrastText,
                            opacity: 0.55,
                        },
                    }}
                >
                    {sent ? (
                        <>
                            <CheckIcon sx={{fontSize: 16}}/>
                            Sent!
                        </>
                    ) : sending ? (
                        'Sending\u2026'
                    ) : (
                        <>
                            <SendIcon sx={{fontSize: 16}}/>
                            Send POD PDF
                        </>
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default SendPodDialog;
