import React, {useEffect} from 'react';
import {Button, Center, Loader, Stack, Text, Title} from '@mantine/core';
import {redirectTo} from '../../../utils/navigation';
import {useSessionContext} from '../../../hooks/useSessionContext';

const isUnauthorized = (error: unknown): boolean => (error as {status?: number} | null)?.status === 401;

export const SessionGate: React.FC<{children: React.ReactNode}> = ({children}) => {
    const {isSuccess, isError, error, refetch} = useSessionContext();
    const unauthorized = isError && isUnauthorized(error);

    useEffect(() => {
        if (unauthorized) redirectTo((error as {authRedirect?: string}).authRedirect || '/');
    }, [unauthorized, error]);

    if (isSuccess) return <>{children}</>;

    if (isError && !unauthorized) {
        return (
            <Center mih="100vh">
                <Stack align="center" gap="sm">
                    <Title order={3}>Can't connect</Title>
                    <Text c="dimmed">Couldn't load your session. Check your connection and try again.</Text>
                    <Button onClick={() => void refetch()}>Retry</Button>
                </Stack>
            </Center>
        );
    }

    return (
        <Center mih="100vh">
            <Loader aria-label="Loading session" />
        </Center>
    );
};
