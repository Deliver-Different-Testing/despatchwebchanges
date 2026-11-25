/**
 * Minimum-hourly-top-up helpers for the driver lists. The server sends only "behind by" and the time today's minimum
 * paid block ends; the window in which to warn is evaluated here against the tenant's wall clock so the alert appears
 * and clears without a reload.
 */

import {useEffect, useState} from 'react';
import {tenantNow} from '../../../utils/dateUtils';

/** The three top-up fields, as carried by both the clear-list courier and the map's driver position. */
export interface TopUpFields {
    earningsBehindBy?: number | null;
    minimumEndsAt?: string | null;
    minimumAlertMinutes?: number | null;
}

const TICK_MS = 30_000;

/** Wall-clock "YYYY-MM-DDTHH:mm" read as if UTC, so two wall-clock strings subtract without any zone maths. */
function wallClockMs(value: string): number {
    return Date.parse(`${value.slice(0, 19)}Z`);
}

function tenantWallClockNow(): number {
    return wallClockMs(tenantNow().format('YYYY-MM-DDTHH:mm:ss'));
}

/** Minutes until the driver's minimum shift ends, only while inside the warning window; otherwise null. */
export function minutesUntilMinimumEnds(courier: TopUpFields | undefined, nowMs: number): number | null {
    if (!courier?.minimumEndsAt || courier.minimumAlertMinutes == null) {
        return null;
    }
    const minutes = Math.ceil((wallClockMs(courier.minimumEndsAt) - nowMs) / 60_000);
    return minutes > 0 && minutes <= courier.minimumAlertMinutes ? minutes : null;
}

export function isBehind(courier: TopUpFields | undefined): boolean {
    return (courier?.earningsBehindBy ?? 0) > 0;
}

/** "11:35" from a wall-clock ISO string. */
export function formatMinimumEnd(minimumEndsAt: string): string {
    return minimumEndsAt.slice(11, 16);
}

export type DriverAlertFilter = 'behind' | 'minimum' | null;

/** Tenant wall-clock "now" in ms, refreshed on a timer so alerts appear and clear without a reload. */
export function useTenantNowMs(enabled = true): number {
    const [nowMs, setNowMs] = useState(() => tenantWallClockNow());
    useEffect(() => {
        if (!enabled) {
            return;
        }
        setNowMs(tenantWallClockNow());
        const id = window.setInterval(() => setNowMs(tenantWallClockNow()), TICK_MS);
        return () => window.clearInterval(id);
    }, [enabled]);
    return nowMs;
}
