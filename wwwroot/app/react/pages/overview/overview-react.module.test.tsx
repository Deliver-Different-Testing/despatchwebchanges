/** @jest-environment jest-environment-jsdom */
/**
 * Tests for the overview-react module (mount/unmount/refresh lifecycle).
 *
 * The module calls (window as any).angular.module() at load time,
 * so we set up the mock in a jest.mock factory which runs before imports.
 */

// Mock react-dom/client + set up window.angular (both run before imports via hoisting)
const mockUnmount = jest.fn();
const mockRender = jest.fn();

jest.mock('react-dom/client', () => {
    // Side effect: set up window.angular before the module loads
    (window as any).angular = (window as any).angular || {
        module: jest.fn(() => ({})),
    };

    return {
        createRoot: jest.fn(() => ({
            render: mockRender,
            unmount: mockUnmount,
        })),
    };
});

jest.mock('./OverviewPage', () => ({
    OverviewPage: () => null,
}));

jest.mock('../../theme/muiTheme', () => ({
    getTheme: jest.fn(() => ({})),
}));

jest.mock('../../query', () => ({
    ReactQueryProvider: ({children}: {children: any}) => children,
}));

import {createRoot} from 'react-dom/client';
import {mountOverviewPage, unmountOverviewPage, refreshOverview} from './overview-react.module';

const mockConfig = {
    showToast: {
        showSuccessToast: jest.fn(),
        showWarningToast: jest.fn(),
        showErrorToast: jest.fn(),
        showInfoToast: jest.fn(),
    },
    isUsCustomer: false,
    onOpenJobDetail: jest.fn(),
};

describe('overview-react.module', () => {
    beforeEach(() => {
        unmountOverviewPage();
        document.body.innerHTML = '';
        // Reset mock counters after cleanup
        mockUnmount.mockClear();
        mockRender.mockClear();
        (createRoot as jest.Mock).mockClear();
    });

    describe('mountOverviewPage', () => {
        it('creates a root and renders when container exists', () => {
            const container = document.createElement('div');
            container.id = 'react-overview';
            document.body.appendChild(container);

            mountOverviewPage('react-overview', mockConfig);

            expect(createRoot).toHaveBeenCalledWith(container);
            expect(mockRender).toHaveBeenCalled();
        });

        it('creates a fallback container if not found', () => {
            mountOverviewPage('non-existent-container', mockConfig);

            const fallback = document.getElementById('non-existent-container');
            expect(fallback).toBeTruthy();
            expect(createRoot).toHaveBeenCalled();
            expect(mockRender).toHaveBeenCalled();
        });

        it('reuses existing root on re-mount to same container', () => {
            const container = document.createElement('div');
            container.id = 'react-overview';
            document.body.appendChild(container);

            mountOverviewPage('react-overview', mockConfig);
            mountOverviewPage('react-overview', mockConfig);

            expect(createRoot).toHaveBeenCalledTimes(1);
            expect(mockRender).toHaveBeenCalledTimes(2);
        });

        it('unmounts previous root when mounting to different container', () => {
            const container1 = document.createElement('div');
            container1.id = 'container-1';
            document.body.appendChild(container1);

            const container2 = document.createElement('div');
            container2.id = 'container-2';
            document.body.appendChild(container2);

            mountOverviewPage('container-1', mockConfig);
            mountOverviewPage('container-2', mockConfig);

            expect(mockUnmount).toHaveBeenCalledTimes(1);
            expect(createRoot).toHaveBeenCalledTimes(2);
        });
    });

    describe('unmountOverviewPage', () => {
        it('unmounts the root when mounted', () => {
            const container = document.createElement('div');
            container.id = 'react-overview';
            document.body.appendChild(container);

            mountOverviewPage('react-overview', mockConfig);
            unmountOverviewPage();

            expect(mockUnmount).toHaveBeenCalled();
        });

        it('does nothing when not mounted', () => {
            unmountOverviewPage();
            unmountOverviewPage();
            expect(mockUnmount).not.toHaveBeenCalled();
        });
    });

    describe('refreshOverview', () => {
        it('does nothing when no refresh callback registered', () => {
            expect(() => refreshOverview()).not.toThrow();
        });
    });

    describe('Global registration', () => {
        it('exposes ReactOverview on window', () => {
            expect((window as any).ReactOverview).toBeDefined();
            expect((window as any).ReactOverview.mount).toBe(mountOverviewPage);
            expect((window as any).ReactOverview.unmount).toBe(unmountOverviewPage);
            expect((window as any).ReactOverview.refresh).toBe(refreshOverview);
        });
    });
});
