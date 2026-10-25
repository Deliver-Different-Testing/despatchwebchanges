import {act, renderHook} from '@testing-library/react';
import {useDashboardSettings} from './useDashboardSettings';
import {getPreference, savePreference} from '../api/preferencesApi';
import {toastService} from '../services/toastService';

jest.mock('../api/preferencesApi', () => ({getPreference: jest.fn(), savePreference: jest.fn()}));
jest.mock('../services/toastService', () => ({
    toastService: {showSuccessToast: jest.fn(), showErrorToast: jest.fn(), showInfoToast: jest.fn()},
}));

const KEYS = {jobs: 'jobsKey', driverLocations: 'driverKey', tasks: 'tasksKey'};

function setup(overrides: Partial<Parameters<typeof useDashboardSettings>[0]> = {}, result: unknown = null) {
    const open = jest.fn().mockResolvedValue(result);
    const onRefreshIntervals = jest.fn();
    const onCourierDisplayMode = jest.fn();
    const hook = renderHook(() => useDashboardSettings({
        title: 'Dispatch Dashboard Settings',
        intervalKeys: KEYS,
        showCourierDisplayMode: true,
        isUsCustomer: false,
        onRefreshIntervals,
        onCourierDisplayMode,
        openDialog: async () => ({open}) as never,
        ...overrides,
    }));
    return {open, onRefreshIntervals, onCourierDisplayMode, hook};
}

