/**
 * DriversPanel Component
 *
 * Sidebar panel showing list of active drivers with search functionality.
 */

import React, { useMemo } from 'react';
import { CircularProgress } from '@mui/material';
import type { DriversPanelProps } from '../CourierMapPage.types';
import { DriverListItem } from './DriverListItem';
import styles from '../CourierMapPage.module.css';

export function DriversPanel({
    drivers,
    totalActiveDrivers,
    isLoading,
    searchInputValue,
    searchTerm,
    onSearchChange,
    onDriverClick,
    onRefresh,
    isPanelHidden,
    onTogglePanel,
}: DriversPanelProps) {
    // Filter drivers based on search term
    const filteredDrivers = useMemo(() => {
        if (!searchTerm || searchTerm.trim() === '') {
            return drivers;
        }

        const term = searchTerm.toLowerCase().trim();
        return drivers.filter((driver) => {
            const name = (driver.courierName || '').toLowerCase();
            const code = (driver.code || '').toLowerCase();
            return name.includes(term) || code.includes(term);
        });
    }, [drivers, searchTerm]);

    const panelClasses = [
        styles.driversPanel,
        isPanelHidden ? styles.panelHidden : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={panelClasses}>
            {/* Panel Content */}
            <div className={styles.panelContent}>
                {/* Header */}
                <div className={styles.panelHeader}>
                    <div className={styles.headerLeft}>
                        <span className={styles.panelTitle}>Active Drivers</span>
                        {totalActiveDrivers > 0 && (
                            <span className={styles.driverCountBadge}>
                                {totalActiveDrivers}
                            </span>
                        )}
                    </div>
                    <button
                        className={styles.refreshBtn}
                        onClick={onRefresh}
                        disabled={isLoading}
                        aria-label="Refresh drivers"
                    >
                        <span
                            className={`material-symbols-outlined ${isLoading ? styles.spin : ''}`}
                        >
                            sync
                        </span>
                    </button>
                </div>

                {/* Search */}
                <div className={styles.searchBox}>
                    <span className={`material-symbols-outlined ${styles.searchIcon}`}>
                        search
                    </span>
                    <input
                        type="text"
                        value={searchInputValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search drivers..."
                        aria-label="Search drivers"
                    />
                    {searchInputValue && (
                        <button
                            className={styles.clearBtn}
                            onClick={() => onSearchChange('')}
                            aria-label="Clear search"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    )}
                </div>

                {/* Driver List Wrapper */}
                <div className={styles.driverListWrapper}>
                    {/* Loading State */}
                    {isLoading && (
                        <div className={styles.stateContainer}>
                            <CircularProgress size={36} />
                            <span className={styles.stateText}>Loading drivers...</span>
                        </div>
                    )}

                    {/* No Drivers State */}
                    {!isLoading && drivers.length === 0 && (
                        <div className={styles.stateContainer}>
                            <span className={`material-symbols-outlined ${styles.stateIcon}`}>
                                person_off
                            </span>
                            <span className={styles.stateText}>No active drivers</span>
                        </div>
                    )}

                    {/* No Search Results State */}
                    {!isLoading &&
                        drivers.length > 0 &&
                        filteredDrivers.length === 0 && (
                            <div className={styles.stateContainer}>
                                <span
                                    className={`material-symbols-outlined ${styles.stateIcon}`}
                                >
                                    search_off
                                </span>
                                <span className={styles.stateText}>No matches found</span>
                            </div>
                        )}

                    {/* Driver List */}
                    {!isLoading && filteredDrivers.length > 0 && (
                        <div className={styles.driverList}>
                            {filteredDrivers.map((driver) => (
                                <DriverListItem
                                    key={driver.courierId}
                                    driver={driver}
                                    onClick={() => onDriverClick(driver)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle Button */}
            <button
                className={styles.toggleBtn}
                onClick={onTogglePanel}
                aria-label="Toggle drivers panel"
            >
                <span
                    className={`material-symbols-outlined ${isPanelHidden ? styles.rotated : ''}`}
                >
                    chevron_right
                </span>
            </button>
        </div>
    );
}
