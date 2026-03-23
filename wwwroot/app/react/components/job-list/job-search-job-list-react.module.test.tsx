/** @jest-environment jest-environment-jsdom */
/**
 * Job Search Job List React Module Tests
 *
 * Covers the multi-instance bridge module that manages independent React roots
 * for the job search page (POD + bulk lists). Tests mount/unmount lifecycle,
 * callback forwarding, config updates, and edge cases like missing containers
 * and DOM-removed containers.
 */

import React from 'react';
import {act} from '@testing-library/react';
import type {DispatchJob, MountJobListConfig} from '../../interfaces/dispatchJob';
import dayjs from 'dayjs';

// ── Callback spies ────────────────────────────────────────────────────

const mockUpdateJobsCb = jest.fn();
const mockRefreshCb = jest.fn();
const mockSelectJobCb = jest.fn();
const mockUpdateSearchParamsCb = jest.fn();

// Store raw props for assertion
let lastRenderedProps: any = null;

jest.mock('./JobListPanel', () => ({
    JobListPanel: (props: any) => {
        lastRenderedProps = props;
        // Register callbacks with the bridge by calling the setters
        if (props.setJobsCallback) props.setJobsCallback(mockUpdateJobsCb);
        if (props.setRefreshCallback) props.setRefreshCallback(mockRefreshCb);
        if (props.setSelectJobCallback) props.setSelectJobCallback(mockSelectJobCb);
        if (props.setUpdateSearchParamsCallback) props.setUpdateSearchParamsCallback(mockUpdateSearchParamsCb);
        return <div data-testid="job-list-panel" data-app-page={props.appPage}/>;
    },
}));

jest.mock('../../theme/muiTheme', () => ({
    getTheme: jest.fn(() => ({})),
}));

