import {useCallback} from 'react';
import {getPreference, savePreference} from '../api/preferencesApi';
import {StaffPreferenceKey} from '../types/enums/staff-preference-key.enum';
import {defaultCourierDisplayMode, type CourierDisplayMode} from '../pages/dispatch/lib/courierDisplayMode';
import {loadDialog, requireDialog, type DialogLoader} from '../components/dialogs/dialogRegistry';
import {toastService} from '../services/toastService';

export interface RefreshIntervals {
    jobsMs: number | false;
    driverLocationsMs: number | false;
    tasksMs: number | false;
}

export interface UseDashboardSettingsOptions {
    title: string;
    /** localStorage keys (seconds). A setting is shown in the dialog only when its key is given. */
    intervalKeys: {jobs?: string; driverLocations?: string; tasks?: string};
    /** Shows the courier display mode picker (dispatch only). */
    showCourierDisplayMode?: boolean;
    isUsCustomer?: boolean;
    /** Overrides how the stored jobs interval is read (e.g. snapping to the offered options). */
    readJobsSeconds?: (raw: string | null) => number;
    /** Toast shown after a successful save. */
    successMessage?: string;
    onRefreshIntervals?: (intervals: RefreshIntervals) => void;
    onCourierDisplayMode?: (mode: CourierDisplayMode) => void;
    openDialog?: DialogLoader;
}

const toMs = (secs?: number): number | false => (secs && secs > 0 ? secs * 1000 : false);

function readSeconds(key: string): number {
    const raw = localStorage.getItem(key);
    const n = raw == null ? 0 : parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function useDashboardSettings(options: UseDashboardSettingsOptions): {openSettings: () => Promise<void>} {
    const {
        title, intervalKeys, showCourierDisplayMode, isUsCustomer = false, readJobsSeconds,
        successMessage, onRefreshIntervals, onCourierDisplayMode, openDialog = loadDialog,
    } = options;
    const {jobs, driverLocations, tasks} = intervalKeys;

    const openSettings = useCallback(async () => {
        const dialog = await requireDialog('DashboardSettings', openDialog);
        if (!dialog) return;

        const jobsSeconds = jobs
            ? (readJobsSeconds ? readJobsSeconds(localStorage.getItem(jobs)) : readSeconds(jobs))
            : 0;
        // First run: Tasks inherits the job-list cadence so the dialog shows what the panel is doing.
        const tasksSeconds = !tasks
            ? 0
            : localStorage.getItem(tasks) != null ? readSeconds(tasks) : (jobs ? readSeconds(jobs) : 0);

        const seedCourierDisplayMode = async (): Promise<CourierDisplayMode> => {
            try {
                const raw = await getPreference(StaffPreferenceKey.DispatchCourierDisplayMode);
                return raw ? (JSON.parse(raw) as CourierDisplayMode) : defaultCourierDisplayMode(isUsCustomer);
            } catch (err) {
                console.error('[settings] failed to load courier display mode preference', err);
                return defaultCourierDisplayMode(isUsCustomer);
            }
        };

        try {
            const result = await dialog.open(
                {
                    title,
                    showRefreshInterval: !!jobs,
                    showDriverLocationRefresh: !!driverLocations,
                    showTaskRefresh: !!tasks,
                    showCourierDisplayMode: !!showCourierDisplayMode,
                },
                jobs ? {id: jobsSeconds, text: ''} : undefined,
                driverLocations ? {id: readSeconds(driverLocations), text: ''} : undefined,
                tasks ? {id: tasksSeconds, text: ''} : undefined,
                showCourierDisplayMode ? await seedCourierDisplayMode() : undefined,
            );
            if (!result) return;

            const persist = (key: string | undefined, interval?: {id: number}) => {
                if (key && interval) localStorage.setItem(key, String(interval.id));
            };
            persist(jobs, result.selectedRefreshInterval);
            persist(driverLocations, result.selectedDriverLocationRefreshInterval);
            persist(tasks, result.selectedTaskRefreshInterval);

            if (result.selectedRefreshInterval || result.selectedDriverLocationRefreshInterval
                || result.selectedTaskRefreshInterval) {
                onRefreshIntervals?.({
                    jobsMs: toMs(result.selectedRefreshInterval?.id),
                    driverLocationsMs: toMs(result.selectedDriverLocationRefreshInterval?.id),
                    tasksMs: toMs(result.selectedTaskRefreshInterval?.id),
                });
            }

            if (showCourierDisplayMode && result.courierDisplayMode) {
                await savePreference(
                    StaffPreferenceKey.DispatchCourierDisplayMode,
                    JSON.stringify(result.courierDisplayMode),
                );
                onCourierDisplayMode?.(result.courierDisplayMode);
            }

            if (successMessage) toastService.showSuccessToast(successMessage);
        } catch (err) {
            console.error('[settings] dashboard settings dialog error', err);
        }
    }, [title, jobs, driverLocations, tasks, showCourierDisplayMode, isUsCustomer, readJobsSeconds,
        successMessage, onRefreshIntervals, onCourierDisplayMode, openDialog]);

    return {openSettings};
}
