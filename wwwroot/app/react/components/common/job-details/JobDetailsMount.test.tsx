import React from 'react';
import {act, render} from '@testing-library/react';
import {JobDetailsMount} from './JobDetailsMount';
import {refreshJobDetails} from './jobDetailsRefresh';
import type {MountJobDetailsConfig} from './JobDetails.types';

let mounts = 0;
let configs: MountJobDetailsConfig[] = [];

jest.mock('./JobDetails', () => {
    const R = require('react');
    return {
        JobDetails: ({config}: {config: MountJobDetailsConfig}) => {
            R.useEffect(() => {
                mounts++;
                return () => {
                    mounts--;
                };
            }, []);
            configs.push(config);
            return R.createElement('div', {'data-testid': 'panel'});
        },
    };
});

describe('JobDetailsMount', () => {
    const props = {
        jobId: 1,
        containerId: 'test-detail',
        isUsCustomer: false,
        showToast: jest.fn(),
    };
    const lastConfig = () => configs[configs.length - 1];

    beforeEach(() => {
        mounts = 0;
        configs = [];
    });

    it('renders the panel inside the themed container', () => {
        const {container, getByTestId} = render(<JobDetailsMount {...props}/>);
        const box = container.querySelector('#test-detail');
        expect(box).toContainElement(getByTestId('panel'));
        expect(box).toHaveStyle({backgroundColor: 'var(--mantine-color-gray-1)'});
        expect(lastConfig().jobId).toBe(1);
    });

    it('defaults isBulkJob to false and forwards it when set', () => {
        render(<JobDetailsMount {...props}/>);
        expect(lastConfig().isBulkJob).toBe(false);
        render(<JobDetailsMount {...props} containerId="bulk-detail" isBulkJob/>);
        expect(lastConfig().isBulkJob).toBe(true);
    });

    it('stays mounted across job and callback changes and unmounts only when leaving the tree', () => {
        const {rerender, unmount} = render(<JobDetailsMount {...props} onJobUpdate={() => undefined}/>);
        rerender(<JobDetailsMount {...props} jobId={2} onJobUpdate={() => undefined}/>);
        expect(lastConfig().jobId).toBe(2);
        expect(mounts).toBe(1);
        unmount();
        expect(mounts).toBe(0);
    });

    it('does not rebuild the config when only callback identities change', () => {
        const {rerender} = render(<JobDetailsMount {...props} onJobUpdate={() => undefined}/>);
        const first = lastConfig();
        rerender(<JobDetailsMount {...props} onJobUpdate={() => undefined}/>);
        expect(lastConfig()).toBe(first);
    });

    it('always calls through to the latest callbacks and tolerates none', () => {
        const first = jest.fn();
        const second = jest.fn();
        const {rerender} = render(<JobDetailsMount {...props} onRelatedJobChange={first}/>);
        rerender(<JobDetailsMount {...props} onRelatedJobChange={second}/>);
        lastConfig().onRelatedJobChange?.(99);
        expect(second).toHaveBeenCalledWith(99);
        expect(first).not.toHaveBeenCalled();

        rerender(<JobDetailsMount {...props}/>);
        expect(() => lastConfig().onJobUpdate?.()).not.toThrow();
    });

    it('passes a bumped _refreshNonce to the panel when a refresh is requested', async () => {
        render(<JobDetailsMount {...props}/>);
        const before = lastConfig()._refreshNonce;
        await act(async () => {
            await refreshJobDetails();
        });
        expect(lastConfig()._refreshNonce).toBe((before ?? 0) + 1);
    });
});
