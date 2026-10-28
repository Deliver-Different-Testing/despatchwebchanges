import React, {useEffect, useState} from 'react';
import {Loader, Stack, Text} from '@mantine/core';
import styles from './PageTransition.module.css';

export const PAGE_TRANSITION_DELAY_MS = 150;

/** Suspense fallback shown while a page chunk loads; delayed so instant navigations never flash it. */
export const PageTransition: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), PAGE_TRANSITION_DELAY_MS);
        return () => clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <Stack h="100%" mih="50vh" align="center" justify="center" gap="sm" role="status">
            <div className={styles.glass}>
                <Loader size="sm" color="var(--mantine-primary-color-filled)"/>
            </div>
            <Text size="sm" c="dimmed">Loading Despatch</Text>
        </Stack>
    );
};

