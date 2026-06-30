import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import EmailIcon from '@mui/icons-material/Email';
import {DriverEmail, GroupEmailData} from '../../../interfaces';
import {AiDraftButton} from '../../common/ai-draft-button/AiDraftButton';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {draftEmail} from '../../../services/aiAssistantApi';

interface ComposeEmailDialogProps {
    open: boolean;
    selectedCouriers: DriverEmail[];
    onClose: () => void;
    onSend: (data: GroupEmailData) => void;
}

interface EmailTemplate {
    key: string;
    label: string;
    subject: string;
    body: string;
}

const EMAIL_TEMPLATES: EmailTemplate[] = [
    {
        key: 'weekly_update',
        label: 'Weekly Update',
        subject: 'Weekly Team Update',
        body: `Dear Team,

Here's your weekly update:

\u2022 [Update point 1]
\u2022 [Update point 2]
\u2022 [Update point 3]

Please let me know if you have any questions.

Best regards`,
    },
    {
        key: 'urgent_notice',
        label: 'Urgent Notice',
        subject: 'URGENT: Important Notice',
        body: `URGENT NOTICE

Dear Team,

This is an important notice regarding:

[Please specify the urgent matter here]

Action required:
\u2022 [Action item 1]
\u2022 [Action item 2]

Please respond by: [Date/Time]

Thank you for your immediate attention.`,
    },
    {
        key: 'schedule_change',
        label: 'Schedule Change',
        subject: 'Schedule Change Notification',
        body: `Dear Team,

Please note the following schedule changes:

Date: [Date]
Original Time: [Original time]
New Time: [New time]
Reason: [Reason for change]

Please confirm receipt of this message.

Thanks for your understanding.`,
    },
    {
        key: 'general_announcement',
        label: 'Announcement',
        subject: 'Team Announcement',
        body: `Dear Team,

I wanted to share the following announcement:

[Your message here]

If you have any questions or concerns, please don't hesitate to reach out.

Best regards`,
    },
];

export const ComposeEmailDialog: React.FC<ComposeEmailDialogProps> = ({
    open,
    selectedCouriers,
    onClose,
    onSend,
}) => {
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [subjectError, setSubjectError] = useState(false);
    const [bodyError, setBodyError] = useState(false);
    const {runDraft, isDrafting} = useAiDraft();

    const applyTemplate = (template: EmailTemplate) => {
        setSubject(template.subject);
        setBody(template.body);
        setSubjectError(false);
        setBodyError(false);
    };

    const handleDraft = async () => {
        const result = await runDraft((signal) =>
            draftEmail(
                {
                    recipientNames: selectedCouriers.map(c => c.name),
                    seedSubject: subject,
                    seedBody: body,
                },
                {signal},
            ),
        );
        if (result) {
            setSubject(result.subject);
            setBody(result.body);
            setSubjectError(false);
            setBodyError(false);
        }
    };

    const handleSend = () => {
        const trimmedSubject = subject.trim();
        const trimmedBody = body.trim();
        let hasError = false;

        if (!trimmedSubject) { setSubjectError(true); hasError = true; }
        if (!trimmedBody) { setBodyError(true); hasError = true; }
        if (hasError) return;

        onSend({
            courierIds: selectedCouriers.map(c => c.courierId),
            subject: trimmedSubject,
            body: trimmedBody,
        });

        // Reset form
        setSubject('');
        setBody('');
    };

    const handleClose = () => {
        setSubject('');
        setBody('');
        setSubjectError(false);
        setBodyError(false);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
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
                <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <EmailIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" sx={{
                        fontWeight: 600
                    }}>Compose Email</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.85, mt: 0.25 }}>Send an email to selected couriers</Typography>
                </Box>
                <IconButton onClick={handleClose} sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <DialogContent>
                {/* Recipients */}
                <Box sx={{mb: 2}}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                            mb: 0.5,
                            display: 'block'
                        }}>
                        Recipients ({selectedCouriers.length})
                    </Typography>
                    <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 0.5}}>
                        {selectedCouriers.map(c => (
                            <Chip key={c.courierId} label={c.name} size="small" />
                        ))}
                    </Box>
                </Box>

                {/* Quick Templates */}
                <Box sx={{mb: 2}}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: "text.secondary",
                            mb: 0.5,
                            display: 'block'
                        }}>
                        Quick Templates
                    </Typography>
                    <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center'}}>
                        {EMAIL_TEMPLATES.map(t => (
                            <Button key={t.key} variant="outlined" size="small" onClick={() => applyTemplate(t)}>
                                {t.label}
                            </Button>
                        ))}
                        <AiDraftButton onClick={handleDraft} isDrafting={isDrafting} />
                    </Box>
                </Box>

                {/* Subject */}
                <TextField
                    label="Subject"
                    fullWidth
                    size="small"
                    value={subject}
                    onChange={(e) => { setSubject(e.target.value); setSubjectError(false); }}
                    error={subjectError}
                    helperText={subjectError ? 'Please enter an email subject' : ''}
                    sx={{mb: 2}}
                    autoFocus
                />

                {/* Body */}
                <TextField
                    label="Message"
                    fullWidth
                    multiline
                    rows={8}
                    value={body}
                    onChange={(e) => { setBody(e.target.value); setBodyError(false); }}
                    error={bodyError}
                    helperText={bodyError ? 'Please enter an email message' : ''}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button onClick={handleSend} variant="contained">Send Email</Button>
            </DialogActions>
        </Dialog>
    );
};
