/**
 * React Error Page Component
 *
 * A full-page error display with customizable error types.
 * Supports: 404 Not Found, 403 Forbidden, 500 Server Error, and generic errors.
 */

import React from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    alpha,
} from '@mui/material';
import {
    SearchOff as SearchOffIcon,
    ErrorOutline as ErrorOutlineIcon,
    Lock as LockIcon,
    CloudOff as CloudOffIcon,
    ArrowBack as ArrowBackIcon,
    Home as HomeIcon,
} from '@mui/icons-material';

export type ErrorType = 'notFound' | 'error' | 'forbidden' | 'serverError';

interface ErrorConfig {
    icon: React.ReactNode;
    title: string;
    message: string;
    code?: string;
}

export interface ErrorPageProps {
    errorType?: ErrorType;
    customTitle?: string;
    customMessage?: string;
    onGoHome?: () => void;
    onGoBack?: () => void;
}

const iconSx = {fontSize: 48};

const errorConfigs: Record<ErrorType, ErrorConfig> = {
    notFound: {
        icon: <SearchOffIcon sx={iconSx} />,
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist or has been moved.',
        code: '404',
    },
    error: {
        icon: <ErrorOutlineIcon sx={iconSx} />,
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again later.',
        code: 'Error',
    },
    forbidden: {
        icon: <LockIcon sx={iconSx} />,
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        code: '403',
    },
    serverError: {
        icon: <CloudOffIcon sx={iconSx} />,
        title: 'Server Error',
        message: 'The server encountered an error. Please try again later.',
        code: '500',
    },
};

export const ErrorPage: React.FC<ErrorPageProps> = ({
    errorType = 'notFound',
    customTitle,
    customMessage,
    onGoHome,
    onGoBack,
}) => {
    const config = errorConfigs[errorType];

    const title = customTitle || config.title;
    const message = customMessage || config.message;

    const handleGoBack = () => {
        if (onGoBack) {
            onGoBack();
        } else {
            window.history.back();
        }
    };

    const handleGoHome = () => {
        if (onGoHome) {
            onGoHome();
        }
    };

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                bgcolor: 'grey.100',
                p: 3,
            }}
        >
            <Paper
                elevation={4}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    borderRadius: 3,
                    p: {xs: 4, sm: 6},
                    maxWidth: 420,
                    width: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Background code watermark */}
                {config.code && (
                    <Typography
                        sx={{
                            position: 'absolute',
                            top: -20,
                            right: -10,
                            fontSize: {xs: 80, sm: 120},
                            fontWeight: 700,
                            opacity: 0.05,
                            lineHeight: 1,
                            pointerEvents: 'none',
                            userSelect: 'none',
                            color: 'primary.main',
                        }}
                    >
                        {config.code}
                    </Typography>
                )}

                {/* Icon container */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: {xs: 72, sm: 88},
                        height: {xs: 72, sm: 88},
                        borderRadius: '50%',
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                        mb: 3,
                        color: 'primary.main',
                    }}
                >
                    {config.icon}
                </Box>

                {/* Content */}
                <Box sx={{mb: 4}}>
                    <Typography
                        variant="h5"
                        component="h1"
                        sx={{
                            fontWeight: 600,
                            color: 'text.primary',
                            mb: 1.5,
                            fontSize: {xs: '1.25rem', sm: '1.5rem'},
                        }}
                    >
                        {title}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'text.secondary',
                            lineHeight: 1.6,
                            maxWidth: 320,
                            mx: 'auto',
                        }}
                    >
                        {message}
                    </Typography>
                </Box>

                {/* Actions */}
                <Box
                    sx={{
                        display: 'flex',
                        gap: 1.5,
                        flexWrap: 'wrap',
                        justifyContent: 'center',
                        width: '100%',
                        flexDirection: {xs: 'column', sm: 'row'},
                    }}
                >
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={handleGoBack}
                        sx={{
                            minWidth: 120,
                            textTransform: 'none',
                            fontWeight: 500,
                        }}
                    >
                        Go Back
                    </Button>
                    {onGoHome && (
                        <Button
                            variant="contained"
                            startIcon={<HomeIcon />}
                            onClick={handleGoHome}
                            sx={{
                                minWidth: 120,
                                textTransform: 'none',
                                fontWeight: 500,
                            }}
                        >
                            Go Home
                        </Button>
                    )}
                </Box>
            </Paper>
        </Box>
    );
};

export default ErrorPage;
