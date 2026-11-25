/**
 * Agent inbound-email pre-flight + editable template (Mantine).
 *
 * Shown before assigning an agent: an info/warning alert saying whether the inbound-agent
 * link will be emailed, and — when it will — editable Subject/Message fields that fall back to
 * the hardcoded server defaults. Edits are reported to the parent via `onChange`, which passes
 * them to the assign call so the dispatcher can tailor the email per-send.
 *
 * Shared by the flight-agent confirmation dialog and the universal dispatch dialog's Agent
 * option. Render it keyed by `${agentId}-${jobId}` so a change of agent/job remounts it and
 * reseeds from that agent/job's defaults.
 */

import React, {useEffect, useState} from 'react';
import {Alert, Box, Checkbox, Paper, Stack, Text, TextInput, Textarea} from '@mantine/core';
import {useQuery} from '@tanstack/react-query';
import {getAgentInboundEmailPreview, type AgentAlertType} from '../../../../api/dispatchExecutorApi';
import {sectionLabelProps, sectionPaperProps} from './styles';

export interface AgentEmailState {
    /** Whether assigning the agent will actually send the inbound-agent link email. */
    willEmail: boolean;
    subject: string;
    body: string;
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
    /** Reports the current editable values plus whether an email will actually be sent. */
    onChange: (state: AgentEmailState) => void;
}

export const AgentEmailFields: React.FC<AgentEmailFieldsProps> = ({agentId, jobId, onChange}) => {
    const {data} = useQuery({
        queryKey: ['agentInboundEmailPreview', agentId, jobId],
        queryFn: ({signal}) => getAgentInboundEmailPreview(agentId, jobId, {signal}),
        enabled: agentId > 0 && jobId > 0,
        staleTime: 30_000,
    });

    // Only the operator's edits are held in state; the server defaults are applied during
    // render so the very first commit that shows the fields already carries them. Seeding
    // in an effect instead would leave a commit where the template is still empty, which
    // the parent would report upward (and could assign with).
    const [subjectEdit, setSubjectEdit] = useState<string | null>(null);
    const [bodyEdit, setBodyEdit] = useState<string | null>(null);
    const [sendAgain, setSendAgain] = useState(false);

    const alreadySent = data?.status === 'AlreadySent';
    const resend = alreadySent && sendAgain;
    const willEmail = (data?.willEmail ?? false) || resend;
    const alertLabel = data?.alertType ? ALERT_LABEL[data.alertType] : 'inbound-agent link';
    // `??` not `||` — clearing a field must stay cleared rather than snap back to the default.
    const subject = subjectEdit ?? data?.defaultSubject ?? '';
    const body = bodyEdit ?? data?.defaultBody ?? '';

    // Report the current state upward whenever it changes so the parent can pass the edits
    // (or the default seed) into the assign call.
    useEffect(() => {
        onChange({willEmail, subject, body, resend});
    }, [onChange, willEmail, subject, body, resend]);

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
                ? 'This agent has no email address on file — no inbound-agent link will be sent.'
                : data.status === 'NoInboundUrl'
                    ? "The inbound portal URL isn't configured — no inbound-agent link will be sent."
                    : "The inbound-agent link couldn't be prepared — no link will be sent.";
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
                            label="Message"
                            minRows={8}
                            autosize
                            value={body}
                            onChange={(e) => setBodyEdit(e.currentTarget.value)}
                            description="Tokens like [AgentName], [JobNumber] and [InboundUrl] are replaced with the job's details when the email is sent."
                            inputWrapperOrder={['label', 'input', 'description', 'error']}
                        />
                    </Stack>
                </Paper>
            </Box>
        </Stack>
    );
};

export default AgentEmailFields;
