import React from 'react';
import {screen} from '@testing-library/react';
import {renderWithProviders} from '../../../__testUtils__';
import {AgentInboundEmailNotice} from './AgentInboundEmailNotice';
import {getAgentInboundEmailPreview} from '../../../services/dispatchExecutorApi';

jest.mock('../../../services/dispatchExecutorApi', () => ({
    getAgentInboundEmailPreview: jest.fn(),
}));

const mockPreview = getAgentInboundEmailPreview as jest.MockedFunction<typeof getAgentInboundEmailPreview>;

describe('AgentInboundEmailNotice', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows the recipient when a link will be emailed', async () => {
        mockPreview.mockResolvedValue({status: 'Queued', agentEmail: 'agent@example.com', willEmail: true});

        renderWithProviders(<AgentInboundEmailNotice agentId={1} jobId={100}/>);

        expect(await screen.findByText(/link will be emailed to agent@example\.com/i)).toBeInTheDocument();
        expect(mockPreview).toHaveBeenCalledWith(1, 100, expect.anything());
    });

    it('warns when the agent has no email on file', async () => {
        mockPreview.mockResolvedValue({status: 'NoAgentEmail', agentEmail: null, willEmail: false});

        renderWithProviders(<AgentInboundEmailNotice agentId={1} jobId={100}/>);

        expect(await screen.findByText(/no email address on file/i)).toBeInTheDocument();
    });

    it('warns when the inbound portal URL is not configured', async () => {
        mockPreview.mockResolvedValue({status: 'NoInboundUrl', agentEmail: 'agent@example.com', willEmail: false});

        renderWithProviders(<AgentInboundEmailNotice agentId={1} jobId={100}/>);

        expect(await screen.findByText(/inbound portal url isn.t configured/i)).toBeInTheDocument();
    });

    it('renders nothing until the preview resolves', () => {
        mockPreview.mockReturnValue(new Promise(() => { /* never resolves */ }));

        const {container} = renderWithProviders(<AgentInboundEmailNotice agentId={1} jobId={100}/>);

        expect(container).toBeEmptyDOMElement();
    });
});
