import React, {useEffect, useState} from 'react';
import {Alert, Badge, Box, Button, Checkbox, CloseButton, Divider, Group, Paper, Stack, Text, Textarea, TextInput} from '@mantine/core';
import {Check, FileText, Paperclip, Send} from 'lucide-react';
import {Icon} from '../../common/icon/Icon';
import {
    DialogShell, DialogHeader, DialogFooter, dialogContentBg, sectionPaperProps, sectionLabelProps,
} from '../shared/mantine';

import {AiDraftButton} from '../../common/ai-draft-button/mantine/AiDraftButton';
import {useAiDraft} from '../../../hooks/useAiDraft';
import {draftPodEmail} from '../../../services/aiAssistantApi';

/** The small uppercase field labels down the left of the email preview. */
const previewLabelProps = {
    fz: 'xs',
    fw: 700,
    tt: 'uppercase',
    lts: '0.07em',
    c: 'dimmed',
    miw: 72,
    style: {flexShrink: 0},
} as const;

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
        <DialogShell opened={open} onClose={handleClose}>
            <DialogHeader
                icon={<Icon lucide={FileText}/>}
                title="Send Proof of Delivery"
                subtitle={<>Booking {jobData.jobNo} &middot; {jobData.clientName}</>}
                onClose={handleClose}
            />

            <Stack p="lg" gap="lg" bg={dialogContentBg}>
                {errorMessage && <Alert color="red" variant="light">{errorMessage}</Alert>}

                {/* Recipients */}
                <Box>
                    <Text {...sectionLabelProps}>Recipients</Text>
                    <Paper {...sectionPaperProps}>
                        {showBookingCheckbox && (
                            <Checkbox
                                checked={useBooking}
                                onChange={toggleBooking}
                                py="xs"
                                label={
                                    <Box>
                                        <Text fw={500}>Booking {bookingEmails.length > 1 ? 'emails' : 'email'}</Text>
                                        {bookingEmails.map((email) => (
                                            <Text key={email} fz="xs" c="dimmed" ff="monospace">{email}</Text>
                                        ))}
                                    </Box>
                                }
                            />
                        )}

                        {showTrackingCheckbox && (
                            <Checkbox
                                checked={useTracking}
                                onChange={toggleTracking}
                                py="xs"
                                label={
                                    <Box>
                                        <Text fw={500}>Tracking {uniqueTrackingEmails.length > 1 ? 'emails' : 'email'}</Text>
                                        {uniqueTrackingEmails.map((email) => (
                                            <Text key={email} fz="xs" c="dimmed" ff="monospace">{email}</Text>
                                        ))}
                                    </Box>
                                }
                            />
                        )}

                        {(showBookingCheckbox || showTrackingCheckbox) && <Divider my="sm"/>}

                        <Group gap="xs" align="flex-start" wrap="nowrap">
                            <TextInput
                                style={{flex: 1}}
                                type="email"
                                placeholder="Add another email address&hellip;"
                                value={freeInput}
                                onChange={(e) => {
                                    setFreeInput(e.currentTarget.value);
                                    setFreeError('');
                                }}
                                onKeyDown={handleFreeKeyDown}
                                error={!!freeError}
                            />
                            <Button variant="default" onClick={addFreeEmail} style={{whiteSpace: 'nowrap'}}>
                                Add
                            </Button>
                        </Group>
                        <Text fz="xs" mt={6} c={freeError ? 'red.6' : 'dimmed'}>
                            {freeError || 'Press Enter or comma to add multiple'}
                        </Text>
                    </Paper>
                </Box>

                {/* Recipient chips */}
                {recipients.length > 0 && (
                    <Box>
                        <Text {...sectionLabelProps}>Sending to ({recipients.length})</Text>
                        <Group gap="xs">
                            {recipients.map((r) => (
                                <Badge
                                    key={r}
                                    size="sm"
                                    variant="outline"
                                    color="brand"
                                    rightSection={
                                        <CloseButton
                                            size={14}
                                            aria-label={`Remove ${r}`}
                                            onClick={() => removeRecipient(r)}
                                        />
                                    }
                                >
                                    {r}
                                </Badge>
                            ))}
                        </Group>
                    </Box>
                )}

                {/* Email preview */}
                <Box>
                    <Group justify="space-between" align="center" mb="xs">
                        <Text {...sectionLabelProps} mb={0}>Email preview</Text>
                        <AiDraftButton onClick={handleDraft} isDrafting={isDrafting}/>
                    </Group>
                    <Paper {...sectionPaperProps} p={0} style={{overflow: 'hidden'}}>
                        {/* Subject */}
                        <Group gap="sm" align="flex-start" wrap="nowrap" py={10} px={14}>
                            <Text {...previewLabelProps}>Subject</Text>
                            <Textarea
                                variant="unstyled"
                                autosize
                                style={{flex: 1}}
                                aria-label="Email subject"
                                value={subject}
                                onChange={(e) => setSubject(e.currentTarget.value)}
                                styles={{input: {fontSize: 13, fontWeight: 600, lineHeight: 1.45, padding: 0, minHeight: 0}}}
                            />
                        </Group>
                        <Divider/>

                        {/* Attachment */}
                        <Group gap="sm" align="center" wrap="nowrap" py={10} px={14}>
                            <Text {...previewLabelProps}>Attachment</Text>
                            <Badge size="sm" variant="outline" color="gray" leftSection={<Icon lucide={Paperclip} size={12}/>}>
                                {`POD_${jobData.jobNo}.pdf`}
                            </Badge>
                        </Group>
                        <Divider/>

                        {/* Body */}
                        <Textarea
                            variant="unstyled"
                            autosize
                            minRows={4}
                            aria-label="Email body"
                            value={body}
                            onChange={(e) => setBody(e.currentTarget.value)}
                            styles={{input: {fontSize: 13, lineHeight: 1.7, paddingBlock: 12, paddingInline: 14}}}
                        />
                    </Paper>
                </Box>
            </Stack>

            <DialogFooter
                onCancel={handleClose}
                onConfirm={handleSend}
                confirmLabel={sent ? 'Queued' : 'Send POD PDF'}
                confirmIcon={sent ? <Icon lucide={Check}/> : <Icon lucide={Send}/>}
                confirmDisabled={recipients.length === 0}
                submitting={sending}
            />
        </DialogShell>
    );
};

export default SendPodDialog;
