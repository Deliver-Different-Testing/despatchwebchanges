/**
 * Job list bridge
 *
 * Four AngularJS entry points mount the same `JobListPanel`: dispatch, current work,
 * job search (main + bulk) and nationwide (three lists). Each carried its own copy of the
 * mount bookkeeping and of the 20-prop panel render, which had already drifted — only some
 * of them re-created the root after AngularJS tore the container out of the DOM.
 *
 * This owns the bookkeeping once, keyed by instance id, so a caller with one list and a
 * caller with three share the same lifecycle.
 */

import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {JobListPanel} from './JobListPanel';
import {islandTree} from '../../theme/DfrntMantineProvider';
import type {DispatchJob, MountJobListConfig, JobListSearchParams} from '../../interfaces';
import {ErrorBoundary} from '../common/error-boundary';

interface JobListInstance {
    root: Root;
    container: HTMLElement;
    config: MountJobListConfig;
    updateJobsCallback: ((jobs: DispatchJob[], totalCount: number) => void) | null;
    refreshCallback: (() => void) | null;
    selectJobCallback: ((jobId: number) => void) | null;
    updateSearchParamsCallback: ((params: Partial<JobListSearchParams>) => void) | null;
}

export interface JobListBridgeOptions {
    /** Log prefix, e.g. 'JobSearchJobListReact'. */
    logName: string;
    /** Page the panel defaults to when the caller does not name one. */
    defaultAppPage: number;
    /** localStorage prefix the panel defaults to when the caller does not name one. */
    defaultStoragePrefix?: string;
    /** Hide the "logged in only" switch unless the caller says otherwise. */
    defaultHideLoggedInSwitch?: boolean;
}

export interface JobListBridge {
    mount(instanceId: string, containerId: string, config: MountJobListConfig): void;
    unmount(instanceId: string): void;
    unmountAll(): void;
    updateJobs(instanceId: string, jobs: DispatchJob[], totalCount: number): void;
    updateConfig(instanceId: string, config: Partial<MountJobListConfig>): void;
    refresh(instanceId: string): void;
    selectJob(instanceId: string, jobId: number): void;
    updateSearchParams(instanceId: string, params: Partial<JobListSearchParams>): void;
}

export function createJobListBridge(options: JobListBridgeOptions): JobListBridge {
    const {logName, defaultAppPage, defaultStoragePrefix, defaultHideLoggedInSwitch} = options;
    const instances = new Map<string, JobListInstance>();

    function renderInstance(instance: JobListInstance): void {
        const {config} = instance;

        // ErrorBoundary is a shared MUI leaf still rendered by unmigrated islands.
        instance.root.render(islandTree(
            <ErrorBoundary>
                <JobListPanel
                    showToast={config.showToast}
                    isUsCustomer={config.isUsCustomer}
                    appPage={config.appPage ?? defaultAppPage}
                    onJobSelect={config.onJobSelect}
                    onJobDispatch={config.onJobDispatch}
                    onRefresh={config.onRefresh}
                    onSearchChange={config.onSearchChange}
                    onCategoryChange={config.onCategoryChange}
                    onBackendFilter={config.onBackendFilter}
                    onLoadMoreJobs={config.onLoadMoreJobs}
                    onAddStop={config.onAddStop}
                    onJobsLoaded={config.onJobsLoaded}
                    defaultCategory={config.defaultCategory}
                    storagePrefix={config.storagePrefix ?? defaultStoragePrefix}
                    hideLoggedInSwitch={config.hideLoggedInSwitch ?? defaultHideLoggedInSwitch}
                    fetchConfig={config.fetchConfig}
                    setJobsCallback={(cb) => {
                        instance.updateJobsCallback = cb;
                    }}
                    setRefreshCallback={(cb) => {
                        instance.refreshCallback = cb;
                    }}
                    setSelectJobCallback={(cb) => {
                        instance.selectJobCallback = cb;
                    }}
                    setUpdateSearchParamsCallback={(cb) => {
                        instance.updateSearchParamsCallback = cb;
                    }}
                />
            </ErrorBoundary>
        ));
    }

    return {
        mount(instanceId, containerId, config) {
            console.log(`[${logName}] Mounting instance '${instanceId}' to container:`, containerId);

            const existing = instances.get(instanceId);
            if (existing) {
                if (!document.contains(existing.container)) {
                    // AngularJS tore the container out from under us — the old root is dead.
                    console.log(`[${logName}] Container for '${instanceId}' removed from DOM, re-creating root`);
                    existing.root.unmount();
                    instances.delete(instanceId);
                } else if (existing.container.id === containerId) {
                    existing.config = config;
                    renderInstance(existing);
                    return;
                } else {
                    existing.root.unmount();
                    instances.delete(instanceId);
                }
            }

            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`[${logName}] Container not found: ${containerId}`);
                return;
            }

            const instance: JobListInstance = {
                root: createRoot(container),
                container,
                config,
                updateJobsCallback: null,
                refreshCallback: null,
                selectJobCallback: null,
                updateSearchParamsCallback: null,
            };

            instances.set(instanceId, instance);
            renderInstance(instance);
            console.log(`[${logName}] Instance '${instanceId}' mounted`);
        },

        unmount(instanceId) {
            const instance = instances.get(instanceId);
            if (!instance) return;

            console.log(`[${logName}] Unmounting instance '${instanceId}'`);
            instance.root.unmount();
            instances.delete(instanceId);
        },

        unmountAll() {
            console.log(`[${logName}] Unmounting all instances (${instances.size})`);
            for (const instance of instances.values()) {
                instance.root.unmount();
            }
            instances.clear();
        },

        updateJobs(instanceId, jobs, totalCount) {
            instances.get(instanceId)?.updateJobsCallback?.(jobs, totalCount);
        },

        updateConfig(instanceId, config) {
            const instance = instances.get(instanceId);
            if (!instance) return;

            instance.config = {...instance.config, ...config};
            renderInstance(instance);
        },

        refresh(instanceId) {
            instances.get(instanceId)?.refreshCallback?.();
        },

        selectJob(instanceId, jobId) {
            instances.get(instanceId)?.selectJobCallback?.(jobId);
        },

        updateSearchParams(instanceId, params) {
            instances.get(instanceId)?.updateSearchParamsCallback?.(params);
        },
    };
}
