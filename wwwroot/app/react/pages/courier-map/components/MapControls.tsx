/**
 * MapControls Component
 *
 * Horizontal glassmorphic floating bar with fit-all and refresh actions.
 */

import React from 'react';
import { Tooltip } from '@mui/material';
import type { MapControlsProps } from '../CourierMapPage.types';
import styles from '../CourierMapPage.module.css';

export function MapControls({ onFitAll, onRefresh, isLoading }: MapControlsProps) {
    return (
        <div className={styles.mapControls}>
            <Tooltip title="Fit all drivers in view" placement="top">
                <button
                    className={styles.mapControlBtn}
                    onClick={onFitAll}
                    aria-label="Return to overview"
                >
                    <span className="material-symbols-outlined">fit_screen</span>
                </button>
            </Tooltip>
            <div className={styles.controlsDivider} />
            <Tooltip title="Refresh locations" placement="top">
                <button
                    className={styles.mapControlBtn}
                    onClick={onRefresh}
                    disabled={isLoading}
                    aria-label="Refresh data"
                >
                    <span
                        className={`material-symbols-outlined ${isLoading ? styles.spin : ''}`}
                    >
                        sync
                    </span>
                </button>
            </Tooltip>
        </div>
    );
}
