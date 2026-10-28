import React from 'react';
import {render, screen} from '@testing-library/react';
import {useMantineTheme} from '@mantine/core';
import {DfrntMantineProvider} from './DfrntMantineProvider';
import {COLOR_MODE_STORAGE_KEY} from '../hooks/useColorMode';
import {APPEARANCE_STORAGE_KEY} from '../hooks/useAppearance';

describe('DfrntMantineProvider', () => {
    beforeEach(() => window.localStorage.clear());

    it('renders in the stored colour mode and tells native controls about it', () => {
        window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'dark');

        render(<DfrntMantineProvider><span>content</span></DfrntMantineProvider>);

        expect(screen.getByText('content')).toBeInTheDocument();
        expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'dark');
        expect(document.documentElement.style.colorScheme).toBe('dark');
    });

    it('renders light when light is stored', () => {
        window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'light');

        render(<DfrntMantineProvider><span>content</span></DfrntMantineProvider>);

        expect(document.documentElement).toHaveAttribute('data-mantine-color-scheme', 'light');
        expect(document.documentElement.style.colorScheme).toBe('light');
    });

    it('applies the stored appearance: high contrast flag on <html> and the chosen colours in the theme variables', () => {
        window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'light');
        window.localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({
            user: {contrast: 'high', textLight: '#222222'},
            tenant: {primary: '#132279'},
        }));

        const ThemeProbe = () => {
            const theme = useMantineTheme();
            return <span data-testid="probe">{`${theme.colors.brand[5]} ${theme.other.appearance.textLight}`}</span>;
        };

        render(<DfrntMantineProvider><ThemeProbe/></DfrntMantineProvider>);

        expect(document.documentElement.dataset.ddContrast).toBe('high');
        expect(screen.getByTestId('probe')).toHaveTextContent('#132279 #222222');
    });

    it('marks standard contrast when nothing is stored', () => {
        render(<DfrntMantineProvider><span>content</span></DfrntMantineProvider>);

        expect(document.documentElement.dataset.ddContrast).toBe('standard');
    });
});
