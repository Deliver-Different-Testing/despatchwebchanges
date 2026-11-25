import type {Mock, MockedFunction} from 'vitest';
import React from 'react';
import {screen, waitFor} from '@testing-library/react';
import {renderWithMantineProviders} from '../../../../test/utils';
import {setupUser} from '../../../../test/utils/setupUser';
import {AgentEmailFields} from './AgentEmailFields';
import {getAgentInboundEmailPreview} from '../../../../api/dispatchExecutorApi';

vi.mock('../../../../api/dispatchExecutorApi', () => ({
    getAgentInboundEmailPreview: vi.fn(),
}));

const mockPreview = getAgentInboundEmailPreview as MockedFunction<typeof getAgentInboundEmailPreview>;

const DEFAULT_SUBJECT = 'New job assigned [JobNumber]';
const DEFAULT_BODY = 'Hi [AgentName]\n\nYou have been assigned a new job [JobNumber]. [InboundUrl]';

const willEmailPreview = {
    status: 'Queued' as const,
    agentEmail: 'agent@example.com',
    willEmail: true,
    defaultSubject: DEFAULT_SUBJECT,
    defaultBody: DEFAULT_BODY,
};

const lastReport = (onChange: Mock) => onChange.mock.calls.at(-1)?.[0];

describe('AgentEmailFields', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders nothing until the preview resolves', () => {
        mockPreview.mockReturnValue(new Promise(() => { /* never resolves */ }));

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={vi.fn()}/>);

        // MantineProvider injects a <style> element, so assert on the absence of
        // the component's own output rather than an empty container.
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Subject')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
    });

    it('shows the recipient and seeds the fields from the server defaults when a link will be emailed', async () => {
        mockPreview.mockResolvedValue(willEmailPreview);
        const onChange = vi.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        expect(await screen.findByText(/link will be emailed to agent@example\.com/i)).toBeInTheDocument();
        expect(screen.getByLabelText('Subject')).toHaveValue(DEFAULT_SUBJECT);
        expect(screen.getByLabelText('Message')).toHaveValue(DEFAULT_BODY);
        expect(mockPreview).toHaveBeenCalledWith(1, 100, expect.anything());

        await waitFor(() =>
            expect(lastReport(onChange)).toEqual({willEmail: true, subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, resend: false}),
        );
        // The parent feeds this straight into the assign call, so it must never see the
        // pre-seed empty template — not even transiently.
        expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({willEmail: true, subject: '', body: ''}));
    });

    it('reports the edited body up through onChange', async () => {
        const user = setupUser();
        mockPreview.mockResolvedValue(willEmailPreview);
        const onChange = vi.fn();

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
        const onChange = vi.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        expect(await screen.findByText(/no email address on file/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
        await waitFor(() => expect(lastReport(onChange)).toEqual({willEmail: false, subject: '', body: '', resend: false}));
    });

    it('warns when the inbound portal URL is not configured', async () => {
        mockPreview.mockResolvedValue({status: 'NoInboundUrl', agentEmail: 'agent@example.com', willEmail: false});

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={vi.fn()}/>);

        expect(await screen.findByText(/inbound portal url isn.t configured/i)).toBeInTheDocument();
    });

    it('names the alert the leg gets', async () => {
        mockPreview.mockResolvedValue({...willEmailPreview, alertType: 'Pickup'});

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={vi.fn()}/>);

        expect(await screen.findByText('The pickup alert will be emailed to agent@example.com.')).toBeInTheDocument();
    });

    it('says the agent already has the alert and sends nothing, until the dispatcher ticks Send it again', async () => {
        const user = setupUser();
        mockPreview.mockResolvedValue({...willEmailPreview, status: 'AlreadySent', willEmail: false, alertType: 'Delivery'});
        const onChange = vi.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        expect(await screen.findByText(/already has the delivery alert for this job/)).toBeInTheDocument();
        expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
        await waitFor(() => expect(lastReport(onChange)).toEqual(expect.objectContaining({willEmail: false, resend: false})));

        await user.click(screen.getByLabelText('Send it again'));

        expect(await screen.findByText('The delivery alert will be sent again to agent@example.com.')).toBeInTheDocument();
        expect(screen.getByLabelText('Subject')).toHaveValue(DEFAULT_SUBJECT);
        await waitFor(() => expect(lastReport(onChange)).toEqual(
            {willEmail: true, subject: DEFAULT_SUBJECT, body: DEFAULT_BODY, resend: true},
        ));
    });

    it('says nothing will be sent when agent alerts are switched off', async () => {
        mockPreview.mockResolvedValue({status: 'AlertsOff', agentEmail: null, willEmail: false});

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={vi.fn()}/>);

        expect(await screen.findByText(/agent alerts are switched off/i)).toBeInTheDocument();
        expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
    });
});
