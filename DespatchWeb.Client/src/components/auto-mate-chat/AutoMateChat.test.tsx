import type {MockedFunction} from 'vitest';
import React from 'react';
import {screen, waitFor, act} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {renderWithMantine} from '../../test/utils';
import {setupUser} from '../../test/utils/setupUser';
import {NavigationProvider} from '../../routes/NavigationContext';
import {AutoMateChatProvider} from './AutoMateChatProvider';
import {AutoMateChatButton} from './AutoMateChatButton';
import {AutoMateChatPanel} from './AutoMateChatPanel';
import {AI_CHAT_CHANGED_EVENT, isAiChatEnabled, loadAutoMateFromServer} from '../../utils/aiSettings';
import {streamChat} from '../../api/autoMateChat';
import type {AutoMateStreamEvent} from '../../types/autoMateChat';

vi.mock('../../api/autoMateChat', () => ({streamChat: vi.fn()}));
vi.mock('../../utils/aiSettings', () => ({
    AI_CHAT_CHANGED_EVENT: 'automate-chat-enabled-changed',
    isAiChatEnabled: vi.fn(),
    setAiChatEnabled: vi.fn(),
    loadAutoMateFromServer: vi.fn(),
}));

const mockStreamChat = streamChat as MockedFunction<typeof streamChat>;
const mockIsAiChatEnabled = isAiChatEnabled as MockedFunction<typeof isAiChatEnabled>;
const mockLoad = loadAutoMateFromServer as MockedFunction<typeof loadAutoMateFromServer>;

const renderChat = (enabled: boolean, route = '/dispatch') => {
    mockIsAiChatEnabled.mockReturnValue(enabled);
    return renderWithMantine(
        <MemoryRouter initialEntries={[route]}>
            <NavigationProvider value={{navigate: vi.fn(), currentState: 'dispatch'}}>
                <AutoMateChatProvider>
                    <AutoMateChatButton/>
                    <AutoMateChatPanel/>
                </AutoMateChatProvider>
            </NavigationProvider>
        </MemoryRouter>,
    );
};

describe('Auto-mate chat', () => {
    beforeEach(() => {
        mockLoad.mockResolvedValue(undefined);
    });

    it('renders nothing while chat is disabled', () => {
        renderChat(false);

        expect(screen.queryByRole('button', {name: 'Open Auto-mate assistant'})).not.toBeInTheDocument();
        expect(screen.queryByText('Auto-mate assistant')).not.toBeInTheDocument();
    });

    it('shows the brand Auto-mate logo at 44px on a surface launcher', () => {
        renderChat(true);

        const launcher = screen.getByRole('button', {name: 'Open Auto-mate assistant'});
        expect(launcher).toHaveAttribute('data-variant', 'default');
        expect(launcher.querySelector('img')).toHaveStyle({width: '44px', height: '44px'});
        expect(launcher.querySelector('svg')).toBeNull();
    });

    it('opens from the button with page suggestions, streams an answer with source badges, and closes', async () => {
        const sources = [{articleId: 'a-1', title: 'Booking a job', isFaq: false}];
        mockStreamChat.mockImplementation(async function* (): AsyncGenerator<AutoMateStreamEvent> {
            yield {type: 'text_delta', text: 'Open Jobs and click New.'};
            yield {type: 'done', sources};
        });
        const user = setupUser();
        renderChat(true, '/dispatch?jobId=42');

        await user.click(screen.getByRole('button', {name: 'Open Auto-mate assistant'}));
        expect(await screen.findByText('Auto-mate assistant')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Open Auto-mate assistant'})).not.toBeInTheDocument();
        expect(screen.getByText("What's happening with this job?")).toBeInTheDocument();

        await user.click(screen.getByRole('textbox'));
        await user.paste('How do I book a job?');
        await user.click(screen.getByRole('button', {name: 'Send message'}));

        const badges = await screen.findByRole('list', {name: 'Sources'});
        expect(badges).toHaveTextContent('Booking a job');
        expect(screen.getByText('Open Jobs and click New.')).toBeInTheDocument();
        expect(mockStreamChat.mock.calls[0][0]).toEqual({
            messages: [{role: 'user', content: 'How do I book a job?'}],
            pageContext: 'Job details for job 42',
        });

        await user.click(screen.getByRole('button', {name: 'Close assistant'}));
        await waitFor(() => expect(screen.queryByText('Auto-mate assistant')).not.toBeInTheDocument());
    });

    it('shows what Auto-mate is doing until the answer starts, then removes the status', async () => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => (release = resolve));
        mockStreamChat.mockImplementation(async function* (): AsyncGenerator<AutoMateStreamEvent> {
            yield {type: 'tool_use', toolName: 'get_job'};
            await gate;
            yield {type: 'text_delta', text: 'Job 42 is on time.'};
            yield {type: 'done'};
        });
        const user = setupUser();
        renderChat(true);

        await user.click(screen.getByRole('button', {name: 'Open Auto-mate assistant'}));
        await user.click(await screen.findByRole('textbox'));
        await user.paste('Is job 42 late?');
        await user.click(screen.getByRole('button', {name: 'Send message'}));

        expect(await screen.findByRole('status')).toHaveTextContent('Looking up the job…');

        await act(async () => release());

        expect(await screen.findByText('Job 42 is on time.')).toBeInTheDocument();
        await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    });

    it('follows the setting when it changes elsewhere, e.g. the Settings page', async () => {
        renderChat(false);

        mockIsAiChatEnabled.mockReturnValue(true);
        act(() => {
            window.dispatchEvent(new Event(AI_CHAT_CHANGED_EVENT));
        });

        expect(await screen.findByRole('button', {name: 'Open Auto-mate assistant'})).toBeInTheDocument();
    });
});
