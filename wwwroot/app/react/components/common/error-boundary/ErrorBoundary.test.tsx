import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react';
import {MantineTestProvider} from '../../../__testUtils__';
import {ErrorBoundary} from './ErrorBoundary';

// Built inline rather than via `renderWithMantine` because two cases below need
// `rerender` with the provider in the tree.
const renderWithTheme = (ui: React.ReactElement) => {
    return render(<MantineTestProvider>{ui}</MantineTestProvider>);
};

const ThrowingComponent = ({shouldThrow, message = 'Test error'}: {shouldThrow: boolean; message?: string}) => {
    if (shouldThrow) {
        throw new Error(message);
    }
    return <div>Child content</div>;
};

describe('ErrorBoundary', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('renders children when there is no error', () => {
        renderWithTheme(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={false} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders the fallback with the error message when a child throws', () => {
        renderWithTheme(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} message="Boom! something blew up" />
            </ErrorBoundary>
        );

        expect(screen.queryByText('Child content')).not.toBeInTheDocument();
        expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();
        expect(screen.getByText('Boom! something blew up')).toBeInTheDocument();
    });

    it('logs the error with the [ErrorBoundary] prefix', () => {
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

    it('resets and re-renders children when "Try again" is clicked', () => {
        const {rerender} = renderWithTheme(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();

        // The child stops throwing after the click — clicking "Try again" should
        // clear the boundary and the new render shows the child content.
        rerender(
            <MantineTestProvider>
                <ErrorBoundary>
                    <ThrowingComponent shouldThrow={false} />
                </ErrorBoundary>
            </MantineTestProvider>
        );

        fireEvent.click(screen.getByRole('button', {name: /try again/i}));

        expect(screen.getByText('Child content')).toBeInTheDocument();
        expect(screen.queryByText('Something Went Wrong')).not.toBeInTheDocument();
    });

    it('calls onReset when "Try again" is clicked', () => {
        const onReset = jest.fn();
        renderWithTheme(
            <ErrorBoundary onReset={onReset}>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        fireEvent.click(screen.getByRole('button', {name: /try again/i}));

        expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('resets the boundary when resetKey changes', () => {
        const {rerender} = renderWithTheme(
            <ErrorBoundary resetKey={1}>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something Went Wrong')).toBeInTheDocument();

        rerender(
            <MantineTestProvider>
                <ErrorBoundary resetKey={2}>
                    <ThrowingComponent shouldThrow={false} />
                </ErrorBoundary>
            </MantineTestProvider>
        );

        expect(screen.getByText('Child content')).toBeInTheDocument();
        expect(screen.queryByText('Something Went Wrong')).not.toBeInTheDocument();
    });

    it('reveals the component stack when "Show details" is clicked', () => {
        renderWithTheme(
            <ErrorBoundary>
                <ThrowingComponent shouldThrow={true} />
            </ErrorBoundary>
        );

        // Details are collapsed by default
        expect(screen.getByRole('button', {name: /show details/i})).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', {name: /show details/i}));

        // After expansion the button label flips and the component stack is in the DOM
        expect(screen.getByRole('button', {name: /hide details/i})).toBeInTheDocument();
        // The throwing component's name appears somewhere in the component stack
        expect(document.body.textContent).toMatch(/ThrowingComponent/);
    });
});
