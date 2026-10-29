import React from 'react';
import {act, render, screen, waitFor} from '@testing-library/react';
import {setupUser} from '../test/utils/setupUser';
import {ColorModeProvider, useColorMode, COLOR_MODE_STORAGE_KEY} from './useColorMode';
import {getPreference, savePreference} from '../api/preferencesApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';

jest.mock('../api/preferencesApi', () => ({
    getPreference: jest.fn(),
    savePreference: jest.fn(),
}));

const mockGetPreference = getPreference as jest.Mock;
const mockSavePreference = savePreference as jest.Mock;

const Probe: React.FC<{label?: string}> = ({label = 'probe'}) => {
    const {mode, preference, setPreference} = useColorMode();
    return (
        <div>
            <span data-testid={`${label}-state`}>{`${preference}:${mode}`}</span>
            <button onClick={() => setPreference('dark')}>{`${label}-dark`}</button>
        </div>
    );
};

function mockMatchMedia(matches: boolean) {
    const listeners = new Set<(e: MediaQueryListEvent) => void>();
    window.matchMedia = jest.fn().mockImplementation(() => ({
        matches,
        addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.delete(cb),
    }));
    return (next: boolean) => listeners.forEach(cb => cb({matches: next} as MediaQueryListEvent));
}

describe('ColorModeProvider', () => {
    const win = window as unknown as {ContactID: number};

    beforeEach(() => {
        jest.clearAllMocks();
        window.localStorage.clear();
        win.ContactID = 0;
        delete (window as unknown as Record<string, unknown>).__ddColorModeServerSynced;
        mockGetPreference.mockResolvedValue(null);
        mockSavePreference.mockResolvedValue(undefined);
        mockMatchMedia(false);
    });

    it('persists a pick to localStorage and saves it as the Appearance staff preference', async () => {
        const user = setupUser();
        render(<ColorModeProvider><Probe/></ColorModeProvider>);

        await user.click(screen.getByText('probe-dark'));

        expect(screen.getByTestId('probe-state')).toHaveTextContent('dark:dark');
        expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
        expect(mockSavePreference).toHaveBeenCalledWith(StaffPreferenceKey.Appearance, 'dark');
    });

    it('keeps the pre-paint boot scheme attribute in step with the mode so switching to light drops the dark canvas', async () => {
        const root = document.documentElement;
        root.setAttribute('data-dd-boot-scheme', 'dark');
        window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'dark');
        const Toggle: React.FC = () => {
            const {setPreference} = useColorMode();
            return <button onClick={() => setPreference('light')}>to-light</button>;
        };
        const user = setupUser();
        render(<ColorModeProvider><Toggle/></ColorModeProvider>);
        expect(root.getAttribute('data-dd-boot-scheme')).toBe('dark');

        await user.click(screen.getByText('to-light'));
        expect(root.hasAttribute('data-dd-boot-scheme')).toBe(false);

        act(() => window.dispatchEvent(new CustomEvent('dd-color-mode-change', {detail: 'dark'})));
        expect(root.getAttribute('data-dd-boot-scheme')).toBe('dark');
        root.removeAttribute('data-dd-boot-scheme');
    });

    it('updates every mounted provider live when one changes, and follows the OS while on system', async () => {
        const user = setupUser();
        const fireOsChange = mockMatchMedia(false);
        render(<><ColorModeProvider><Probe label="a"/></ColorModeProvider><ColorModeProvider><Probe label="b"/></ColorModeProvider></>);

        act(() => fireOsChange(true));
        expect(screen.getByTestId('a-state')).toHaveTextContent('system:dark');

        await user.click(screen.getByText('a-dark'));
        expect(screen.getByTestId('b-state')).toHaveTextContent('dark:dark');
    });

    it('adopts the server preference for a signed-in user, and seeds the server from local when it has none', async () => {
        win.ContactID = 7;
        mockGetPreference.mockResolvedValue('dark');
        const {unmount} = render(<ColorModeProvider><Probe/></ColorModeProvider>);
        await waitFor(() => expect(screen.getByTestId('probe-state')).toHaveTextContent('dark:dark'));
        expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
        unmount();

        delete (window as unknown as Record<string, unknown>).__ddColorModeServerSynced;
        window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'light');
        mockGetPreference.mockResolvedValue(null);
        render(<ColorModeProvider><Probe/></ColorModeProvider>);
        await waitFor(() => expect(mockSavePreference).toHaveBeenCalledWith(StaffPreferenceKey.Appearance, 'light'));
    });

    it('writes nothing for a signed-in user when neither the server nor this browser has a saved choice', async () => {
        win.ContactID = 7;
        render(<ColorModeProvider><Probe/></ColorModeProvider>);

        await waitFor(() => expect(mockGetPreference).toHaveBeenCalledWith(StaffPreferenceKey.Appearance));
        await act(async () => {});
        expect(mockSavePreference).not.toHaveBeenCalled();
        expect(screen.getByTestId('probe-state')).toHaveTextContent('system:light');
    });

    it('does not touch the server when there is no signed-in staff member', () => {
        render(<ColorModeProvider><Probe/></ColorModeProvider>);

        expect(mockGetPreference).not.toHaveBeenCalled();
    });
});
