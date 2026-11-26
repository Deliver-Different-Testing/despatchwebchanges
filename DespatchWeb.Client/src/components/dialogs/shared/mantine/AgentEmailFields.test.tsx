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

const SUBJECT = 'Recover KT107DF3';
const HTML = '<div><p>Hi Metro Air</p><a href="https://in.example/Job/Details/x">Accept job</a></div>';

const willEmailPreview = {
    status: 'Queued' as const,
    agentEmail: 'agent@example.com',
    willEmail: true,
    alertType: 'Delivery' as const,
    subject: SUBJECT,
    html: HTML,
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
        expect(screen.queryByLabelText(/Add a note/)).not.toBeInTheDocument();
    });

    it('shows the email as it will be sent, in a sandbox that runs no script', async () => {
        mockPreview.mockResolvedValue(willEmailPreview);

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={vi.fn()}/>);

        expect(await screen.findByText('The delivery alert will be emailed to agent@example.com.')).toBeInTheDocument();
        expect(screen.getByLabelText('Subject')).toHaveValue(SUBJECT);
        const frame = screen.getByTitle('Agent email preview');
        expect(frame).toHaveAttribute('srcdoc', HTML);
        expect(frame.getAttribute('sandbox')).toBe('allow-same-origin');
        expect(mockPreview).toHaveBeenCalledWith(1, 100, undefined, expect.anything());
    });

    it('leaves the subject to the server until the dispatcher edits it', async () => {
        const user = setupUser();
        mockPreview.mockResolvedValue(willEmailPreview);
        const onChange = vi.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        const subject = await screen.findByLabelText('Subject');
        await waitFor(() =>
            expect(lastReport(onChange)).toEqual({willEmail: true, subject: undefined, note: '', resend: false}),
        );

        await user.clear(subject);
        await user.click(subject);
        await user.paste('Urgent [JobNumber]');

        await waitFor(() =>
            expect(lastReport(onChange)).toEqual(expect.objectContaining({subject: 'Urgent [JobNumber]'})),
        );
    });

    it('reports the note and re-previews with it', async () => {
        const user = setupUser();
        mockPreview.mockResolvedValue(willEmailPreview);
        const onChange = vi.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        const note = await screen.findByLabelText(/Add a note/);
        await user.click(note);
        await user.paste('Gate code 4411');

        await waitFor(() =>
            expect(lastReport(onChange)).toEqual(expect.objectContaining({willEmail: true, note: 'Gate code 4411'})),
        );
        await waitFor(() =>
            expect(mockPreview).toHaveBeenCalledWith(1, 100, 'Gate code 4411', expect.anything()),
        );
    });

    it('warns and shows no fields when the agent has no email on file', async () => {
        mockPreview.mockResolvedValue({status: 'NoAgentEmail', agentEmail: null, willEmail: false});
        const onChange = vi.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        expect(await screen.findByText(/no email address on file/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/Add a note/)).not.toBeInTheDocument();
        await waitFor(() =>
            expect(lastReport(onChange)).toEqual({willEmail: false, subject: undefined, note: '', resend: false}),
        );
    });

    it('warns when the agent page address is not set', async () => {
        mockPreview.mockResolvedValue({status: 'NoInboundUrl', agentEmail: 'agent@example.com', willEmail: false});

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={vi.fn()}/>);

        expect(await screen.findByText(/agent page address isn.t set/i)).toBeInTheDocument();
    });

    it('names the alert the leg gets', async () => {
        mockPreview.mockResolvedValue({...willEmailPreview, alertType: 'Pickup'});

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={vi.fn()}/>);

        expect(await screen.findByText('The pickup alert will be emailed to agent@example.com.')).toBeInTheDocument();
    });

    it('says the agent already has the alert and sends nothing, until the dispatcher ticks Send it again', async () => {
        const user = setupUser();
        mockPreview.mockResolvedValue({...willEmailPreview, status: 'AlreadySent', willEmail: false});
        const onChange = vi.fn();

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={onChange}/>);

        expect(await screen.findByText(/already has the delivery alert for this job/)).toBeInTheDocument();
        expect(screen.queryByTitle('Agent email preview')).not.toBeInTheDocument();
        await waitFor(() => expect(lastReport(onChange)).toEqual(expect.objectContaining({willEmail: false, resend: false})));

        await user.click(screen.getByLabelText('Send it again'));

        expect(await screen.findByText('The delivery alert will be sent again to agent@example.com.')).toBeInTheDocument();
        expect(screen.getByLabelText('Subject')).toHaveValue(SUBJECT);
        await waitFor(() => expect(lastReport(onChange)).toEqual(
            {willEmail: true, subject: undefined, note: '', resend: true},
        ));
    });

    it('says nothing will be sent when agent alerts are switched off', async () => {
        mockPreview.mockResolvedValue({status: 'AlertsOff', agentEmail: null, willEmail: false});

        renderWithMantineProviders(<AgentEmailFields agentId={1} jobId={100} onChange={vi.fn()}/>);

        expect(await screen.findByText(/agent alerts are switched off/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/Add a note/)).not.toBeInTheDocument();
    });
});
