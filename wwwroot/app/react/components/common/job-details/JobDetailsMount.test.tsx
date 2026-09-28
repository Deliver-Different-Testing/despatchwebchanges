import React from 'react';
import {render} from '@testing-library/react';
import {JobDetailsMount} from './JobDetailsMount';

type MountConfig = {
    jobId: number;
    isBulkJob: boolean;
    onRelatedJobChange?: (id: number) => void;
    onJobUpdate?: () => void;
};

describe('JobDetailsMount', () => {
    const mount = jest.fn();
    const unmount = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        (window as unknown as {ReactJobDetails: unknown}).ReactJobDetails = {mount, unmount};
    });

    const props = {
        jobId: 1,
        containerId: 'test-detail',
        isUsCustomer: false,
        showToast: jest.fn(),
    };

    const lastConfig = () => mount.mock.calls[mount.mock.calls.length - 1][1] as MountConfig;

    it('renders the container the panel mounts into', () => {
        const {container} = render(<JobDetailsMount {...props}/>);
        expect(container.querySelector('#test-detail')).toBeInTheDocument();
    });

    it('mounts the panel for the job', () => {
        render(<JobDetailsMount {...props}/>);

        expect(mount).toHaveBeenCalledWith('test-detail', expect.objectContaining({jobId: 1}));
    });

    it('defaults isBulkJob to false and forwards it when set', () => {
        render(<JobDetailsMount {...props}/>);
        expect(lastConfig().isBulkJob).toBe(false);

        mount.mockClear();
        render(<JobDetailsMount {...props} containerId="bulk-detail" isBulkJob/>);
        expect(lastConfig().isBulkJob).toBe(true);
    });

    it('does nothing when the panel bundle has not loaded', () => {
        (window as unknown as {ReactJobDetails?: unknown}).ReactJobDetails = undefined;
        expect(() => render(<JobDetailsMount {...props}/>)).not.toThrow();
    });

    describe('staying mounted', () => {
        it('re-mounts into the same container on a job change rather than tearing down', () => {
            // mount() reuses the root for a container, so this re-renders the
            // panel. Unmounting here would reset its selected tab -- the bug the
            // Job Search copy had before these two were unified.
            const {rerender} = render(<JobDetailsMount {...props}/>);
            rerender(<JobDetailsMount {...props} jobId={2}/>);

            expect(mount).toHaveBeenCalledTimes(2);
            expect(lastConfig().jobId).toBe(2);
            expect(unmount).not.toHaveBeenCalled();
        });

        it('does not re-mount when only the callback identities change', () => {
            const {rerender} = render(
                <JobDetailsMount {...props} onJobUpdate={() => undefined}/>,
            );
            expect(mount).toHaveBeenCalledTimes(1);

            rerender(<JobDetailsMount {...props} onJobUpdate={() => undefined}/>);
            expect(mount).toHaveBeenCalledTimes(1);
        });

        it('unmounts only when it leaves the tree', () => {
            const {unmount: unmountTree} = render(<JobDetailsMount {...props}/>);
            expect(unmount).not.toHaveBeenCalled();

            unmountTree();
            expect(unmount).toHaveBeenCalledTimes(1);
        });
    });

    describe('callbacks', () => {
        it('always calls through to the latest callback', () => {
            const first = jest.fn();
            const second = jest.fn();

            const {rerender} = render(<JobDetailsMount {...props} onRelatedJobChange={first}/>);
            rerender(<JobDetailsMount {...props} onRelatedJobChange={second}/>);

            lastConfig().onRelatedJobChange?.(99);

            expect(second).toHaveBeenCalledWith(99);
            expect(first).not.toHaveBeenCalled();
        });

        it('tolerates a host that supplies no callbacks', () => {
            render(<JobDetailsMount {...props}/>);

            expect(() => lastConfig().onRelatedJobChange?.(5)).not.toThrow();
            expect(() => lastConfig().onJobUpdate?.()).not.toThrow();
        });
    });
});
