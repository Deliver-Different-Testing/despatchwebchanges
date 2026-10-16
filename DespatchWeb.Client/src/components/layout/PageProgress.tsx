import React, {useEffect, useState, useSyncExternalStore} from 'react';
import {getPendingPageLoads, subscribePageLoads} from '../../routes/pageLoadTracker';
import {PAGE_TRANSITION_DELAY_MS} from './PageTransition';
import styles from './PageProgress.module.css';

/** Thin indeterminate bar over the still-visible old page while the next page's code loads. */
export const PageProgress: React.FC = () => {
    const loading = useSyncExternalStore(subscribePageLoads, () => getPendingPageLoads() > 0);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!loading) {
            setVisible(false);
            return;
        }
        const timer = setTimeout(() => setVisible(true), PAGE_TRANSITION_DELAY_MS);
        return () => clearTimeout(timer);
    }, [loading]);

    if (!visible) return null;

    return (
        <div className={styles.track} role="progressbar" aria-label="Loading page">
            <div className={styles.glint}/>
        </div>
    );
};
