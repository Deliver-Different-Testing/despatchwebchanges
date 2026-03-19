/** @jest-environment jest-environment-jsdom */
import React from 'react';
import {render, screen} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {ErrorBoundary} from './ErrorBoundary';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

const ThrowingComponent = ({shouldThrow}: {shouldThrow: boolean}) => {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>Child content</div>;
};

describe('ErrorBoundary', () => {
    // Suppress React error boundary console output during tests
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('should render children when there is no error', () => {
        renderWithTheme(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should render ErrorPage when a child throws', () => {
        renderWithTheme(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.queryByText('Child content')).not.toBeInTheDocument();
        expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
        expect(screen.getByText('An unexpected error occurred in this page. Please try refreshing.')).toBeInTheDocument();
    });

    it('should log the error to console', () => {
        renderWithTheme(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[ErrorBoundary] Uncaught error:',
            expect.any(Error),
            expect.any(String)
        );
    });
});
