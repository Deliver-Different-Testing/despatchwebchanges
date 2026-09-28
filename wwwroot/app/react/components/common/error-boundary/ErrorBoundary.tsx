import React from 'react';
import {Alert, Box, Button, Collapse, Group, Paper, Stack, Text, Title} from '@mantine/core';
import {CircleAlert, RefreshCw} from 'lucide-react';
import {Icon} from '../icon/Icon';

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
            p={24}
            w="100%"
            h="100%"
            bg="var(--mantine-color-gray-0)"
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                overflow: 'auto',
            }}
        >
            <Paper shadow="sm" p={24} maw={720} w="100%">
                <Stack gap={16}>
                    <Group gap={12} align="center" wrap="nowrap">
                        <Icon lucide={CircleAlert} size={32} color="var(--mantine-color-red-6)"/>
                        <Box>
                            <Title order={2} size="h6">
                                Something Went Wrong
                            </Title>
                            <Text size="sm" c="dimmed">
                                An unexpected error occurred in this page. Please try refreshing.
                            </Text>
                        </Box>
                    </Group>

                    {/* role="alert" is correct here — this genuinely is an error announcement. */}
                    <Alert color="red" variant="outline" title="Error">
                        {errorMessage}
                    </Alert>

                    <Box>
                        <Button variant="subtle" size="xs" onClick={() => setShowDetails((v) => !v)}>
                            {showDetails ? 'Hide details' : 'Show details'}
                        </Button>
                        <Collapse expanded={showDetails}>
                            <Box
                                component="pre"
                                p={12}
                                m={0}
                                fz="xs"
                                ff="monospace"
                                bg="var(--mantine-color-gray-1)"
                                // marginTop lives in `style`, not an `mt` prop: `m={0}`
                                // kills the browser's default <pre> margin and the two
                                // style props emit inline styles in no guaranteed order.
                                // (The MUI original had the same pair, where `m: 0` came
                                // last in the sx object and silently ate its `mt: 1`.)
                                style={{
                                    marginTop: 8,
                                    border: '1px solid var(--mantine-color-gray-3)',
                                    borderRadius: 'var(--mantine-radius-sm)',
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    maxHeight: 320,
                                    overflow: 'auto',
                                }}
                            >
                                {errorStack}
                                {componentStack && `\n\nComponent stack:${componentStack}`}
                            </Box>
                        </Collapse>
                    </Box>

                    <Group justify="flex-end" gap={8}>
                        <Button
                            leftSection={<Icon lucide={RefreshCw}/>}
                            onClick={onReset}
                            miw={120}
                        >
                            Try again
                        </Button>
                    </Group>
                </Stack>
            </Paper>
        </Box>
    );
}
