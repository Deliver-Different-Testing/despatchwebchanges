import React, {useEffect, useState} from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import DialogContent from '@mui/material/DialogContent';
import InputBase from '@mui/material/InputBase';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckIcon from '@mui/icons-material/Check';
import SendIcon from '@mui/icons-material/Send';
import DescriptionIcon from '@mui/icons-material/Description';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import {DialogShell, DialogHeader, DialogFooter, sectionPaperSx, sectionLabelSx, dialogFieldSx} from '../shared';
import {AiDraftButton} from '../../common/ai-draft-button/AiDraftButton';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {draftPodEmail} from '../../../services/aiAssistantApi';

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
    /** Server-supplied failure text, shown inline so the send can be corrected and retried. */
    errorMessage?: string;
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
    errorMessage,
}) => {
    const [recipients, setRecipients] = useState<string[]>([]);
    const [useBooking, setUseBooking] = useState(false);
    const [useTracking, setUseTracking] = useState(false);
    const [freeInput, setFreeInput] = useState('');
    const [freeError, setFreeError] = useState('');

    const [subject, setSubject] = useState(() => buildSubject(jobData));
    const [body, setBody] = useState(() => buildBody(jobData));
    const {runDraft, isDrafting} = useAiDraft();

    // Reset to the template whenever a different job is shown.
    useEffect(() => {
        setSubject(buildSubject(jobData));
        setBody(buildBody(jobData));
    }, [jobData]);

    const handleDraft = async () => {
        const result = await runDraft((signal) => draftPodEmail(jobData.jobId, {signal}));
        if (result) {
            setSubject(result.subject);
            setBody(result.body);
        }
    };

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
        <DialogShell open={open} onClose={handleClose}>
            <DialogHeader
                icon={<DescriptionIcon/>}
                title="Send Proof of Delivery"
                subtitle={<>Booking {jobData.jobNo} &middot; {jobData.clientName}</>}
                onClose={handleClose}
            />

            <DialogContent sx={{p: 0, bgcolor: 'background.default'}}>
                <Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>
                    {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

                    {/* Recipients */}
                    <Box>
                        <Typography variant="body2" sx={sectionLabelSx}>
                            Recipients
                        </Typography>
                        <Paper elevation={0} sx={sectionPaperSx}>
                            {showBookingCheckbox && (
                                <Box
                                    onClick={toggleBooking}
                                    sx={{display: 'flex', alignItems: 'center', gap: 1.5, py: 1, cursor: 'pointer', userSelect: 'none'}}
                                >
                                    <Checkbox checked={useBooking} size="small" sx={{p: 0}}/>
                                    <Box>
                                        <Typography sx={{fontWeight: 500}}>
                                            Booking {bookingEmails.length > 1 ? 'emails' : 'email'}
                                        </Typography>
                                        {bookingEmails.map((email) => (
                                            <Typography key={email} variant="caption" sx={{display: 'block', color: 'text.secondary', fontFamily: 'monospace'}}>
                                                {email}
                                            </Typography>
                                        ))}
                                    </Box>
                                </Box>
                            )}

                            {showTrackingCheckbox && (
                                <Box
                                    onClick={toggleTracking}
                                    sx={{display: 'flex', alignItems: 'center', gap: 1.5, py: 1, cursor: 'pointer', userSelect: 'none'}}
                                >
                                    <Checkbox checked={useTracking} size="small" sx={{p: 0}}/>
                                    <Box>
                                        <Typography sx={{fontWeight: 500}}>
                                            Tracking {uniqueTrackingEmails.length > 1 ? 'emails' : 'email'}
                                        </Typography>
                                        {uniqueTrackingEmails.map((email) => (
                                            <Typography key={email} variant="caption" sx={{display: 'block', color: 'text.secondary', fontFamily: 'monospace'}}>
                                                {email}
                                            </Typography>
                                        ))}
                                    </Box>
                                </Box>
                            )}

                            {(showBookingCheckbox || showTrackingCheckbox) && <Divider sx={{my: 1.5}}/>}

                            <Box sx={{display: 'flex', gap: 1}}>
                                <TextField
                                    size="small"
                                    fullWidth
                                    type="email"
                                    placeholder="Add another email address\u2026"
                                    value={freeInput}
                                    onChange={(e) => {
                                        setFreeInput(e.target.value);
                                        setFreeError('');
                                    }}
                                    onKeyDown={handleFreeKeyDown}
                                    error={!!freeError}
                                    sx={dialogFieldSx}
                                />
                                <Button variant="outlined" onClick={addFreeEmail} sx={{whiteSpace: 'nowrap'}}>
                                    Add
                                </Button>
                            </Box>
                            <Typography variant="caption" sx={{display: 'block', mt: 0.75, color: freeError ? 'error.main' : 'text.disabled'}}>
                                {freeError || 'Press Enter or comma to add multiple'}
                            </Typography>
                        </Paper>
                    </Box>

                    {/* Recipient chips */}
                    {recipients.length > 0 && (
                        <Box>
                            <Typography variant="body2" sx={sectionLabelSx}>
                                Sending to ({recipients.length})
                            </Typography>
                            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
                                {recipients.map((r) => (
                                    <Chip
                                        key={r}
                                        label={r}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        onDelete={() => removeRecipient(r)}
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}

                    {/* Email preview */}
                    <Box>
                        <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1}}>
                            <Typography variant="body2" sx={{...sectionLabelSx, mb: 0}}>
                                Email preview
                            </Typography>
                            <AiDraftButton onClick={handleDraft} isDrafting={isDrafting}/>
                        </Box>
                        <Paper elevation={0} sx={{...sectionPaperSx, p: 0, overflow: 'hidden'}}>
                            {/* Subject */}
                            <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1.25, px: 1.75}}>
                                <Typography variant="caption" sx={{fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.disabled', minWidth: 72, pt: '2px', flexShrink: 0}}>
                                    Subject
                                </Typography>
                                <InputBase
                                    value={subject}
                                    onChange={(e) => setSubject(e.target.value)}
                                    inputProps={{'aria-label': 'Email subject'}}
                                    multiline
                                    sx={{fontSize: 13, fontWeight: 600, color: 'text.primary', lineHeight: 1.45, flex: 1, p: 0}}
                                />
                            </Box>
                            <Divider/>

                            {/* Attachment */}
                            <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, px: 1.75}}>
                                <Typography variant="caption" sx={{fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'text.disabled', minWidth: 72, flexShrink: 0}}>
                                    Attachment
                                </Typography>
                                <Chip size="small" variant="outlined" icon={<AttachFileIcon/>} label={`POD_${jobData.jobNo}.pdf`}/>
                            </Box>
                            <Divider/>

                            {/* Body */}
                            <InputBase
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                inputProps={{'aria-label': 'Email body'}}
                                multiline
                                fullWidth
                                sx={{py: 1.5, px: 1.75, fontSize: 13, color: 'text.primary', lineHeight: 1.7}}
                            />
                        </Paper>
                    </Box>
                </Box>
            </DialogContent>

            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSend}
                confirmLabel={sent ? 'Queued' : 'Send POD PDF'}
                confirmIcon={sent ? <CheckIcon/> : <SendIcon/>}
                confirmDisabled={recipients.length === 0}
                submitting={sending}
            />
        </DialogShell>
    );
};

export default SendPodDialog;
