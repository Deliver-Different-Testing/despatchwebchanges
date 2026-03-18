import React from 'react';
import {ErrorPage} from '../../../pages/error-page/ErrorPage';

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {hasError: false};

    static getDerivedStateFromError(): ErrorBoundaryState {
        return {hasError: true};
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <ErrorPage
                    errorType="error"
                    customTitle="Something Went Wrong"
                    customMessage="An unexpected error occurred in this page. Please try refreshing."
                />
            );
        }

        return this.props.children;
    }
}
