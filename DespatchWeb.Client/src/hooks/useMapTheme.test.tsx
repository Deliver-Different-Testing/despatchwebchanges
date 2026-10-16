import React from 'react';
import {act, render, screen} from '@testing-library/react';
import {setupUser} from '../test/utils/setupUser';
import {MAP_THEME_STORAGE_KEY, useMapTheme} from './useMapTheme';
import {ColorModeContext} from './useColorMode';

const Probe: React.FC<{label?: string}> = ({label = 'p'}) => {
    const {preference, mode, setPreference} = useMapTheme();
    return (
        <div>
            <span data-testid={label}>{`${preference}:${mode}`}</span>
            <button onClick={() => setPreference('dark')}>{`${label}-dark`}</button>
            <button onClick={() => setPreference('auto')}>{`${label}-auto`}</button>
        </div>
    );
};

const inApp = (appMode: 'light' | 'dark', ui: React.ReactElement) => (
    <ColorModeContext.Provider value={{mode: appMode, preference: appMode, setPreference: jest.fn()}}>{ui}</ColorModeContext.Provider>
);

describe('useMapTheme', () => {
    beforeEach(() => window.localStorage.clear());

    it('follows the app by default, and a pin overrides it independently of the app', async () => {
        const user = setupUser();
        render(inApp('light', <Probe/>));
        expect(screen.getByTestId('p')).toHaveTextContent('auto:light');

        await user.click(screen.getByText('p-dark'));
        expect(screen.getByTestId('p')).toHaveTextContent('dark:dark');
        expect(window.localStorage.getItem(MAP_THEME_STORAGE_KEY)).toBe('dark');

        await user.click(screen.getByText('p-auto'));
        expect(screen.getByTestId('p')).toHaveTextContent('auto:light');
    });

    it('restores a stored pin, ignoring the app mode', () => {
        window.localStorage.setItem(MAP_THEME_STORAGE_KEY, 'light');
        render(inApp('dark', <Probe/>));

        expect(screen.getByTestId('p')).toHaveTextContent('light:light');
    });

    it('keeps every mounted map in step, and ignores junk in storage', async () => {
        window.localStorage.setItem(MAP_THEME_STORAGE_KEY, 'purple');
        const user = setupUser();
        render(inApp('light', <><Probe label="a"/><Probe label="b"/></>));
        expect(screen.getByTestId('a')).toHaveTextContent('auto:light');

        await user.click(screen.getByText('a-dark'));
        expect(screen.getByTestId('b')).toHaveTextContent('dark:dark');
        act(() => { window.dispatchEvent(new StorageEvent('storage', {key: MAP_THEME_STORAGE_KEY, newValue: 'light'})); });
        expect(screen.getByTestId('b')).toHaveTextContent('light:light');
    });
});
