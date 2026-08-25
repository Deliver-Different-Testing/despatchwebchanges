/**
 * jobListBridge tests
 *
 * The bookkeeping the four AngularJS job-list entry points share: one root per instance id,
 * re-created when AngularJS removes the container, reused when the same container is mounted
 * again, and the callbacks the panel hands back so AngularJS can push data into it.
 */

import React from 'react';
import {act} from '@testing-library/react';
import type {MountJobListConfig} from '../../interfaces';
import {createJobListBridge} from './jobListBridge';

const panelProps: Record<string, unknown>[] = [];

jest.mock('./JobListPanel', () => ({
    JobListPanel: (props: Record<string, unknown>) => {
        panelProps.push(props);
        (props.setJobsCallback as (cb: unknown) => void)?.(jest.fn());
        (props.setRefreshCallback as (cb: unknown) => void)?.(jest.fn());
        return <div data-testid="panel">{String(props.appPage)}</div>;
    },
}));

function container(id: string): HTMLElement {
    const element = document.createElement('div');
    element.id = id;
    document.body.appendChild(element);
    return element;
}

const config = {isUsCustomer: false} as MountJobListConfig;

describe('createJobListBridge', () => {
    let bridge: ReturnType<typeof createJobListBridge>;

    beforeEach(() => {
        panelProps.length = 0;
        document.body.innerHTML = '';
        jest.spyOn(console, 'log').mockImplementation(() => undefined);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);
        bridge = createJobListBridge({logName: 'ProbeList', defaultAppPage: 3});
    });

    afterEach(() => {
        act(() => bridge.unmountAll());
        jest.restoreAllMocks();
    });

    it('mounts an instance and falls back to the configured app page', () => {
        const host = container('list-a');

        act(() => bridge.mount('main', 'list-a', config));

        expect(host).toHaveTextContent('3');
        expect(panelProps.at(-1)?.appPage).toBe(3);
    });

    it('keeps the caller app page when one is given', () => {
        container('list-a');

        act(() => bridge.mount('main', 'list-a', {...config, appPage: 1}));

        expect(panelProps.at(-1)?.appPage).toBe(1);
    });

    it('runs two instances side by side', () => {
        const first = container('list-a');
        const second = container('list-b');

        act(() => bridge.mount('main', 'list-a', config));
        act(() => bridge.mount('bulk', 'list-b', config));

        expect(first).toHaveTextContent('3');
        expect(second).toHaveTextContent('3');
    });

    it('re-renders in place when the same instance is mounted into the same container', () => {
        container('list-a');
        act(() => bridge.mount('main', 'list-a', config));
        const renders = panelProps.length;

        act(() => bridge.mount('main', 'list-a', {...config, appPage: 2}));

        expect(panelProps.length).toBeGreaterThan(renders);
        expect(panelProps.at(-1)?.appPage).toBe(2);
    });

    it('re-creates the root when AngularJS has removed the container', () => {
        container('list-a').remove();
        act(() => bridge.mount('main', 'list-a', config));
        expect(panelProps).toHaveLength(0);

        const replacement = container('list-a');
        act(() => bridge.mount('main', 'list-a', config));

        expect(replacement).toHaveTextContent('3');
    });

    it('does nothing when the container is missing', () => {
        act(() => bridge.mount('main', 'nowhere', config));

        expect(panelProps).toHaveLength(0);
        expect(console.error).toHaveBeenCalledWith('[ProbeList] Container not found: nowhere');
    });

    it('pushes jobs and refreshes through the callbacks the panel registered', () => {
        container('list-a');
        act(() => bridge.mount('main', 'list-a', config));
        expect(() => {
            bridge.updateJobs('main', [], 0);
            bridge.refresh('main');
            bridge.selectJob('main', 1);
            bridge.updateSearchParams('main', {});
        }).not.toThrow();

        // Unknown instances are simply ignored rather than throwing.
        expect(() => bridge.refresh('missing')).not.toThrow();
    });

    it('empties every container on unmountAll', () => {
        const first = container('list-a');
        const second = container('list-b');
        act(() => bridge.mount('main', 'list-a', config));
        act(() => bridge.mount('bulk', 'list-b', config));

        act(() => bridge.unmountAll());

        expect(first).toBeEmptyDOMElement();
        expect(second).toBeEmptyDOMElement();
    });
});
