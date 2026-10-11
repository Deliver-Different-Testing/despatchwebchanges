import React from 'react';
import {render, screen} from '@testing-library/react';
import {DfrntMantineProvider} from './DfrntMantineProvider';
import {COLOR_MODE_STORAGE_KEY} from '../hooks/useColorMode';

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
});
