/**
 * DriverListItem Component
 *
 * Individual driver row in the drivers panel with avatar,
 * name, code, and job count.
 */

import React from 'react';
import type { DriverListItemProps } from '../CourierMapPage.types';
import { AVATAR_COLORS } from '../CourierMapPage.types';
import styles from '../CourierMapPage.module.css';

/**
 * Get a consistent color based on courier ID
 */
function getDriverColor(courierId: number): string {
    return AVATAR_COLORS[courierId % AVATAR_COLORS.length];
}

/**
 * Get initials from driver name
 */
function getDriverInitials(name: string | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function DriverListItem({ driver, onClick }: DriverListItemProps) {
    const avatarColor = getDriverColor(driver.courierId);
    const initials = getDriverInitials(driver.courierName);

    return (
        <div className={styles.driverRow} onClick={onClick}>
            <div
                className={styles.driverAvatar}
                style={{ backgroundColor: avatarColor }}
            >
                {initials}
            </div>
            <div className={styles.driverInfo}>
                <div className={styles.driverName}>{driver.courierName}</div>
                <div className={styles.driverMeta}>
                    {driver.code && (
                        <span className={styles.driverCode}>{driver.code}</span>
                    )}
                    {driver.totalJobs > 0 && (
                        <span className={styles.driverJobs}>
                            <span className="material-symbols-outlined">work</span>
                            {driver.totalJobs} {driver.totalJobs === 1 ? 'job' : 'jobs'}
                        </span>
                    )}
                </div>
            </div>
            <span className={`material-symbols-outlined ${styles.locateBtn}`}>
                near_me
            </span>
        </div>
    );
}
