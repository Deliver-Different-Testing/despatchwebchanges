/**
 * Agent alert pre-flight + preview (Mantine).
 *
 * Shown before assigning an agent: whether the agent alert will be emailed, and — when it will — the email exactly
 * as it will be sent (the tenant's template from Settings, every field filled for this job), an editable subject and
 * an "Add a note" box whose text goes above the message. The body itself is not editable here (Settings owns it).
 *
 * Shared by the flight-agent confirmation dialog and the universal dispatch dialog's Agent option. Render it keyed by
 * `${agentId}-${jobId}` so a change of agent/job remounts it.
 */

import React, {useEffect, useState} from 'react';
import {Alert, Box, Checkbox, Paper, Stack, Text, TextInput, Textarea} from '@mantine/core';
import {useDebouncedValue} from '@mantine/hooks';
import {keepPreviousData, useQuery} from '@tanstack/react-query';
import {getAgentInboundEmailPreview, type AgentAlertType} from '../../../../api/dispatchExecutorApi';
import {EmailPreviewFrame} from './EmailPreviewFrame';
import {sectionLabelProps, sectionPaperProps} from './styles';

export interface AgentEmailState {
    /** Whether assigning the agent will actually send the agent alert. */
    willEmail: boolean;
    /** The dispatcher's subject, only when they changed it; otherwise undefined and each job gets its own. */
    subject: string | undefined;
    /** The dispatcher's plain-text note for this send, shown above the message. */
    note: string;
    /** The agent already has this alert for this job and the dispatcher chose to send it again. */
    resend: boolean;
}

const ALERT_LABEL: Record<AgentAlertType, string> = {
    Pickup: 'pickup alert',
    Delivery: 'delivery alert',
    DoorToDoor: 'door to door alert',
};

interface AgentEmailFieldsProps {
    agentId: number;
    jobId: number;
    /** Reports the dispatcher's subject edit and note plus whether an email will actually be sent. */
    onChange: (state: AgentEmailState) => void;
}

export const AgentEmailFields: React.FC<AgentEmailFieldsProps> = ({agentId, jobId, onChange}) => {
    const [subjectEdit, setSubjectEdit] = useState<string | null>(null);
    const [note, setNote] = useState('');
    const [sendAgain, setSendAgain] = useState(false);
    const [previewNote] = useDebouncedValue(note.trim(), 400);

    const {data} = useQuery({
        queryKey: ['agentInboundEmailPreview', agentId, jobId, previewNote],
        queryFn: ({signal}) => getAgentInboundEmailPreview(agentId, jobId, previewNote || undefined, {signal}),
        enabled: agentId > 0 && jobId > 0,
        staleTime: 30_000,
        placeholderData: keepPreviousData,
    });

    const alreadySent = data?.status === 'AlreadySent';
    const resend = alreadySent && sendAgain;
    const willEmail = (data?.willEmail ?? false) || resend;
    const alertLabel = data?.alertType ? ALERT_LABEL[data.alertType] : 'agent alert';
    // `??` not `||` — clearing the field must stay cleared rather than snap back to the tenant's subject.
    const subject = subjectEdit ?? data?.subject ?? '';
    const editedSubject = subjectEdit === null ? undefined : subjectEdit;

    useEffect(() => {
        onChange({willEmail, subject: editedSubject, note, resend});
    }, [onChange, willEmail, editedSubject, note, resend]);

    if (!data) return null;

    const sendAgainBox = alreadySent && (
        <Checkbox
            label="Send it again"
            checked={sendAgain}
            onChange={(e) => setSendAgain(e.currentTarget.checked)}
        />
    );

    if (alreadySent && !sendAgain) {
        return (
            <Stack gap="xs">
                <Alert color="brand" variant="outline">
                    {data.agentEmail} already has the {alertLabel} for this job, so it won&apos;t be sent again.
                </Alert>
                {sendAgainBox}
            </Stack>
        );
    }

    if (data.status === 'AlertsOff') {
        return (
            <Alert color="orange" variant="outline">
                Agent alerts are switched off in Settings — no email will be sent.
            </Alert>
        );
    }

    if (!willEmail) {
        const message =
            data.status === 'NoAgentEmail'
                ? 'This agent has no email address on file — no agent alert will be sent.'
                : data.status === 'NoInboundUrl'
                    ? "The agent page address isn't set in Settings — no agent alert will be sent."
                    : "The agent alert couldn't be prepared — none will be sent.";
        return (
            <Alert color="orange" variant="outline">
                {message}
            </Alert>
        );
    }

    return (
        <Stack gap="md">
            <Alert color="brand" variant="outline">
                {resend
                    ? `The ${alertLabel} will be sent again to ${data.agentEmail}.`
                    : `The ${alertLabel} will be emailed to ${data.agentEmail}.`}
            </Alert>
            {sendAgainBox}
            <Box>
                <Text {...sectionLabelProps}>Agent email</Text>
                <Paper {...sectionPaperProps}>
                    <Stack gap="md">
                        <TextInput
                            label="Subject"
                            value={subject}
                            onChange={(e) => setSubjectEdit(e.currentTarget.value)}
                        />
                        <Textarea
                            label="Add a note"
                            description="Shown above the message for this send only."
                            minRows={2}
                            autosize
                            value={note}
                            onChange={(e) => setNote(e.currentTarget.value)}
                        />
                        {data.html && <EmailPreviewFrame html={data.html} title="Agent email preview" />}
                    </Stack>
                </Paper>
            </Box>
        </Stack>
    );
};

export default AgentEmailFields;
