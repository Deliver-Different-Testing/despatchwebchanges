/**
 * React Error Page Component
 *
 * A full-page error display with customizable error types.
 * Supports: 404 Not Found, 403 Forbidden, 500 Server Error, and generic errors.
 */

import React from 'react';
import {Box, Button, Flex, Paper, Text, Title, alpha} from '@mantine/core';
import {ArrowLeft, CloudOff, House, Lock, SearchX, TriangleAlert} from 'lucide-react';
import {Icon} from '../../components/common/icon/Icon';

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

const ICON_SIZE = 48;

const errorConfigs: Record<ErrorType, ErrorConfig> = {
    notFound: {
        icon: <Icon lucide={SearchX} size={ICON_SIZE} />,
        title: 'Page Not Found',
        message: 'The page you are looking for does not exist or has been moved.',
        code: '404',
    },
    error: {
        icon: <Icon lucide={TriangleAlert} size={ICON_SIZE} />,
        title: 'Something Went Wrong',
        message: 'An unexpected error occurred. Please try again later.',
        code: 'Error',
    },
    forbidden: {
        icon: <Icon lucide={Lock} size={ICON_SIZE} />,
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        code: '403',
    },
    serverError: {
        icon: <Icon lucide={CloudOff} size={ICON_SIZE} />,
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
            p={24}
            mih="100vh"
            bg="var(--mantine-color-gray-1)"
            style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}
        >
            <Paper
                shadow="md"
                radius="lg"
                p={{base: 32, sm: 48}}
                maw={420}
                w="100%"
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Background code watermark */}
                {config.code && (
                    <Text
                        fz={{base: 80, sm: 120}}
                        fw={700}
                        c="var(--mantine-primary-color-filled)"
                        style={{
                            position: 'absolute',
                            top: -20,
                            right: -10,
                            opacity: 0.05,
                            lineHeight: 1,
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                    >
                        {config.code}
                    </Text>
                )}

                {/* Icon container */}
                <Box
                    w={{base: 72, sm: 88}}
                    h={{base: 72, sm: 88}}
                    mb={24}
                    c="var(--mantine-primary-color-filled)"
                    bg={alpha('var(--mantine-primary-color-filled)', 0.1)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                    }}
                >
                    {config.icon}
                </Box>

                {/* Content */}
                <Box mb={32}>
                    <Title
                        order={1}
                        fw={600}
                        mb={12}
                        fz={{base: '1.25rem', sm: '1.5rem'}}
                    >
                        {title}
                    </Title>
                    <Text c="dimmed" maw={320} mx="auto" style={{lineHeight: 1.6}}>
                        {message}
                    </Text>
                </Box>

                {/* Actions — stacked on the narrowest viewport, side by side above it.
                    Flex takes the responsive `direction` natively, so this needs no
                    media query of its own. */}
                <Flex
                    w="100%"
                    gap={12}
                    wrap="wrap"
                    justify="center"
                    direction={{base: 'column', sm: 'row'}}
                >
                    <Button
                        variant="outline"
                        leftSection={<Icon lucide={ArrowLeft} />}
                        onClick={handleGoBack}
                        miw={120}
                        fw={500}
                    >
                        Go Back
                    </Button>
                    {onGoHome && (
                        <Button
                            leftSection={<Icon lucide={House} />}
                            onClick={handleGoHome}
                            miw={120}
                            fw={500}
                        >
                            Go Home
                        </Button>
                    )}
                </Flex>
            </Paper>
        </Box>
    );
};

export default ErrorPage;
