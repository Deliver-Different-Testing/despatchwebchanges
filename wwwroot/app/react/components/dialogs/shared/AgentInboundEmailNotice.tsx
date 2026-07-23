/**
 * Pre-flight notice shown before assigning an agent: tells the dispatcher whether the
 * agent will be emailed the inbound-agent job link, or why not. Shared by the flight-agent
 * confirmation dialog and the universal dispatch dialog's Agent option.
 */

import React from 'react';
import Alert from '@mui/material/Alert';
import {useQuery} from '@tanstack/react-query';
import {getAgentInboundEmailPreview} from '../../../services/dispatchExecutorApi';

interface AgentInboundEmailNoticeProps {
    agentId: number;
    jobId: number;
}

export const AgentInboundEmailNotice: React.FC<AgentInboundEmailNoticeProps> = ({agentId, jobId}) => {
    const {data} = useQuery({
        queryKey: ['agentInboundEmailPreview', agentId, jobId],
        queryFn: ({signal}) => getAgentInboundEmailPreview(agentId, jobId, {signal}),
        enabled: agentId > 0 && jobId > 0,
        staleTime: 30_000,
    });

    if (!data) return null;

    if (data.willEmail) {
        return (
            <Alert severity="info" variant="outlined">
                An inbound-agent link will be emailed to {data.agentEmail}.
            </Alert>
        );
    }

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
};
