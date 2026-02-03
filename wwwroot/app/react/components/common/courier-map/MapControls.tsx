/**
 * MapControls Component
 *
 * Control buttons for the courier map: fit-all and refresh.
 */

import React from 'react';
import { Tooltip } from '@mui/material';
import type { MapControlsProps } from './CourierMap.types';
import styles from './CourierMap.module.css';

export function MapControls({ onFitAll, onRefresh, isLoading }: MapControlsProps) {
    return (
        <div className={styles.mapControls}>
            <Tooltip title="Fit all drivers in view" placement="left">
                <button
                    className={styles.mapControlBtn}
                    onClick={onFitAll}
                    aria-label="Return to overview"
                >
                    <span className="material-symbols-outlined">fit_screen</span>
                </button>
            </Tooltip>
            <Tooltip title="Refresh locations" placement="left">
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
