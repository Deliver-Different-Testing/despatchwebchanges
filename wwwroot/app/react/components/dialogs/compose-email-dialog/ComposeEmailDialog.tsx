import React, {useState} from 'react';
import {Badge, Box, Button, Group, Text, TextInput, Textarea} from '@mantine/core';
import {Mail} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {DialogShell, DialogHeader, DialogFooter, dialogContentBg} from '../shared/mantine';
import {DriverEmail, GroupEmailData} from '../../../interfaces';
import {AiDraftButton} from '../../common/ai-draft-button/mantine/AiDraftButton';
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
        <DialogShell opened={open} onClose={handleClose}>
            <DialogHeader
                icon={<Icon lucide={Mail}/>}
                title="Compose Email"
                subtitle="Send an email to selected couriers"
                onClose={handleClose}
            />
            <Box p="lg" style={{backgroundColor: dialogContentBg, display: 'flex', flexDirection: 'column', gap: 'var(--mantine-spacing-md)'}}>
                {/* Recipients */}
                <Box>
                    <Text fz="xs" c="dimmed" mb={4}>
                        Recipients ({selectedCouriers.length})
                    </Text>
                    <Group gap={4}>
                        {selectedCouriers.map(c => (
                            <Badge key={c.courierId} size="sm" variant="light" color="gray">{c.name}</Badge>
                        ))}
                    </Group>
                </Box>

                {/* Quick Templates */}
                <Box>
                    <Text fz="xs" c="dimmed" mb={4}>
                        Quick Templates
                    </Text>
                    <Group gap="xs">
                        {EMAIL_TEMPLATES.map(t => (
                            <Button key={t.key} variant="outline" size="xs" onClick={() => applyTemplate(t)}>
                                {t.label}
                            </Button>
                        ))}
                        <AiDraftButton onClick={handleDraft} isDrafting={isDrafting} />
                    </Group>
                </Box>

                {/* Subject */}
                <TextInput
                    label="Subject"
                    value={subject}
                    onChange={(e) => { setSubject(e.currentTarget.value); setSubjectError(false); }}
                    error={subjectError ? 'Please enter an email subject' : undefined}
                    data-autofocus
                />

                {/* Body */}
                <Textarea
                    label="Message"
                    autosize
                    minRows={8}
                    maxRows={8}
                    value={body}
                    onChange={(e) => { setBody(e.currentTarget.value); setBodyError(false); }}
                    error={bodyError ? 'Please enter an email message' : undefined}
                />
            </Box>
            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSend}
                confirmLabel="Send Email"
            />
        </DialogShell>
    );
};