describe('useDashboardSettings', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        (getPreference as jest.Mock).mockResolvedValue(null);
    });

    it('seeds the dialog (task interval inherits jobs on first run, courier mode defaults by region)', async () => {
        localStorage.setItem(KEYS.jobs, '30');
        localStorage.setItem(KEYS.driverLocations, 'junk');
        const {open, hook} = setup();

        await act(() => hook.result.current.openSettings());

        expect(open).toHaveBeenCalledWith(
            {
                title: 'Dispatch Dashboard Settings',
                showRefreshInterval: true,
                showDriverLocationRefresh: true,
                showTaskRefresh: true,
                taskRefreshFollowsJobList: true,
                showCourierDisplayMode: true,
            },
            {id: 30, text: ''},
            {id: 0, text: ''},
            {id: 30, text: ''},
            'number',
        );
    });

    it('persists results, applies ms intervals and courier mode', async () => {
        const {onRefreshIntervals, onCourierDisplayMode, hook} = setup({}, {
            selectedRefreshInterval: {id: 60, text: ''},
            selectedDriverLocationRefreshInterval: {id: 0, text: ''},
            selectedTaskRefreshInterval: {id: 15, text: ''},
            courierDisplayMode: 'name',
        });

        await act(() => hook.result.current.openSettings());

        expect(localStorage.getItem(KEYS.jobs)).toBe('60');
        expect(localStorage.getItem(KEYS.driverLocations)).toBe('0');
        expect(localStorage.getItem(KEYS.tasks)).toBe('15');
        expect(onRefreshIntervals).toHaveBeenCalledWith({jobsMs: 60000, driverLocationsMs: false, tasksMs: 15000});
        expect(savePreference).toHaveBeenCalledWith('DispatchCourierDisplayMode', '"name"');
        expect(onCourierDisplayMode).toHaveBeenCalledWith('name');
    });

    it('does nothing when the dialog is cancelled', async () => {
        const {onRefreshIntervals, hook} = setup();
        await act(() => hook.result.current.openSettings());
        expect(onRefreshIntervals).not.toHaveBeenCalled();
        expect(localStorage.length).toBe(0);
    });

    it('supports the single-interval variant with a success toast and no courier mode', async () => {
        const {open, onRefreshIntervals, hook} = setup(
            {
                title: 'Nationwide Dashboard Settings',
                intervalKeys: {jobs: 'nwKey'},
                showCourierDisplayMode: false,
                successMessage: 'Settings saved and applied successfully',
            },
            {selectedRefreshInterval: {id: 120, text: ''}},
        );

        await act(() => hook.result.current.openSettings());

        expect(open.mock.calls[0]).toEqual([
            {
                title: 'Nationwide Dashboard Settings',
                showRefreshInterval: true,
                showDriverLocationRefresh: false,
                showTaskRefresh: false,
                showCourierDisplayMode: false,
            },
            {id: 0, text: ''},
            undefined,
            undefined,
            undefined,
        ]);
        expect(getPreference).not.toHaveBeenCalled();
        expect(onRefreshIntervals).toHaveBeenCalledWith({jobsMs: 120000, driverLocationsMs: false, tasksMs: false});
        expect(toastService.showSuccessToast).toHaveBeenCalledWith('Settings saved and applied successfully');
    });

    describe('Tasks interval on save', () => {
        type Option = {id: number; text: string};

        /** Mirrors the real dialog: it starts from the seeds and leaves out a Tasks that follows the job list. */
        function saveWith(changes: {jobs?: number; tasks?: number} = {}) {
            const onRefreshIntervals = jest.fn();
            const open = jest.fn(async (
                config: {taskRefreshFollowsJobList?: boolean}, jobs: Option, driver: Option, tasks: Option,
            ) => ({
                selectedRefreshInterval: changes.jobs == null ? jobs : {id: changes.jobs, text: ''},
                selectedDriverLocationRefreshInterval: driver,
                ...(changes.tasks != null
                    ? {selectedTaskRefreshInterval: {id: changes.tasks, text: ''}}
                    : config.taskRefreshFollowsJobList ? {} : {selectedTaskRefreshInterval: tasks}),
                courierDisplayMode: 'off',
            }));
            const hook = renderHook(() => useDashboardSettings({
                title: 'Dispatch Dashboard Settings',
                intervalKeys: KEYS,
                showCourierDisplayMode: true,
                onRefreshIntervals,
                openDialog: async () => ({open}) as never,
            }));
            return {open, onRefreshIntervals, save: () => act(() => hook.result.current.openSettings())};
        }

        it('seeds Tasks with the default cadence the panel runs when the job list is Disabled', async () => {
            localStorage.setItem(KEYS.jobs, '0');
            const {open, save} = saveWith();
            await save();
            expect(open.mock.calls[0][3]).toEqual({id: 60, text: ''});
        });

        it('does not store Tasks when only the job list changed (Disabled → 60s)', async () => {
            localStorage.setItem(KEYS.jobs, '0');
            const {onRefreshIntervals, save} = saveWith({jobs: 60});
            await save();
            expect(localStorage.getItem(KEYS.jobs)).toBe('60');
            expect(localStorage.getItem(KEYS.tasks)).toBeNull();
            expect(onRefreshIntervals).toHaveBeenCalledWith(expect.objectContaining({tasksMs: 60000}));
        });

        it('does not store Tasks on an untouched save', async () => {
            localStorage.setItem(KEYS.jobs, '120');
            const {onRefreshIntervals, save} = saveWith();
            await save();
            expect(localStorage.getItem(KEYS.tasks)).toBeNull();
            expect(onRefreshIntervals).toHaveBeenCalledWith(expect.objectContaining({tasksMs: 120000}));
        });

        it('keeps inheriting the new job-list cadence after an untouched save', async () => {
            localStorage.setItem(KEYS.jobs, '120');
            await saveWith().save();
            const {onRefreshIntervals, save} = saveWith({jobs: 30});
            await save();
            expect(localStorage.getItem(KEYS.tasks)).toBeNull();
            expect(onRefreshIntervals).toHaveBeenCalledWith(expect.objectContaining({tasksMs: 30000}));
        });

        it('stores a deliberately chosen Disabled', async () => {
            localStorage.setItem(KEYS.jobs, '120');
            const {onRefreshIntervals, save} = saveWith({tasks: 0});
            await save();
            expect(localStorage.getItem(KEYS.tasks)).toBe('0');
            expect(onRefreshIntervals).toHaveBeenCalledWith(expect.objectContaining({tasksMs: false}));
        });

        it('keeps a stored Disabled through an untouched save', async () => {
            localStorage.setItem(KEYS.jobs, '60');
            localStorage.setItem(KEYS.tasks, '0');
            const {onRefreshIntervals, save} = saveWith();
            await save();
            expect(localStorage.getItem(KEYS.tasks)).toBe('0');
            expect(onRefreshIntervals).toHaveBeenCalledWith(expect.objectContaining({tasksMs: false}));
        });
    });

    it('toasts when the dialog bundle is missing', async () => {
        const {hook} = setup({openDialog: () => Promise.reject(new Error('bundle missing'))});
        await act(() => hook.result.current.openSettings());
        expect(toastService.showErrorToast).toHaveBeenCalledWith('Settings dialog is not loaded.');
    });
});
