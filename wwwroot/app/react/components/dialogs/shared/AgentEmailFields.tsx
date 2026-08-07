/**
 * Agent inbound-email pre-flight + editable template.
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
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import {useQuery} from '@tanstack/react-query';
import {getAgentInboundEmailPreview} from '../../../services/dispatchExecutorApi';
import {sectionPaperSx, sectionLabelSx, dialogFieldSx} from './styles';

export interface AgentEmailState {
    /** Whether assigning the agent will actually send the inbound-agent link email. */
    willEmail: boolean;
    subject: string;
    body: string;
}

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

    const willEmail = data?.willEmail ?? false;
    // `??` not `||` — clearing a field must stay cleared rather than snap back to the default.
    const subject = subjectEdit ?? data?.defaultSubject ?? '';
    const body = bodyEdit ?? data?.defaultBody ?? '';

    // Report the current state upward whenever it changes so the parent can pass the edits
    // (or the default seed) into the assign call.
    useEffect(() => {
        onChange({willEmail, subject, body});
    }, [onChange, willEmail, subject, body]);

    if (!data) return null;

    if (!willEmail) {
        const message =
            data.status === 'NoAgentEmail'
                ? 'This agent has no email address on file — no inbound-agent link will be sent.'
                : data.status === 'NoInboundUrl'
                    ? 'The inbound portal URL isn’t configured — no inbound-agent link will be sent.'
                    : 'The inbound-agent link couldn’t be prepared — no link will be sent.';
        return (
            <Alert severity="warning" variant="outlined">
                {message}
            </Alert>
        );
    }

    return (
        <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
            <Alert severity="info" variant="outlined">
                An inbound-agent link will be emailed to {data.agentEmail}.
            </Alert>
            <Box>
                <Typography sx={sectionLabelSx}>Agent email</Typography>
                <Paper elevation={0} sx={sectionPaperSx}>
                    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2}}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Subject"
                            value={subject}
                            onChange={(e) => setSubjectEdit(e.target.value)}
                            sx={dialogFieldSx}
                        />
                        <TextField
                            fullWidth
                            multiline
                            minRows={8}
                            label="Message"
                            value={body}
                            onChange={(e) => setBodyEdit(e.target.value)}
                            helperText="Tokens like [AgentName], [JobNumber] and [InboundUrl] are replaced with the job’s details when the email is sent."
                            sx={dialogFieldSx}
                        />
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
};
