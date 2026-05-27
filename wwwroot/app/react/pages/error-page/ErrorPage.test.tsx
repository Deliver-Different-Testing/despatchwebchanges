/**
 * ErrorPage Component Tests
 */

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {ThemeProvider, createTheme} from '@mui/material/styles';
import {ErrorPage} from './ErrorPage';

const theme = createTheme();

const renderWithTheme = (ui: React.ReactElement) => {
    return render(
        <ThemeProvider theme={theme}>
            {ui}
        </ThemeProvider>
    );
};

describe('ErrorPage', () => {
    describe('Default rendering', () => {
        it('should render 404 page by default', () => {
            renderWithTheme(<ErrorPage />);

            expect(screen.getByText('Page Not Found')).toBeInTheDocument();
            expect(screen.getByText('The page you are looking for does not exist or has been moved.')).toBeInTheDocument();
            expect(screen.getByText('404')).toBeInTheDocument();
        });

        it('should render Go Back button', () => {
            renderWithTheme(<ErrorPage />);

            expect(screen.getByRole('button', {name: /go back/i})).toBeInTheDocument();
        });

        it('should not render Go Home button when onGoHome is not provided', () => {
            renderWithTheme(<ErrorPage />);

            expect(screen.queryByRole('button', {name: /go home/i})).not.toBeInTheDocument();
        });

        it('should render Go Home button when onGoHome is provided', () => {
            renderWithTheme(<ErrorPage onGoHome={() => {}} />);

            expect(screen.getByRole('button', {name: /go home/i})).toBeInTheDocument();
        });
    });

    describe('Error types', () => {
        it('should render notFound error', () => {
            renderWithTheme(<ErrorPage errorType="notFound" />);

            expect(screen.getByText('Page Not Found')).toBeInTheDocument();
            expect(screen.getByText('404')).toBeInTheDocument();
        });

        it('should render error type', () => {
            renderWithTheme(<ErrorPage errorType="error" />);

            expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
            expect(screen.getByText('Error')).toBeInTheDocument();
        });

        it('should render forbidden error', () => {
            renderWithTheme(<ErrorPage errorType="forbidden" />);

            expect(screen.getByText('Access Denied')).toBeInTheDocument();
            expect(screen.getByText('403')).toBeInTheDocument();
        });

        it('should render serverError', () => {
            renderWithTheme(<ErrorPage errorType="serverError" />);

            expect(screen.getByText('Server Error')).toBeInTheDocument();
            expect(screen.getByText('500')).toBeInTheDocument();
        });
    });

    describe('Custom content', () => {
        it('should use custom title when provided', () => {
            renderWithTheme(<ErrorPage customTitle="Custom Error Title" />);

            expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
            expect(screen.queryByText('Page Not Found')).not.toBeInTheDocument();
        });

        it('should use custom message when provided', () => {
            renderWithTheme(<ErrorPage customMessage="This is a custom error message." />);

            expect(screen.getByText('This is a custom error message.')).toBeInTheDocument();
        });

        it('should use both custom title and message', () => {
            renderWithTheme(
                <ErrorPage
                    customTitle="Custom Title"
                    customMessage="Custom Message"
                />
            );

            expect(screen.getByText('Custom Title')).toBeInTheDocument();
            expect(screen.getByText('Custom Message')).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should call onGoBack when Go Back button is clicked', () => {
            const onGoBack = jest.fn();
            renderWithTheme(<ErrorPage onGoBack={onGoBack} />);

            fireEvent.click(screen.getByRole('button', {name: /go back/i}));

            expect(onGoBack).toHaveBeenCalledTimes(1);
        });

        it('should call onGoHome when Go Home button is clicked', () => {
            const onGoHome = jest.fn();
            renderWithTheme(<ErrorPage onGoHome={onGoHome} />);

            fireEvent.click(screen.getByRole('button', {name: /go home/i}));

            expect(onGoHome).toHaveBeenCalledTimes(1);
        });

        it('should call window.history.back when Go Back is clicked without onGoBack handler', () => {
            const historyBackSpy = jest.spyOn(window.history, 'back').mockImplementation(() => {});
            renderWithTheme(<ErrorPage />);

            fireEvent.click(screen.getByRole('button', {name: /go back/i}));

            expect(historyBackSpy).toHaveBeenCalledTimes(1);
            historyBackSpy.mockRestore();
        });
    });
});
