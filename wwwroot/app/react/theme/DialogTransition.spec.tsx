import React from 'react';
import {render, screen} from '@testing-library/react';
import {DialogTransition} from './DialogTransition';

// Stub the two MUI transitions with identifiable markers so we can assert which
// one DialogTransition selects based on the reduced-motion preference.
jest.mock('@mui/material/Grow', () => ({
    __esModule: true,
    default: ({children}: { children: React.ReactNode }) => <div data-testid="grow">{children}</div>,
}));
jest.mock('@mui/material/Fade', () => ({
    __esModule: true,
    default: ({children}: { children: React.ReactNode }) => <div data-testid="fade">{children}</div>,
}));

function mockPrefersReducedMotion(reduce: boolean) {
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        matches: query.includes('prefers-reduced-motion: reduce') ? reduce : false,
        media: query,
        onchange: null,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        addListener: jest.fn(),
        removeListener: jest.fn(),
        dispatchEvent: jest.fn(),
    }));
}

describe('DialogTransition', () => {
    it('uses Grow when reduced motion is not requested', () => {
        mockPrefersReducedMotion(false);
        render(<DialogTransition in><span>body</span></DialogTransition>);
        expect(screen.getByTestId('grow')).toBeInTheDocument();
        expect(screen.queryByTestId('fade')).not.toBeInTheDocument();
    });

    it('falls back to a cross-fade when the user prefers reduced motion', () => {
        mockPrefersReducedMotion(true);
        render(<DialogTransition in><span>body</span></DialogTransition>);
        expect(screen.getByTestId('fade')).toBeInTheDocument();
        expect(screen.queryByTestId('grow')).not.toBeInTheDocument();
    });
});
