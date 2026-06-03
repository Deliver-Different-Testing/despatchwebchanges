import React from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    /**
     * When this value changes the boundary resets to a non-error state.
     * Lets parents recover the subtree (e.g. by passing the selected
     * record's id) without unmounting the boundary itself.
     */
    resetKey?: unknown;
    /** Fired in addition to internal reset when the user clicks "Try again". */
    onReset?: () => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    componentStack: string | null;
    resetKey: unknown;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        hasError: false,
        error: null,
        componentStack: null,
        resetKey: undefined,
    };

    static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
        return {hasError: true, error};
    }

    static getDerivedStateFromProps(
        props: ErrorBoundaryProps,
        state: ErrorBoundaryState,
    ): Partial<ErrorBoundaryState> | null {
        if (props.resetKey !== state.resetKey) {
            return {
                hasError: false,
                error: null,
                componentStack: null,
                resetKey: props.resetKey,
            };
        }
        return null;
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
        this.setState({componentStack: info.componentStack ?? null});
    }

    private handleReset = (): void => {
        this.setState({hasError: false, error: null, componentStack: null});
        this.props.onReset?.();
    };

    render() {
        if (this.state.hasError) {
            return (
                <FallbackPanel
                    error={this.state.error}
                    componentStack={this.state.componentStack}
                    onReset={this.handleReset}
                />
            );
        }

        return this.props.children;
    }
}

interface FallbackPanelProps {
    error: Error | null;
    componentStack: string | null;
    onReset: () => void;
}

function FallbackPanel({error, componentStack, onReset}: FallbackPanelProps) {
    const [showDetails, setShowDetails] = React.useState(false);
    const errorMessage = error?.message || String(error ?? 'Unknown error');
    const errorStack = error?.stack ?? '';

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                p: 3,
                width: '100%',
                height: '100%',
                bgcolor: 'grey.50',
                overflow: 'auto',
            }}
        >
            <Paper
                elevation={2}
                sx={{
                    p: 3,
                    borderRadius: 2,
                    maxWidth: 720,
                    width: '100%',
                }}
            >
                <Stack spacing={2}>
                    <Box sx={{display: 'flex', alignItems: 'center', gap: 1.5}}>
                        <ErrorOutlineIcon color="error" sx={{fontSize: 32}}/>
                        <Box>
                            <Typography variant="h6" component="h2" sx={{
                                fontWeight: 600
                            }}>
                                Something Went Wrong
                            </Typography>
                            <Typography variant="body2" sx={{
                                color: "text.secondary"
                            }}>
                                An unexpected error occurred in this page. Please try refreshing.
                            </Typography>
                        </Box>
                    </Box>

                    <Alert severity="error" variant="outlined">
                        <AlertTitle>Error</AlertTitle>
                        {errorMessage}
                    </Alert>

                    <Box>
                        <Button
                            size="small"
                            onClick={() => setShowDetails((v) => !v)}
                            sx={{textTransform: 'none'}}
                        >
                            {showDetails ? 'Hide details' : 'Show details'}
                        </Button>
                        <Collapse in={showDetails} unmountOnExit>
                            <Box
                                component="pre"
                                sx={{
                                    mt: 1,
                                    p: 1.5,
                                    bgcolor: 'grey.100',
                                    border: 1,
                                    borderColor: 'grey.300',
                                    borderRadius: 1,
                                    fontSize: '0.75rem',
                                    fontFamily: 'monospace',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: 320,
                                    overflow: 'auto',
                                    m: 0,
                                }}
                            >
                                {errorStack}
                                {componentStack && `\n\nComponent stack:${componentStack}`}
                            </Box>
                        </Collapse>
                    </Box>

                    <Box sx={{display: 'flex', justifyContent: 'flex-end', gap: 1}}>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<RefreshIcon/>}
                            onClick={onReset}
                            sx={{minWidth: 120, textTransform: 'none'}}
                        >
                            Try again
                        </Button>
                    </Box>
                </Stack>
            </Paper>
        </Box>
    );
}
