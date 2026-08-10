import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {renderWithMantineProviders} from '../../../../__testUtils__';
import {setupUser} from '../../../../__testUtils__/setupUser';
import {AgentEmailFields} from './AgentEmailFields';
import {getAgentInboundEmailPreview} from '../../../../services/dispatchExecutorApi';

jest.mock('../../../../services/dispatchExecutorApi', () => ({
    getAgentInboundEmailPreview: jest.fn(),
}));

const mockPreview = getAgentInboundEmailPreview as jest.MockedFunction<typeof getAgentInboundEmailPreview>;

const DEFAULT_SUBJECT = 'New job assigned [JobNumber]';
const DEFAULT_BODY = 'Hi [AgentName]\n\nYou have been assigned a new job [JobNumber]. [InboundUrl]';

const willEmailPreview = {
    status: 'Queued' as const,
    agentEmail: 'agent@example.com',
    willEmail: true,
    defaultSubject: DEFAULT_SUBJECT,
    defaultBody: DEFAULT_BODY,
};

const lastReport = (onChange: jest.Mock) => onChange.mock.calls.at(-1)?.[0];

describe('AgentEmailFields', () => {
    beforeEach(() => jest.clearAllMocks());

    it('renders nothing until the preview resolves', () => {
        mockPreview.mockReturnValue(new Promise(() => { /* never resolves */ }));

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={jest.fn()}/>);

        // MantineProvider injects a <style> element, so assert on the absence of
        // the component's own output rather than an empty container.
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Subject')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
    });

    it('shows the recipient and seeds the fields from the server defaults when a link will be emailed', async () => {
        mockPreview.mockResolvedValue(willEmailPreview);
        const onChange = jest.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        expect(await screen.findByText(/link will be emailed to agent@example\.com/i)).toBeInTheDocument();
        expect(screen.getByLabelText('Subject')).toHaveValue(DEFAULT_SUBJECT);
        expect(screen.getByLabelText('Message')).toHaveValue(DEFAULT_BODY);
        expect(mockPreview).toHaveBeenCalledWith(1, 100, expect.anything());

        await waitFor(() =>
            expect(lastReport(onChange)).toEqual({willEmail: true, subject: DEFAULT_SUBJECT, body: DEFAULT_BODY}),
        );
        // The parent feeds this straight into the assign call, so it must never see the
        // pre-seed empty template — not even transiently.
        expect(onChange).not.toHaveBeenCalledWith({willEmail: true, subject: '', body: ''});
    });

    it('reports the edited body up through onChange', async () => {
        const user = setupUser();
        mockPreview.mockResolvedValue(willEmailPreview);
        const onChange = jest.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        const bodyInput = await screen.findByLabelText('Message');
        await user.clear(bodyInput);
        await user.click(bodyInput);
        await user.paste('Edited body for the agent');

        await waitFor(() =>
            expect(lastReport(onChange)).toEqual(
                expect.objectContaining({willEmail: true, body: 'Edited body for the agent'}),
            ),
        );
    });

    it('warns and shows no editable fields when the agent has no email on file', async () => {
        mockPreview.mockResolvedValue({status: 'NoAgentEmail', agentEmail: null, willEmail: false});
        const onChange = jest.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        expect(await screen.findByText(/no email address on file/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
        await waitFor(() => expect(lastReport(onChange)).toEqual({willEmail: false, subject: '', body: ''}));
    });

    it('warns when the inbound portal URL is not configured', async () => {
        mockPreview.mockResolvedValue({status: 'NoInboundUrl', agentEmail: 'agent@example.com', willEmail: false});

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={jest.fn()}/>);

        expect(await screen.findByText(/inbound portal url isn.t configured/i)).toBeInTheDocument();
    });
});