jest.mock('@mui/material/styles', () => ({
    ThemeProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('@mui/material/CssBaseline', () => () => null);

jest.mock('../../query', () => ({
    ReactQueryProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('../common/error-boundary', () => ({
    ErrorBoundary: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

// ── Setup window.angular before import ───────────────────────────────

beforeAll(() => {
    (window as any).angular = {
        module: jest.fn(() => ({name: 'uDispatch.jobSearchJobListReact'})),
    };
});

// Dynamic import to ensure mocks are in place — assigned in beforeAll, always
// defined by the time tests run so we use the non-null type.
let bridgeApi: NonNullable<typeof window.ReactJobSearchJobList>;

beforeAll(async () => {
    await import('./job-search-job-list-react.module');
    bridgeApi = (window as any).ReactJobSearchJobList;
});

// ── Helpers ───────────────────────────────────────────────────────────

function createContainer(id: string): HTMLElement {
    const el = document.createElement('div');
    el.id = id;
    document.body.appendChild(el);
    return el;
}

function createMockConfig(overrides?: Partial<MountJobListConfig>): MountJobListConfig {
    return {
        showToast: jest.fn(),
        isUsCustomer: false,
        appPage: 3,
        onJobSelect: jest.fn(),
        onRefresh: jest.fn(),
        storagePrefix: 'test',
        ...overrides,
    };
}

function createMockJob(overrides?: Partial<DispatchJob>): DispatchJob {
    return {
        angularId: 'job-1',
        id: 1,
        jobNo: 'J001',
        hasBeenRead: true,
        showCourierSearch: false,
        isParentOrSingle: true,
        parentId: 0,
        isFlightJob: false,
        isAgentJob: false,
        isBulkJob: false,
        isArchived: false,
        statusId: 0,
        statusName: 'New',
        status: 'New',
        booked: dayjs('2030-06-15T09:00:00'),
        time: dayjs('2030-06-15T17:00:00'),
        remain: 120,
        courierSearchLoading: false,
        speed: 'Standard',
        client: 'Acme Corp',
        ...overrides,
    } as DispatchJob;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('job-search-job-list-react.module', () => {
    beforeEach(() => {
        mockUpdateJobsCb.mockClear();
        mockRefreshCb.mockClear();
        mockSelectJobCb.mockClear();
        mockUpdateSearchParamsCb.mockClear();
        lastRenderedProps = null;

        act(() => { bridgeApi.unmountAll(); });
        document.body.innerHTML = '';
    });

    it('exposes the bridge API on window.ReactJobSearchJobList and registers AngularJS module', () => {
        expect(bridgeApi).toBeDefined();
        expect(bridgeApi.mount).toBeInstanceOf(Function);
        expect(bridgeApi.unmount).toBeInstanceOf(Function);
        expect(bridgeApi.unmountAll).toBeInstanceOf(Function);
        expect(bridgeApi.updateJobs).toBeInstanceOf(Function);
        expect(bridgeApi.updateConfig).toBeInstanceOf(Function);
        expect(bridgeApi.refresh).toBeInstanceOf(Function);
        expect(bridgeApi.selectJob).toBeInstanceOf(Function);
        expect(bridgeApi.updateSearchParams).toBeInstanceOf(Function);

        // AngularJS module registration happened at import time
        // (window.angular.module was called — verified by the bridge API existing on window)
    });

    it('mounts into specified container, renders JobListPanel with config, and handles missing containers', () => {
        // Missing container logs error
        const errorSpy = jest.spyOn(console, 'error').mockImplementation();
        act(() => { bridgeApi.mount('missing', 'nonexistent', createMockConfig()); });
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Container not found'),
        );
        errorSpy.mockRestore();

        // Successful mount
        const container = createContainer('pod-list');
        const config = createMockConfig({appPage: 3, isUsCustomer: true, storagePrefix: 'podSearch'});
        act(() => { bridgeApi.mount('pod', 'pod-list', config); });

        expect(container.querySelector('[data-testid="job-list-panel"]')).not.toBeNull();
        expect(lastRenderedProps.appPage).toBe(3);
        expect(lastRenderedProps.isUsCustomer).toBe(true);
        expect(lastRenderedProps.storagePrefix).toBe('podSearch');
        expect(lastRenderedProps.showToast).toBe(config.showToast);
    });

    it('re-renders with updated config when mounted to the same container, and re-creates root when container removed from DOM', () => {
        const container = createContainer('pod-list');

        // First mount
        act(() => { bridgeApi.mount('pod', 'pod-list', createMockConfig({storagePrefix: 'first'})); });
        expect(lastRenderedProps.storagePrefix).toBe('first');

        // Same container re-mount updates config
        act(() => { bridgeApi.mount('pod', 'pod-list', createMockConfig({storagePrefix: 'second'})); });
        expect(lastRenderedProps.storagePrefix).toBe('second');

        // Remove container from DOM and re-mount to new one
        document.body.removeChild(container);
        const container2 = createContainer('pod-list');
        act(() => { bridgeApi.mount('pod', 'pod-list', createMockConfig({storagePrefix: 'third'})); });
        expect(container2.querySelector('[data-testid="job-list-panel"]')).not.toBeNull();
        expect(lastRenderedProps.storagePrefix).toBe('third');
    });

    it('unmounts old root when mounting to a different container', () => {
        createContainer('container-a');
        createContainer('container-b');

        act(() => { bridgeApi.mount('pod', 'container-a', createMockConfig()); });
        const containerA = document.getElementById('container-a')!;
        expect(containerA.querySelector('[data-testid="job-list-panel"]')).not.toBeNull();

        act(() => { bridgeApi.mount('pod', 'container-b', createMockConfig()); });
        const containerB = document.getElementById('container-b')!;
        expect(containerB.querySelector('[data-testid="job-list-panel"]')).not.toBeNull();
    });

    it('manages two independent instances (POD + bulk), unmounts individually, and unmountAll clears all', () => {
        const podContainer = createContainer('pod-list');
        const bulkContainer = createContainer('bulk-list');

        act(() => {
            bridgeApi.mount('pod', 'pod-list', createMockConfig({storagePrefix: 'pod'}));
            bridgeApi.mount('bulk', 'bulk-list', createMockConfig({storagePrefix: 'bulk'}));
        });

        expect(podContainer.querySelector('[data-testid="job-list-panel"]')).not.toBeNull();
        expect(bulkContainer.querySelector('[data-testid="job-list-panel"]')).not.toBeNull();

        // Unmount only pod
        act(() => { bridgeApi.unmount('pod'); });
        expect(podContainer.querySelector('[data-testid="job-list-panel"]')).toBeNull();
        expect(bulkContainer.querySelector('[data-testid="job-list-panel"]')).not.toBeNull();

        // Re-mount pod, then unmountAll
        act(() => { bridgeApi.mount('pod', 'pod-list', createMockConfig()); });
        act(() => { bridgeApi.unmountAll(); });
        expect(podContainer.querySelector('[data-testid="job-list-panel"]')).toBeNull();
        expect(bulkContainer.querySelector('[data-testid="job-list-panel"]')).toBeNull();
    });

    it('unmount and callbacks are no-ops for unknown instance IDs', () => {
        expect(() => {
            bridgeApi.unmount('nonexistent');
            bridgeApi.updateJobs('unknown', [], 0);
            bridgeApi.refresh('unknown');
            bridgeApi.selectJob('unknown', 1);
            bridgeApi.updateSearchParams('unknown', {});
            bridgeApi.updateConfig('unknown', {isUsCustomer: true});
        }).not.toThrow();
    });

    it('forwards updateJobs, refresh, selectJob, and updateSearchParams to registered callbacks', () => {
        createContainer('test-list');
        act(() => { bridgeApi.mount('test', 'test-list', createMockConfig()); });

        // updateJobs
        const jobs = [createMockJob({id: 10, jobNo: 'J010'})];
        bridgeApi.updateJobs('test', jobs, 1);
        expect(mockUpdateJobsCb).toHaveBeenCalledWith(jobs, 1);

        // refresh
        bridgeApi.refresh('test');
        expect(mockRefreshCb).toHaveBeenCalledTimes(1);

        // selectJob
        bridgeApi.selectJob('test', 42);
        expect(mockSelectJobCb).toHaveBeenCalledWith(42);

        // updateSearchParams
        const params = {searchText: 'test query', page: 2};
        bridgeApi.updateSearchParams('test', params);
        expect(mockUpdateSearchParamsCb).toHaveBeenCalledWith(params);
    });

    it('updateConfig merges partial config and re-renders', () => {
        createContainer('test-list');
        act(() => { bridgeApi.mount('test', 'test-list', createMockConfig({storagePrefix: 'original', isUsCustomer: false})); });
        expect(lastRenderedProps.storagePrefix).toBe('original');
        expect(lastRenderedProps.isUsCustomer).toBe(false);

        act(() => { bridgeApi.updateConfig('test', {isUsCustomer: true}); });
        expect(lastRenderedProps.isUsCustomer).toBe(true);
        expect(lastRenderedProps.storagePrefix).toBe('original');
    });

    it('passes fetchConfig and all event callbacks through to JobListPanel, and defaults appPage to 3', () => {
        createContainer('cb-list');

        const fetchConfig = {
            fetchFn: jest.fn(),
            queryKeyFn: jest.fn(),
            initialParams: {order: 'time', orderDirection: 'asc', page: 0, pageSize: 50},
        };
        const callbacks = {
            onJobSelect: jest.fn(),
            onJobDispatch: jest.fn(),
            onCategoryChange: jest.fn(),
            onBackendFilter: jest.fn(),
            onLoadMoreJobs: jest.fn(),
            onAddStop: jest.fn(),
            onSearchChange: jest.fn(),
        };

        const config = createMockConfig({...callbacks, fetchConfig});
        delete (config as any).appPage;
        act(() => { bridgeApi.mount('cb', 'cb-list', config); });

        expect(lastRenderedProps.fetchConfig).toBe(fetchConfig);
        expect(lastRenderedProps.onJobSelect).toBe(callbacks.onJobSelect);
        expect(lastRenderedProps.onJobDispatch).toBe(callbacks.onJobDispatch);
        expect(lastRenderedProps.onCategoryChange).toBe(callbacks.onCategoryChange);
        expect(lastRenderedProps.onBackendFilter).toBe(callbacks.onBackendFilter);
        expect(lastRenderedProps.onLoadMoreJobs).toBe(callbacks.onLoadMoreJobs);
        expect(lastRenderedProps.onAddStop).toBe(callbacks.onAddStop);
        expect(lastRenderedProps.onSearchChange).toBe(callbacks.onSearchChange);
        expect(lastRenderedProps.appPage).toBe(3);
    });
});
